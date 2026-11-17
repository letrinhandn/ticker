import { describe, expect, it } from "vitest";
import {
  GO_TO_HALT_INDEX,
  HALT_FINE,
  HALT_INDEX,
  INCOME_TAX,
  ORDER_FEE_M,
  PROTOCOL_VERSION,
  SECTOR_MAX,
  SECTOR_MIN,
  STARTING_CASH,
  START_CASH_TAX_RATE,
  WEALTH_TAX,
} from "@/shared/types";
import { SECTOR_IDS } from "@/lib/game/board";
import { getBalanceCatalog, catalogFormulas } from "./catalog";

const LEVELS = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5] as const;

describe("getBalanceCatalog completeness", () => {
  const catalog = getBalanceCatalog();

  it("has expected collection counts", () => {
    expect(catalog.companies).toHaveLength(22);
    expect(catalog.etfs).toHaveLength(6);
    expect(catalog.board).toHaveLength(40);
    expect(catalog.priceReactions.cards).toHaveLength(100);
    expect(catalog.marketNews.cards).toHaveLength(100);
    expect(catalog.dice.openingFaces).toHaveLength(6);
    expect(
      catalog.dice.openingFaces.filter((f) => f.kind === "preset"),
    ).toHaveLength(5);
  });

  it("mirrors live globals", () => {
    expect(catalog.globals.PROTOCOL_VERSION).toBe(PROTOCOL_VERSION);
    expect(catalog.globals.STARTING_CASH).toBe(STARTING_CASH);
    expect(catalog.globals.START_CASH_TAX_RATE).toBe(START_CASH_TAX_RATE);
    expect(catalog.globals.ORDER_FEE_M).toBe(ORDER_FEE_M);
    expect(catalog.globals.HALT_FINE).toBe(HALT_FINE);
    expect(catalog.globals.HALT_INDEX).toBe(HALT_INDEX);
    expect(catalog.globals.GO_TO_HALT_INDEX).toBe(GO_TO_HALT_INDEX);
    expect(catalog.globals.INCOME_TAX).toBe(INCOME_TAX);
    expect(catalog.globals.WEALTH_TAX).toBe(WEALTH_TAX);
    expect(catalog.globals.SECTOR_MIN).toBe(SECTOR_MIN);
    expect(catalog.globals.SECTOR_MAX).toBe(SECTOR_MAX);
    expect(catalog.globals.tradesLeftPerTurn).toBe(1);
  });

  it("every company has full −5…+5 price + ops grids", () => {
    for (const c of catalog.companies) {
      for (const lv of LEVELS) {
        const key = String(lv);
        expect(c.pricePerShareByLevelM[key]).toEqual(expect.any(Number));
        expect(c.pricePerShareByLevelM[key]!).toBeGreaterThanOrEqual(1);
        expect(c.netOpsPerShareByLevel[key]).toEqual(expect.any(Number));
      }
    }
  });

  it("every PR card has an 8×8 matrix with numeric buy/sell in −5…+5", () => {
    for (const card of catalog.priceReactions.cards) {
      for (const row of SECTOR_IDS) {
        expect(card.matrix[row]).toBeTruthy();
        for (const col of SECTOR_IDS) {
          const cell = card.matrix[row]![col]!;
          expect(typeof cell.buy).toBe("number");
          expect(typeof cell.sell).toBe("number");
          expect(cell.buy).toBeGreaterThanOrEqual(-5);
          expect(cell.buy).toBeLessThanOrEqual(5);
          expect(cell.sell).toBeGreaterThanOrEqual(-5);
          expect(cell.sell).toBeLessThanOrEqual(5);
        }
      }
    }
  });

  it("every news card has regime + shocks", () => {
    for (const card of catalog.marketNews.cards) {
      expect(card.regime === "bull" || card.regime === "bear").toBe(true);
      expect(card.shocks).toBeTruthy();
      expect(typeof card.shocks).toBe("object");
    }
    expect(catalog.marketNews.aggregates.bull).toBe(50);
    expect(catalog.marketNews.aggregates.bear).toBe(50);
  });

  it("ETF sensitivity tables cover each sleeve × levels", () => {
    for (const etf of catalog.etfs) {
      expect(etf.priceAtAllZero).toBe(etf.basePricePerUnitM);
      for (const sector of etf.sectorIds) {
        const row = etf.singleSleeveSensitivity[sector];
        expect(row).toBeTruthy();
        for (const lv of LEVELS) {
          expect(row![String(lv)]).toEqual(expect.any(Number));
        }
      }
    }
  });

  it("formula helpers match catalog grids", () => {
    const c = catalog.companies[0]!;
    expect(catalogFormulas.companySharePrice(
      {
        ...c,
        pricePerShareByLevelM: Object.fromEntries(
          Object.entries(c.pricePerShareByLevelM).map(([k, v]) => [
            Number(k),
            v,
          ]),
        ),
      } as Parameters<typeof catalogFormulas.companySharePrice>[0],
      0,
    )).toBe(c.pricePerShareByLevelM["0"]);
    expect(catalogFormulas.sharePrice(100, 2)).toBe(120);
    expect(catalogFormulas.feePerShare(100)).toBe(
      Math.round(10 * catalog.globals.visitFeeMult),
    );
  });

  it("fingerprint is stable across rebuilds", () => {
    const again = getBalanceCatalog();
    expect(again.fingerprint).toBe(catalog.fingerprint);
    expect(catalog.fingerprint).toMatch(/^[0-9a-f]{8}$/);
  });

  it("sector mean stays visually clear of every company line at all levels", () => {
    const bySector = new Map<string, typeof catalog.companies>();
    for (const c of catalog.companies) {
      const list = bySector.get(c.sector) ?? [];
      list.push(c);
      bySector.set(c.sector, list);
    }
    for (const [sectorId, list] of bySector) {
      for (const lv of LEVELS) {
        const key = String(lv);
        const prices = list.map((co) => co.pricePerShareByLevelM[key]!);
        const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
        const range = Math.max(...prices) - Math.min(...prices) || 1;
        // 3+ tickers: keep TB ngành off the mid line (≥12% of chart range).
        // 2 tickers: mean is midway — require ≥35% of range.
        const minGap =
          list.length >= 3
            ? Math.max(12, range * 0.12)
            : Math.max(8, range * 0.35);
        for (const price of prices) {
          const gap = Math.abs(price - mean);
          expect(
            gap,
            `${sectorId} level ${lv}: |${price} − mean ${mean.toFixed(1)}| = ${gap.toFixed(1)} must be ≥ ${minGap.toFixed(1)}`,
          ).toBeGreaterThanOrEqual(minGap);
        }
      }
    }
  });
});
