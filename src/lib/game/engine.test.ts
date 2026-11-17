import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyAction, createGame, currentSharePrice } from "./engine";
import { BOARD } from "./board";
import { feePerShare, sharePrice } from "./pricing";
import {
  cardMatchesSide,
  pressureDeltas,
  prById,
  resolveMatchingPr,
} from "./content/priceReactions";
import {
  HALT_INDEX,
  INCOME_TAX,
  MAX_SHARES_OWNED,
  ORDER_FEE_M,
  START_CASH_TAX_RATE,
  STARTING_CASH,
} from "@/shared/types";
import { companyByTileIndex, netOpsPerShare } from "./content/companies";
import { emptySectorIndex } from "./content/cards";
import { sectorForTile } from "./board";
import { BALANCE, resetBalanceKnobs, setBalanceKnobs } from "./balance/knobs";

function rngSeq(values: number[]) {
  let i = 0;
  return () => {
    const v = values[i % values.length]!;
    i += 1;
    return v;
  };
}

/** Drain dismiss/trade-skip until clear or max steps. */
function clearModals(g: ReturnType<typeof createGame>, id: string) {
  let state = g;
  for (let i = 0; i < 16; i++) {
    const p = state.pending;
    if (!p) break;
    if (p.type === "info" || p.type === "price_reaction" || p.type === "regime") {
      state = applyAction(state, id, { type: "dismiss" });
      continue;
    }
    if (p.type === "trade") {
      state = applyAction(state, id, { type: "trade", action: "skip" });
      continue;
    }
    break;
  }
  return state;
}

describe("pricing V4", () => {
  it("Apple +2 = 414 (no regime multiplier)", () => {
    expect(sharePrice(345, 2)).toBe(414);
  });

  it("Apple fee = P0/10 × visitFeeMult", () => {
    expect(feePerShare(345)).toBe(Math.round(35 * BALANCE.visitFeeMult));
  });
});

describe("PR quantity deck (EN/VI)", () => {
  beforeEach(() => setBalanceKnobs({ prShockMult: 1 }));
  afterEach(() => resetBalanceKnobs());

  it("PR-04 sell any qty matches and applies full TE sell row", () => {
    const card = prById("PR-04");
    expect(cardMatchesSide(card, "sell", 8, "tech", 0)).toBe(true);
    const deltas = pressureDeltas(card, "tech", 8, "sell");
    const bySector = Object.fromEntries(deltas.map((d) => [d.sector, d.delta]));
    expect(bySector.tech).toBe(-3);
    expect(bySector.energy).toBe(2);
    expect(bySector.comms).toBe(-1);
    expect(sharePrice(345, -3)).toBe(241);
  });

  it("PR-04 buy 2 does not match (>3 shares required)", () => {
    expect(cardMatchesSide(prById("PR-04"), "buy", 2, "tech", 0)).toBe(false);
    expect(cardMatchesSide(prById("PR-04"), "buy", 4, "tech", 0)).toBe(true);
  });

  it("resolveMatchingPr prefers mock prefix PR-95 for small sell", () => {
    const { card, deltas } = resolveMatchingPr(
      {
        side: "sell",
        shares: 1,
        tradedSector: "tech",
        levelBefore: 0,
      },
      () => 0.1,
      ["PR-95"],
    );
    expect(card.id).toBe("PR-95");
    const bySector = Object.fromEntries(deltas.map((d) => [d.sector, d.delta]));
    expect(bySector.tech).toBe(-5);
    expect(bySector.industrials).toBe(-3);
  });

  it("coverage anchors match any valid quantity", () => {
    for (const id of ["PR-20", "PR-28", "PR-75", "PR-80"]) {
      expect(cardMatchesSide(prById(id), "buy", 1, "tech", 0)).toBe(true);
      expect(cardMatchesSide(prById(id), "sell", 1, "staples", 0)).toBe(true);
    }
  });
});

