import { describe, expect, it } from "vitest";
import { createGame } from "../engine";
import { chooseBotTradeStance } from "./bot";
import { botProfileForName } from "./botProfile";
import {
  BOT_FUNDS,
  FUND_KIND_ORDER,
  fundsByKind,
  pickBotFund,
} from "./botRoster";
import { FUND_STRATEGIES } from "./fundStrategies";

describe("botRoster fund kinds", () => {
  it("covers every FundKind with at least one desk", () => {
    for (const kind of FUND_KIND_ORDER) {
      expect(fundsByKind(kind).length).toBeGreaterThan(0);
      expect(FUND_STRATEGIES[kind]).toBeDefined();
    }
    expect(BOT_FUNDS.every((f) => f.kind && f.blurb)).toBe(true);
  });

  it("pickBotFund can filter by kind", () => {
    const f = pickBotFund(() => 0.1, [], "quant");
    expect(f.kind).toBe("quant");
  });
});

describe("per-kind trading logic", () => {
  it("unnamed bots default to multi_strat", () => {
    expect(botProfileForName("Bot").kind).toBe("multi_strat");
    expect(botProfileForName(null).kind).toBe("multi_strat");
  });

  it("index Vanguard never dumps a hot contested book", () => {
    const g = createGame([
      { id: "bot-rival", name: "Vanguard", token: "teal" },
      { id: "a", name: "A", token: "amber" },
    ]);
    g.players[0]!.cash = 900;
    g.sectorIndex.tech = 3;
    g.holdings = [
      { tileIndex: 37, ownerId: "bot-rival", shares: 6 },
      { tileIndex: 39, ownerId: "a", shares: 4 },
    ];
    g.pending = { type: "trade", tradesLeft: 1, focusTile: 37 };
    expect(chooseBotTradeStance(g, "bot-rival", 37)).not.toBe("dump_pressure");
  });

  it("activist Elliott dumps a hot contested book", () => {
    const g = createGame([
      { id: "bot-rival", name: "Elliott", token: "teal" },
      { id: "a", name: "A", token: "amber" },
    ]);
    g.players[0]!.cash = 900;
    g.sectorHistory.tech = [1, 2, 3, 4];
    g.sectorIndex.tech = 4;
    g.holdings = [
      { tileIndex: 37, ownerId: "bot-rival", shares: 6 },
      { tileIndex: 39, ownerId: "a", shares: 4 },
    ];
    g.pending = { type: "trade", tradesLeft: 1, focusTile: 37 };
    // Contested + stretched tape → campaign dump.
    expect(chooseBotTradeStance(g, "bot-rival", 37)).toBe("dump_pressure");
  });

  it("multi-strat Citadel still dumps when the book is ripe", () => {
    const g = createGame([
      { id: "bot-rival", name: "Citadel", token: "teal" },
      { id: "a", name: "A", token: "amber" },
    ]);
    g.players[0]!.cash = 900;
    g.sectorHistory.tech = [1, 2, 3, 4];
    g.sectorIndex.tech = 4;
    g.holdings = [
      { tileIndex: 37, ownerId: "bot-rival", shares: 6 },
      { tileIndex: 39, ownerId: "a", shares: 4 },
    ];
    g.pending = { type: "trade", tradesLeft: 1, focusTile: 37 };
    expect(chooseBotTradeStance(g, "bot-rival", 37)).toBe("dump_pressure");
  });

  it("value Berkshire refuses to chase a mild rally", () => {
    const g = createGame([
      { id: "bot-rival", name: "Berkshire", token: "teal" },
      { id: "a", name: "A", token: "amber" },
    ]);
    g.players[0]!.cash = 4000;
    g.sectorIndex.staples = 1;
    g.pending = { type: "trade", tradesLeft: 1, focusTile: 1 };
    expect(chooseBotTradeStance(g, "bot-rival", 1)).toBe("cash_hold");
  });

  it("value Berkshire corners a deep crash", () => {
    const g = createGame([
      { id: "bot-rival", name: "Berkshire", token: "teal" },
      { id: "a", name: "A", token: "amber" },
    ]);
    g.players[0]!.cash = 4000;
    g.sectorIndex.staples = -3;
    g.pending = { type: "trade", tradesLeft: 1, focusTile: 1 };
    expect(chooseBotTradeStance(g, "bot-rival", 1)).toBe("corner_dip");
  });

  it("quant takes profit earlier than multi-strat on level 2", () => {
    const g = createGame([
      { id: "bot-rival", name: "Renaissance", token: "teal" },
      { id: "a", name: "A", token: "amber" },
    ]);
    g.players[0]!.cash = 2000;
    // Flat tape at level 2 → mean-rev fade (no rideTrend).
    g.sectorHistory.tech = [2, 2, 2];
    g.sectorIndex.tech = 2;
    g.holdings = [{ tileIndex: 37, ownerId: "bot-rival", shares: 4 }];
    g.pending = { type: "trade", tradesLeft: 1, focusTile: 37 };
    expect(chooseBotTradeStance(g, "bot-rival", 37)).toBe("take_profit");
    expect(chooseBotTradeStance(g, "a", 37)).not.toBe("take_profit");
  });

  it("macro holds cash in a flat regime", () => {
    const g = createGame([
      { id: "bot-rival", name: "Bridgewater", token: "teal" },
      { id: "a", name: "A", token: "amber" },
    ]);
    g.players[0]!.cash = 3000;
    g.sectorIndex.staples = 0;
    g.pending = { type: "trade", tradesLeft: 1, focusTile: 1 };
    expect(chooseBotTradeStance(g, "bot-rival", 1)).toBe("cash_hold");
  });

  it("Jane Street vacuums float as a market maker", () => {
    const g = createGame([
      { id: "bot-rival", name: "Jane Street", token: "teal" },
      { id: "a", name: "A", token: "amber" },
    ]);
    g.players[0]!.cash = 4000;
    g.sectorIndex.staples = 0;
    g.pending = { type: "trade", tradesLeft: 1, focusTile: 1 };
    expect(chooseBotTradeStance(g, "bot-rival", 1)).toBe("corner_dip");
  });
});
