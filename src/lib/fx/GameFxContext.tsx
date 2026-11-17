"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { GameState, SectorId } from "@/shared/types";
import { STARTING_CASH } from "@/shared/types";
import { SECTOR_IDS } from "@/lib/game/board";
import { portfolioValue } from "@/lib/game/pricing";
import { useRoom } from "@/lib/net/RoomContext";
import {
  cloneSectorIndex,
  coalesceSectorBumps,
  diffGameFx,
  type SectorBumpEvent,
} from "./choreograph";
import type { CashFlyItem, FxEvent } from "./types";
import { playPegWorthFlies } from "./pegWorthFly";
import { fxMs } from "@/lib/prefs/gamePrefs";
import { FX_TIMING } from "./types";
import { playCashDelta, playSfx, unlockSfx } from "@/lib/sfx/sounds";

type SectorBump = SectorBumpEvent;

type HoldingsSnap = GameState["holdings"];

type GameFxValue = {
  fxBusy: boolean;
  displayCash: Record<string, number>;
  cashFlash: Record<string, "up" | "down" | null>;
  cashFlies: CashFlyItem[];
  landPulseTile: number | null;
  /** Peg track levels (animate during sector bumps). */
  sectorVisual: Record<SectorId, number>;
  /**
   * Seat net-worth pricing levels — lag behind pegs until +/- chips land,
   * so the fly delivers the change instead of the seat tweening alone.
   */
  seatSectorVisual: Record<SectorId, number>;
  /**
   * Pre-trade holdings while cash is still frozen. Stops seat total from
   * counting newly bought shares before the purchase cash lands (and the
   * reverse on sells).
   */
  holdingsVisual: HoldingsSnap | null;
  sectorBumpId: SectorId | null;
  sectorBumpDir: 1 | -1 | 0;
  focusTile: number | null;
  bankruptPlayerId: string | null;
  winCelebrate: boolean;
  /**
   * Gate board FX while a card owns the screen.
   * true  = park cash + pegs (play after reveal)
   * false = flush: cash flies → sector pegs
   */
  setPresentationHold: (hold: boolean) => void;
  /**
   * Settle card already animated cash chips — apply HUD cash now and
   * drop parked cashDelta so flush will not replay the seat floats.
   */
  absorbHeldCash: () => void;
};

function cloneHoldings(holdings: HoldingsSnap): HoldingsSnap {
  return holdings.map((h) => ({ ...h }));
}

const GameFxContext = createContext<GameFxValue | null>(null);

function emptyCash(game: GameState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of game.players) out[p.id] = p.cash;
  return out;
}

function zeroSectors(): Record<SectorId, number> {
  const o = {} as Record<SectorId, number>;
  for (const s of SECTOR_IDS) o[s] = 0;
  return o;
}

function isSectorBump(e: FxEvent): e is SectorBump {
  return e.type === "sectorBump";
}

function isCashDelta(e: FxEvent): boolean {
  return e.type === "cashDelta";
}

/** Parked until presentation hold releases (keeps card sequence clean). */
function isHoldParked(e: FxEvent): boolean {
  return e.type === "cashDelta" || e.type === "sectorBump";
}

function isCashInfoPending(game: GameState | null): boolean {
  const p = game?.pending;
  if (p?.type !== "info") return false;
  return p.cashKind != null || (p.amount != null && p.amount !== 0);
}

function isCardPending(game: GameState | null): boolean {
  const t = game?.pending?.type;
  return t === "price_reaction" || t === "regime" || isCashInfoPending(game);
}

/** Detect a new on-screen card even when pending.type stays "info". */
function pendingCardKey(game: GameState | null): string {
  const p = game?.pending;
  if (!p) return "";
  if (p.type === "info") {
    return `info:${p.title}:${p.amount ?? 0}:${p.cashKind ?? ""}:${p.bundle?.length ?? 0}:${p.tileIndex ?? ""}`;
  }
  if (p.type === "price_reaction") {
    return `pr:${p.card.id}:${p.order.tileIndex}:${p.order.side}`;
  }
  if (p.type === "regime") {
    return `regime:${p.card.id}`;
  }
  return p.type;
}

