import { describe, expect, it } from "vitest";
import { chooseBotAction, chooseBotTradeStance } from "./bot";
import { runBotUntilHuman } from "./botRunner";
import { applyAction, createGame } from "../engine";

function rngSeq(values: number[]) {
  let i = 0;
  return () => {
    const v = values[i % values.length]!;
    i += 1;
    return v;
  };
}

describe("chooseBotAction", () => {
  it("rolls when nothing pending", () => {
    const g = createGame([
      { id: "bot-rival", name: "Bot", token: "teal" },
      { id: "a", name: "A", token: "amber" },
    ]);
    expect(chooseBotAction(g, "bot-rival")).toEqual({ type: "roll" });
  });

  it("dismisses info cards", () => {
    const g = createGame([
      { id: "bot-rival", name: "Bot", token: "teal" },
      { id: "a", name: "A", token: "amber" },
    ]);
    g.pending = {
      type: "info",
      tileIndex: 4,
      title: "Income Tax",
      body: "Pay $100",
      amount: 100,
    };
    expect(chooseBotAction(g, "bot-rival")).toEqual({ type: "dismiss" });
  });

  it("buys dips when cash allows", () => {
    const g = createGame([
      { id: "bot-rival", name: "Bot", token: "teal" },
      { id: "a", name: "A", token: "amber" },
    ]);
    g.players[0]!.cash = 2000;
    g.sectorIndex.staples = -2; // tile 1 is staples — buy the dip
    g.pending = {
      type: "trade",
      tradesLeft: 1,
      focusTile: 1,
    };
    const action = chooseBotAction(g, "bot-rival");
    expect(action?.type).toBe("trade");
    if (action?.type === "trade") {
      expect(action.action).toBe("buy");
      expect(action.tileIndex).toBe(1);
      expect((action.shares ?? 0) >= 1).toBe(true);
    }
  });

  it("skips chasing extreme sector peaks", () => {
    const g = createGame([
      { id: "bot-rival", name: "Bot", token: "teal" },
      { id: "a", name: "A", token: "amber" },
    ]);
    g.players[0]!.cash = 3000;
    g.sectorIndex.staples = 4;
    g.pending = {
      type: "trade",
      tradesLeft: 1,
      focusTile: 1,
    };
    expect(chooseBotAction(g, "bot-rival")).toEqual({
      type: "trade",
      action: "skip",
    });
  });

  it("sells holdings when cash reserves are thin", () => {
    const g = createGame([
      { id: "bot-rival", name: "Bot", token: "teal" },
      { id: "a", name: "A", token: "amber" },
    ]);
    g.players[0]!.cash = 80;
    g.holdings = [{ tileIndex: 3, ownerId: "bot-rival", shares: 4 }];
    g.pending = {
      type: "trade",
      tradesLeft: 1,
      focusTile: 1,
    };
    const action = chooseBotAction(g, "bot-rival");
    expect(action?.type).toBe("trade");
    if (action?.type === "trade") {
      expect(action.action).toBe("sell");
      expect(action.shares ?? 0).toBeGreaterThanOrEqual(1);
    }
  });

  it("takes profit on concentrated high-sector holdings", () => {
    const g = createGame([
      { id: "bot-rival", name: "Bot", token: "teal" },
      { id: "a", name: "A", token: "amber" },
    ]);
    g.players[0]!.cash = 800;
    g.sectorIndex.staples = 3;
    g.holdings = [{ tileIndex: 1, ownerId: "bot-rival", shares: 5 }];
    g.pending = {
      type: "trade",
      tradesLeft: 1,
      focusTile: 1,
    };
    const action = chooseBotAction(g, "bot-rival");
    expect(action?.type).toBe("trade");
    if (action?.type === "trade") {
      expect(action.action).toBe("sell");
      expect(action.tileIndex).toBe(1);
    }
  });

  it("corners a dip by buying max affordable float", () => {
    const g = createGame([
      { id: "bot-rival", name: "Bot", token: "teal" },
      { id: "a", name: "A", token: "amber" },
    ]);
    g.players[0]!.cash = 4000;
    g.sectorIndex.staples = -2;
    g.pending = {
      type: "trade",
      tradesLeft: 1,
      focusTile: 1,
    };
    expect(chooseBotTradeStance(g, "bot-rival", 1)).toBe("corner_dip");
    const action = chooseBotAction(g, "bot-rival");
    expect(action?.type).toBe("trade");
    if (action?.type === "trade") {
      expect(action.action).toBe("buy");
      expect(action.shares ?? 0).toBeGreaterThanOrEqual(4);
    }
  });

  it("dumps a large block to pressure a hot contested sector", () => {
    const g = createGame([
      { id: "bot-rival", name: "Bot", token: "teal" },
      { id: "a", name: "A", token: "amber" },
    ]);
    g.players[0]!.cash = 900;
    g.sectorIndex.tech = 3;
    g.holdings = [
      { tileIndex: 37, ownerId: "bot-rival", shares: 6 }, // AAPL tech
    ];
    // Rival also long tech — dump PR hurts them.
    g.holdings.push({ tileIndex: 39, ownerId: "a", shares: 4 }); // MSFT
    g.pending = {
      type: "trade",
      tradesLeft: 1,
      focusTile: 37, // desk on the hot name
    };
    expect(chooseBotTradeStance(g, "bot-rival", 37)).toBe("dump_pressure");
    const action = chooseBotAction(g, "bot-rival");
    expect(action?.type).toBe("trade");
    if (action?.type === "trade") {
      expect(action.action).toBe("sell");
      expect(action.tileIndex).toBe(37);
      expect(action.shares ?? 0).toBeGreaterThanOrEqual(5);
    }
  });

  it("holds cash instead of chasing a mediocre setup", () => {
    const g = createGame([
      { id: "bot-rival", name: "Bot", token: "teal" },
      { id: "a", name: "A", token: "amber" },
    ]);
    g.players[0]!.cash = 500;
    g.sectorIndex.staples = 3;
    g.holdings = [];
    g.pending = {
      type: "trade",
      tradesLeft: 1,
      focusTile: 1,
    };
    expect(chooseBotTradeStance(g, "bot-rival", 1)).toBe("cash_hold");
    expect(chooseBotAction(g, "bot-rival")).toEqual({
      type: "trade",
      action: "skip",
    });
  });

  it("skips trade with no landed focus tile", () => {
    const g = createGame([
      { id: "bot-rival", name: "Bot", token: "teal" },
      { id: "a", name: "A", token: "amber" },
    ]);
    g.pending = { type: "trade", tradesLeft: 1 } as typeof g.pending;
    expect(chooseBotAction(g, "bot-rival")).toEqual({
      type: "trade",
      action: "skip",
    });
  });
});

