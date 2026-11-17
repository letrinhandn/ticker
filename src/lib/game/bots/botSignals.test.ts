import { describe, expect, it } from "vitest";
import { createGame } from "../engine";
import { deskEdge, readSectorTape } from "./botSignals";

describe("botSignals", () => {
  it("flags buyDip after a crash stretch", () => {
    const g = createGame([
      { id: "a", name: "A", token: "teal" },
      { id: "b", name: "B", token: "amber" },
    ]);
    g.sectorHistory.staples = [0, -1, -2, -3];
    g.sectorIndex.staples = -3;
    const edge = deskEdge(g, "staples");
    expect(edge.buyDip).toBe(true);
    expect(edge.meanRev).toBeGreaterThan(0);
  });

  it("flags fadeRally on stretched uptrend", () => {
    const g = createGame([
      { id: "a", name: "A", token: "teal" },
      { id: "b", name: "B", token: "amber" },
    ]);
    g.sectorHistory.tech = [0, 1, 2, 3, 4];
    g.sectorIndex.tech = 4;
    const edge = deskEdge(g, "tech");
    expect(edge.fadeRally).toBe(true);
    expect(edge.tape.mom).toBeGreaterThan(0);
  });

  it("reads live peg even when history empty", () => {
    const g = createGame([
      { id: "a", name: "A", token: "teal" },
      { id: "b", name: "B", token: "amber" },
    ]);
    g.sectorIndex.energy = 2;
    const tape = readSectorTape(g, "energy");
    expect(tape.level).toBe(2);
    expect(tape.samples).toBeGreaterThanOrEqual(1);
  });
});
