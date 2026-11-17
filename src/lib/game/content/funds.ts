import type { GameState, SectorId } from "@/shared/types";
import { SECTOR_CODE } from "../board";

export type FundId = "GRW" | "INF" | "DEF" | "CYC" | "DIV" | "CON";

export type FundDef = {
  id: FundId;
  ticker: FundId;
  name: string;
  /** Board tile index. */
  tileIndex: number;
  totalUnits: number;
  basePricePerUnitM: number;
  sectorIds: SectorId[];
  /** Base contribution per sector at level 0 (each 100 → total 300). */
  baseContributionM: number;
};

/** Playtest ETF set — replaces brokers / utilities (config V4.0 ETF). */
export const FUNDS: FundDef[] = [
  {
    id: "GRW",
    ticker: "GRW",
    name: "Growth Fund",
    tileIndex: 5,
    totalUnits: 1,
    basePricePerUnitM: 300,
    sectorIds: ["tech", "comms", "discretionary"],
    baseContributionM: 100,
  },
  {
    id: "INF",
    ticker: "INF",
    name: "Infrastructure Fund",
    tileIndex: 12,
    totalUnits: 1,
    basePricePerUnitM: 300,
    sectorIds: ["energy", "industrials", "comms"],
    baseContributionM: 100,
  },
  {
    id: "DEF",
    ticker: "DEF",
    name: "Defensive Fund",
    tileIndex: 15,
    totalUnits: 1,
    basePricePerUnitM: 300,
    sectorIds: ["staples", "healthcare", "energy"],
    baseContributionM: 100,
  },
  {
    id: "CYC",
    ticker: "CYC",
    name: "Cyclical Fund",
    tileIndex: 25,
    totalUnits: 1,
    basePricePerUnitM: 300,
    sectorIds: ["industrials", "financials", "energy"],
    baseContributionM: 100,
  },
  {
    id: "DIV",
    ticker: "DIV",
    name: "Diversified Fund",
    tileIndex: 28,
    totalUnits: 1,
    basePricePerUnitM: 300,
    sectorIds: ["tech", "financials", "healthcare"],
    baseContributionM: 100,
  },
  {
    id: "CON",
    ticker: "CON",
    name: "Consumer Fund",
    tileIndex: 35,
    totalUnits: 1,
    basePricePerUnitM: 300,
    sectorIds: ["staples", "discretionary", "comms"],
    baseContributionM: 100,
  },
];

export const FUNDS_BY_TILE = Object.fromEntries(
  FUNDS.map((f) => [f.tileIndex, f]),
) as Record<number, FundDef>;

export const FUNDS_BY_ID = Object.fromEntries(
  FUNDS.map((f) => [f.id, f]),
) as Record<FundId, FundDef>;

/** Contribution of one sector sleeve at a given level (10% of base per step). */
export function fundSleeveValue(baseContributionM: number, sectorIdx: number): number {
  return Math.max(1, Math.round(baseContributionM * (1 + sectorIdx * 0.1)));
}

/** Current ETF unit price = sum of sleeve values at live sector levels. */
export function currentFundPrice(
  state: Pick<GameState, "sectorIndex">,
  fund: FundDef,
): number {
  return fund.sectorIds.reduce((sum, sector) => {
    const idx = state.sectorIndex[sector] ?? 0;
    return sum + fundSleeveValue(fund.baseContributionM, idx);
  }, 0);
}

export function fundSectorCodes(fund: FundDef): string {
  return fund.sectorIds.map((s) => SECTOR_CODE[s]).join(", ");
}
