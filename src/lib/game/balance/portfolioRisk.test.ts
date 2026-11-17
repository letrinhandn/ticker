import { afterEach, describe, expect, it } from "vitest";
import { createGame } from "@/lib/game/engine";
import {
  cashHoardTaxBoost,
  companySharesBySector,
  concentrationLossMultiplier,
} from "./portfolioRisk";
import { resetBalanceKnobs, setBalanceKnobs } from "./knobs";

describe("portfolioRisk", () => {
  afterEach(() => resetBalanceKnobs());

  it("amplifies weak-sector ops losses when concentrated", () => {
    setBalanceKnobs({
      concentrationWeightGate: 0.4,
      concentrationLossMult: 2,
    });
    expect(concentrationLossMultiplier(0.2, -3)).toBe(1);
    expect(concentrationLossMultiplier(0.4, -3)).toBe(1);
    expect(concentrationLossMultiplier(1, -3)).toBe(2);
    expect(concentrationLossMultiplier(1, 0)).toBe(1); // not weak
    expect(concentrationLossMultiplier(0.7, -2)).toBeGreaterThan(1);
  });

  it("cash-hoard tax scales with cash/NW even when lightly invested", () => {
    const g = createGame([
      { id: "a", name: "A", token: "amber" },
      { id: "b", name: "B", token: "teal" },
    ]);
    expect(cashHoardTaxBoost(g, "a")).toBe(0); // turn 0
    g.players[0]!.turnsDone = 2;
    expect(cashHoardTaxBoost(g, "a")).toBeGreaterThan(0); // all cash
    // Token shares must not erase the cash-ratio drag.
    g.holdings = [{ tileIndex: 1, ownerId: "a", shares: 1 }];
    expect(cashHoardTaxBoost(g, "a")).toBeGreaterThan(0);
    // Heavy deployment (low cash/NW) clears the surcharge.
    g.players[0]!.cash = 50;
    g.holdings = [{ tileIndex: 1, ownerId: "a", shares: 8 }];
    expect(cashHoardTaxBoost(g, "a")).toBe(0);
  });

  it("ETF holdings dilute concentration vs pure company pile", () => {
    const g = createGame([
      { id: "a", name: "A", token: "amber" },
      { id: "b", name: "B", token: "teal" },
    ]);
    g.holdings = [
      { tileIndex: 37, ownerId: "a", shares: 6 }, // AAPL tech
      { tileIndex: 5, ownerId: "a", shares: 1 }, // GRW etf
    ];
    const { bySector, total } = companySharesBySector(g, "a");
    expect(total).toBe(7);
    expect(bySector.tech / total).toBeLessThan(1);
    expect(bySector.tech).toBeGreaterThan(6);
  });
});
