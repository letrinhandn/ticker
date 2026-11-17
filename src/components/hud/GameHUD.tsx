"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BOARD } from "@/lib/game/board";
import { useGameFxOptional } from "@/lib/fx/GameFxContext";
import { useT } from "@/lib/i18n";
import { money, moneySeat } from "@/lib/money";
import { useGameActions } from "@/lib/net/useGameActions";
import { HALT_FINE, type RegimeCard } from "@/shared/types";
import { CashFlyLayer } from "@/components/fx/CashFlyLayer";
import { AnimatedHudCash } from "@/components/hud/AnimatedHudCash";
import { portfolioValue } from "@/lib/game/pricing";
import {
  DeckDrawPortal,
  shuffleDeckPile,
} from "@/components/fx/DeckDrawPortal";
import { NewsRevealPortal } from "@/components/fx/NewsRevealPortal";
import { PrMillPortal } from "@/components/fx/PrMillPortal";
import { CashSettlePortal } from "@/components/fx/CashSettlePortal";
import { TradeSettlePortal } from "@/components/fx/TradeSettlePortal";
import { FX_TIMING, type FxDeckKind } from "@/lib/fx/types";
import { fxMs } from "@/lib/prefs/gamePrefs";
import { useBrowseHold, useBrowseHoldActive } from "@/lib/ui/BrowseHoldContext";
import { settleSummary } from "@/components/cards/EventCard";
import { InfoCard } from "@/components/cards/InfoCard";
import { PlayerPiece, seatAccentColor } from "@/components/cards/PlayerPiece";
import { PlayerProfile } from "./PlayerProfile";
import { TradeModal } from "./TradeModal";
import { playSfx } from "@/lib/sfx/sounds";

const SEAT_CORNERS = ["bl", "tr", "tl", "br"] as const;
const EMPTY_MILLED: string[] = [];

/**
 * Buy/sell: desk → hammer → portfolio → mill → gather → shuffle →
 * cash flies → sector pegs → dismiss. Never overlap those beats.
 */
type DeckStage =
  | "idle"
  | "closingTrade"
  | "settling"
  | "portfolio"
  | "milling"
  | "drawing"
  | "showing"
  | "returning"
  | "shuffling"
  /** Hold released; waiting cash + peg FX to drain before dismiss. */
  | "waiting";

function isDeckBusy(stage: DeckStage) {
  return stage !== "idle";
}

function holdingsKey(
  holdings: { ownerId: string; tileIndex: number; shares: number }[],
) {
  return holdings
    .map((h) => `${h.ownerId}:${h.tileIndex}:${h.shares}`)
    .sort()
    .join("|");
}

