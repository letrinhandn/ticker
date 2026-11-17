import type { SectorId } from "@/shared/types";
import type { FundId } from "@/lib/game/content/funds";
import type { MessageKey } from "./messages";

const SECTOR_KEYS: Record<SectorId, MessageKey> = {
  staples: "sector.staples",
  energy: "sector.energy",
  comms: "sector.comms",
  industrials: "sector.industrials",
  financials: "sector.financials",
  discretionary: "sector.discretionary",
  healthcare: "sector.healthcare",
  tech: "sector.tech",
};

const FUND_KEYS: Record<FundId, MessageKey> = {
  GRW: "fund.GRW",
  INF: "fund.INF",
  DEF: "fund.DEF",
  CYC: "fund.CYC",
  DIV: "fund.DIV",
  CON: "fund.CON",
};

export function sectorNameKey(sector: SectorId): MessageKey {
  return SECTOR_KEYS[sector];
}

export function fundNameKey(fundId: FundId): MessageKey {
  return FUND_KEYS[fundId];
}
