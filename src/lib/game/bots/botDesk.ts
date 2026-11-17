import type { GameState, SectorId } from "@/shared/types";
import { BALANCE } from "../balance/knobs";
import { BOARD, isListedCompany, sectorForTile } from "../board";
import { FUNDS_BY_TILE } from "../content/funds";
import {
  currentSharePrice,
  getSharesOnMarket,
  getSharesOwned,
} from "../engine";
import { botFundByName, type FundKind } from "./botRoster";
import { deskEdge, type DeskEdge } from "./botSignals";

/** Stance labels — useful for tests / UI “bot thinking”. */
export type BotTradeStance =
  | "raise_cash"
  | "dump_pressure"
  | "take_profit"
  | "cut_loss"
  | "corner_dip"
  | "accumulate"
  | "etf_hedge"
  | "cash_hold";

export type DeskView = {
  state: GameState;
  botId: string;
  focus: number;
  kind: FundKind;
  fundName: string;
  cash: number;
  focusKind: "company" | "etf" | "other";
  owned: number;
  market: number;
  price: number;
  sector: SectorId | null;
  level: number;
  total: number;
  weight: number;
  concentrated: boolean;
  rival: number;
  reserve: number;
  budget: number;
  /** Sector tape + price-action edge from sectorHistory. */
  edge: DeskEdge;
};

export function buyReserve(cash: number, aggressive = false): number {
  if (aggressive) {
    return Math.max(BALANCE.wealthTax * 0.15, Math.floor(cash * 0.05), 60);
  }
  // Keep a thinner fee buffer so desks can deploy 3–5 share clips.
  return Math.max(BALANCE.wealthTax * 0.35, Math.floor(cash * 0.12), 120);
}

export function sellTrigger(cash: number, raiseCashMult = 1): number {
  const base = Math.max(BALANCE.incomeTax + 40, Math.floor(cash * 0.18), 160);
  return Math.floor(base * raiseCashMult);
}

export function sharesBySector(
  state: GameState,
  botId: string,
): { total: number; bySector: Partial<Record<SectorId, number>> } {
  const bySector: Partial<Record<SectorId, number>> = {};
  let total = 0;
  for (const h of state.holdings) {
    if (h.ownerId !== botId || h.shares <= 0) continue;
    const tile = BOARD[h.tileIndex];
    if (!tile) continue;
    if (tile.kind === "etf") {
      const fund = FUNDS_BY_TILE[h.tileIndex];
      if (!fund) continue;
      const part = h.shares / fund.sectorIds.length;
      for (const s of fund.sectorIds) {
        bySector[s] = (bySector[s] ?? 0) + part;
      }
      total += h.shares;
      continue;
    }
    const sector = sectorForTile(tile);
    if (!sector) continue;
    bySector[sector] = (bySector[sector] ?? 0) + h.shares;
    total += h.shares;
  }
  return { total, bySector };
}

export function sectorWeight(
  bySector: Partial<Record<SectorId, number>>,
  total: number,
  sector: SectorId,
): number {
  if (total <= 0) return 0;
  return (bySector[sector] ?? 0) / total;
}

export function rivalSectorShares(
  state: GameState,
  botId: string,
  sector: SectorId,
): number {
  let n = 0;
  for (const h of state.holdings) {
    if (h.ownerId === botId || h.shares <= 0) continue;
    const tile = BOARD[h.tileIndex];
    if (!tile || tile.kind !== "company") continue;
    if (sectorForTile(tile) === sector) n += h.shares;
  }
  return n;
}

export function pickDumpTarget(
  state: GameState,
  botId: string,
  focus: number | undefined,
): { tileIndex: number; shares: number; score: number } | null {
  const { total, bySector } = sharesBySector(state, botId);
  let best: { tileIndex: number; shares: number; score: number } | null = null;

  for (const tile of BOARD) {
    if (!isListedCompany(tile)) continue;
    const owned = getSharesOwned(state, tile.index, botId);
    if (owned < 1) continue;
    const shares = Math.min(owned, 10);
    const price = currentSharePrice(state, tile.index);
    const sector = sectorForTile(tile);
    const level = sector ? (state.sectorIndex[sector] ?? 0) : 0;
    const weight = sector ? sectorWeight(bySector, total, sector) : 0;
    const rival = sector ? rivalSectorShares(state, botId, sector) : 0;
    const edge = deskEdge(state, sector);

    let score =
      price * shares +
      level * 55 +
      weight * 180 +
      rival * 35 +
      shares * 12 +
      edge.tape.stretch * 40 +
      edge.tape.mom * 25 -
      edge.meanRev * 20;
    if (focus != null && tile.index === focus) score += 50;
    if (level <= -2) score -= 40;
    if (edge.fadeRally) score += 60;
    if (!best || score > best.score) {
      best = { tileIndex: tile.index, shares, score };
    }
  }
  return best;
}

export function buildDeskView(
  state: GameState,
  botId: string,
  focus: number,
): DeskView | null {
  const player = state.players.find((p) => p.id === botId);
  if (!player) return null;
  const fund = botFundByName(player.name);
  const kind: FundKind = fund?.kind ?? "multi_strat";
  const aggressive = player.name === "SoftBank";
  const focusTile = BOARD[focus];
  if (!focusTile) return null;

  const { total, bySector } = sharesBySector(state, botId);
  const owned = getSharesOwned(state, focus, botId);
  const sector = sectorForTile(focusTile);
  const level = sector ? (state.sectorIndex[sector] ?? 0) : 0;
  const weight = sector ? sectorWeight(bySector, total, sector) : 0;
  const market = getSharesOnMarket(state, focus);
  const price = currentSharePrice(state, focus);
  const reserve = buyReserve(player.cash, aggressive);
  const budget = Math.max(0, player.cash - reserve - BALANCE.orderFeeM);

  const focusKind: DeskView["focusKind"] =
    focusTile.kind === "company"
      ? "company"
      : focusTile.kind === "etf"
        ? "etf"
        : "other";

  return {
    state,
    botId,
    focus,
    kind,
    fundName: player.name,
    cash: player.cash,
    focusKind,
    owned,
    market,
    price,
    sector,
    level,
    total,
    weight,
    concentrated: total >= 4 && weight >= 0.45,
    rival: sector ? rivalSectorShares(state, botId, sector) : 0,
    reserve,
    budget,
    edge: deskEdge(state, sector),
  };
}
