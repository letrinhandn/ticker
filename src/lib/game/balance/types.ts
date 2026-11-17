import type {
  MarketRegime,
  PlayerToken,
  PrCell,
  PrMatchSide,
  SectorId,
  TileKind,
  ColorGroup,
  TradeSide,
} from "@/shared/types";

export type OpsBand = {
  id: string;
  minLevel: number;
  maxLevel: number;
  revenueAdjustmentPerShareM: number;
  nameEn: string;
  nameVi: string;
};

export type BalanceGlobals = {
  PROTOCOL_VERSION: number;
  MAX_PLAYERS: number;
  PLAYER_TOKENS: PlayerToken[];
  STANDARD_TURNS: number;
  tradesLeftPerTurn: number;
  STARTING_CASH: number;
  START_CASH_TAX_RATE: number;
  START_PAY_BULL: number;
  START_PAY_BEAR: number;
  ORDER_FEE_M: number;
  orderFeeNote: string;
  HALT_FINE: number;
  JAIL_FINE: number;
  HALT_INDEX: number;
  GO_TO_HALT_INDEX: number;
  JAIL_INDEX: number;
  GO_TO_JAIL_INDEX: number;
  INCOME_TAX: number;
  WEALTH_TAX: number;
  SHARES_PER_COMPANY: number;
  SHARES_PER_ETF: number;
  MAX_SHARES_OWNED: number;
  SECTOR_MIN: number;
  SECTOR_MAX: number;
  minSharesPerOrder: number;
  maxSharesPerOrder: number;
  stepPctOfBasePrice: number;
  visitFeeMult: number;
  opsFlatYieldPct: number;
  opsFlatBlend: number;
  opsWeakPct: number;
  opsStrongPct: number;
  opsWeakAdj: number;
  opsStrongAdj: number;
  newsShockMult: number;
  prShockMult: number;
  taxEscalationPerTurn: number;
  visitEscalationPerTurn: number;
  concentrationWeightGate: number;
  concentrationLossMult: number;
  cashHoardNwRatio: number;
  cashHoardTaxExtra: number;
};

export type OpeningDieFace =
  | {
      die: number;
      kind: "preset";
      sourceNewsId: string;
      nameEn: string;
      nameVi: string;
      regime: MarketRegime;
      shocks: Partial<Record<SectorId, number>>;
    }
  | {
      die: number;
      kind: "flat";
      regime: "bull";
      shocks: Record<SectorId, number>;
    };

export type BoardTileCatalog = {
  index: number;
  name: string;
  kind: TileKind;
  group: ColorGroup;
  ticker?: string;
  logo?: string;
  price?: number;
  visitFeePerShare?: number;
  revenueBasePerShare?: number;
  fixedCostPerShare?: number;
  taxAmount?: number;
  chargesVisitFee: boolean;
  isListedCompany: boolean;
};

export type CompanyCatalogEntry = {
  id: string;
  ticker: string;
  name: string;
  sector: SectorId;
  group: string;
  boardTileIndex: number;
  basePricePerShareM: number;
  visitFeePerShareM: number;
  totalShares: number;
  revenueBasePerShareM: number;
  fixedCostPerShareM: number;
  pricePerShareByLevelM: Record<string, number>;
  feePerShare: number;
  netOpsPerShareByLevel: Record<string, number>;
};

export type EtfCatalogEntry = {
  id: string;
  ticker: string;
  name: string;
  tileIndex: number;
  totalUnits: number;
  basePricePerUnitM: number;
  baseContributionM: number;
  sectorIds: SectorId[];
  priceAtAllZero: number;
  /** Price when one sleeve varies −5…+5 and others stay 0. */
  singleSleeveSensitivity: Partial<
    Record<SectorId, Record<string, number>>
  >;
};

export type PrCardCatalogEntry = {
  id: string;
  title: string;
  titleVi?: string;
  text?: string;
  textEn?: string;
  intensity?: string;
  feePerExecutedOrderM: number;
  drawCoverageAnchor?: boolean;
  matchConditionsBySide: Record<TradeSide, PrMatchSide>;
  matrix: Record<SectorId, Record<SectorId, PrCell>>;
  aggregates: {
    buyNonZero: number;
    sellNonZero: number;
    buyAbsSum: number;
    sellAbsSum: number;
  };
};

export type NewsCardCatalogEntry = {
  id: string;
  title: string;
  titleVi?: string;
  regime: MarketRegime;
  shocks: Partial<Record<SectorId, number>>;
  text: string;
  textEn?: string;
};

