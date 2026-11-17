#!/usr/bin/env npx tsx
/**
 * Fund-kind matrix: every strategy vs every strategy.
 *
 *   npx tsx scripts/fund-matrix.ts
 *   npx tsx scripts/fund-matrix.ts --games 24 --out fund-matrix.json
 *
 * Seat order is swapped each game so first-mover bias cancels.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runMatch } from "../src/lib/game/balance/simulate";
import {
  FUND_KIND_ORDER,
  fundsByKind,
  type FundKind,
} from "../src/lib/game/bots/botRoster";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i < 0) return undefined;
  return process.argv[i + 1];
}

/** One canonical desk per kind for the matrix. */
const KIND_REP: Record<FundKind, string> = {
  index: "Vanguard",
  value: "Berkshire",
  growth: "Sequoia",
  sovereign: "Temasek",
  activist: "Elliott",
  event: "Farallon",
  multi_strat: "Citadel",
  macro: "Bridgewater",
  quant: "Renaissance",
  market_make: "Jane Street",
};

type Cell = {
  a: FundKind;
  b: FundKind;
  games: number;
  winsA: number;
  winsB: number;
  draws: number;
  winRateA: number;
  winRateB: number;
};

function ensureReps(): void {
  for (const kind of FUND_KIND_ORDER) {
    const name = KIND_REP[kind];
    const hit = fundsByKind(kind).find((f) => f.name === name);
    if (!hit) {
      throw new Error(`KIND_REP[${kind}]="${name}" missing from roster`);
    }
  }
}

function main() {
  ensureReps();
  const gamesPerPair = Number(argValue("--games") ?? 20);
  const maxTurns = Number(argValue("--maxTurns") ?? 40);
  const baseSeed = Number(argValue("--seed") ?? 1000);
  const out = argValue("--out") ?? "fund-matrix.json";

  const kinds = FUND_KIND_ORDER;
  const cells: Cell[] = [];
  const winsByKind: Record<string, { wins: number; games: number }> =
    Object.fromEntries(kinds.map((k) => [k, { wins: 0, games: 0 }]));

  let seed = baseSeed;
  let played = 0;

  console.log(
    `Fund matrix ${kinds.length}×${kinds.length}, ${gamesPerPair} games/pair (seat-swapped), maxTurns=${maxTurns}`,
  );

  for (const a of kinds) {
    for (const b of kinds) {
      let winsA = 0;
      let winsB = 0;
      let draws = 0;

      for (let g = 0; g < gamesPerPair; g++) {
        const swap = g % 2 === 1;
        const names = swap
          ? [KIND_REP[b], KIND_REP[a]]
          : [KIND_REP[a], KIND_REP[b]];
        const match = runMatch({
          players: 2,
          maxTurns,
          seed: seed++,
          seatNames: names,
        });
        played += 1;

        const winner = match.playerResults.find(
          (p) => p.id === match.winnerId,
        );
        const winnerName = winner
          ? names[winner.seat]
          : null;

        winsByKind[a]!.games += 1;
        winsByKind[b]!.games += 1;

        if (!winnerName) {
          draws += 1;
          continue;
        }
        if (winnerName === KIND_REP[a]) {
          winsA += 1;
          winsByKind[a]!.wins += 1;
        } else if (winnerName === KIND_REP[b]) {
          winsB += 1;
          winsByKind[b]!.wins += 1;
        } else {
          draws += 1;
        }
      }

      const games = gamesPerPair;
      cells.push({
        a,
        b,
        games,
        winsA,
        winsB,
        draws,
        winRateA: winsA / games,
        winRateB: winsB / games,
      });
    }
  }

  const standings = kinds
    .map((k) => {
      const row = winsByKind[k]!;
      return {
        kind: k,
        fund: KIND_REP[k],
        wins: row.wins,
        games: row.games,
        winRate: row.wins / Math.max(1, row.games),
      };
    })
    .sort((x, y) => y.winRate - x.winRate);

  const rates = standings.map((s) => s.winRate);
  const mean = rates.reduce((s, x) => s + x, 0) / rates.length;
  const max = Math.max(...rates);
  const min = Math.min(...rates);
  const spread = max - min;

  // Head-to-head grid (A rows, B cols): P(A beats B)
  const grid: Record<string, Record<string, number>> = {};
  for (const a of kinds) {
    grid[a] = {};
    for (const b of kinds) {
      const cell = cells.find((c) => c.a === a && c.b === b)!;
      grid[a]![b] = +cell.winRateA.toFixed(3);
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    gamesPerPair,
    maxTurns,
    baseSeed,
    totalGames: played,
    kindReps: KIND_REP,
    standings,
    summary: { meanWinRate: +mean.toFixed(4), max, min, spread: +spread.toFixed(4) },
    h2hWinRateA: grid,
    cells,
  };

  const path = resolve(process.cwd(), out);
  writeFileSync(path, JSON.stringify(report, null, 2));

  console.log("\nStandings (overall win rate across matrix):");
  for (const s of standings) {
    const bar = "█".repeat(Math.round(s.winRate * 40));
    console.log(
      `  ${s.kind.padEnd(12)} ${s.fund.padEnd(16)} ${(s.winRate * 100).toFixed(1)}%  ${bar}`,
    );
  }
  /** Real-market skill ladder (1 = strongest). Not “equal win rates”. */
  const MARKET_RANK: Record<FundKind, number> = {
    multi_strat: 1,
    quant: 2,
    market_make: 3,
    activist: 4,
    growth: 5,
    event: 6,
    macro: 7,
    value: 8,
    sovereign: 9,
    index: 10,
  };

  const byKind = Object.fromEntries(
    standings.map((s) => [s.kind, s]),
  ) as Record<FundKind, (typeof standings)[0]>;
  const simRank = [...kinds].sort(
    (a, b) => (byKind[b]?.winRate ?? 0) - (byKind[a]?.winRate ?? 0),
  );
  // Spearman vs market ladder
  const marketOrder = [...kinds].sort(
    (a, b) => MARKET_RANK[a] - MARKET_RANK[b],
  );
  const rankIndex = (order: FundKind[], k: FundKind) => order.indexOf(k) + 1;
  let d2 = 0;
  for (const k of kinds) {
    const d = rankIndex(simRank, k) - rankIndex(marketOrder, k);
    d2 += d * d;
  }
  const n = kinds.length;
  const spearman = 1 - (6 * d2) / (n * (n * n - 1));

  console.log(
    `\nSpread max−min: ${(spread * 100).toFixed(1)}pp  mean=${(mean * 100).toFixed(1)}%`,
  );
  console.log(`Market-order Spearman ρ=${spearman.toFixed(3)} (1=perfect ladder)`);
  console.log(
    `Sim order: ${simRank.join(" > ")}`,
  );
  console.log(
    `Mkt order: ${marketOrder.join(" > ")}`,
  );
  console.log(`Wrote ${path} (${played} games)`);

  if (spearman < 0.35) {
    console.warn(
      "WARN: sim ladder disagrees with real-market fund hierarchy — retune economy/styles.",
    );
  } else if (spread < 0.08) {
    console.warn(
      "WARN: spread too flat — elite desks should still pull ahead.",
    );
  } else {
    console.log("OK: hierarchy leans market-like; every desk still has a weakness.");
  }
}

main();
