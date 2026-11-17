"use client";

import { useEffect, useState } from "react";
import { BOARD } from "@/lib/game/board";
import { useGameFxOptional } from "@/lib/fx/GameFxContext";
import { useT } from "@/lib/i18n";
import { useGameActions } from "@/lib/net/useGameActions";
import { CashFlyLayer } from "@/components/fx/CashFlyLayer";
import {
  DeckDrawPortal,
} from "@/components/fx/DeckDrawPortal";
import { NewsRevealPortal } from "@/components/fx/NewsRevealPortal";
import { PrMillPortal } from "@/components/fx/PrMillPortal";
import { CashSettlePortal } from "@/components/fx/CashSettlePortal";
import { TradeSettlePortal } from "@/components/fx/TradeSettlePortal";
import { useBrowseHold, useBrowseHoldActive } from "@/lib/ui/BrowseHoldContext";
import { settleSummary } from "@/components/cards/EventCard";
import { InfoCard } from "@/components/cards/InfoCard";
import { PlayerProfile } from "./PlayerProfile";
import { TradeModal } from "./TradeModal";
import { SeatStrip } from "./SeatStrip";
import { WatchPeekControls } from "./WatchPeekControls";
import { useDeckStage } from "./useDeckStage";
import { EMPTY_MILLED } from "./deckStage";
import Link from "next/link";

export function GameHUD() {
  const t = useT();
  const {
    game,
    playerId,
    current,
    isMyTurn,
    isBotTurn,
    isSpectator,
    isAutoPlay,
    isAwaySeat,
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
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profilePinned, setProfilePinned] = useState(false);
  useBrowseHoldActive(profilePinned);
  const [peekHiddenKey, setPeekHiddenKey] = useState<string | null>(null);

  const setPresentationHold = fx?.setPresentationHold;
  const fxBusy = fx?.fxBusy ?? false;
  const sectorBumpId = fx?.sectorBumpId ?? null;

  const {
    deckStage,
    activeDeck,
    newsCard,
    tradeReveal,
    lastTrade,
    captureLastTrade,
    ensureTradeActor,
    onNewsDone,
    onMillDone,
    onSettleDone,
    onReturnDone,
    closePortfolioEarly,
  } = useDeckStage({
    game,
    playerId,
    currentId: current?.id,
    pending,
    revealPending,
    sectorBumpId,
    fxBusy,
    setPresentationHold,
    profilePinned,
    browseHold,
    send,
    setProfileId,
  });

  const tradeActorId =
    pending?.type === "trade"
      ? isMyTurn
        ? (playerId ?? "")
        : (current?.id ?? playerId ?? "")
      : (playerId ?? "");
  const watchingPlay = !isMyTurn || isSpectator;

  useEffect(() => {
    if (!revealPending || pending?.type !== "trade" || pending.focusTile == null) {
      return;
    }
    if (
      deckStage === "drawing" ||
      deckStage === "milling" ||
      deckStage === "returning" ||
      deckStage === "settling" ||
      deckStage === "closingTrade" ||
      deckStage === "portfolio"
    ) {
      return;
    }
    queueMicrotask(() =>
      captureLastTrade({
        tradesLeft: pending.tradesLeft,
        focusTile: pending.focusTile,
        actorId: tradeActorId,
        watchMode: watchingPlay,
        actorName: current?.name,
      }),
    );
  }, [
    revealPending,
    pending,
    deckStage,
    tradeActorId,
    watchingPlay,
    current?.name,
    captureLastTrade,
  ]);

  if (!game || !playerId) return null;

  if (game.phase === "finished") {
    const winner = game.players.find((p) => p.id === game.winnerId);
    return (
      <div className={`hud-finish${fx?.winCelebrate ? " is-celebrate" : ""}`}>
        <p className="winner-line">
          {t("hud.wins", { name: winner?.name ?? "?" })}
        </p>
        <Link className="btn btn-primary" href="/">
          {t("hud.newTable")}
        </Link>
      </div>
    );
  }

  const seatPlayerIds = game.players.map((p) => p.id);
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
  const deckOwnsScreen =
    deckStage === "drawing" ||
    deckStage === "milling" ||
    deckStage === "returning" ||
    deckStage === "settling" ||
    deckStage === "closingTrade" ||
    deckStage === "portfolio";
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
  const showTradeClosing = deckStage === "closingTrade" && !!lastTrade;
  const showTrade = showTradeLive || showTradeClosing;
  const tradeWatch = watchingPlay;
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

  const tradeSnap = showTradeClosing ? lastTrade : null;
  const tradeModalPlayerId = tradeSnap?.actorId ?? tradeActorId;
  const tradeModalLeft =
    tradeSnap?.tradesLeft ??
    (pending?.type === "trade" ? pending.tradesLeft : 1);
  const tradeModalFocus =
    tradeSnap?.focusTile ??
    (pending?.type === "trade" ? pending.focusTile : undefined);
  const tradeModalWatch = tradeSnap?.watchMode ?? tradeWatch;
  const tradeModalActor = tradeSnap?.actorName ?? current?.name;

  const handleClosePortfolio = () => {
    if (!closePortfolioEarly()) {
      setProfilePinned(false);
      setProfileId(null);
    }
  };

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
            lastTrade?.actorName ??
            current?.name ??
            game.players.find((p) => p.id === tradeActorId)?.name
          }
          actorId={lastTrade?.actorId ?? tradeActorId ?? current?.id}
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
              ? (lastTrade?.actorName ?? current?.name)
              : (current?.name ??
                game.players.find((p) => p.id === playerId)?.name)
          }
          actorId={
            pending.cashKind === "buy" || pending.cashKind === "sell"
              ? (lastTrade?.actorId ?? current?.id ?? playerId)
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
              ensureTradeActor(
                lastTrade?.actorId ?? current?.id ?? playerId,
              );
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
            watchingPlay && tradeReveal ? hidePeek : handleClosePortfolio
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
        <SeatStrip
          game={game}
          playerId={playerId}
          currentId={current?.id}
          diceRolling={diceRolling}
          tokensMoving={tokensMoving}
          onOpenProfile={(id) => {
            setProfilePinned(true);
            setProfileId(id);
          }}
        />
        <WatchPeekControls
          myTradeOpen={myTradeOpen}
          peekAway={peekAway}
          onShowTradeAgain={showTradeAgain}
          haltPending={pending?.type === "halt"}
          isMyTurn={isMyTurn}
          diceRolling={diceRolling}
          canPayFine={pending?.type === "halt" ? pending.canPay : false}
          onRoll={roll}
          onPayJail={() => send({ type: "pay_jail" })}
          canEnd={canEnd}
          onEndTurn={endTurn}
          isSpectator={isSpectator}
          isAwaySeat={isAwaySeat}
          isAutoPlay={isAutoPlay}
          isBotTurn={isBotTurn}
          currentName={current?.name}
          tokensMoving={tokensMoving}
        />
      </div>
    </>
  );
}
