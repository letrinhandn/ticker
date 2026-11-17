/**
 * Portfolio risk triangle — every stance has a counter:
 *
 *  Whale (concentrated): big visit income + strong ops when right,
 *    but sector crashes / PR dumps amplify ops losses.
 *  Cash hoard: safe vs fees, ready to corner — START tax + missed rents hurt.
 *  Thin diversify: smooth, low rent power, still hit by broad news.
 *  Corner: monopoly rent — cash-poor after the buy, one bad PR hurts.
 */
import type { GameState, SectorId } from "@/shared/types";
import { BOARD, SECTOR_IDS, sectorForTile } from "@/lib/game/board";
import { FUNDS_BY_TILE } from "@/lib/game/content/funds";
import { netWorth } from "@/lib/game/pricing";
import { BALANCE } from "./knobs";

export function companySharesBySector(
  state: GameState,
  playerId: string,
): { total: number; bySector: Record<SectorId, number> } {
  const bySector = Object.fromEntries(SECTOR_IDS.map((s) => [s, 0])) as Record<
    SectorId,
    number
  >;
  let total = 0;
  for (const h of state.holdings) {
    if (h.ownerId !== playerId || h.shares <= 0) continue;
    const tile = BOARD[h.tileIndex];
    if (!tile) continue;
    if (tile.kind === "etf") {
      const fund = FUNDS_BY_TILE[h.tileIndex];
      if (!fund) continue;
      const part = h.shares / fund.sectorIds.length;
      for (const s of fund.sectorIds) bySector[s] += part;
      total += h.shares;
      continue;
    }
    if (tile.kind !== "company") continue;
    const sector = sectorForTile(tile);
    if (!sector) continue;
    bySector[sector] += h.shares;
    total += h.shares;
  }
  return { total, bySector };
}

/**
 * Extra pain on ops losses when a weak sector is a large % of the book.
 * Gains are NOT amplified — concentration is a risk, not a free lever.
 */
export function concentrationLossMultiplier(
  sectorWeight: number,
  sectorLevel: number,
): number {
  if (sectorLevel > -2) return 1;
  if (sectorWeight < BALANCE.concentrationWeightGate) return 1;
  const gate = BALANCE.concentrationWeightGate;
  const t = Math.min(1, (sectorWeight - gate) / Math.max(0.01, 1 - gate));
  return 1 + (BALANCE.concentrationLossMult - 1) * t;
}

/**
 * Idle-capital drag on START: tax scales with cash/NW.
 * Holding a token share does not erase a high cash ratio.
 */
export function cashHoardTaxBoost(state: GameState, playerId: string): number {
  const p = state.players.find((x) => x.id === playerId);
  if (!p || p.cash <= 0 || p.turnsDone < 1) return 0;
  const nw = Math.max(1, netWorth(state, playerId));
  const ratio = p.cash / nw;
  if (ratio < BALANCE.cashHoardNwRatio) return 0;
  const t = Math.min(
    1,
    (ratio - BALANCE.cashHoardNwRatio) /
      Math.max(0.01, 1 - BALANCE.cashHoardNwRatio),
  );
  return BALANCE.cashHoardTaxExtra * t;
}