export type BalanceCatalog = {
  generatedAt: string;
  fingerprint: string;
  protocol: {
    PROTOCOL_VERSION: number;
    MAX_PLAYERS: number;
    PLAYER_TOKENS: PlayerToken[];
    STANDARD_TURNS: number;
    tradesLeftPerTurn: number;
  };
  globals: BalanceGlobals;
  dice: {
    movement: string;
    opening: string;
    jail: string;
    faceProbability: number;
    openingFaces: OpeningDieFace[];
  };
  sectors: {
    ids: SectorId[];
    codes: Record<SectorId, string>;
    codeToId: Record<string, SectorId>;
    min: number;
    max: number;
    stepPctOfBasePrice: number;
    priceFormula: string;
    opsFormula: string;
    opsBands: OpsBand[];
  };
  board: BoardTileCatalog[];
  companies: CompanyCatalogEntry[];
  etfs: EtfCatalogEntry[];
  priceReactions: {
    meta: Record<string, unknown>;
    cards: PrCardCatalogEntry[];
    aggregates: {
      count: number;
      feeHistogram: Record<string, number>;
      intensityCounts: Record<string, number>;
      anchorIds: string[];
      matchShareCoverageBuy: Record<string, number>;
      matchShareCoverageSell: Record<string, number>;
      orderFeeRuntimeNote: string;
    };
  };
  marketNews: {
    cards: NewsCardCatalogEntry[];
    aggregates: {
      count: number;
      bull: number;
      bear: number;
      shockAbsSumBySector: Record<SectorId, number>;
      maxAbsShock: number;
    };
  };
  formulas: {
    sharePrice: string;
    feePerShare: string;
    companySharePrice: string;
    netOpsPerShare: string;
    fundSleeveValue: string;
    currentFundPrice: string;
    worstCaseBuyCost: string;
  };
};

export type MatchEndReason = "bankruptcy" | "maxTurns" | "stepCap" | "stuck";

export type MatchPlayerResult = {
  id: string;
  seat: number;
  cash: number;
  netWorth: number;
  bankrupt: boolean;
  bankruptTurn: number | null;
  sharesHeld: number;
  holdings: { tileIndex: number; shares: number }[];
  buys: number;
  sells: number;
  skips: number;
};

export type MatchResult = {
  seed: number;
  players: number;
  maxTurns: number;
  steps: number;
  turns: number;
  phase: string;
  winnerId: string | null;
  endReason: MatchEndReason;
  openingDie: number | null;
  openingPresetId: string | null;
  diceSumHistogram: Record<string, number>;
  jailDoubles: number;
  jailRolls: number;
  landsByTile: Record<string, number>;
  landsByKind: Record<string, number>;
  tradesByTile: Record<string, { buy: number; sell: number; skip: number }>;
  orderFeesPaid: number;
  visitFeesPaid: number;
  startTaxPaid: number;
  startOpsNet: number;
  tileTaxesPaid: number;
  haltFinesPaid: number;
  prDraws: string[];
  newsDraws: string[];
  sectorFinal: Record<SectorId, number>;
  sectorMin: Record<SectorId, number>;
  sectorMax: Record<SectorId, number>;
  /** Company desk actions keyed by sector level at decision (−5…+5). */
  companyTradesByLevel: Record<
    string,
    { buy: number; sell: number; skip: number }
  >;
  /** How many sectors touched the −5 / +5 rail this match. */
  sectorsHitFloor: number;
  sectorsHitCeil: number;
  playerResults: MatchPlayerResult[];
  coverage: {
    companyLand: boolean;
    etfTrade: boolean;
    visitFee: boolean;
    prSettle: boolean;
    news: boolean;
    startPass: boolean;
    tax: boolean;
    halt: boolean;
  };
};

export type BalanceScenario = {
  id: string;
  players: 2 | 3 | 4;
  maxTurns: number;
  vitestGames: number;
  cliGames: number;
};

export type BatchReport = {
  scenarioId: string;
  games: number;
  baseSeed: number;
  finished: number;
  endReasons: Record<string, number>;
  winRateBySeat: number[];
  winRateByPlayerId: Record<string, number>;
  medianTurns: number;
  p90Turns: number;
  meanTurns: number;
  prIdCoverage: number;
  newsIdCoverage: number;
  prIdsSeen: number;
  newsIdsSeen: number;
  meanBuysPerGame: number;
  meanSellsPerGame: number;
  meanOrderFees: number;
  meanVisitFees: number;
  meanNetWorthGap: number;
  matches: MatchResult[];
};
