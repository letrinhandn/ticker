import { SECTOR_MAX, SECTOR_MIN, type GameState, type SectorId } from "@/shared/types";
import { BALANCE } from "./balance/knobs";
import { BOARD, sectorForTile } from "./board";
import { currentFundPrice, FUNDS_BY_TILE } from "./content/funds";

/** V4: Giá = P₀ × (1 + chỉ_số × 10%). Regime không nhân vào giá. */
export function sharePrice(p0: number, sectorIdx: number): number {
  return Math.max(1, Math.round(p0 * (1 + sectorIdx * 0.1)));
}

/** V4: Phí ghé cố định = P₀ × 10% (or tile.visitFeePerShare). ETF = 0. Scaled by BALANCE.visitFeeMult. */
export function feePerShare(p0: number, visitFee?: number): number {
  const base = visitFee != null ? visitFee : Math.round(p0 / 10);
  return Math.max(1, Math.round(base * BALANCE.visitFeeMult));
}

export function currentSharePrice(
  state: GameState,
  tileIndex: number,
  levels?: Record<SectorId, number>,
): number {
  const tile = BOARD[tileIndex];
  if (!tile?.price) return 0;
  const idxMap = levels ?? state.sectorIndex;
  if (tile.kind === "etf") {
    const fund = FUNDS_BY_TILE[tileIndex];
    return fund
      ? currentFundPrice({ sectorIndex: idxMap }, fund)
      : tile.price;
  }
  const sector = sectorForTile(tile);
  const idx = sector ? (idxMap[sector] ?? 0) : 0;
  return sharePrice(tile.price, idx);
}

export function visitFeeForTile(tileIndex: number): number {
  const tile = BOARD[tileIndex];
  if (!tile || tile.kind !== "company" || !tile.price) return 0;
  return feePerShare(tile.price, tile.visitFeePerShare);
}

export function clampSector(n: number): number {
  return Math.max(SECTOR_MIN, Math.min(SECTOR_MAX, n));
}

export function bumpSector(state: GameState, sector: SectorId, delta: number) {
  state.sectorIndex[sector] = clampSector(state.sectorIndex[sector] + delta);
}

export function portfolioValue(
  state: GameState,
  playerId: string,
  levels?: Record<SectorId, number>,
): number {
  let total = 0;
  for (const h of state.holdings) {
    if (h.ownerId !== playerId) continue;
    total += h.shares * currentSharePrice(state, h.tileIndex, levels);
  }
  return total;
}

export function netWorth(
  state: GameState,
  playerId: string,
  levels?: Record<SectorId, number>,
): number {
  const p = state.players.find((x) => x.id === playerId);
  if (!p) return 0;
  return p.cash + portfolioValue(state, playerId, levels);
}
