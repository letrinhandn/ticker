import {
  GO_TO_HALT_INDEX,
  HALT_FINE,
  HALT_INDEX,
  INCOME_TAX,
  JAIL_FINE,
  JAIL_INDEX,
  GO_TO_JAIL_INDEX,
  MAX_PLAYERS,
  MAX_SHARES_OWNED,
  ORDER_FEE_M,
  PLAYER_TOKENS,
  PROTOCOL_VERSION,
  SECTOR_MAX,
  SECTOR_MIN,
  SHARES_PER_COMPANY,
  SHARES_PER_ETF,
  STANDARD_TURNS,
  START_CASH_TAX_RATE,
  START_PAY_BEAR,
  START_PAY_BULL,
  STARTING_CASH,
  WEALTH_TAX,
  type SectorId,
  type TradeSide,
} from "@/shared/types";
import {
  BOARD,
  SECTOR_CODE,
  SECTOR_IDS,
  chargesVisitFee,
  isListedCompany,
} from "@/lib/game/board";
import {
  COMPANY_CARDS,
  companySharePrice,
  netOpsPerShare,
  revenueAdjustmentPerShare,
} from "@/lib/game/content/companies";
import {
  FUNDS,
  currentFundPrice,
  fundSleeveValue,
} from "@/lib/game/content/funds";
import { OPENING_PRESETS } from "@/lib/game/content/openingRegimes";
import {
  CODE_TO_SECTOR,
  PRICE_REACTIONS,
} from "@/lib/game/content/priceReactions";
import { REGIME_CARDS, emptySectorIndex } from "@/lib/game/content/regimes";
import { feePerShare, sharePrice } from "@/lib/game/pricing";
import prRaw from "@/content/priceReactions100.json";
import companyRaw from "@/content/companyCards22.json";
import { BALANCE } from "./knobs";
import { fnv1aHex } from "./rng";
import type {
  BalanceCatalog,
  CompanyCatalogEntry,
  EtfCatalogEntry,
  NewsCardCatalogEntry,
  OpeningDieFace,
  OpsBand,
  PrCardCatalogEntry,
} from "./types";

const LEVELS = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5] as const;

function opsBandsFromJson(): OpsBand[] {
  const rules = (
    companyRaw as {
      rules?: {
        companyStartSettlement?: {
          states?: OpsBand[];
        };
      };
    }
  ).rules?.companyStartSettlement?.states;
  // Catalog shows % of P₀ × reference 200 so bands stay comparable.
  const weakAdj = Math.round(200 * BALANCE.opsWeakPct);
  const strongAdj = Math.round(200 * BALANCE.opsStrongPct);
  if (rules?.length) {
    return rules.map((band) => {
      if (band.id === "weak") {
        return { ...band, revenueAdjustmentPerShareM: weakAdj };
      }
      if (band.id === "strong") {
        return { ...band, revenueAdjustmentPerShareM: strongAdj };
      }
      return band;
    });
  }
  return [
    {
      id: "weak",
      minLevel: -5,
      maxLevel: -2,
      revenueAdjustmentPerShareM: weakAdj,
      nameEn: "Weak",
      nameVi: "Yếu",
    },
    {
      id: "normal",
      minLevel: -1,
      maxLevel: 1,
      revenueAdjustmentPerShareM: 0,
      nameEn: "Normal",
      nameVi: "Bình thường",
    },
    {
      id: "strong",
      minLevel: 2,
      maxLevel: 5,
      revenueAdjustmentPerShareM: strongAdj,
      nameEn: "Strong",
      nameVi: "Mạnh",
    },
  ];
}

function openingFaces(): OpeningDieFace[] {
  const faces: OpeningDieFace[] = [];
  for (let die = 1; die <= 5; die++) {
    const p = OPENING_PRESETS.find((x) => x.die === die);
    if (!p) continue;
    faces.push({
      die,
      kind: "preset",
      sourceNewsId: p.sourceNewsId,
      nameEn: p.nameEn,
      nameVi: p.nameVi,
      regime: p.regime,
      shocks: { ...p.shocks },
    });
  }
  const zero = emptySectorIndex();
  faces.push({
    die: 6,
    kind: "flat",
    regime: "bull",
    shocks: { ...zero },
  });
  return faces;
}