/** Restart / new match with same seat ids — don't animate leftover cash from the prior game. */
function isFreshMatch(prev: GameState, next: GameState): boolean {
  if (next.turnIndex !== 0 || next.holdings.length > 0) return false;
  if (
    !next.players.every(
      (p) =>
        p.cash === STARTING_CASH &&
        p.position === 0 &&
        p.turnsDone === 0 &&
        !p.bankrupt,
    )
  ) {
    return false;
  }
  if (prev.players.length !== next.players.length) return false;
  if (!prev.players.every((p, i) => p.id === next.players[i]?.id)) return false;
  const prevAlreadyFresh =
    prev.holdings.length === 0 &&
    prev.turnIndex === 0 &&
    prev.players.every(
      (p) => p.cash === STARTING_CASH && p.turnsDone === 0 && p.position === 0,
    );
  return !prevAlreadyFresh;
}

function cashEqual(
  a: Record<string, number>,
  b: Record<string, number>,
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if ((a[k] ?? 0) !== (b[k] ?? 0)) return false;
  }
  return true;
}

function sectorsEqual(
  a: Record<SectorId, number>,
  b: Record<SectorId, number>,
): boolean {
  for (const s of SECTOR_IDS) {
    if ((a[s] ?? 0) !== (b[s] ?? 0)) return false;
  }
  return true;
}

