"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FX_TIMING, type FxDeckKind } from "@/lib/fx/types";
import { fxMs } from "@/lib/prefs/gamePrefs";
import { shuffleDeckPile } from "@/components/fx/DeckDrawPortal";
import type {
  ClientMessage,
  GameState,
  PendingDecision,
  RegimeCard,
} from "@/shared/types";
import {
  type DeckStage,
  holdingsKey,
  isDeckBusy,
} from "./deckStage";

export type TradeSnap = {
  tradesLeft: number;
  focusTile?: number;
  actorId: string;
  watchMode: boolean;
  actorName?: string;
};

type UseDeckStageArgs = {
  game: GameState | null;
  playerId: string | null;
  currentId: string | undefined;
  pending: PendingDecision | null | undefined;
  revealPending: boolean;
  sectorBumpId: string | null;
  fxBusy: boolean;
  setPresentationHold: ((v: boolean) => void) | undefined;
  profilePinned: boolean;
  browseHold: boolean;
  send: (msg: ClientMessage) => void;
  setProfileId: React.Dispatch<React.SetStateAction<string | null>>;
};

export function useDeckStage({
  game,
  playerId,
  currentId,
  pending,
  revealPending,
  sectorBumpId,
  fxBusy,
  setPresentationHold,
  profilePinned,
  browseHold,
  send,
  setProfileId,
}: UseDeckStageArgs) {
  const [deckStage, setDeckStage] = useState<DeckStage>("idle");
  const [deckKey, setDeckKey] = useState<string | null>(null);
  const [activeDeck, setActiveDeck] = useState<FxDeckKind>("pr");
  const [newsCard, setNewsCard] = useState<RegimeCard | null>(null);
  const [tradeReveal, setTradeReveal] = useState(false);
  const [awaitFxIdle, setAwaitFxIdle] = useState(false);
  const [lastTrade, setLastTrade] = useState<TradeSnap | null>(null);

  const deckStageRef = useRef<DeckStage>("idle");
  const dismissAfterOutro = useRef(false);
  const playedDeckKeyRef = useRef<string | null>(null);
  const prevPendingType = useRef<string | null>(null);
  const lastTradeRef = useRef<TradeSnap | null>(null);
  const prevHoldings = useRef<string>("");
  const autoProfileTimer = useRef<number | null>(null);
  const stageTimer = useRef<number | null>(null);
  const tradeActorForSettle = useRef<string | null>(null);
  const settleAfterRef = useRef<"mill" | "dismiss">("mill");
  const sawFxBusyAfterRelease = useRef(false);
  const profilePinnedRef = useRef(false);
  const browseHoldRef = useRef(false);

  const clearStageTimer = useCallback(() => {
    if (stageTimer.current) {
      window.clearTimeout(stageTimer.current);
      stageTimer.current = null;
    }
  }, []);

  useEffect(() => {
    profilePinnedRef.current = profilePinned;
  }, [profilePinned]);

  useEffect(() => {
    browseHoldRef.current = browseHold;
  }, [browseHold]);

  useEffect(() => {
    deckStageRef.current = deckStage;
  }, [deckStage]);

  useEffect(() => {
    lastTradeRef.current = lastTrade;
  }, [lastTrade]);

  const captureLastTrade = useCallback((snap: TradeSnap) => {
    setLastTrade(snap);
  }, []);

  const ensureTradeActor = useCallback((id: string | null | undefined) => {
    if (!id) return;
    if (!tradeActorForSettle.current) tradeActorForSettle.current = id;
  }, []);

  const needsDeck =
    pending?.type === "price_reaction" || pending?.type === "regime";
  const deckKind: FxDeckKind =
    pending?.type === "price_reaction" ? "pr" : "regime";
  const pendingDeckKey =
    pending?.type === "price_reaction"
      ? `pr:${pending.card.id}:${pending.settledShares}`
      : pending?.type === "regime"
        ? `news:${pending.card.id}`
        : null;

  useEffect(() => {
    if (!revealPending || !needsDeck || !pendingDeckKey) {
      if (
        playedDeckKeyRef.current == null &&
        (deckStageRef.current === "showing" ||
          deckStageRef.current === "drawing" ||
          deckStageRef.current === "milling" ||
          deckStageRef.current === "closingTrade" ||
          deckStageRef.current === "settling" ||
          deckStageRef.current === "portfolio")
      ) {
        if (
          deckStageRef.current === "drawing" &&
          activeDeck === "regime" &&
          newsCard
        ) {
          dismissAfterOutro.current = false;
          return;
        }
        dismissAfterOutro.current = false;
        clearStageTimer();
        const actor =
          !profilePinnedRef.current &&
          !browseHoldRef.current &&
          tradeActorForSettle.current
            ? tradeActorForSettle.current
            : null;
        queueMicrotask(() => {
          setTradeReveal(false);
          if (actor) {
            setProfileId((id) => (id === actor ? null : id));
          }
          setPresentationHold?.(false);
          setAwaitFxIdle(false);
          setNewsCard(null);
          setDeckStage("returning");
        });
        return;
      }
      if (
        deckStageRef.current === "idle" ||
        deckStageRef.current === "shuffling" ||
        deckStageRef.current === "waiting"
      ) {
        playedDeckKeyRef.current = null;
        queueMicrotask(() => setDeckKey(null));
      }
      return;
    }
    if (playedDeckKeyRef.current === pendingDeckKey) {
      return;
    }
    if (deckKey !== pendingDeckKey) {
      const fromTrade = prevPendingType.current === "trade";
      const actor =
        lastTradeRef.current?.actorId ?? currentId ?? playerId;
      queueMicrotask(() => {
        setDeckKey(pendingDeckKey);
        setActiveDeck(deckKind);
        dismissAfterOutro.current = false;
        setAwaitFxIdle(false);
        clearStageTimer();
        setTradeReveal(false);
        setPresentationHold?.(true);
        if (deckKind === "pr") {
          setNewsCard(null);
          tradeActorForSettle.current = actor ?? null;
          if (fromTrade) {
            setDeckStage("closingTrade");
            stageTimer.current = window.setTimeout(() => {
              setDeckStage("settling");
              stageTimer.current = null;
            }, fxMs(FX_TIMING.tradeCloseMs));
          } else {
            setDeckStage("settling");
          }
        } else if (pending?.type === "regime") {
          setNewsCard(pending.card);
          setDeckStage(sectorBumpId ? "idle" : "drawing");
        }
      });
    } else if (
      deckKind === "regime" &&
      deckStageRef.current === "idle" &&
      !sectorBumpId &&
      playedDeckKeyRef.current !== pendingDeckKey
    ) {
      queueMicrotask(() => setDeckStage("drawing"));
    }
  }, [
    revealPending,
    needsDeck,
    pendingDeckKey,
    deckKey,
    deckKind,
    clearStageTimer,
    currentId,
    playerId,
    setPresentationHold,
    sectorBumpId,
    activeDeck,
    newsCard,
    pending,
    setProfileId,
  ]);

  useEffect(() => {
    prevPendingType.current = pending?.type ?? null;
  }, [pending?.type]);

  useEffect(() => {
    return () => clearStageTimer();
  }, [clearStageTimer]);

  const finishOutro = useCallback(() => {
    const shouldSend = dismissAfterOutro.current;
    dismissAfterOutro.current = false;
    setDeckStage("idle");
    setNewsCard(null);
    setTradeReveal(false);
    tradeActorForSettle.current = null;
    if (shouldSend) send({ type: "dismiss" });
  }, [send]);

  const finishDeckReveal = useCallback(
    (deck: FxDeckKind) => {
      dismissAfterOutro.current = true;
      playedDeckKeyRef.current = deckKey;
      sawFxBusyAfterRelease.current = false;
      setAwaitFxIdle(false);
      setDeckStage("shuffling");
      window.setTimeout(() => {
        shuffleDeckPile(deck, () => {
          setPresentationHold?.(false);
          setDeckStage("waiting");
          window.setTimeout(() => setAwaitFxIdle(true), 48);
          window.setTimeout(() => {
            if (!sawFxBusyAfterRelease.current) {
              sawFxBusyAfterRelease.current = true;
              setAwaitFxIdle(true);
            }
          }, 160);
        });
      }, fxMs(FX_TIMING.prShuffleDelayMs));
    },
    [deckKey, setPresentationHold],
  );

  useEffect(() => {
    if (awaitFxIdle && fxBusy) sawFxBusyAfterRelease.current = true;
  }, [awaitFxIdle, fxBusy]);

  useEffect(() => {
    if (!awaitFxIdle) return;
    if (deckStage !== "waiting") return;
    if (!dismissAfterOutro.current) return;
    if (fxBusy) return;
    if (!sawFxBusyAfterRelease.current) return;
    setAwaitFxIdle(false);
    finishOutro();
  }, [awaitFxIdle, deckStage, fxBusy, finishOutro]);

  const onNewsDone = useCallback(() => {
    finishDeckReveal("regime");
  }, [finishDeckReveal]);

  const onMillDone = useCallback(() => {
    finishDeckReveal("pr");
  }, [finishDeckReveal]);

  const onSettleDone = useCallback(
    (after: "mill" | "dismiss" = "mill") => {
      settleAfterRef.current = after;
      const actor =
        tradeActorForSettle.current ?? currentId ?? playerId ?? null;
      if (!actor) {
        if (after === "mill") setDeckStage("milling");
        else {
          setDeckStage("idle");
          send({ type: "dismiss" });
        }
        return;
      }
      if (profilePinnedRef.current || browseHoldRef.current) {
        if (after === "mill") setDeckStage("milling");
        else {
          setDeckStage("idle");
          send({ type: "dismiss" });
        }
        return;
      }
      setTradeReveal(true);
      setProfileId(actor);
      setDeckStage("portfolio");
      clearStageTimer();
      stageTimer.current = window.setTimeout(() => {
        setTradeReveal(false);
        if (!profilePinnedRef.current && !browseHoldRef.current) {
          setProfileId((id) => (id === actor ? null : id));
        }
        if (after === "mill") {
          setDeckStage("milling");
        } else {
          setDeckStage("idle");
          send({ type: "dismiss" });
        }
        stageTimer.current = null;
      }, fxMs(FX_TIMING.portfolioRevealMs));
    },
    [clearStageTimer, currentId, playerId, send, setProfileId],
  );

  const closePortfolioEarly = useCallback(() => {
    if (deckStageRef.current !== "portfolio") {
      return false;
    }
    clearStageTimer();
    setTradeReveal(false);
    setProfileId(null);
    if (settleAfterRef.current === "dismiss") {
      setDeckStage("idle");
      send({ type: "dismiss" });
    } else {
      setDeckStage("milling");
    }
    return true;
  }, [clearStageTimer, send, setProfileId]);

  const onReturnDone = useCallback(() => {
    dismissAfterOutro.current = false;
    setDeckStage("shuffling");
    shuffleDeckPile(activeDeck, () => {
      setDeckStage("idle");
    });
  }, [activeDeck]);

  useEffect(() => {
    if (!game || !revealPending) return;
    const key = holdingsKey(game.holdings);
    const stampPending =
      pending?.type === "info" && pending.cashKind != null;
    if (
      pending?.type === "price_reaction" ||
      pending?.type === "regime" ||
      pending?.type === "trade" ||
      stampPending ||
      isDeckBusy(deckStage)
    ) {
      prevHoldings.current = key;
      return;
    }
    const prev = prevHoldings.current;
    prevHoldings.current = key;
    if (
      !prev ||
      prev === key ||
      profilePinnedRef.current ||
      browseHoldRef.current
    ) {
      return;
    }

    const prevMap = new Map(
      prev.split("|").filter(Boolean).map((row) => {
        const [ownerId, tileIndex, shares] = row.split(":");
        return [`${ownerId}:${tileIndex}`, Number(shares)];
      }),
    );
    let changedOwner: string | null = null;
    for (const h of game.holdings) {
      const k = `${h.ownerId}:${h.tileIndex}`;
      if ((prevMap.get(k) ?? 0) !== h.shares) {
        changedOwner = h.ownerId;
        break;
      }
    }
    if (!changedOwner) {
      for (const [k, shares] of prevMap) {
        const [ownerId, tileIndex] = k.split(":");
        const still = game.holdings.find(
          (h) => h.ownerId === ownerId && String(h.tileIndex) === tileIndex,
        );
        if (!still && shares > 0) {
          changedOwner = ownerId ?? null;
          break;
        }
      }
    }
    if (!changedOwner) return;

    setTradeReveal(true);
    setProfileId(changedOwner);
    if (autoProfileTimer.current) window.clearTimeout(autoProfileTimer.current);
    autoProfileTimer.current = window.setTimeout(() => {
      if (profilePinnedRef.current || browseHoldRef.current) return;
      setTradeReveal(false);
      setProfileId((id) => (id === changedOwner ? null : id));
    }, fxMs(FX_TIMING.portfolioRevealMs));
  }, [game, revealPending, pending, deckStage, setProfileId]);

  useEffect(() => {
    return () => {
      if (autoProfileTimer.current) window.clearTimeout(autoProfileTimer.current);
    };
  }, []);

  return {
    deckStage,
    setDeckStage,
    deckKey,
    activeDeck,
    newsCard,
    tradeReveal,
    setTradeReveal,
    lastTrade,
    captureLastTrade,
    ensureTradeActor,
    onNewsDone,
    onMillDone,
    onSettleDone,
    onReturnDone,
    closePortfolioEarly,
    setPresentationHold,
  };
}