describe("createGame V5", () => {
  it("starts with starting cash, 100 PR cards, unused news deck", () => {
    const g = createGame(
      [
        { id: "a", name: "A", token: "amber" },
        { id: "b", name: "B", token: "teal" },
      ],
      () => 0.1,
    );
    expect(g.players[0]!.cash).toBe(STARTING_CASH);
    expect(STARTING_CASH).toBe(1700);
    expect(g.holdings).toHaveLength(0);
    expect(g.prDeck.length).toBe(100);
    expect(g.regimeDeck).toEqual([]);
    expect(g.regimeDiscard).toEqual([]);
  });

  it("d6=6 opens flat bull with all sectors at 0", () => {
    const g = createGame(
      [
        { id: "a", name: "A", token: "amber" },
        { id: "b", name: "B", token: "teal" },
      ],
      () => 0.99,
    );
    expect(g.regime).toBe("bull");
    expect(g.activeRegimeId).toBeNull();
    expect(g.sectorIndex).toEqual(emptySectorIndex());
    expect(g.log[0]).toContain("d6=6");
  });

  it("d6=1 applies AI boom preset shocks", () => {
    const g = createGame(
      [
        { id: "a", name: "A", token: "amber" },
        { id: "b", name: "B", token: "teal" },
      ],
      () => 0,
    );
    expect(g.activeRegimeId).toBe("B01");
    expect(g.regime).toBe("bull");
    expect(g.sectorIndex.tech).toBe(2);
    expect(g.sectorIndex.comms).toBe(1);
    expect(g.sectorIndex.industrials).toBe(1);
  });
});

describe("tax tiles", () => {
  it("deducts income tax cash and shows a pay settle card", () => {
    let g = createGame([
      { id: "a", name: "A", token: "amber" },
      { id: "b", name: "B", token: "teal" },
    ]);
    const before = g.players[0]!.cash;
    g.players[0]!.position = 2; // 1+1 → tile 4 Income Tax
    g = applyAction(g, "a", { type: "roll" }, rngSeq([0, 0]));
    expect(g.players[0]!.position).toBe(4);
    expect(g.players[0]!.cash).toBe(before - INCOME_TAX);
    expect(g.pending?.type).toBe("info");
    if (g.pending?.type === "info") {
      expect(g.pending.cashKind).toBe("pay");
      expect(g.pending.amount).toBe(-INCOME_TAX);
    }
  });
});

