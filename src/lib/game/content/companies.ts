/**
 * Company cards — 22 sector companies from EN/VI minimal deck JSON.
 */
import type { ColorGroup, SectorId } from "@/shared/types";
import rawJson from "@/content/companyCards22.json";
import { BALANCE } from "../balance/knobs";

const raw =
  rawJson &&
    typeof rawJson === "object" &&
    "companiesById" in rawJson
    ? rawJson
    : (rawJson as { default?: typeof rawJson }).default;

if (!raw?.companiesById) {
  throw new Error("companyCards22.json missing companiesById");
}

const CODE_TO_SECTOR: Record<string, SectorId> = {
  CS: "staples",
  EN: "energy",
  CM: "comms",
  IN: "industrials",
  FI: "financials",
  CD: "discretionary",
  HC: "healthcare",
  TE: "tech",
};

const SECTOR_TO_GROUP: Record<
  SectorId,
  Exclude<ColorGroup, "none" | "railroad" | "utility" | "etf">
> = {
  staples: "brown",
  energy: "lightblue",
  comms: "pink",
  industrials: "orange",
  financials: "red",
  discretionary: "yellow",
  healthcare: "green",
  tech: "darkblue",
};

type RawCompany = {
  id: string;
  ticker: string;
  name: string;
  sectorId: string;
  basePricePerShareM: number;
  visitFeePerShareM: number;
  totalShares?: number;
  pricePerShareByLevelM: Record<string, number>;
  boardTileId: string;
  operations: {
    revenueBasePerShareM: number;
    fixedCostPerShareM: number;
  };
};

export type CompanyCard = {
  id: string;
  ticker: string;
  name: string;
  sector: SectorId;
  group: Exclude<ColorGroup, "none" | "railroad" | "utility" | "etf">;
  basePricePerShareM: number;
  visitFeePerShareM: number;
  totalShares: number;
  pricePerShareByLevelM: Record<number, number>;
  boardTileIndex: number;
  revenueBasePerShareM: number;
  fixedCostPerShareM: number;
};

function parseTileIndex(boardTileId: string): number {
  const m = /^tile_(\d+)$/i.exec(boardTileId);
  if (!m) throw new Error(`Bad boardTileId ${boardTileId}`);
  return Number(m[1]);
}

function parseCompany(rawCard: RawCompany): CompanyCard {
  const sector = CODE_TO_SECTOR[rawCard.sectorId];
  if (!sector) throw new Error(`Unknown sector ${rawCard.sectorId}`);
  const levels: Record<number, number> = {};
  for (const [k, v] of Object.entries(rawCard.pricePerShareByLevelM ?? {})) {
    levels[Number(k)] = v;
  }
  return {
    id: rawCard.id,
    ticker: rawCard.ticker,
    name: rawCard.name,
    sector,
    group: SECTOR_TO_GROUP[sector],
    basePricePerShareM: rawCard.basePricePerShareM,
    visitFeePerShareM: rawCard.visitFeePerShareM,
    totalShares: rawCard.totalShares ?? 10,
    pricePerShareByLevelM: levels,
    boardTileIndex: parseTileIndex(rawCard.boardTileId),
    revenueBasePerShareM: rawCard.operations.revenueBasePerShareM,
    fixedCostPerShareM: rawCard.operations.fixedCostPerShareM,
  };
}

export const COMPANY_CARDS: CompanyCard[] = Object.values(
  raw.companiesById as Record<string, RawCompany>,
).map(parseCompany);

const BY_TICKER = Object.fromEntries(
  COMPANY_CARDS.map((c) => [c.ticker, c]),
) as Record<string, CompanyCard>;

const BY_TILE = Object.fromEntries(
  COMPANY_CARDS.map((c) => [c.boardTileIndex, c]),
) as Record<number, CompanyCard>;

export function companyByTicker(ticker: string): CompanyCard | undefined {
  return BY_TICKER[ticker];
}

export function companyByTileIndex(tileIndex: number): CompanyCard | undefined {
  return BY_TILE[tileIndex];
}

/** Prefer JSON level table; fall back to P₀×(1+n×10%). */
export function companySharePrice(
  company: CompanyCard,
  sectorLevel: number,
): number {
  const keyed = company.pricePerShareByLevelM[sectorLevel];
  if (keyed != null) return keyed;
  return Math.max(
    1,
    Math.round(company.basePricePerShareM * (1 + sectorLevel * 0.1)),
  );
}

/**
 * Cycle adj as % of P₀ so cheap and rich names share the same % risk.
 * weak (−5…−2): opsWeakPct, normal (−1…+1): 0, strong (+2…+5): opsStrongPct.
 */
export function revenueAdjustmentPerShare(
  sectorLevel: number,
  basePricePerShareM = 200,
): number {
  const p0 = Math.max(1, basePricePerShareM);
  if (sectorLevel <= -2) return Math.round(p0 * BALANCE.opsWeakPct);
  if (sectorLevel >= 2) return Math.round(p0 * BALANCE.opsStrongPct);
  return 0;
}

export function revenueAtLevel(
  revenueBasePerShareM: number,
  sectorLevel: number,
  basePricePerShareM = 200,
): number {
  return (
    revenueBasePerShareM +
    revenueAdjustmentPerShare(sectorLevel, basePricePerShareM)
  );
}

/**
 * Net ops / share: blended flat margin (JSON ↔ target yield) + cycle adj.
 * Pass P₀ so yields stay business-like across the price ladder.
 */
export function netOpsPerShare(
  revenueBasePerShareM: number,
  fixedCostPerShareM: number,
  sectorLevel: number,
  basePricePerShareM = 200,
): number {
  const p0 = Math.max(1, basePricePerShareM);
  const raw = revenueBasePerShareM - fixedCostPerShareM;
  const target = Math.max(1, Math.round(p0 * BALANCE.opsFlatYieldPct));
  const blend = Math.max(0, Math.min(1, BALANCE.opsFlatBlend));
  const flat = Math.round(raw * (1 - blend) + target * blend);
  return flat + revenueAdjustmentPerShare(sectorLevel, p0);
}
