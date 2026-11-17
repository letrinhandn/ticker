import { describe, expect, it } from "vitest";
import { createGame } from "@/lib/game/engine";
import {
  bumpsFromDeltas,
  coalesceSectorBumps,
  diffGameFx,
  sectorBumpMs,
} from "./choreograph";

describe("diffGameFx", () => {
  it("emits opening sector bumps on first paint when d6 preset shocks", () => {
    const g = createGame(
      [
        { id: "a", name: "A", token: "amber" },
        { id: "b", name: "B", token: "teal" },
      ],
      () => 0,
    );
    const events = diffGameFx(null, g);
    expect(events.some((e) => e.type === "opening")).toBe(true);
    expect(events.some((e) => e.type === "sectorBump")).toBe(true);
  });

  it("does not replay sector bumps when joining mid price_reaction", () => {
    const g = createGame(
      [
        { id: "a", name: "A", token: "amber" },
        { id: "b", name: "B", token: "teal" },
      ],
      () => 0.99,
    );
    g.sectorIndex.tech = 2;
    g.pending = {
      type: "price_reaction",
      card: { id: "pr-x" } as never,
      order: { side: "buy", shares: 1, tileIndex: 1 },
      deltas: [{ sector: "tech", delta: 2 }],
      settledShares: 1,
      settlePrice: 100,
      totalCash: 100,
    };
    const events = diffGameFx(null, g);
    expect(events.some((e) => e.type === "sectorBump")).toBe(false);
  });

  it("emits PR bumps from card deltas with clamp (no change at ceiling)", () => {
    const a = createGame(
      [
        { id: "a", name: "A", token: "amber" },
        { id: "b", name: "B", token: "teal" },
      ],
      () => 0.99,
    );
    a.sectorIndex.tech = 5;
    const b = structuredClone(a);
    b.pending = {
      type: "price_reaction",
      card: { id: "pr-x" } as never,
      order: { side: "buy", shares: 1, tileIndex: 1 },
      deltas: [
        { sector: "tech", delta: 2 },
        { sector: "comms", delta: 1 },
      ],
      settledShares: 1,
      settlePrice: 100,
      totalCash: 100,
    };
    b.sectorIndex.tech = 5;
    b.sectorIndex.comms = 1;
    const events = diffGameFx(a, b);
    const bumps = events.filter((e) => e.type === "sectorBump");
    expect(bumps).toEqual([
      { type: "sectorBump", sector: "comms", from: 0, to: 1 },
    ]);
  });

  it("drops news bumps when board index disagrees with card shocks", () => {
    const a = createGame(
      [
        { id: "a", name: "A", token: "amber" },
        { id: "b", name: "B", token: "teal" },
      ],
      () => 0.99,
    );
    a.sectorIndex.energy = 0;
    const b = structuredClone(a);
    b.pending = {
      type: "regime",
      card: {
        id: "mn-bad",
        title: "News",
        regime: "bull",
        shocks: { energy: 1 },
        text: "test",
      },
      text: "test",
    };
    // Engine wrongly scaled (+3) while card says +1 — must not animate a lie.
    b.sectorIndex.energy = 3;
    expect(
      diffGameFx(a, b).filter((e) => e.type === "sectorBump"),
    ).toEqual([]);
  });

  it("emits Market News bumps from card shocks and skips while still showing", () => {
    const a = createGame(
      [
        { id: "a", name: "A", token: "amber" },
        { id: "b", name: "B", token: "teal" },
      ],
      () => 0.99,
    );
    a.sectorIndex.energy = 0;
    a.sectorIndex.tech = 1;
    const b = structuredClone(a);
    b.pending = {
      type: "regime",
      card: {
        id: "mn-1",
        title: "News",
        regime: "bull",
        shocks: { energy: 2, tech: -1 },
        text: "test",
      },
      text: "test",
    };
    b.sectorIndex.energy = 2;
    b.sectorIndex.tech = 0;
    const first = diffGameFx(a, b).filter((e) => e.type === "sectorBump");
    expect(first).toEqual([
      { type: "sectorBump", sector: "energy", from: 0, to: 2 },
      { type: "sectorBump", sector: "tech", from: 1, to: 0 },
    ]);
    const still = structuredClone(b);
    still.sectorIndex.energy = 3; // corrupted / late write — must not re-bump
    expect(
      diffGameFx(b, still).some((e) => e.type === "sectorBump"),
    ).toBe(false);
  });

  it("emits cashDelta and landPulse when cash and position change", () => {
    const a = createGame(
      [
        { id: "a", name: "A", token: "amber" },
        { id: "b", name: "B", token: "teal" },
      ],
      () => 0.99,
    );
    const b = structuredClone(a);
    b.players[0]!.cash -= 500;
    b.players[0]!.position = 3;
    const events = diffGameFx(a, b);
    expect(
      events.some(
        (e) => e.type === "cashDelta" && e.playerId === "a" && e.delta === -500,
      ),
    ).toBe(true);
    expect(
      events.some((e) => e.type === "landPulse" && e.tileIndex === 3),
    ).toBe(true);
  });

  it("emits bankrupt and win", () => {
    const a = createGame(
      [
        { id: "a", name: "A", token: "amber" },
        { id: "b", name: "B", token: "teal" },
      ],
      () => 0.99,
    );
    const b = structuredClone(a);
    b.players[0]!.bankrupt = true;
    b.phase = "finished";
    b.winnerId = "b";
    const events = diffGameFx(a, b);
    expect(events.some((e) => e.type === "bankrupt" && e.playerId === "a")).toBe(
      true,
    );
    expect(events.some((e) => e.type === "win" && e.winnerId === "b")).toBe(
      true,
    );
  });

  it("caps sector bump duration", () => {
    expect(sectorBumpMs(0, 5)).toBe(1900); // 5 * 380 under 2400 cap
    expect(sectorBumpMs(0, 1)).toBe(380);
  });
});

describe("coalesceSectorBumps / bumpsFromDeltas", () => {
  it("merges duplicate sector plays into one from→to", () => {
    expect(
      coalesceSectorBumps([
        { type: "sectorBump", sector: "tech", from: 0, to: 1 },
        { type: "sectorBump", sector: "tech", from: 1, to: 2 },
      ]),
    ).toEqual([{ type: "sectorBump", sector: "tech", from: 0, to: 2 }]);
  });

  it("drops deltas that clamp to no movement", () => {
    expect(
      bumpsFromDeltas({ tech: 5 } as never, [{ sector: "tech", delta: 2 }]),
    ).toEqual([]);
  });
});