describe("START tax + ops", () => {
  it("takes START cash tax and skips News/stipend", () => {
    let g = createGame(
      [
        { id: "a", name: "A", token: "amber" },
        { id: "b", name: "B", token: "teal" },
      ],
      () => 0.99,
    );
    g.regime = "bear";
    g.activeRegimeId = "R10";
    const before = g.players[0]!.cash;
    const tax = Math.floor(before * START_CASH_TAX_RATE);
    g.players[0]!.position = 38;
    g = applyAction(g, "a", { type: "roll" }, rngSeq([1 / 6, 0])); // 2+1 → tile 1
    expect(g.players[0]!.position).toBe(1);
    expect(g.activeRegimeId).toBe("R10");
    expect(g.regime).toBe("bear");
    expect(g.players[0]!.cash).toBe(before - tax);
    expect(g.awaitingLandAfterStart).toBe(true);
    expect(g.pending?.type).toBe("info");
    if (g.pending?.type === "info") {
      expect(g.pending.bundle).toHaveLength(2);
      expect(g.pending.bundle?.[0]?.title).toBe("START tax");
      expect(g.pending.bundle?.[0]?.cashKind).toBe("pay");
      expect(g.pending.bundle?.[0]?.amount).toBe(-tax);
      expect(g.pending.bundle?.[1]?.title).toBe("Company rev");
      expect(g.pending.bundle?.[1]?.cashKind).toBe("receive");
      expect(g.pending.bundle?.[1]?.amount).toBe(0);
    }
    expect(
      g.pendingQueue.some(
        (p) => p.type === "info" && p.title === "Company rev",
      ),
    ).toBe(false);
    // Land resolves only after START settle dismisses.
    const cashAfterStart = g.players[0]!.cash;
    g = applyAction(g, "a", { type: "dismiss" }, rngSeq([]));
    expect(g.awaitingLandAfterStart).toBe(false);
    expect(g.players[0]!.cash).toBe(cashAfterStart);
    expect(g.pending?.type).toBe("trade");
  });

  it("settles company ops after tax", () => {
    let g = createGame(
      [
        { id: "a", name: "A", token: "amber" },
        { id: "b", name: "B", token: "teal" },
      ],
      () => 0.99,
    );
    g.sectorIndex = emptySectorIndex();
    g.holdings = [{ tileIndex: 3, ownerId: "a", shares: 2 }];
    const company = companyByTileIndex(3)!;
    const sector = sectorForTile(BOARD[3]!)!;
    const ops =
      netOpsPerShare(
        company.revenueBasePerShareM,
        company.fixedCostPerShareM,
        g.sectorIndex[sector] ?? 0,
        company.basePricePerShareM,
      ) * 2;
    const before = 2000;
    g.players[0]!.cash = before;
    const tax = Math.floor(before * START_CASH_TAX_RATE);
    g.players[0]!.position = 38;
    g = applyAction(g, "a", { type: "roll" }, rngSeq([1 / 6, 0]));
    expect(g.players[0]!.cash).toBe(before - tax + ops);
  });

  it("amplifies ops losses for a concentrated weak-sector whale", () => {
    let g = createGame(
      [
        { id: "a", name: "A", token: "amber" },
        { id: "b", name: "B", token: "teal" },
      ],
      () => 0.99,
    );
    const sector = sectorForTile(BOARD[37]!)!; // AAPL tech
    g.sectorIndex = emptySectorIndex();
    g.sectorIndex[sector] = -4;
    g.holdings = [{ tileIndex: 37, ownerId: "a", shares: 8 }];
    const company = companyByTileIndex(37)!;
    const baseNet =
      netOpsPerShare(
        company.revenueBasePerShareM,
        company.fixedCostPerShareM,
        -4,
        company.basePricePerShareM,
      ) * 8;
    expect(baseNet).toBeLessThan(0);
    const before = 3000;
    g.players[0]!.cash = before;
    g.players[0]!.position = 38;
    g = applyAction(g, "a", { type: "roll" }, rngSeq([1 / 6, 0]));
    const tax = Math.floor(before * START_CASH_TAX_RATE);
    const after = g.players[0]!.cash;
    const opsApplied = after - (before - tax);
    // Concentrated crash should hurt at least as much as flat ops (usually more).
    expect(opsApplied).toBeLessThanOrEqual(baseNet);
    expect(opsApplied).toBeLessThan(baseNet * 0.95); // amplified
  });
});

describe("sector track fidelity", () => {
  afterEach(() => resetBalanceKnobs());

  it("Market News moves sectors exactly by card.shocks (no silent mult)", () => {
    setBalanceKnobs({ newsShockMult: 99, prShockMult: 99 }); // must be ignored
    let g = createGame(
      [
        { id: "a", name: "A", token: "amber" },
        { id: "b", name: "B", token: "teal" },
      ],
      () => 0.5,
    );
    const before = { ...g.sectorIndex };
    g.players[0]!.position = 5;
    g = applyAction(g, "a", { type: "roll" }, rngSeq([0, 0]));
    expect(g.pending?.type).toBe("regime");
    if (g.pending?.type !== "regime") return;
    const shocks = g.pending.card.shocks;
    for (const sector of Object.keys(before) as (keyof typeof before)[]) {
      const delta = shocks[sector] ?? 0;
      const expected = Math.max(-5, Math.min(5, (before[sector] ?? 0) + delta));
      expect(g.sectorIndex[sector]).toBe(expected);
    }
    // No sector moves unless the card lists it.
    for (const sector of Object.keys(g.sectorIndex) as (keyof typeof before)[]) {
      if ((shocks[sector] ?? 0) === 0) {
        expect(g.sectorIndex[sector]).toBe(before[sector]);
      }
    }
  });

  it("Price Reaction pending.deltas equal matrix cells and board movement", () => {
    setBalanceKnobs({ newsShockMult: 99, prShockMult: 99 });
    let g = createGame(
      [
        { id: "a", name: "A", token: "amber" },
        { id: "b", name: "B", token: "teal" },
      ],
      () => 0.2,
    );
    g.players[0]!.cash = 50_000;
    g.players[0]!.position = 0;
    // Land brown company (tile 1) via 1+1 from 0? need tile with trade — use direct trade pending
    g.pending = { type: "trade", tradesLeft: 1, focusTile: 37 }; // AAPL tech
    const before = { ...g.sectorIndex };
    g = applyAction(g, "a", {
      type: "trade",
      action: "buy",
      tileIndex: 37,
      shares: 1,
    });
    expect(g.pending?.type).toBe("price_reaction");
    if (g.pending?.type !== "price_reaction") return;
    const { card, deltas } = g.pending;
    const expected = pressureDeltas(card, "tech", 1, "buy");
    expect(deltas).toEqual(expected);
    for (const d of expected) {
      const cell = card.matrix.tech![d.sector]!.buy;
      expect(d.delta).toBe(cell);
      expect(g.sectorIndex[d.sector]).toBe(
        Math.max(-5, Math.min(5, (before[d.sector] ?? 0) + cell)),
      );
    }
    for (const sector of Object.keys(before) as (keyof typeof before)[]) {
      if (!expected.some((d) => d.sector === sector)) {
        expect(g.sectorIndex[sector]).toBe(before[sector]);
      }
    }
  });
});