function buildCompanies(): CompanyCatalogEntry[] {
  return COMPANY_CARDS.map((c) => {
    const pricePerShareByLevelM: Record<string, number> = {};
    const netOpsPerShareByLevel: Record<string, number> = {};
    for (const lv of LEVELS) {
      pricePerShareByLevelM[String(lv)] = companySharePrice(c, lv);
      netOpsPerShareByLevel[String(lv)] = netOpsPerShare(
        c.revenueBasePerShareM,
        c.fixedCostPerShareM,
        lv,
        c.basePricePerShareM,
      );
    }
    return {
      id: c.id,
      ticker: c.ticker,
      name: c.name,
      sector: c.sector,
      group: c.group,
      boardTileIndex: c.boardTileIndex,
      basePricePerShareM: c.basePricePerShareM,
      visitFeePerShareM: c.visitFeePerShareM,
      totalShares: c.totalShares,
      revenueBasePerShareM: c.revenueBasePerShareM,
      fixedCostPerShareM: c.fixedCostPerShareM,
      pricePerShareByLevelM,
      feePerShare: feePerShare(c.basePricePerShareM, c.visitFeePerShareM),
      netOpsPerShareByLevel,
    };
  }).sort((a, b) => a.boardTileIndex - b.boardTileIndex);
}

function buildEtfs(): EtfCatalogEntry[] {
  return FUNDS.map((f) => {
    const zero = emptySectorIndex();
    const singleSleeveSensitivity: EtfCatalogEntry["singleSleeveSensitivity"] =
      {} as EtfCatalogEntry["singleSleeveSensitivity"];
    for (const sector of f.sectorIds) {
      const row: Record<string, number> = {};
      for (const lv of LEVELS) {
        const idx = { ...zero, [sector]: lv };
        row[String(lv)] = currentFundPrice({ sectorIndex: idx }, f);
      }
      singleSleeveSensitivity[sector] = row;
    }
    return {
      id: f.id,
      ticker: f.ticker,
      name: f.name,
      tileIndex: f.tileIndex,
      totalUnits: f.totalUnits,
      basePricePerUnitM: f.basePricePerUnitM,
      baseContributionM: f.baseContributionM,
      sectorIds: [...f.sectorIds],
      priceAtAllZero: currentFundPrice({ sectorIndex: zero }, f),
      singleSleeveSensitivity,
    };
  });
}

function cardMatchesShare(
  side: TradeSide,
  shares: number,
  card: (typeof PRICE_REACTIONS)[number],
): boolean {
  const anyOf = card.matchConditionsBySide[side]?.anyOf ?? [];
  if (!anyOf.length) return true;
  return anyOf.some((clause) => {
    if (!clause.shares) return true;
    const min = clause.shares.min ?? 1;
    const max = clause.shares.max ?? 10;
    return shares >= min && shares <= max;
  });
}

function buildPrCards(): PrCardCatalogEntry[] {
  return PRICE_REACTIONS.map((card) => {
    let buyNonZero = 0;
    let sellNonZero = 0;
    let buyAbsSum = 0;
    let sellAbsSum = 0;
    for (const row of SECTOR_IDS) {
      for (const col of SECTOR_IDS) {
        const cell = card.matrix[row]![col]!;
        if (cell.buy !== 0) {
          buyNonZero += 1;
          buyAbsSum += Math.abs(cell.buy);
        }
        if (cell.sell !== 0) {
          sellNonZero += 1;
          sellAbsSum += Math.abs(cell.sell);
        }
      }
    }
    return {
      id: card.id,
      title: card.title,
      titleVi: card.titleVi,
      text: card.text,
      textEn: card.textEn,
      intensity: card.intensity,
      feePerExecutedOrderM: card.feePerExecutedOrderM,
      drawCoverageAnchor: card.drawCoverageAnchor,
      matchConditionsBySide: card.matchConditionsBySide,
      matrix: card.matrix,
      aggregates: { buyNonZero, sellNonZero, buyAbsSum, sellAbsSum },
    };
  });
}

function buildNews(): NewsCardCatalogEntry[] {
  return REGIME_CARDS.map((c) => ({
    id: c.id,
    title: c.title,
    titleVi: c.titleVi,
    regime: c.regime,
    shocks: { ...c.shocks },
    text: c.text,
    textEn: c.textEn,
  }));
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).sort(([a], [b]) =>
          a.localeCompare(b),
        ),
      );
    }
    return v;
  });
}