export function GameHUD() {
  const t = useT();
  const {
    game,
    playerId,
    current,
    isMyTurn,
    isBotTurn,
    isSpectator,
    pending,
    canEnd,
    diceRolling,
    tokensMoving,
    revealPending,
    roll,
    endTurn,
    send,
  } = useGameActions();
  const fx = useGameFxOptional();
  const { hold: browseHold } = useBrowseHold();
  const browseHoldRef = useRef(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profilePinned, setProfilePinned] = useState(false);
  const profilePinnedRef = useRef(false);
  useBrowseHoldActive(profilePinned);
  const [deckStage, setDeckStage] = useState<DeckStage>("idle");
  const [deckKey, setDeckKey] = useState<string | null>(null);
  const [activeDeck, setActiveDeck] = useState<FxDeckKind>("pr");
  /** Keep News face alive if server dismisses mid-animation. */
  const [newsCard, setNewsCard] = useState<RegimeCard | null>(null);
  const deckStageRef = useRef<DeckStage>("idle");
  const dismissAfterOutro = useRef(false);
  /** Reveal keys already played — blocks restart while dismiss is in flight. */
  const playedDeckKeyRef = useRef<string | null>(null);
  const prevPendingType = useRef<string | null>(null);
  const lastTradeRef = useRef<{
    tradesLeft: number;
    focusTile?: number;
    actorId: string;
    watchMode: boolean;
    actorName?: string;
  } | null>(null);
  const prevHoldings = useRef<string>("");
  const autoProfileTimer = useRef<number | null>(null);
  const stageTimer = useRef<number | null>(null);
  const tradeActorForSettle = useRef<string | null>(null);
  /** After stamp portfolio beat: mill PR card or dismiss ETF buy/sell. */
  const settleAfterRef = useRef<"mill" | "dismiss">("mill");
  const [tradeReveal, setTradeReveal] = useState(false);
  /** After mill release — dismiss when peg queue goes idle. */
  const [awaitFxIdle, setAwaitFxIdle] = useState(false);
  /** Prevent dismiss on the pre-busy flicker right after hold release. */
  const sawFxBusyAfterRelease = useRef(false);
  /** Local peek-away while watching bot / other seats (does not dismiss server). */
  const [peekHiddenKey, setPeekHiddenKey] = useState<string | null>(null);

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

  // Stable — never depend on the whole fx object (it changes every peg step).
  const setPresentationHold = fx?.setPresentationHold;
  const fxBusy = fx?.fxBusy ?? false;
  const sectorBumpId = fx?.sectorBumpId ?? null;

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
      // Server cleared pending while we were still showing.
      if (
        playedDeckKeyRef.current == null &&
        (deckStageRef.current === "showing" ||
          deckStageRef.current === "drawing" ||
          deckStageRef.current === "milling" ||
          deckStageRef.current === "closingTrade" ||
          deckStageRef.current === "settling" ||
          deckStageRef.current === "portfolio")
      ) {
        // News: keep local reveal running — never snap to DeckDraw "return"
        // (that looked like the card flying home before anyone could read it).
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
        setTradeReveal(false);
        // Never yank a user-opened card while FX continue behind.
        if (
          !profilePinnedRef.current &&
          !browseHoldRef.current &&
          tradeActorForSettle.current
        ) {
          const actor = tradeActorForSettle.current;
          setProfileId((id) => (id === actor ? null : id));
        }
        setPresentationHold?.(false);
        setAwaitFxIdle(false);
        setNewsCard(null);
        setDeckStage("returning");
        return;
      }
      if (
        deckStageRef.current === "idle" ||
        deckStageRef.current === "shuffling" ||
        deckStageRef.current === "waiting"
      ) {
        setDeckKey(null);
        playedDeckKeyRef.current = null;
      }
      return;
    }
    // Still the same pending after outro cleared deckKey — do not re-draw.
    if (playedDeckKeyRef.current === pendingDeckKey) {
      return;
    }
    if (deckKey !== pendingDeckKey) {
      const fromTrade = prevPendingType.current === "trade";
      setDeckKey(pendingDeckKey);
      setActiveDeck(deckKind);
      dismissAfterOutro.current = false;
      setAwaitFxIdle(false);
      clearStageTimer();
      setTradeReveal(false);
      // Arm gate (GameFx also arms on pending — this keeps HUD in sync).
      setPresentationHold?.(true);
      if (deckKind === "pr") {
        setNewsCard(null);
        // Desk → hammer/price → portfolio → mill all → one shuffle.
        tradeActorForSettle.current =
          lastTradeRef.current?.actorId ?? current?.id ?? playerId;
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
        // Wait out leftover pegs from a prior card before the news deal.
        setDeckStage(sectorBumpId ? "idle" : "drawing");
      }
    } else if (
      deckKind === "regime" &&
      deckStageRef.current === "idle" &&
      !sectorBumpId &&
      playedDeckKeyRef.current !== pendingDeckKey
    ) {
      setDeckStage("drawing");
    }
  }, [
    revealPending,
    needsDeck,
    pendingDeckKey,
    deckKey,
    deckKind,
    clearStageTimer,
    current?.id,
    playerId,
    setPresentationHold,
    sectorBumpId,
    activeDeck,
    newsCard,
    pending,
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
    // Keep deckKey + playedDeckKey until server clears pending — otherwise the
    // effect sees pending still set and starts a second draw/mill.
    if (shouldSend) send({ type: "dismiss" });
  }, [send]);

  /**
   * Gather done → shuffle pile → release hold (cash → pegs) → dismiss idle.
   * Strict sequence: never overlap shuffle with cash/pegs.
   */
  const finishDeckReveal = useCallback(
    (deck: FxDeckKind) => {
      dismissAfterOutro.current = true;
      playedDeckKeyRef.current = deckKey;
      sawFxBusyAfterRelease.current = false;
      setAwaitFxIdle(false);
      setDeckStage("shuffling");
      window.setTimeout(() => {
        shuffleDeckPile(deck, () => {
          // Shuffle finished — now cash flies, then sector pegs.
          setPresentationHold?.(false);
          setDeckStage("waiting");
          window.setTimeout(() => setAwaitFxIdle(true), 48);
          // No parked FX: allow dismiss even if busy never latched.
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

  // Cash + peg FX drained → dismiss.
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

  /** After trade stamp: portfolio, then PR mill or dismiss (ETF). */
  const onSettleDone = useCallback(
    (after: "mill" | "dismiss" = "mill") => {
      settleAfterRef.current = after;
      const actor =
        tradeActorForSettle.current ?? current?.id ?? playerId ?? null;
      if (!actor) {
        if (after === "mill") setDeckStage("milling");
        else {
          setDeckStage("idle");
          send({ type: "dismiss" });
        }
        return;
      }
      // User is reading a browse card — skip portfolio beat.
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
    [clearStageTimer, current?.id, playerId, send],
  );

  const closePortfolioEarly = useCallback(() => {
    if (deckStageRef.current !== "portfolio") {
      setProfilePinned(false);
      setProfileId(null);
      return;
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
  }, [clearStageTimer, send]);

  const onReturnDone = useCallback(() => {
    dismissAfterOutro.current = false;
    setDeckStage("shuffling");
    shuffleDeckPile(activeDeck, () => {
      setDeckStage("idle");
    });
  }, [activeDeck]);

  // Holdings change: never open portfolio while a stamp card / trade sequence
  // owns the screen. Trade fills open portfolio only after settle onDone.
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
      // Consume the delta so idle after mill does not re-open portfolio.
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
  }, [game, revealPending, pending, deckStage]);

  useEffect(() => {
    return () => {
      if (autoProfileTimer.current) window.clearTimeout(autoProfileTimer.current);
    };
  }, []);

  if (!game || !playerId) return null;

  if (game.phase === "finished") {
    const winner = game.players.find((p) => p.id === game.winnerId);
    return (
      <div className={`hud-finish${fx?.winCelebrate ? " is-celebrate" : ""}`}>
        <p className="winner-line">
          {t("hud.wins", { name: winner?.name ?? "?" })}
        </p>
        <a className="btn btn-primary" href="/">
          {t("hud.newTable")}
        </a>
      </div>
    );
  }

  const tradeActorId =
    pending?.type === "trade"
      ? isMyTurn
        ? playerId
        : (current?.id ?? playerId)
      : playerId;
  const seatPlayerIds = game?.players.map((p) => p.id) ?? [];
  /** Bot / other human / spectator — see cards without veil; tap outside peeks away. */
  const watchingPlay = !isMyTurn || isSpectator;
  /** Own trade desk also peeks so the player can check the board, then reopen. */
  const myTradeOpen =
    isMyTurn &&
    !isSpectator &&
    pending?.type === "trade" &&
    pending.focusTile != null;
  const peekKey =
    tradeReveal && profileId
      ? `portfolio:${profileId}`
      : pending
        ? [
            pending.type,
            pending.type === "info"
              ? `${pending.title}:${pending.tileIndex ?? ""}:${pending.amount ?? ""}`
              : pending.type === "trade"
                ? `${pending.focusTile ?? ""}:${pending.tradesLeft}`
                : pending.type === "price_reaction"
                  ? `${pending.card.id}:${pending.order.tileIndex}:${deckStage}`
                  : pending.type === "regime"
                    ? `${pending.card.id}:${deckStage}`
                    : deckStage,
          ].join(":")
        : deckStage !== "idle"
          ? `deck:${deckStage}:${activeDeck}`
          : null;
  const canPeekAway = watchingPlay || myTradeOpen;
  const peekAway =
    canPeekAway && peekKey != null && peekHiddenKey === peekKey;
  const hidePeek = () => {
    if (peekKey) setPeekHiddenKey(peekKey);
  };
  const showTradeAgain = () => setPeekHiddenKey(null);

  // Nothing land-related until the token has arrived on the tile.
  // Peek only hides visually — keep portals mounted so onDone / dismiss / peg FX still run.
  const showModals = revealPending;
  const showNewsReveal =
    revealPending && deckStage === "drawing" && !!newsCard;
  const showDeckReturn = revealPending && deckStage === "returning";
  const showSettle =
    revealPending &&
    deckStage === "settling" &&
    pending?.type === "price_reaction";
  const showPrMill =
    revealPending &&
    deckStage === "milling" &&
    pending?.type === "price_reaction";
  // Deck fly/mill/return owns the screen — never stack a company deed under it
  // (returning card used to sit on top of the asset card, then vanish).
  const deckOwnsScreen =
    deckStage === "drawing" ||
    deckStage === "milling" ||
    deckStage === "returning" ||
    deckStage === "settling" ||
    deckStage === "closingTrade" ||
    deckStage === "portfolio";
  // Stamp ticket when cash moves, or when cashKind is set (START tax/rev at $0).
  const infoHasCash =
    pending?.type === "info" &&
    (pending.cashKind != null ||
      (pending.amount != null && pending.amount !== 0));
  const showCashSettle = showModals && infoHasCash && !deckOwnsScreen;
  const showInfo =
    showModals && pending?.type === "info" && !infoHasCash && !deckOwnsScreen;
  const showTradeLive =
    showModals &&
    pending?.type === "trade" &&
    pending.focusTile != null &&
    !deckOwnsScreen;
  const showTradeClosing =
    deckStage === "closingTrade" && !!lastTradeRef.current;
  const showTrade = showTradeLive || showTradeClosing;
  const tradeWatch = watchingPlay;
  /** Stamp / desk close owns the screen — portfolio waits until after stamp. */
  const tradeStampBlocking =
    deckStage === "settling" ||
    deckStage === "closingTrade" ||
    (deckStage !== "portfolio" &&
      pending?.type === "info" &&
      (pending.cashKind === "buy" || pending.cashKind === "sell") &&
      showCashSettle);
  const showPortfolio =
    Boolean(profileId) &&
    !tradeStampBlocking &&
    deckStage !== "milling" &&
    deckStage !== "drawing" &&
    deckStage !== "returning" &&
    deckStage !== "shuffling";

  if (showTradeLive && pending?.type === "trade") {
    lastTradeRef.current = {
      tradesLeft: pending.tradesLeft,
      focusTile: pending.focusTile,
      actorId: tradeActorId,
      watchMode: tradeWatch,
      actorName: current?.name,
    };
  }

  const tradeSnap = showTradeClosing ? lastTradeRef.current : null;
  const tradeModalPlayerId = tradeSnap?.actorId ?? tradeActorId;
  const tradeModalLeft = tradeSnap?.tradesLeft ?? (pending?.type === "trade" ? pending.tradesLeft : 1);
  const tradeModalFocus =
    tradeSnap?.focusTile ?? (pending?.type === "trade" ? pending.focusTile : undefined);
  const tradeModalWatch = tradeSnap?.watchMode ?? tradeWatch;
  const tradeModalActor = tradeSnap?.actorName ?? current?.name;

  return (
    <>
      <CashFlyLayer playerIds={game.players.map((p) => p.id)} />

      {showNewsReveal && newsCard && (
        <NewsRevealPortal
          card={newsCard}
          active
          onDone={onNewsDone}
          watch={watchingPlay}
          peeked={peekAway}
          onHide={hidePeek}
        />
      )}

      {showSettle && pending?.type === "price_reaction" && (
        <TradeSettlePortal
          side={pending.order.side}
          shares={pending.settledShares}
          settlePrice={pending.settlePrice}
          totalCash={pending.totalCash}
          tileIndex={pending.order.tileIndex}
          actorName={
            lastTradeRef.current?.actorName ??
            current?.name ??
            game?.players.find((p) => p.id === tradeActorId)?.name
          }
          actorId={
            lastTradeRef.current?.actorId ?? tradeActorId ?? current?.id
          }
          playerIds={seatPlayerIds}
          active
          onDone={() => onSettleDone("mill")}
          watch={watchingPlay}
          peeked={peekAway}
          onHide={hidePeek}
        />
      )}

      {showPrMill && pending?.type === "price_reaction" && (
        <PrMillPortal
          milled={pending.milled ?? EMPTY_MILLED}
          matchId={pending.card.id}
          order={pending.order}
          deltas={pending.deltas}
          settleLine={settleSummary(
            t,
            pending.order.side,
            pending.settledShares,
            pending.settlePrice,
            pending.totalCash,
          )}
          active
          onDone={onMillDone}
          watch={watchingPlay}
          peeked={peekAway}
          onHide={hidePeek}
        />
      )}

      {showDeckReturn && (
        <DeckDrawPortal
          deck={activeDeck}
          active
          direction="return"
          onDone={onReturnDone}
        />
      )}

      {showCashSettle && pending?.type === "info" && (
        <CashSettlePortal
          key={`settle:${pending.title}:${pending.amount ?? 0}:${pending.cashKind ?? ""}:${pending.bundle?.length ?? 0}`}
          kind={
            pending.cashKind ??
            ((pending.amount ?? 0) < 0 ? "pay" : "receive")
          }
          title={pending.title}
          subtitle={
            pending.tileIndex != null && pending.tileIndex !== 0
              ? (BOARD[pending.tileIndex]?.ticker ?? undefined)
              : undefined
          }
          amount={Math.abs(pending.amount ?? 0)}
          tileIndex={pending.tileIndex}
          shares={pending.shares}
          unitPrice={pending.unitPrice}
          actorName={
            pending.cashKind === "buy" || pending.cashKind === "sell"
              ? (lastTradeRef.current?.actorName ?? current?.name)
              : (current?.name ??
                game?.players.find((p) => p.id === playerId)?.name)
          }
          actorId={
            pending.cashKind === "buy" || pending.cashKind === "sell"
              ? (lastTradeRef.current?.actorId ?? current?.id ?? playerId)
              : (current?.id ?? playerId ?? undefined)
          }
          playerIds={seatPlayerIds}
          transfers={pending.transfers}
          bundle={
            pending.bundle && pending.bundle.length > 0
              ? pending.bundle.map((card) => ({
                  kind: card.cashKind,
                  title: card.title,
                  amount: Math.abs(card.amount),
                  tileIndex: pending.tileIndex,
                }))
              : undefined
          }
          active
          onDone={() => {
            setPresentationHold?.(false);
            const kind = pending.cashKind;
            if (kind === "buy" || kind === "sell") {
              tradeActorForSettle.current =
                tradeActorForSettle.current ??
                lastTradeRef.current?.actorId ??
                current?.id ??
                playerId;
              onSettleDone("dismiss");
              return;
            }
            send({ type: "dismiss" });
          }}
          watch={watchingPlay}
          peeked={peekAway}
          onHide={hidePeek}
          hold={browseHold}
        />
      )}

      {showInfo && pending?.type === "info" && (
        <InfoCard
          title={pending.title}
          body={pending.body}
          tileIndex={pending.tileIndex}
          game={game}
          onDismiss={() => send({ type: "dismiss" })}
          watch={watchingPlay}
          peeked={peekAway}
          onHide={hidePeek}
          hold={browseHold}
        />
      )}

      {showTrade && (
        <TradeModal
          game={game}
          playerId={tradeModalPlayerId}
          tradesLeft={tradeModalLeft}
          focusTile={tradeModalFocus}
          watchMode={tradeModalWatch || showTradeClosing}
          actorName={tradeModalActor}
          closing={showTradeClosing}
          peeked={peekAway}
          onHide={hidePeek}
          onTrade={(action, tileIndex, shares) =>
            send({ type: "trade", action, tileIndex, shares })
          }
          onSkip={() => send({ type: "trade", action: "skip" })}
        />
      )}

      {showPortfolio && profileId && (
        <PlayerProfile
          game={game}
          playerId={profileId}
          viewerId={playerId}
          tradeReveal={tradeReveal}
          browse={profilePinned && !tradeReveal}
          watch={watchingPlay && tradeReveal}
          peeked={peekAway && watchingPlay && tradeReveal}
          onClose={
            watchingPlay && tradeReveal ? hidePeek : closePortfolioEarly
          }
        />
      )}

      {fx?.bankruptPlayerId && (
        <div className="fx-bankrupt-banner" role="status">
          {game.players.find((p) => p.id === fx.bankruptPlayerId)?.name ??
            "Player"}{" "}
          is out
        </div>
      )}

      <div className="game-hud" aria-live="polite">
        {game.players.map((p, i) => {
          const corner = SEAT_CORNERS[i] ?? "br";
          const active = current?.id === p.id;
          const mine = p.id === playerId;
          const shares = game.holdings
            .filter((x) => x.ownerId === p.id)
            .reduce((s, h) => s + h.shares, 0);
          const shownCash = fx?.displayCash[p.id] ?? p.cash;
          // Price holdings off animated pegs so seat totals ease when pegs move,
          // instead of jumping to the final ledger the moment the card resolves.
          const assets = portfolioValue(
            game,
            p.id,
            fx?.seatSectorVisual ?? fx?.sectorVisual ?? game.sectorIndex,
          );
          const shownWorth = shownCash + assets;
          const flash = fx?.cashFlash[p.id];
          const accent = seatAccentColor(p.name, p.token);
          const status = p.bankrupt
            ? t("hud.out")
            : p.inJail
              ? t("hud.sec")
              : active
                ? diceRolling
                  ? t("hud.rolling")
                  : tokensMoving
                    ? t("hud.moving")
                    : t("hud.turn")
                : t("hud.sharesCount", { count: shares });
          return (
            <button
              type="button"
              key={p.id}
              className={`hud-player hud-${corner}${active ? " is-active" : ""}${mine ? " is-me" : ""}${p.bankrupt ? " is-out" : ""}${fx?.bankruptPlayerId === p.id ? " is-busting" : ""}`}
              style={{ ["--seat-accent" as string]: accent }}
              onClick={() => {
                setProfilePinned(true);
                setProfileId(p.id);
              }}
              aria-label={t("hud.openProfile", { name: p.name })}
            >
              <PlayerPiece
                name={p.name}
                playerId={p.id}
                token={p.token}
                size={28}
                jailed={p.inJail}
                className="hud-seat-piece"
              />
              <div className="hud-player-meta">
                <p className="hud-name">
                  {p.name}
                  {mine ? ` (${t("common.you")})` : ""}
                </p>
                <AnimatedHudCash
                  playerId={p.id}
                  value={shownWorth}
                  flash={flash}
                />
                <p className="hud-sub">
                  {p.bankrupt
                    ? status
                    : t("hud.seatMeta", {
                        cash: moneySeat(shownCash),
                        status,
                      })}
                </p>
              </div>
            </button>
          );
        })}

        <div className="hud-center-actions">
          {myTradeOpen && peekAway && (
            <button
              type="button"
              className="hud-chip hud-chip-pulse"
              onClick={showTradeAgain}
            >
              {t("trade.backToDesk")}
            </button>
          )}

          {pending?.type === "halt" && isMyTurn && (
            <div className="hud-chip-row">
              <button
                type="button"
                className="hud-chip hud-chip-pulse"
                disabled={diceRolling}
                onClick={roll}
              >
                {t("hud.tapDoubles")}
              </button>
              {pending.canPay && (
                <button
                  type="button"
                  className="hud-chip"
                  onClick={() => send({ type: "pay_jail" })}
                >
                  {t("hud.payFine", { amount: money(HALT_FINE) })}
                </button>
              )}
            </div>
          )}

          {canEnd && (
            <button
              type="button"
              className="hud-end hud-end-pulse"
              onClick={() => {
                playSfx("turn");
                endTurn();
              }}
            >
              {t("hud.endTurn")}
            </button>
          )}

          {isSpectator && (
            <p className="hud-wait">{t("hud.watchingAuto")}</p>
          )}
          {isBotTurn && current && !isSpectator && (
            <p className="hud-wait">
              {diceRolling
                ? t("hud.fundRolling", { name: current.name })
                : tokensMoving
                  ? t("hud.fundMoving", { name: current.name })
                  : t("hud.fundTurn", { name: current.name })}
            </p>
          )}
          {!isMyTurn && !isBotTurn && !isSpectator && current && (
            <p className="hud-wait">
              {t("hud.playerTurn", { name: current.name })}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