describe("Market News + Weekend V5", () => {
  it("draws News with replacement from full 100", () => {
    let g = createGame(
      [
        { id: "a", name: "A", token: "amber" },
        { id: "b", name: "B", token: "teal" },
      ],
      () => 0.99,
    );
    g.regimeDeck = [];
    g.regimeDiscard = [];
    g.players[0]!.position = 5;
    // 1+1 → tile 7 Market News
    g = applyAction(g, "a", { type: "roll" }, rngSeq([0, 0, 0.25]));
    expect(g.players[0]!.position).toBe(7);
    // No placeholder land card — Market News draws straight from the pile.
    expect(g.pending?.type).toBe("regime");
    expect(g.activeRegimeId).toBeTruthy();
    expect(g.regimeDeck).toEqual([]);
    expect(g.regimeDiscard).toEqual([]);
  });

  it("Weekend shows land card then no trade", () => {
    let g = createGame(
      [
        { id: "a", name: "A", token: "amber" },
        { id: "b", name: "B", token: "teal" },
      ],
      () => 0.99,
    );
    g.players[0]!.position = 18;
    // 1+1 → tile 20 Weekend
    g = applyAction(g, "a", { type: "roll" }, rngSeq([0, 0]));
    expect(g.players[0]!.position).toBe(20);
    expect(BOARD[20]!.kind).toBe("free");
    expect(g.pending?.type).toBe("info");
    g = applyAction(g, "a", { type: "dismiss" });
    expect(g.pending).toBeNull();
    expect(g.tradesLeft).toBe(0);
  });

  it("Market News and tax lands do not open a trade desk", () => {
    let news = createGame(
      [
        { id: "a", name: "A", token: "amber" },
        { id: "b", name: "B", token: "teal" },
      ],
      () => 0.5,
    );
    news.players[0]!.position = 5;
    // 1+1 → tile 7 Market News
    news = applyAction(news, "a", { type: "roll" }, rngSeq([0, 0]));
    expect(news.players[0]!.position).toBe(7);
    expect(news.pending?.type).toBe("regime");
    expect(news.tradesLeft).toBe(0);
    news = applyAction(news, "a", { type: "dismiss" });
    expect(news.pending).toBeNull();

    let tax = createGame(
      [
        { id: "a", name: "A", token: "amber" },
        { id: "b", name: "B", token: "teal" },
      ],
      () => 0.5,
    );
    tax.players[0]!.position = 2;
    // 1+1 → tile 4 Income Tax
    tax = applyAction(tax, "a", { type: "roll" }, rngSeq([0, 0]));
    expect(tax.players[0]!.position).toBe(4);
    expect(tax.pending?.type).toBe("info");
    expect(tax.tradesLeft).toBe(0);
    tax = applyAction(tax, "a", { type: "dismiss" });
    expect(tax.pending).toBeNull();
  });
});

