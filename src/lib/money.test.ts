import { describe, expect, it } from "vitest";
import { money, moneySeat } from "./money";

describe("money V4", () => {
  it("formats M$", () => {
    expect(money(350)).toBe("350 M$");
    expect(money(5000)).toBe("5 B$");
  });

  it("formats B$ for ≥1000", () => {
    expect(money(1000)).toBe("1 B$");
    expect(money(1960)).toBe("1.96 B$");
  });

  it("seat B$ keeps three decimals", () => {
    expect(moneySeat(1000)).toBe("1.000 B$");
    expect(moneySeat(1960)).toBe("1.960 B$");
    expect(moneySeat(350)).toBe("350 M$");
  });
});
