#!/usr/bin/env npx tsx
/**
 * Balance harness CLI
 *
 *   npx tsx scripts/balance-sim.ts --catalog
 *   npx tsx scripts/balance-sim.ts --catalog-summary
 *   npx tsx scripts/balance-sim.ts --sim --scenario standard2 --games 500
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  getBalanceCatalog,
  getBalanceCatalogSummary,
} from "../src/lib/game/balance/catalog";
import { runBatch } from "../src/lib/game/balance/batch";
import { BALANCE_SCENARIOS, scenarioById } from "../src/lib/game/balance/scenarios";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i < 0) return undefined;
  return process.argv[i + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function usage(): never {
  console.log(`Usage:
  balance-sim --catalog [--out balance-catalog.json]
  balance-sim --catalog-summary [--out balance-catalog-summary.json]
  balance-sim --sim --scenario <id> [--games N] [--seed N] [--out balance-report.json]

Scenarios: ${BALANCE_SCENARIOS.map((s) => s.id).join(", ")}
`);
  process.exit(1);
}

async function main() {
  if (hasFlag("--catalog") || hasFlag("--catalog-summary")) {
    const summary = hasFlag("--catalog-summary");
    const data = summary ? getBalanceCatalogSummary() : getBalanceCatalog();
    const out =
      argValue("--out") ??
      (summary ? "balance-catalog-summary.json" : "balance-catalog.json");
    const path = resolve(process.cwd(), out);
    writeFileSync(path, JSON.stringify(data, null, 2));
    console.log(
      `Wrote ${summary ? "catalog summary" : "full catalog"} → ${path}` +
        (`fingerprint` in data ? ` (fp=${(data as { fingerprint: string }).fingerprint})` : ""),
    );
    return;
  }

  if (hasFlag("--sim")) {
    const scenarioId = argValue("--scenario") ?? "standard2";
    const scenario = scenarioById(scenarioId);
    const games = Number(argValue("--games") ?? scenario.cliGames);
    const baseSeed = Number(argValue("--seed") ?? 1);
    const includeMatches = hasFlag("--include-matches");

    console.log(
      `Running ${games}× ${scenario.id} (players=${scenario.players}, maxTurns=${scenario.maxTurns}, seed=${baseSeed})…`,
    );
    const report = runBatch({
      scenario,
      games,
      baseSeed,
      omitMatches: !includeMatches,
    });
    const out = argValue("--out") ?? "balance-report.json";
    const path = resolve(process.cwd(), out);
    writeFileSync(path, JSON.stringify(report, null, 2));
    console.log(
      JSON.stringify(
        {
          scenarioId: report.scenarioId,
          games: report.games,
          finished: report.finished,
          endReasons: report.endReasons,
          winRateBySeat: report.winRateBySeat,
          medianTurns: report.medianTurns,
          p90Turns: report.p90Turns,
          prIdCoverage: report.prIdCoverage,
          newsIdCoverage: report.newsIdCoverage,
          meanBuysPerGame: report.meanBuysPerGame,
          meanSellsPerGame: report.meanSellsPerGame,
        },
        null,
        2,
      ),
    );
    console.log(`Wrote report → ${path}`);
    return;
  }

  usage();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