describe("roll / trade / fees", () => {
  it("moves to Coca-Cola and opens trade on that tile only", () => {
    let g = createGame(
      [
        { id: "a", name: "A", token: "amber" },
        { id: "b", name: "B", token: "teal" },
      ],
      () => 0.1,
    );
    g = applyAction(g, "a", { type: "roll" }, rngSeq([1 / 6, 0]));
    expect(g.players[0]!.position).toBe(3);
    expect(BOARD[3]!.name).toBe("Coca-Cola");
    // No land-preview flash — desk is the single company reveal.
    expect(g.pending?.type).toBe("trade");
    expect(g.pending && g.pending.type === "trade" && g.pending.focusTile).toBe(3);
  });

  it("settles buy after Price Reaction at new price", () => {
    let g = createGame(
      [
        { id: "a", name: "A", token: "amber" },
        { id: "b", name: "B", token: "teal" },
      ],
      () => 0.1,
    );
    g = applyAction(g, "a", { type: "roll" }, rngSeq([1 / 6, 0]));
    if (g.pending?.type === "info") g = applyAction(g, "a", { type: "dismiss" });
    expect(g.pending?.type).toBe("trade");
    g.tradesLeft = 1;
    const before = g.players[0]!.cash;
    g = applyAction(g, "a", { type: "trade", action: "buy", tileIndex: 3, shares: 2 });
    expect(g.pending?.type).toBe("price_reaction");
    if (g.pending?.type === "price_reaction") {
      expect(g.pending.settledShares).toBe(2);
      expect(g.holdings[0]?.shares).toBe(2);
      expect(g.players[0]!.cash).toBe(before - g.pending.totalCash);
      expect(g.pending.settlePrice).toBe(currentSharePrice(g, 3));
      expect(ORDER_FEE_M).toBe(10);
      expect(g.pending.totalCash).toBe(2 * g.pending.settlePrice + ORDER_FEE_M);
    }
  });

  it("enqueues visit fee card when others hold the company", () => {
    let g = createGame(
      [
        { id: "a", name: "A", token: "amber" },
        { id: "b", name: "B", token: "teal" },
      ],
      () => 0.99,
    );
    g.holdings = [{ tileIndex: 3, ownerId: "b", shares: 4 }];
    g.players[0]!.position = 0;
    g = applyAction(g, "a", { type: "roll" }, rngSeq([1 / 6, 0])); // → 3
    expect(g.players[0]!.position).toBe(3);
    // No land-preview — visit fee is the first card, then trade.
    expect(g.pending?.type).toBe("info");
    if (g.pending?.type === "info") {
      expect(g.pending.title).toBe("Visit fee");
      expect((g.pending.amount ?? 0) < 0).toBe(true);
      expect(g.pending.transfers).toEqual([
        {
          fromId: "a",
          fromName: "A",
          toId: "b",
          toName: "B",
          amount: expect.any(Number),
          shares: 4,
        },
      ]);
      expect(g.pending.transfers![0]!.amount).toBeGreaterThan(0);
      expect(g.pending.body).toMatch(/A (→|paid) B/);
    }
    g = applyAction(g, "a", { type: "dismiss" });
    expect(g.pending?.type).toBe("trade");
    expect(
      g.pending && g.pending.type === "trade" && g.pending.focusTile,
    ).toBe(3);
  });

  it("allows ownership up to 10 shares", () => {
    let g = createGame(
      [
        { id: "a", name: "A", token: "amber" },
        { id: "b", name: "B", token: "teal" },
      ],
      () => 0.1,
    );
    expect(MAX_SHARES_OWNED).toBe(10);
    g.players[0]!.cash = 100_000;
    g.pending = { type: "trade", tradesLeft: 1, focusTile: 37 };
    g.sectorIndex.tech = 0;
    g = applyAction(g, "a", { type: "trade", action: "buy", tileIndex: 37, shares: 10 });
    expect(g.pending?.type).toBe("price_reaction");
    if (g.pending?.type === "price_reaction") {
      expect(g.pending.settledShares).toBe(10);
    }
    expect(g.holdings.find((h) => h.tileIndex === 37)?.shares).toBe(10);
  });

  it("former exchange tiles are Market News", () => {
    expect(BOARD[7]!.kind).toBe("regime");
    expect(BOARD[7]!.name).toBe("Market News");
    expect(BOARD[22]!.kind).toBe("regime");
    expect(BOARD[36]!.kind).toBe("regime");
  });

  it("ETF tiles replace brokers/utilities and settle without PR", () => {
    expect(BOARD[5]!.kind).toBe("etf");
    expect(BOARD[5]!.ticker).toBe("GRW");
    expect(BOARD[12]!.ticker).toBe("INF");
    expect(BOARD[15]!.ticker).toBe("DEF");
    expect(BOARD[25]!.ticker).toBe("CYC");
    expect(BOARD[28]!.ticker).toBe("DIV");
    expect(BOARD[35]!.ticker).toBe("CON");

    let g = createGame(
      [
        { id: "a", name: "A", token: "amber" },
        { id: "b", name: "B", token: "teal" },
      ],
      () => 0.1,
    );
    // Land on GRW (tile 5): roll 3+2
    g = applyAction(g, "a", { type: "roll" }, rngSeq([2 / 6, 1 / 6]));
    expect(g.players[0]!.position).toBe(5);
    if (g.pending?.type === "info") g = applyAction(g, "a", { type: "dismiss" });
    expect(g.pending?.type).toBe("trade");

    const beforePr = g.prDeck.length;
    g.players[0]!.cash = 100_000;
    // ETF float is 1 unit — buying shares≠1 is rejected.
    g = applyAction(g, "a", { type: "trade", action: "buy", tileIndex: 5, shares: 2 });
    expect(g.pending?.type).toBe("trade");
    expect(g.holdings.find((h) => h.tileIndex === 5)).toBeUndefined();

    g = applyAction(g, "a", { type: "trade", action: "buy", tileIndex: 5, shares: 1 });
    expect(g.prDeck.length).toBe(beforePr);
    expect(g.pending?.type).toBe("info");
    expect(g.holdings.find((h) => h.tileIndex === 5)?.shares).toBe(1);
  });

  it("Go to SEC stays on tile 30 until dismiss, then warps to HALT", () => {
    let g = createGame(
      [
        { id: "a", name: "A", token: "amber" },
        { id: "b", name: "B", token: "teal" },
      ],
      () => 0.1,
    );
    g.players[0]!.position = 28;
    g = applyAction(g, "a", { type: "roll" }, rngSeq([0, 0])); // 1+1 → 30
    expect(g.players[0]!.position).toBe(30);
    expect(g.players[0]!.inJail).toBe(false);
    expect(g.pending?.type).toBe("info");
    if (g.pending?.type === "info") {
      expect(g.pending.sendToHalt).toBe(true);
      expect(g.pending.tileIndex).toBe(30);
    }
    g = applyAction(g, "a", { type: "dismiss" });
    expect(g.players[0]!.position).toBe(HALT_INDEX);
    expect(g.players[0]!.inJail).toBe(true);
  });

  it("landing on SEC by dice is just visiting — not jailed", () => {
    let g = createGame(
      [
        { id: "a", name: "A", token: "amber" },
        { id: "b", name: "B", token: "teal" },
      ],
      () => 0.1,
    );
    g.players[0]!.position = 8;
    g = applyAction(g, "a", { type: "roll" }, rngSeq([0, 0])); // 1+1 → 10
    expect(g.players[0]!.position).toBe(10);
    expect(g.players[0]!.inJail).toBe(false);
  });

  it("closes trade desk when focusTile is missing", () => {
    let g = createGame(
      [
        { id: "a", name: "A", token: "amber" },
        { id: "b", name: "B", token: "teal" },
      ],
      () => 0.1,
    );
    g.players[0]!.position = 20;
    // Invalid legacy desk (no focus) — engine must close it.
    g.pending = { type: "trade", tradesLeft: 1 } as typeof g.pending;
    g.tradesLeft = 1;
    g.players[0]!.cash = 100_000;
    const before = g.players[0]!.cash;
    g = applyAction(g, "a", { type: "trade", action: "buy", tileIndex: 3, shares: 2 });
    expect(g.pending).toBeNull();
    expect(g.tradesLeft).toBe(0);
    expect(g.players[0]!.cash).toBe(before);
    expect(g.holdings.length).toBe(0);
  });

  it("rejects buy of a different ticker than the landed focus", () => {
    let g = createGame(
      [
        { id: "a", name: "A", token: "amber" },
        { id: "b", name: "B", token: "teal" },
      ],
      () => 0.1,
    );
    g.pending = { type: "trade", tradesLeft: 1, focusTile: 3 };
    g.players[0]!.cash = 100_000;
    g = applyAction(g, "a", { type: "trade", action: "buy", tileIndex: 37, shares: 1 });
    expect(g.pending?.type).toBe("trade");
    expect(g.holdings.length).toBe(0);
  });

  it("tax tiles bankrupt when cash+holdings cannot cover", () => {
    let g = createGame(
      [
        { id: "a", name: "A", token: "amber" },
        { id: "b", name: "B", token: "teal" },
      ],
      () => 0.2,
    );
    g.players[0]!.cash = 40;
    g.holdings = [];
    g.players[0]!.position = 2;
    g = applyAction(g, "a", { type: "roll" }, rngSeq([0, 0])); // → Income Tax
    expect(g.players[0]!.bankrupt).toBe(true);
  });

  it("forced liquidation sells enough shares with no order fee", () => {
    let g = createGame(
      [
        { id: "a", name: "A", token: "amber" },
        { id: "b", name: "B", token: "teal" },
      ],
      () => 0.2,
    );
    // A is broke but holds KO; B owns nothing on tile 4 — land A on Wealth Tax via cash pay.
    g.players[0]!.cash = 50;
    g.holdings = [{ tileIndex: 3, ownerId: "a", shares: 8 }];
    g.players[0]!.position = 2;
    const beforeShares =
      g.holdings.find((h) => h.ownerId === "a" && h.tileIndex === 3)?.shares ?? 0;
    g = applyAction(g, "a", { type: "roll" }, rngSeq([0, 0])); // → tile 4 Income Tax 100
    // Should have liquidated rather than instantly bankrupt (8×KO covers 100).
    expect(g.players[0]!.bankrupt).toBe(false);
    const afterShares =
      g.holdings.find((h) => h.ownerId === "a" && h.tileIndex === 3)?.shares ?? 0;
    expect(afterShares).toBeLessThan(beforeShares);
    expect(g.log.some((l) => l.includes("liquidates"))).toBe(true);
  });

  it("pays visit fees from P0/10 × visitFeeMult", () => {
    let g = createGame(
      [
        { id: "a", name: "A", token: "amber" },
        { id: "b", name: "B", token: "teal" },
      ],
      () => 0.2,
    );
    g.holdings = [{ tileIndex: 3, ownerId: "b", shares: 4 }];
    g = applyAction(g, "a", { type: "roll" }, rngSeq([1 / 6, 0]));
    const fee = feePerShare(80) * 4;
    expect(fee).toBe(Math.round(8 * BALANCE.visitFeeMult) * 4);
    expect(g.players[0]!.cash).toBe(STARTING_CASH - fee);
    expect(g.players[1]!.cash).toBe(STARTING_CASH + fee);
  });

  it("rejects actions from non-current player", () => {
    const g0 = createGame([
      { id: "a", name: "A", token: "amber" },
      { id: "b", name: "B", token: "teal" },
    ]);
    const g1 = applyAction(g0, "b", { type: "roll" }, rngSeq([0, 0]));
    expect(g1.players[0]!.position).toBe(0);
    expect(g1.lastDice).toBeNull();
  });

  it("ends in bankruptcy win", () => {
    const g0 = createGame([
      { id: "a", name: "A", token: "amber" },
      { id: "b", name: "B", token: "teal" },
    ]);
    const g1 = applyAction(g0, "a", { type: "declare_bankrupt" });
    expect(g1.phase).toBe("finished");
    expect(g1.winnerId).toBe("b");
  });

  it("no extra turn on doubles", () => {
    let g = createGame([
      { id: "a", name: "A", token: "amber" },
      { id: "b", name: "B", token: "teal" },
    ]);
    g = applyAction(g, "a", { type: "roll" }, rngSeq([2 / 6, 2 / 6]));
    expect(g.lastDice).toEqual([3, 3]);
    expect(g.players[0]!.position).toBe(6);
    g = clearModals(g, "a");
    const g2 = applyAction(g, "a", { type: "roll" }, rngSeq([0, 0]));
    expect(g2.players[0]!.position).toBe(6);
  });
});
