import { describe, expect, it } from "vitest";
import { runBatch } from "./batch";
import { scenarioById } from "./scenarios";

describe("balance sim gates", () => {
  it("smoke2: all games finish by insolvency (no turn-cap)", () => {
    const scenario = scenarioById("smoke2");
    const report = runBatch({
      scenario,
      games: scenario.vitestGames,
      baseSeed: 100,
      omitMatches: true,
    });
    expect(report.finished).toBe(report.games);
    expect(report.endReasons.stuck ?? 0).toBe(0);
    expect(report.endReasons.stepCap ?? 0).toBe(0);
    expect(report.endReasons.maxTurns ?? 0).toBe(0);
    expect(report.endReasons.bankruptcy ?? 0).toBe(report.games);
  });

  it("standard2: crash-paced; fair seats; cards drawn", () => {
    const scenario = scenarioById("standard2");
    const report = runBatch({
      scenario,
      games: scenario.vitestGames,
      baseSeed: 200,
    });

    expect(report.finished).toBe(report.games);
    for (const rate of report.winRateBySeat) {
      expect(rate).toBeLessThanOrEqual(0.85);
    }

    // Forever table: insolvency ends matches; no Market-closes turn-cap.
    expect(report.medianTurns).toBeGreaterThanOrEqual(8);
    expect(report.endReasons.maxTurns ?? 0).toBe(0);
    expect(report.endReasons.bankruptcy ?? 0).toBeGreaterThan(
      report.games * 0.9,
    );

    expect(report.prIdsSeen).toBeGreaterThanOrEqual(1);
    expect(report.newsIdsSeen).toBeGreaterThanOrEqual(1);

    // Soft: at least 15% of PR deck seen across 50 games
    expect(report.prIdCoverage).toBeGreaterThanOrEqual(0.15);
  });
});