function clearHumanTurn(g: ReturnType<typeof createGame>, id: string) {
  let state = g;
  for (let i = 0; i < 12; i++) {
    if (!state.pending) break;
    if (state.pending.type === "trade") {
      state = applyAction(state, id, { type: "trade", action: "skip" });
    } else {
      state = applyAction(state, id, { type: "dismiss" });
    }
  }
  return state;
}

describe("runBotUntilHuman", () => {
  it("completes a full bot turn and returns control to human", () => {
    let g = createGame(
      [
        { id: "human", name: "Human", token: "amber" },
        { id: "bot-rival", name: "Bot", token: "teal" },
      ],
      () => 0.42,
    );

    // Human rolls: 1+1 = 2 → Market News
    g = applyAction(g, "human", { type: "roll" }, rngSeq([0, 0]));
    g = clearHumanTurn(g, "human");
    g = applyAction(g, "human", { type: "end_turn" });
    expect(g.players[g.turnIndex]!.id).toBe("bot-rival");

    g = runBotUntilHuman(g, (id) => id === "bot-rival", Math.random, 48);

    expect(g.phase).toBe("playing");
    expect(g.players[g.turnIndex]!.id).toBe("human");
    expect(g.pending).toBeNull();
    expect(g.lastDice).toBeNull();
    expect(g.players.find((p) => p.id === "bot-rival")!.turnsDone).toBe(1);
  });

  it("lets human roll again on turn 2 after bot finishes", () => {
    let g = createGame(
      [
        { id: "human", name: "Human", token: "amber" },
        { id: "bot-rival", name: "Bot", token: "teal" },
      ],
      () => 0.31,
    );

    g = applyAction(g, "human", { type: "roll" }, rngSeq([0, 1 / 6]));
    g = clearHumanTurn(g, "human");
    g = applyAction(g, "human", { type: "end_turn" });
    g = runBotUntilHuman(g, (id) => id === "bot-rival", () => 0.27, 64);

    expect(g.players[g.turnIndex]!.id).toBe("human");
    expect(g.lastDice).toBeNull();
    expect(g.pending).toBeNull();

    const before = g.players[0]!.position;
    g = applyAction(g, "human", { type: "roll" }, rngSeq([2 / 6, 3 / 6]));
    expect(g.lastDice).toEqual([3, 4]);
    expect(g.players[0]!.position).not.toBe(before);
    expect(g.players.find((p) => p.id === "human")!.turnsDone).toBe(1);
  });
});
