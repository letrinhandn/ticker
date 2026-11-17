#!/usr/bin/env npx tsx
/**
 * Parallel fund-kind matrix (worker_threads).
 *
 *   npx tsx scripts/fund-matrix-parallel.ts --games 2000 --workers 10
 *
 * Literal 1e9 games is ~months at ~40 games/sec/core — use --games for
 * large but feasible batches (e.g. 2000–10000 → 200k–1M total).
 */
import { availableParallelism, cpus } from "node:os";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { runMatch } from "../src/lib/game/balance/simulate";
import {
  FUND_KIND_ORDER,
  fundsByKind,
  type FundKind,
} from "../src/lib/game/bots/botRoster";

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

type PairJob = {
  a: FundKind;
  b: FundKind;
  games: number;
  maxTurns: number;
  seedStart: number;
};

type PairResult = {
  a: FundKind;
  b: FundKind;
  games: number;
  winsA: number;
  winsB: number;
  draws: number;
};

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i < 0) return undefined;
  return process.argv[i + 1];
}

function runPair(job: PairJob): PairResult {
  let winsA = 0;
  let winsB = 0;
  let draws = 0;
  let seed = job.seedStart;
  for (let g = 0; g < job.games; g++) {
    const swap = g % 2 === 1;
    const names = swap
      ? [KIND_REP[job.b], KIND_REP[job.a]]
      : [KIND_REP[job.a], KIND_REP[job.b]];
    const match = runMatch({
      players: 2,
      maxTurns: job.maxTurns,
      seed: seed++,
      seatNames: names,
    });
    const winner = match.playerResults.find((p) => p.id === match.winnerId);
    const winnerName = winner ? names[winner.seat] : null;
    if (!winnerName) {
      draws += 1;
      continue;
    }
    if (winnerName === KIND_REP[job.a]) winsA += 1;
    else if (winnerName === KIND_REP[job.b]) winsB += 1;
    else draws += 1;
  }
  return {
    a: job.a,
    b: job.b,
    games: job.games,
    winsA,
    winsB,
    draws,
  };
}

if (!isMainThread) {
  const jobs = workerData as PairJob[];
  const results = jobs.map(runPair);
  parentPort!.postMessage(results);
} else {
  void main();
}