export function GameFxProvider({ children }: { children: ReactNode }) {
  const { snapshot, diceRolling, tokensMoving } = useRoom();
  const game = snapshot?.game ?? null;
  const movementHold = diceRolling || tokensMoving;

  const [fxBusy, setFxBusy] = useState(false);
  const [displayCash, setDisplayCash] = useState<Record<string, number>>({});
  const [cashFlash, setCashFlash] = useState<
    Record<string, "up" | "down" | null>
  >({});
  const [cashFlies, setCashFlies] = useState<CashFlyItem[]>([]);
  const [landPulseTile, setLandPulseTile] = useState<number | null>(null);
  const [sectorVisual, setSectorVisual] =
    useState<Record<SectorId, number>>(zeroSectors);
  const [seatSectorVisual, setSeatSectorVisual] =
    useState<Record<SectorId, number>>(zeroSectors);
  const [holdingsVisual, setHoldingsVisual] = useState<HoldingsSnap | null>(
    null,
  );
  const [sectorBumpId, setSectorBumpId] = useState<SectorId | null>(null);
  const [sectorBumpDir, setSectorBumpDir] = useState<1 | -1 | 0>(0);
  const [bankruptPlayerId, setBankruptPlayerId] = useState<string | null>(null);
  const [winCelebrate, setWinCelebrate] = useState(false);
  const [presentationHold, setPresentationHoldState] = useState(false);

  const prevGame = useRef<GameState | null>(null);
  const queue = useRef<FxEvent[]>([]);
  const heldSectors = useRef<SectorBump[]>([]);
  /** Cash (and similar) parked with the card hold — flushed before pegs. */
  const heldAside = useRef<FxEvent[]>([]);
  const presentationHoldRef = useRef(false);
  /** HUD release after mill/news — keeps pegs free while pending still set. */
  const sectorsReleasedRef = useRef(false);
  const movementHoldRef = useRef(movementHold);
  const gameRef = useRef(game);
  const flyId = useRef(0);
  const sleepTimers = useRef<number[]>([]);
  const wakeResolve = useRef<(() => void) | null>(null);
  const wakePending = useRef(false);
  const pumping = useRef(false);
  const fxBusyRef = useRef(false);
  const displayCashRef = useRef(displayCash);
  const sectorVisualRef = useRef(sectorVisual);
  const seatSectorVisualRef = useRef(seatSectorVisual);
  /** Avoid re-syncing idle visuals every wake. */
  const idleSyncedRef = useRef(true);

  useEffect(() => {
    movementHoldRef.current = movementHold;
    gameRef.current = game;
    displayCashRef.current = displayCash;
    sectorVisualRef.current = sectorVisual;
    seatSectorVisualRef.current = seatSectorVisual;
  }, [movementHold, game, displayCash, sectorVisual, seatSectorVisual]);

  const clearSleepTimers = () => {
    for (const t of sleepTimers.current) window.clearTimeout(t);
    sleepTimers.current = [];
  };

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      const t = window.setTimeout(resolve, ms);
      sleepTimers.current.push(t);
    });

  const wakePump = useCallback(() => {
    wakePending.current = true;
    const resolve = wakeResolve.current;
    if (resolve) {
      wakeResolve.current = null;
      resolve();
    }
  }, []);

  const sectorsGated = useCallback(
    () => presentationHoldRef.current && !sectorsReleasedRef.current,
    [],
  );

  const setBusy = useCallback((busy: boolean) => {
    if (fxBusyRef.current === busy) return;
    fxBusyRef.current = busy;
    setFxBusy(busy);
  }, []);

  /**
   * Park new pegs while hold is on — never steal leftover bumps already
   * in the play queue (prior card still draining).
   */
  const parkOrQueueSectors = useCallback(
    (sectors: SectorBump[]) => {
      if (!sectors.length) return;
      if (sectorsGated()) {
        heldSectors.current = coalesceSectorBumps([
          ...heldSectors.current,
          ...sectors,
        ]);
        return;
      }
      const existing = [
        ...heldSectors.current,
        ...queue.current.filter(isSectorBump),
      ];
      heldSectors.current = [];
      queue.current = queue.current.filter((e) => !isSectorBump(e));
      queue.current.push(...coalesceSectorBumps([...existing, ...sectors]));
    },
    [sectorsGated],
  );

  /** Flush order: cash flies → sector pegs → other parked beats. */
  const flushHeld = useCallback(() => {
    const aside = heldAside.current;
    heldAside.current = [];
    const cash = aside.filter(isCashDelta);
    const other = aside.filter((e) => !isCashDelta(e));
    const sectors = coalesceSectorBumps(heldSectors.current);
    heldSectors.current = [];
    if (!cash.length && !sectors.length && !other.length) return false;
    queue.current.push(...cash, ...sectors, ...other);
    idleSyncedRef.current = false;
    return true;
  }, []);

  const syncIdleVisual = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    if (
      queue.current.length > 0 ||
      heldSectors.current.length > 0 ||
      heldAside.current.length > 0 ||
      pumping.current
    ) {
      return;
    }
    // Card still on screen — never snap pegs to post-card levels early.
    if (presentationHoldRef.current && !sectorsReleasedRef.current) {
      setBusy(true);
      return;
    }
    if (idleSyncedRef.current) {
      setBusy(false);
      return;
    }
    idleSyncedRef.current = true;
    const nextCash = emptyCash(g);
    const nextSectors = cloneSectorIndex(g);
    if (!cashEqual(displayCashRef.current, nextCash)) {
      setDisplayCash(nextCash);
    }
    if (!sectorsEqual(sectorVisualRef.current, nextSectors)) {
      setSectorVisual(nextSectors);
      setSeatSectorVisual(nextSectors);
    }
    setHoldingsVisual(null);
    setSectorBumpId(null);
    setSectorBumpDir(0);
    setBusy(false);
  }, [setBusy]);

  const enqueue = useCallback(
    (events: FxEvent[]) => {
      if (!events.length) return;
      const sectors = events.filter(isSectorBump);
      const rest = events.filter((e) => !isSectorBump(e));

      idleSyncedRef.current = false;

      if (sectorsGated()) {
        // Park cash with the card; landPulse may still play (token already there).
        const park = rest.filter(isHoldParked);
        const live = rest.filter((e) => !isHoldParked(e));
        if (park.length) heldAside.current.push(...park);
        if (live.length) queue.current.push(...live);
      } else if (rest.length) {
        queue.current.push(...rest);
      }
      if (sectors.length) parkOrQueueSectors(sectors);

      if (sectors.length || rest.length) {
        setBusy(true);
        wakePump();
      }
    },
    [parkOrQueueSectors, sectorsGated, setBusy, wakePump],
  );

  const absorbHeldCash = useCallback(() => {
    const parked = heldAside.current.filter(isCashDelta) as Extract<
      FxEvent,
      { type: "cashDelta" }
    >[];
    heldAside.current = heldAside.current.filter((e) => !isCashDelta(e));
    // Also strip any cash still waiting in the live queue (avoid double fly).
    queue.current = queue.current.filter((e) => !isCashDelta(e));
    const g = gameRef.current;
    if (!g) return;

    // Apply this card's deltas onto the frozen seat readout so each settle
    // matches its own fly (not a snap that already includes later fees).
    setDisplayCash((prev) => {
      const next: Record<string, number> = { ...prev };
      for (const p of g.players) {
        if (next[p.id] == null) next[p.id] = p.cash;
      }
      if (parked.length === 0) {
        return emptyCash(g);
      }
      for (const ev of parked) {
        next[ev.playerId] = (next[ev.playerId] ?? 0) + ev.delta;
      }
      return next;
    });

    // Unlock live holdings + price seats at post-card levels together so a
    // buy is NW-neutral aside from the flat order fee (and true book MTM).
    setHoldingsVisual(null);
    const finalLevels = cloneSectorIndex(g);
    setSeatSectorVisual(finalLevels);
    seatSectorVisualRef.current = finalLevels;

    if (parked.length) {
      const flash: Record<string, "up" | "down" | null> = {};
      for (const ev of parked) {
        flash[ev.playerId] = ev.delta >= 0 ? "up" : "down";
      }
      setCashFlash((f) => ({ ...f, ...flash }));
      window.setTimeout(() => {
        setCashFlash((f) => {
          const next = { ...f };
          for (const id of Object.keys(flash)) next[id] = null;
          return next;
        });
      }, fxMs(FX_TIMING.settleCashFlyMs));
    }
  }, []);

  const setPresentationHold = useCallback(
    (hold: boolean) => {
      const was = presentationHoldRef.current;
      if (was === hold) {
        if (
          !hold &&
          (heldSectors.current.length || heldAside.current.length)
        ) {
          flushHeld();
          setBusy(true);
          wakePump();
        }
        return;
      }

      presentationHoldRef.current = hold;
      setPresentationHoldState(hold);

      if (!hold) {
        sectorsReleasedRef.current = true;
        if (flushHeld()) setBusy(true);
        wakePump();
      } else {
        sectorsReleasedRef.current = false;
      }
    },
    [flushHeld, setBusy, wakePump],
  );

  // Diff snapshots → queue (never cancels the pump).
  useEffect(() => {
    if (!game) {
      prevGame.current = null;
      heldSectors.current = [];
      heldAside.current = [];
      queue.current = [];
      presentationHoldRef.current = false;
      sectorsReleasedRef.current = false;
      idleSyncedRef.current = true;
      queueMicrotask(() => {
        setPresentationHoldState(false);
        setDisplayCash({});
        setCashFlash({});
        setCashFlies([]);
        setHoldingsVisual(null);
        setBusy(false);
      });
      return;
    }

    const prev = prevGame.current;
    if (!prev) {
      const opening = cloneSectorIndex(game);
      const cardPending = isCardPending(game);
      prevGame.current = game;
      if (cardPending) {
        presentationHoldRef.current = true;
        sectorsReleasedRef.current = false;
      }
      queueMicrotask(() => {
        setDisplayCash(emptyCash(game));
        setSectorVisual(opening);
        setSeatSectorVisual(opening);
        setHoldingsVisual(null);
        if (cardPending) setPresentationHoldState(true);
      });
      enqueue(diffGameFx(null, game));
      return;
    }

    if (prev === game) return;

    // Settings restart (same bot/player ids): hard-reset FX so HUD doesn't
    // keep the prior match's cash / queued deltas.
    if (isFreshMatch(prev, game)) {
      clearSleepTimers();
      queue.current = [];
      heldSectors.current = [];
      heldAside.current = [];
      pumping.current = false;
      presentationHoldRef.current = false;
      sectorsReleasedRef.current = false;
      idleSyncedRef.current = true;
      const fresh = cloneSectorIndex(game);
      const cardPending = isCardPending(game);
      prevGame.current = game;
      if (cardPending) {
        presentationHoldRef.current = true;
        sectorsReleasedRef.current = false;
      }
      queueMicrotask(() => {
        setPresentationHoldState(false);
        setCashFlies([]);
        setCashFlash({});
        setLandPulseTile(null);
        setBankruptPlayerId(null);
        setSectorBumpId(null);
        setSectorBumpDir(0);
        setDisplayCash(emptyCash(game));
        setSectorVisual(fresh);
        setSeatSectorVisual(fresh);
        setHoldingsVisual(null);
        setBusy(false);
        if (cardPending) setPresentationHoldState(true);
      });
      enqueue(diffGameFx(null, game));
      wakePump();
      return;
    }

    // Arm gate on each new card (including info → info: START then tax/fee).
    const becameCard =
      isCardPending(game) &&
      pendingCardKey(prev) !== pendingCardKey(game);
    if (becameCard) {
      presentationHoldRef.current = true;
      sectorsReleasedRef.current = false;
      queueMicrotask(() => setPresentationHoldState(true));
      const parkedCash = queue.current.filter(isCashDelta);
      if (parkedCash.length) {
        queue.current = queue.current.filter((e) => !isCashDelta(e));
        heldAside.current.push(...parkedCash);
      }
    }

    // Pending cleared early (safety dismiss): do NOT release hold here.
    // HUD owns release after shuffle so cash/pegs never play under the card.

    const events = diffGameFx(prev, game);
    const freezesCash = events.some((e) => e.type === "cashDelta");
    const freezesSectors = events.some(isSectorBump);
    if (freezesCash || freezesSectors) {
      const frozen = freezesSectors ? cloneSectorIndex(prev) : null;
      queueMicrotask(() => {
        if (freezesCash) setDisplayCash(emptyCash(prev));
        if (frozen) {
          setSectorVisual(frozen);
          setSeatSectorVisual(frozen);
        }
        if (freezesCash || freezesSectors) {
          setHoldingsVisual(cloneHoldings(prev.holdings));
        }
      });
      if (frozen) {
        seatSectorVisualRef.current = frozen;
        idleSyncedRef.current = false;
      }
    }
    prevGame.current = game;
    enqueue(events);
  }, [game, enqueue, flushHeld, setBusy, wakePump]);

  const playOne = useCallback(async (ev: FxEvent) => {
    switch (ev.type) {
      case "cashDelta": {
        playCashDelta(ev.delta);
        const id = `fly-${flyId.current++}`;
        setCashFlies((list) => [
          ...list,
          {
            id,
            playerId: ev.playerId,
            delta: ev.delta,
            createdAt: Date.now(),
          },
        ]);
        setCashFlash((f) => ({
          ...f,
          [ev.playerId]: ev.delta >= 0 ? "up" : "down",
        }));
        await sleep(fxMs(FX_TIMING.cashFlyMs));
        setDisplayCash((c) => ({
          ...c,
          [ev.playerId]: (c[ev.playerId] ?? 0) + ev.delta,
        }));
        setCashFlies((list) => list.filter((x) => x.id !== id));
        setCashFlash((f) => ({ ...f, [ev.playerId]: null }));
        break;
      }
      case "sectorBump": {
        // Continue from the peg's current visual — never rewind (that looked
        // like a jerk back then forward when visual was already at `to`).
        let cur = sectorVisualRef.current[ev.sector] ?? ev.from;
        if (cur === ev.to) {
          // Seat may already be snapped to final on cash absorb — keep it there.
          setSeatSectorVisual((v) => {
            if ((v[ev.sector] ?? 0) === ev.to) return v;
            const next = { ...v, [ev.sector]: ev.to };
            seatSectorVisualRef.current = next;
            return next;
          });
          break;
        }

        const dir = Math.sign(ev.to - cur) as 1 | -1 | 0;
        if (dir === 0) break;
        playSfx(dir > 0 ? "pegUp" : "pegDown", { volume: 0.7 });

        const levelsStart = {
          ...sectorVisualRef.current,
          [ev.sector]: cur,
        };
        // If seats already price this sector at `to` (cash absorb snapped
        // them), board pegs still animate but seat totals stay put.
        const seatAlreadyPriced =
          (seatSectorVisualRef.current[ev.sector] ?? 0) === ev.to;

        setSectorBumpId(ev.sector);
        setSectorBumpDir(dir);
        while (cur !== ev.to) {
          cur += dir;
          const next = cur;
          setSectorVisual((v) => ({ ...v, [ev.sector]: next }));
          await sleep(fxMs(FX_TIMING.sectorStepMs));
        }

        const levelsEnd = { ...levelsStart, [ev.sector]: ev.to };
        if (!seatAlreadyPriced) {
          const g = gameRef.current;
          const deltas: {
            playerId: string;
            delta: number;
            seatIndex: number;
          }[] = [];
          if (g) {
            g.players.forEach((p, seatIndex) => {
              if (p.bankrupt) return;
              const delta =
                portfolioValue(g, p.id, levelsEnd) -
                portfolioValue(g, p.id, levelsStart);
              if (delta === 0) return;
              deltas.push({ playerId: p.id, delta, seatIndex });
            });
          }

          if (deltas.length) {
            await sleep(fxMs(FX_TIMING.pegWorthPauseMs));
            setCashFlash((f) => {
              const nextFlash = { ...f };
              for (const d of deltas) {
                nextFlash[d.playerId] = d.delta >= 0 ? "up" : "down";
              }
              return nextFlash;
            });
            await playPegWorthFlies(ev.sector, deltas);
            setCashFlash((f) => {
              const nextFlash = { ...f };
              for (const d of deltas) nextFlash[d.playerId] = null;
              return nextFlash;
            });
          }
          setSeatSectorVisual((v) => {
            const next = { ...v, [ev.sector]: ev.to };
            seatSectorVisualRef.current = next;
            return next;
          });
        }

        setSectorBumpId(null);
        setSectorBumpDir(0);
        if (queue.current.some(isSectorBump)) {
          await sleep(fxMs(FX_TIMING.sectorGapMs));
        }
        break;
      }
      case "landPulse": {
        // Same card family as company / SEC / ETF deed reveals.
        playSfx("cardFlip", { volume: 1 });
        setLandPulseTile(ev.tileIndex);
        await sleep(fxMs(FX_TIMING.landPulseMs));
        setLandPulseTile(null);
        break;
      }
      case "deckDraw":
        playSfx("cardDraw");
        break;
      case "bankrupt": {
        playSfx("bankrupt");
        setBankruptPlayerId(ev.playerId);
        await sleep(fxMs(FX_TIMING.bankruptMs));
        setBankruptPlayerId(null);
        break;
      }
      case "win": {
        playSfx("win");
        setWinCelebrate(true);
        await sleep(fxMs(FX_TIMING.winMs));
        setWinCelebrate(false);
        break;
      }
      case "opening": {
        playSfx("open");
        await sleep(fxMs(FX_TIMING.openingMs));
        break;
      }
    }
  }, []);

  useEffect(() => {
    const unlock = () => unlockSfx();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // One durable pump for the provider lifetime.
  useEffect(() => {
    let alive = true;

    const waitForWork = () =>
      new Promise<void>((resolve) => {
        if (wakePending.current) {
          wakePending.current = false;
          resolve();
          return;
        }
        wakeResolve.current = () => {
          wakePending.current = false;
          resolve();
        };
      });

    const hasPlayable = () => {
      if (
        !sectorsGated() &&
        (heldSectors.current.length || heldAside.current.length)
      ) {
        flushHeld();
      }
      if (movementHoldRef.current) return false;
      // Leftover pre-hold pegs in the queue still play while a new card holds.
      return queue.current.length > 0;
    };

    const takePlayable = (): FxEvent | null => {
      if (movementHoldRef.current) return null;
      return queue.current.shift() ?? null;
    };

    const run = async () => {
      while (alive) {
        if (!hasPlayable()) {
          pumping.current = false;
          if (
            !heldSectors.current.length &&
            !heldAside.current.length &&
            !queue.current.length
          ) {
            syncIdleVisual();
          } else {
            setBusy(
              presentationHoldRef.current ||
                heldSectors.current.length > 0 ||
                heldAside.current.length > 0 ||
                queue.current.length > 0,
            );
          }
          if (hasPlayable()) {
            wakePending.current = false;
            continue;
          }
          await waitForWork();
          continue;
        }

        const next = takePlayable();
        if (!next) {
          await waitForWork();
          continue;
        }

        pumping.current = true;
        idleSyncedRef.current = false;
        setBusy(true);
        await playOne(next);
      }
    };

    void run();

    return () => {
      alive = false;
      clearSleepTimers();
      wakePump();
    };
    // Stable forever — wake via wakePump / enqueue only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    wakePump();
  }, [movementHold, wakePump]);

  useEffect(() => {
    if (!fxBusy && !presentationHold) return;
    const t = window.setTimeout(() => {
      clearSleepTimers();
      queue.current = [];
      heldSectors.current = [];
      heldAside.current = [];
      pumping.current = false;
      presentationHoldRef.current = false;
      sectorsReleasedRef.current = true;
      idleSyncedRef.current = false;
      setPresentationHoldState(false);
      setBusy(false);
      setLandPulseTile(null);
      setCashFlies([]);
      setBankruptPlayerId(null);
      setSectorBumpId(null);
      setSectorBumpDir(0);
      const g = gameRef.current;
      if (g) {
        setDisplayCash(emptyCash(g));
        const snap = cloneSectorIndex(g);
        setSectorVisual(snap);
        setSeatSectorVisual(snap);
        setHoldingsVisual(null);
      }
      idleSyncedRef.current = true;
      wakePump();
    }, 45000);
    return () => window.clearTimeout(t);
  }, [fxBusy, presentationHold, setBusy, wakePump]);

  const focusTile =
    game?.pending?.type === "trade" ? (game.pending.focusTile ?? null) : null;

  const value = useMemo<GameFxValue>(
    () => ({
      fxBusy: fxBusy || presentationHold,
      displayCash,
      cashFlash,
      cashFlies,
      landPulseTile,
      sectorVisual,
      seatSectorVisual,
      holdingsVisual,
      sectorBumpId,
      sectorBumpDir,
      focusTile,
      bankruptPlayerId,
      winCelebrate,
      setPresentationHold,
      absorbHeldCash,
    }),
    [
      fxBusy,
      presentationHold,
      displayCash,
      cashFlash,
      cashFlies,
      landPulseTile,
      sectorVisual,
      seatSectorVisual,
      holdingsVisual,
      sectorBumpId,
      sectorBumpDir,
      focusTile,
      bankruptPlayerId,
      winCelebrate,
      setPresentationHold,
      absorbHeldCash,
    ],
  );

  return (
    <GameFxContext.Provider value={value}>{children}</GameFxContext.Provider>
  );
}

export function useGameFx() {
  const ctx = useContext(GameFxContext);
  if (!ctx) throw new Error("useGameFx outside GameFxProvider");
  return ctx;
}

export function useGameFxOptional(): GameFxValue | null {
  return useContext(GameFxContext);
}
