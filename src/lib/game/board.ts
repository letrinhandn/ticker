import type { BoardTile, ColorGroup, SectorId } from "@/shared/types";
import { companyByTicker } from "./content/companies";

export const COLOR_TO_SECTOR: Record<
  Exclude<ColorGroup, "none" | "railroad" | "utility" | "etf">,
  SectorId
> = {
  brown: "staples",
  lightblue: "energy",
  pink: "comms",
  orange: "industrials",
  red: "financials",
  yellow: "discretionary",
  green: "healthcare",
  darkblue: "tech",
};

export const SECTOR_IDS: SectorId[] = [
  "staples",
  "energy",
  "comms",
  "industrials",
  "financials",
  "discretionary",
  "healthcare",
  "tech",
];

export const SECTOR_CODE: Record<SectorId, string> = {
  staples: "CS",
  energy: "EN",
  comms: "CM",
  industrials: "IN",
  financials: "FI",
  discretionary: "CD",
  healthcare: "HC",
  tech: "TE",
};

function company(index: number, ticker: string): BoardTile {
  const c = companyByTicker(ticker);
  if (!c) throw new Error(`Missing company card ${ticker}`);
  if (c.boardTileIndex !== index) {
    throw new Error(
      `Company ${ticker} tile mismatch: json=${c.boardTileIndex} board=${index}`,
    );
  }
  return {
    index,
    name: c.name,
    ticker: c.ticker,
    logo: `/logos/${c.ticker}.png`,
    kind: "company",
    group: c.group,
    price: c.basePricePerShareM,
    visitFeePerShare: c.visitFeePerShareM,
    revenueBasePerShare: c.revenueBasePerShareM,
    fixedCostPerShare: c.fixedCostPerShareM,
  };
}

function etf(index: number, name: string, ticker: string, price: number): BoardTile {
  return {
    index,
    name,
    ticker,
    kind: "etf",
    group: "etf",
    price,
    special: true,
  };
}

/**
 * Marketpoly V4.0 playtest ETF —
 * 6 quỹ thay môi giới/tiện ích; 3 ô SÀN → Market News.
 */
export const BOARD: BoardTile[] = [
  { index: 0, name: "START", kind: "go", group: "none", logo: "/tiles/start.svg" },
  company(1, "WMT"),
  { index: 2, name: "Market News", kind: "regime", group: "none" },
  company(3, "KO"),
  {
    index: 4,
    name: "Income Tax",
    kind: "tax",
    group: "none",
    taxAmount: 120,
    price: 100,
    logo: "/tiles/income-tax.svg",
  },
  etf(5, "Growth Fund", "GRW", 300),
  company(6, "XOM"),
  { index: 7, name: "Market News", kind: "regime", group: "none" },
  company(8, "CVX"),
  company(9, "SHEL"),
  {
    index: 10,
    name: "SEC Investigation",
    kind: "halt",
    group: "none",
    logo: "/tiles/sec.svg",
  },
  company(11, "GOOGL"),
  etf(12, "Infrastructure Fund", "INF", 300),
  company(13, "META"),
  company(14, "NFLX"),
  etf(15, "Defensive Fund", "DEF", 300),
  company(16, "CAT"),
  { index: 17, name: "Market News", kind: "regime", group: "none" },
  company(18, "BA"),
  company(19, "SIE"),
  {
    index: 20,
    name: "Weekend",
    kind: "free",
    group: "none",
    logo: "/tiles/weekend.svg",
  },
  company(21, "JPM"),
  { index: 22, name: "Market News", kind: "regime", group: "none" },
  company(23, "V"),
  company(24, "MA"),
  etf(25, "Cyclical Fund", "CYC", 300),
  company(26, "AMZN"),
  company(27, "TSLA"),
  etf(28, "Diversified Fund", "DIV", 300),
  company(29, "NKE"),
  {
    index: 30,
    name: "Go to SEC Investigation",
    kind: "goto_halt",
    group: "none",
    logo: "/tiles/to-sec.svg",
  },
  company(31, "JNJ"),
  company(32, "PFE"),
  { index: 33, name: "Market News", kind: "regime", group: "none" },
  company(34, "LLY"),
  etf(35, "Consumer Fund", "CON", 300),
  { index: 36, name: "Market News", kind: "regime", group: "none" },
  company(37, "AAPL"),
  {
    index: 38,
    name: "Wealth Tax",
    kind: "tax",
    group: "none",
    taxAmount: 250,
    price: 200,
    logo: "/tiles/wealth-tax.svg",
  },
  company(39, "MSFT"),
];

/** Sector metadata for UI (localized names via `sectorNameKey` / i18n). */
export const SECTOR_LABELS: { group: ColorGroup; sector: SectorId }[] = [
  { group: "brown", sector: "staples" },
  { group: "lightblue", sector: "energy" },
  { group: "pink", sector: "comms" },
  { group: "orange", sector: "industrials" },
  { group: "red", sector: "financials" },
  { group: "yellow", sector: "discretionary" },
  { group: "green", sector: "healthcare" },
  { group: "darkblue", sector: "tech" },
];

export const GROUP_COLORS: Record<string, string> = {
  brown: "#79503A",
  lightblue: "#7FB8CF",
  pink: "#CE568E",
  orange: "#E89032",
  red: "#C8353B",
  yellow: "#E4BD31",
  green: "#3C966E",
  darkblue: "#24568B",
  etf: "#2F4F4F",
  railroad: "#1c1c1c",
  utility: "#5b7c8a",
  none: "transparent",
};

/** Tradeable company or ETF unit. */
export function isListedCompany(tile: BoardTile): boolean {
  return tile.kind === "company" || tile.kind === "etf";
}

export function isEtfTile(tile: BoardTile): boolean {
  return tile.kind === "etf";
}

/** Visit fee only on sector companies (ETFs charge 0). */
export function chargesVisitFee(tile: BoardTile): boolean {
  return tile.kind === "company" && tile.price != null;
}

export function sectorForTile(tile: BoardTile): SectorId | null {
  if (
    tile.kind === "company" &&
    tile.group !== "none" &&
    tile.group !== "railroad" &&
    tile.group !== "utility" &&
    tile.group !== "etf"
  ) {
    return COLOR_TO_SECTOR[tile.group];
  }
  return null;
}

/** Sector companies only (ETFs are multi-sector). */
export function companiesInSector(sector: SectorId): BoardTile[] {
  return BOARD.filter((t) => t.kind === "company" && sectorForTile(t) === sector);
}