/** Full balance catalog — every live gameplay number / card matrix. */
export function getBalanceCatalog(): BalanceCatalog {
  const companies = buildCompanies();
  const etfs = buildEtfs();
  const prCards = buildPrCards();
  const newsCards = buildNews();

  const feeHistogram: Record<string, number> = {};
  const intensityCounts: Record<string, number> = {};
  const anchorIds: string[] = [];
  const matchShareCoverageBuy: Record<string, number> = {};
  const matchShareCoverageSell: Record<string, number> = {};
  for (let s = 1; s <= 10; s++) {
    matchShareCoverageBuy[String(s)] = 0;
    matchShareCoverageSell[String(s)] = 0;
  }
  for (const card of PRICE_REACTIONS) {
    const feeKey = String(card.feePerExecutedOrderM);
    feeHistogram[feeKey] = (feeHistogram[feeKey] ?? 0) + 1;
    const inten = card.intensity ?? "(none)";
    intensityCounts[inten] = (intensityCounts[inten] ?? 0) + 1;
    if (card.drawCoverageAnchor) anchorIds.push(card.id);
    for (let s = 1; s <= 10; s++) {
      if (cardMatchesShare("buy", s, card)) {
        matchShareCoverageBuy[String(s)]! += 1;
      }
      if (cardMatchesShare("sell", s, card)) {
        matchShareCoverageSell[String(s)]! += 1;
      }
    }
  }

  const shockAbsSumBySector = Object.fromEntries(
    SECTOR_IDS.map((s) => [s, 0]),
  ) as Record<SectorId, number>;
  let maxAbsShock = 0;
  let bull = 0;
  let bear = 0;
  for (const c of newsCards) {
    if (c.regime === "bull") bull += 1;
    else bear += 1;
    for (const [sector, delta] of Object.entries(c.shocks)) {
      const d = Number(delta) || 0;
      const sid = sector as SectorId;
      if (sid in shockAbsSumBySector) {
        shockAbsSumBySector[sid] += Math.abs(d);
      }
      maxAbsShock = Math.max(maxAbsShock, Math.abs(d));
    }
  }

  const globals = {
    PROTOCOL_VERSION,
    MAX_PLAYERS,
    PLAYER_TOKENS: [...PLAYER_TOKENS],
    STANDARD_TURNS,
    tradesLeftPerTurn: 1,
    STARTING_CASH,
    START_CASH_TAX_RATE,
    START_PAY_BULL,
    START_PAY_BEAR,
    ORDER_FEE_M,
    orderFeeNote:
      "Runtime company settle uses ORDER_FEE_M; card.feePerExecutedOrderM is metadata only.",
    HALT_FINE,
    JAIL_FINE,
    HALT_INDEX,
    GO_TO_HALT_INDEX,
    JAIL_INDEX,
    GO_TO_JAIL_INDEX,
    INCOME_TAX,
    WEALTH_TAX,
    SHARES_PER_COMPANY,
    SHARES_PER_ETF,
    MAX_SHARES_OWNED,
    SECTOR_MIN,
    SECTOR_MAX,
    minSharesPerOrder: 1,
    maxSharesPerOrder: 10,
    stepPctOfBasePrice: 10,
    visitFeeMult: BALANCE.visitFeeMult,
    opsFlatYieldPct: BALANCE.opsFlatYieldPct,
    opsFlatBlend: BALANCE.opsFlatBlend,
    opsWeakPct: BALANCE.opsWeakPct,
    opsStrongPct: BALANCE.opsStrongPct,
    opsWeakAdj: Math.round(200 * BALANCE.opsWeakPct),
    opsStrongAdj: Math.round(200 * BALANCE.opsStrongPct),
    newsShockMult: BALANCE.newsShockMult,
    prShockMult: BALANCE.prShockMult,
    taxEscalationPerTurn: BALANCE.taxEscalationPerTurn,
    visitEscalationPerTurn: BALANCE.visitEscalationPerTurn,
    concentrationWeightGate: BALANCE.concentrationWeightGate,
    concentrationLossMult: BALANCE.concentrationLossMult,
    cashHoardNwRatio: BALANCE.cashHoardNwRatio,
    cashHoardTaxExtra: BALANCE.cashHoardTaxExtra,
  };

  const board = BOARD.map((t) => ({
    index: t.index,
    name: t.name,
    kind: t.kind,
    group: t.group,
    ticker: t.ticker,
    logo: t.logo,
    price: t.price,
    visitFeePerShare: t.visitFeePerShare,
    revenueBasePerShare: t.revenueBasePerShare,
    fixedCostPerShare: t.fixedCostPerShare,
    taxAmount: t.taxAmount,
    chargesVisitFee: chargesVisitFee(t),
    isListedCompany: isListedCompany(t),
  }));

  const prMeta = {
    id: (prRaw as { id?: string }).id,
    schemaVersion: (prRaw as { schemaVersion?: string }).schemaVersion,
    expectedCount: (prRaw as { expectedCount?: number }).expectedCount,
    drawOrder: (prRaw as { drawOrder?: string }).drawOrder,
    sectorOrder: (prRaw as { sectorOrder?: string[] }).sectorOrder,
    effectUnit: (prRaw as { effectUnit?: string }).effectUnit,
    rules: (prRaw as { rules?: unknown }).rules,
    matrix: (prRaw as { matrix?: unknown }).matrix,
    balanceRevision: (prRaw as { balanceRevision?: string }).balanceRevision,
    validation: (prRaw as { validation?: unknown }).validation,
  };

  const body = {
    protocol: {
      PROTOCOL_VERSION,
      MAX_PLAYERS,
      PLAYER_TOKENS: [...PLAYER_TOKENS],
      STANDARD_TURNS,
      tradesLeftPerTurn: 1,
    },
    globals,
    dice: {
      movement: "2d6",
      opening: "1d6",
      jail: "2d6 doubles to leave; else pay HALT_FINE after 3 fails or voluntary pay",
      faceProbability: 1 / 6,
      openingFaces: openingFaces(),
    },
    sectors: {
      ids: [...SECTOR_IDS],
      codes: { ...SECTOR_CODE },
      codeToId: { ...CODE_TO_SECTOR },
      min: SECTOR_MIN,
      max: SECTOR_MAX,
      stepPctOfBasePrice: 10,
      priceFormula: "max(1, round(P0 * (1 + level * 0.1)))",
      opsFormula:
        "netPerShare = revenueBase + revenueAdjustment(level) - fixedCost; × holdings; ETF excluded",
      opsBands: opsBandsFromJson(),
    },
    board,
    companies,
    etfs,
    priceReactions: {
      meta: prMeta,
      cards: prCards,
      aggregates: {
        count: prCards.length,
        feeHistogram,
        intensityCounts,
        anchorIds,
        matchShareCoverageBuy,
        matchShareCoverageSell,
        orderFeeRuntimeNote: globals.orderFeeNote,
      },
    },
    marketNews: {
      cards: newsCards,
      aggregates: {
        count: newsCards.length,
        bull,
        bear,
        shockAbsSumBySector,
        maxAbsShock,
      },
    },
    formulas: {
      sharePrice: "max(1, round(p0 * (1 + sectorIdx * 0.1)))",
      feePerShare: "visitFee ?? round(p0 / 10)",
      companySharePrice:
        "pricePerShareByLevelM[level] ?? sharePrice(basePrice, level)",
      netOpsPerShare:
        "blend(rev−cost, P0×opsFlatYieldPct) + P0×opsWeak/StrongPct(level)",
      fundSleeveValue: "max(1, round(baseContribution * (1 + level * 0.1)))",
      currentFundPrice: "sum(fundSleeveValue(sleeve, sectorIndex[sector]))",
      worstCaseBuyCost:
        "max over quantity-matching buy PR cards of shares * projectedPrice + ORDER_FEE_M",
    },
  };

  // Fingerprint excludes generatedAt so rebuilds stay stable.
  const fingerprint = fnv1aHex(stableStringify(body));

  return {
    generatedAt: new Date().toISOString(),
    fingerprint,
    ...body,
  };
}