async function main() {
  for (const kind of FUND_KIND_ORDER) {
    const name = KIND_REP[kind];
    if (!fundsByKind(kind).find((f) => f.name === name)) {
      throw new Error(`KIND_REP[${kind}]="${name}" missing`);
    }
  }

  const gamesPerPair = Number(argValue("--games") ?? 2000);
  const maxTurns = Number(argValue("--maxTurns") ?? 40);
  const baseSeed = Number(argValue("--seed") ?? 1000);
  const out = argValue("--out") ?? "fund-matrix-mega.json";
  const workers = Math.max(
    1,
    Number(
      argValue("--workers") ??
        availableParallelism?.() ??
        cpus().length,
    ),
  );

  if (gamesPerPair >= 1_000_000) {
    console.error(
      `Refusing --games ${gamesPerPair}: 10×10 matrix would be ${(gamesPerPair * 100).toLocaleString()} matches.\n` +
        `At ~40 games/sec/core × ${workers} cores ≈ ` +
        `${Math.round((gamesPerPair * 100) / (40 * workers) / 3600)} hours.\n` +
        `Use e.g. --games 2000 (200k) or --games 10000 (1M).`,
    );
    process.exit(1);
  }

  const kinds = FUND_KIND_ORDER;
  const jobs: PairJob[] = [];
  let seed = baseSeed;
  for (const a of kinds) {
    for (const b of kinds) {
      jobs.push({
        a,
        b,
        games: gamesPerPair,
        maxTurns,
        seedStart: seed,
      });
      seed += gamesPerPair;
    }
  }

  const totalGames = jobs.length * gamesPerPair;
  const estSec = totalGames / (40 * workers);
  console.log(
    `Parallel matrix ${kinds.length}×${kinds.length}, ${gamesPerPair} games/pair → ${totalGames.toLocaleString()} games`,
  );
  console.log(
    `workers=${workers}  maxTurns=${maxTurns}  seed=${baseSeed}  ~est ${Math.round(estSec)}s`,
  );
  if (totalGames >= 1_000_000_000) {
    console.error("1e9+ games refused — pick a smaller --games.");
    process.exit(1);
  }

  const shards: PairJob[][] = Array.from({ length: workers }, () => []);
  jobs.forEach((job, i) => {
    shards[i % workers]!.push(job);
  });

  const t0 = Date.now();
  const self = resolve(process.cwd(), "scripts/fund-matrix-parallel.ts");
  const results = (
    await Promise.all(
      shards
        .filter((s) => s.length > 0)
        .map(
          (shard) =>
            new Promise<PairResult[]>((resolveP, reject) => {
              const w = new Worker(self, {
                workerData: shard,
                execArgv: ["--import", "tsx"],
              });
              w.on("message", (msg: PairResult[]) => resolveP(msg));
              w.on("error", reject);
              w.on("exit", (code) => {
                if (code !== 0) reject(new Error(`worker exit ${code}`));
              });
            }),
        ),
    )
  ).flat();

  const winsByKind: Record<string, { wins: number; games: number }> =
    Object.fromEntries(kinds.map((k) => [k, { wins: 0, games: 0 }]));

  for (const cell of results) {
    winsByKind[cell.a]!.games += cell.games;
    winsByKind[cell.b]!.games += cell.games;
    winsByKind[cell.a]!.wins += cell.winsA;
    winsByKind[cell.b]!.wins += cell.winsB;
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

  const byKind = Object.fromEntries(
    standings.map((s) => [s.kind, s]),
  ) as Record<FundKind, (typeof standings)[0]>;
  const simRank = [...kinds].sort(
    (a, b) => (byKind[b]?.winRate ?? 0) - (byKind[a]?.winRate ?? 0),
  );
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

  const elapsedMs = Date.now() - t0;
  const gps = totalGames / (elapsedMs / 1000);

  const report = {
    generatedAt: new Date().toISOString(),
    gamesPerPair,
    maxTurns,
    baseSeed,
    workers,
    totalGames,
    elapsedMs,
    gamesPerSec: +gps.toFixed(1),
    kindReps: KIND_REP,
    standings,
    summary: {
      meanWinRate: +mean.toFixed(4),
      max,
      min,
      spread: +spread.toFixed(4),
      spearman: +spearman.toFixed(4),
    },
    cells: results.map((c) => ({
      ...c,
      winRateA: c.winsA / c.games,
      winRateB: c.winsB / c.games,
    })),
  };

  const path = resolve(process.cwd(), out);
  writeFileSync(path, JSON.stringify(report, null, 2));

  console.log("\nStandings (overall win rate across matrix):");
  for (const s of standings) {
    const bar = "█".repeat(Math.round(s.winRate * 40));
    console.log(
      `  ${s.kind.padEnd(12)} ${s.fund.padEnd(16)} ${(s.winRate * 100).toFixed(2)}%  ${bar}`,
    );
  }
  console.log(
    `\nSpread max−min: ${(spread * 100).toFixed(2)}pp  mean=${(mean * 100).toFixed(1)}%`,
  );
  console.log(`Market-order Spearman ρ=${spearman.toFixed(3)}`);
  console.log(`Sim order: ${simRank.join(" > ")}`);
  console.log(`Mkt order: ${marketOrder.join(" > ")}`);
  console.log(
    `Wrote ${path} (${totalGames.toLocaleString()} games in ${(elapsedMs / 1000).toFixed(1)}s @ ${gps.toFixed(0)} games/sec)`,
  );
  if (spearman < 0.35) {
    console.warn("WARN: sim ladder disagrees with real-market fund hierarchy.");
  } else {
    console.log("OK: hierarchy leans market-like.");
  }
}
