"use client";

import { BOARD } from "@/lib/game/board";
import { CashSettlePortal } from "./CashSettlePortal";

/**
 * Buy/sell fill beat — paycheck ticket with qty, price, fee, total.
 * Sell/buy with a tile: deed + settle jaws clamp shut, then stamp both.
 */
export function TradeSettlePortal({
  side,
  shares,
  settlePrice,
  totalCash,
  tileIndex,
  actorName,
  actorId,
  playerIds,
  active,
  onDone,
  watch = false,
  peeked = false,
  onHide,
}: {
  side: "buy" | "sell";
  shares: number;
  settlePrice: number;
  totalCash: number;
  tileIndex: number;
  actorName?: string;
  actorId?: string;
  playerIds?: string[];
  active: boolean;
  onDone: () => void;
  watch?: boolean;
  peeked?: boolean;
  onHide?: () => void;
}) {
  const tile = BOARD[tileIndex];
  const ticker = tile?.ticker ?? tile?.name ?? "";
  const name = tile?.name ?? ticker;
  const notional = shares * settlePrice;
  const fee =
    side === "buy"
      ? Math.max(0, Math.abs(totalCash) - notional)
      : Math.max(0, notional - Math.abs(totalCash));

  return (
    <CashSettlePortal
      kind={side}
      title={name}
      subtitle={ticker}
      amount={Math.abs(totalCash)}
      tileIndex={tileIndex}
      shares={shares}
      unitPrice={settlePrice}
      fee={fee > 0 ? fee : undefined}
      actorName={actorName}
      actorId={actorId}
      playerIds={playerIds}
      active={active}
      onDone={onDone}
      watch={watch}
      peeked={peeked}
      onHide={onHide}
    />
  );
}