/** Aggregates-only view for lighter CLI dumps. */
export function getBalanceCatalogSummary() {
  const full = getBalanceCatalog();
  return {
    generatedAt: full.generatedAt,
    fingerprint: full.fingerprint,
    protocol: full.protocol,
    globals: full.globals,
    dice: {
      movement: full.dice.movement,
      opening: full.dice.opening,
      faceProbability: full.dice.faceProbability,
      openingFaceCount: full.dice.openingFaces.length,
    },
    sectors: {
      ids: full.sectors.ids,
      codes: full.sectors.codes,
      min: full.sectors.min,
      max: full.sectors.max,
      stepPctOfBasePrice: full.sectors.stepPctOfBasePrice,
      opsBands: full.sectors.opsBands,
    },
    boardTileCount: full.board.length,
    companyCount: full.companies.length,
    companies: full.companies.map((c) => ({
      ticker: c.ticker,
      tile: c.boardTileIndex,
      p0: c.basePricePerShareM,
      visit: c.visitFeePerShareM,
      rev: c.revenueBasePerShareM,
      cost: c.fixedCostPerShareM,
    })),
    etfCount: full.etfs.length,
    etfs: full.etfs.map((e) => ({
      ticker: e.ticker,
      tile: e.tileIndex,
      base: e.basePricePerUnitM,
      priceAt0: e.priceAtAllZero,
      sectors: e.sectorIds,
    })),
    priceReactions: full.priceReactions.aggregates,
    marketNews: full.marketNews.aggregates,
    formulas: full.formulas,
  };
}

/** Re-export helpers for formula tests. */
export const catalogFormulas = {
  sharePrice,
  feePerShare,
  companySharePrice,
  netOpsPerShare,
  revenueAdjustmentPerShare,
  fundSleeveValue,
  currentFundPrice,
};
