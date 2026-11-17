#!/usr/bin/env npx tsx
/**
 * Monte Carlo balance sweep — find knobs so 2p bot games finish by crash in <20 turns.
 *
 *   npx tsx scripts/balance-tune.ts --baseline --games 5000
 *   npx tsx scripts/balance-tune.ts --sweep --games 1500
 *   npx tsx scripts/balance-tune.ts --validate --games 50000
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runMatch } from "../src/lib/game/balance/simulate";
import {
  BALANCE,
  resetBalanceKnobs,
  setBalanceKnobs,
  snapshotKnobs,
  type BalanceKnobs,
} from "../src/lib/game/balance/knobs";

type TrialStats = {
  label: string;
  knobs: BalanceKnobs;
  games: number;
  finished: number;
  bankruptcyRate: number;
  maxTurnsRate: number;
  stuckRate: number;
  medianTurns: number;
  meanTurns: number;
  p90Turns: number;
  pctUnder20: number;
  meanBankrupts: number;
  meanVisitFees: number;
  meanStartTax: number;
  meanStartOps: number;
  meanOrderFees: number;
  meanBuys: number;
  maxSeatWinRate: number;
  score: number;
};

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[idx]!;
}

function median(sorted: number[]): number {
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function scoreTrial(s: TrialStats): number {
  // Prefer: bankruptcy ends, median turns in 10–18, high % under 20, not too lopsided.
  const under20 = s.pctUnder20;
  const medOk =
    s.medianTurns >= 8 && s.medianTurns <= 18
      ? 1
      : s.medianTurns < 8
        ? 0.4
        : Math.max(0, 1 - (s.medianTurns - 18) / 20);
  const crash = s.bankruptcyRate;
  const fair = s.maxSeatWinRate <= 0.72 ? 1 : Math.max(0, 1 - (s.maxSeatWinRate - 0.72) * 3);
  const stuckPenalty = s.stuckRate * 5;
  return under20 * 0.35 + medOk * 0.25 + crash * 0.3 + fair * 0.1 - stuckPenalty;
}

function runTrial(
  label: string,
  knobs: Partial<BalanceKnobs>,
  games: number,
  baseSeed: number,
  players: 2 | 4 = 2,
  maxTurns = 40,
): TrialStats {
  resetBalanceKnobs();
  setBalanceKnobs(knobs);
  const snap = snapshotKnobs();

  const turns: number[] = [];
  let finished = 0;
  let bankruptcy = 0;
  let maxTurnsEnd = 0;
  let stuck = 0;
  let bankrupts = 0;
  let visit = 0;
  let startTax = 0;
  let startOps = 0;
  let orderFees = 0;
  let buys = 0;
  const seatWins = Array.from({ length: players }, () => 0);

  const t0 = Date.now();
  for (let i = 0; i < games; i++) {
    const m = runMatch({
      players,
      maxTurns,
      seed: baseSeed + i,
      maxSteps: 6000,
    });
    turns.push(m.turns);
    if (m.phase === "finished") finished += 1;
    if (m.endReason === "bankruptcy") bankruptcy += 1;
    else if (m.endReason === "maxTurns") maxTurnsEnd += 1;
    else stuck += 1;
    bankrupts += m.playerResults.filter((p) => p.bankrupt).length;
    visit += m.visitFeesPaid;
    startTax += m.startTaxPaid;
    startOps += m.startOpsNet;
    orderFees += m.orderFeesPaid;
    buys += m.playerResults.reduce((s, p) => s + p.buys, 0);
    if (m.winnerId) {
      const seat = m.playerResults.find((p) => p.id === m.winnerId)?.seat;
      if (seat != null) seatWins[seat]! += 1;
    }
  }
  const ms = Date.now() - t0;
  const sorted = [...turns].sort((a, b) => a - b);
  const under20 = turns.filter((t) => t < 20).length / games;
  const maxSeatWinRate = Math.max(...seatWins.map((w) => w / games));

  const stats: TrialStats = {
    label,
    knobs: snap,
    games,
    finished,
    bankruptcyRate: bankruptcy / games,
    maxTurnsRate: maxTurnsEnd / games,
    stuckRate: stuck / games,
    medianTurns: median(sorted),
    meanTurns: turns.reduce((a, b) => a + b, 0) / games,
    p90Turns: percentile(sorted, 90),
    pctUnder20: under20,
    meanBankrupts: bankrupts / games,
    meanVisitFees: visit / games,
    meanStartTax: startTax / games,
    meanStartOps: startOps / games,
    meanOrderFees: orderFees / games,
    meanBuys: buys / games,
    maxSeatWinRate,
    score: 0,
  };
  stats.score = scoreTrial(stats);
  console.log(
    JSON.stringify({
      label,
      games,
      ms,
      gps: Math.round((games / ms) * 1000),
      bankruptcyRate: +stats.bankruptcyRate.toFixed(3),
      medianTurns: stats.medianTurns,
      p90Turns: stats.p90Turns,
      pctUnder20: +stats.pctUnder20.toFixed(3),
      meanBankrupts: +stats.meanBankrupts.toFixed(2),
      meanVisitFees: Math.round(stats.meanVisitFees),
      meanStartTax: Math.round(stats.meanStartTax),
      meanStartOps: Math.round(stats.meanStartOps),
      maxSeatWinRate: +stats.maxSeatWinRate.toFixed(3),
      score: +stats.score.toFixed(3),
    }),
  );
  return stats;
}

/** Coarse → fine grid around crash-faster economy. */
function candidateGrid(): { label: string; knobs: Partial<BalanceKnobs> }[] {
  const out: { label: string; knobs: Partial<BalanceKnobs> }[] = [];
  out.push({ label: "baseline", knobs: {} });

  const cashes = [2500, 2000, 1800, 1500];
  const taxes = [0.15, 0.2, 0.25];
  const visits = [2, 2.5, 3, 4];
  const orderFees = [15, 25, 40];
  const news = [1.5, 2];
  const pr = [1.5, 2];
  const weak = [-6, -8];

  // Full factorial is huge — latin-ish sample + targeted combos
  let i = 0;
  for (const startingCash of cashes) {
    for (const startCashTaxRate of taxes) {
      for (const visitFeeMult of visits) {
        i += 1;
        if (i % 3 !== 0) continue; // thin
        out.push({
          label: `c${startingCash}_t${startCashTaxRate}_v${visitFeeMult}`,
          knobs: {
            startingCash,
            startCashTaxRate,
            visitFeeMult,
            orderFeeM: 25,
            haltFine: 100,
            incomeTax: 200,
            wealthTax: 400,
            opsWeakAdj: -8,
            opsStrongAdj: 3,
            newsShockMult: 2,
            prShockMult: 1.5,
          },
        });
      }
    }
  }

  // Hand-picked aggressive pillars
  const hand: Partial<BalanceKnobs>[] = [
    {
      startingCash: 2000,
      startCashTaxRate: 0.2,
      visitFeeMult: 3,
      orderFeeM: 25,
      haltFine: 120,
      incomeTax: 250,
      wealthTax: 450,
      opsWeakAdj: -8,
      opsStrongAdj: 2,
      newsShockMult: 2,
      prShockMult: 2,
    },
    {
      startingCash: 1800,
      startCashTaxRate: 0.22,
      visitFeeMult: 3.5,
      orderFeeM: 30,
      haltFine: 150,
      incomeTax: 250,
      wealthTax: 500,
      opsWeakAdj: -10,
      opsStrongAdj: 2,
      newsShockMult: 2.5,
      prShockMult: 2,
    },
    {
      startingCash: 1500,
      startCashTaxRate: 0.25,
      visitFeeMult: 4,
      orderFeeM: 40,
      haltFine: 150,
      incomeTax: 300,
      wealthTax: 500,
      opsWeakAdj: -10,
      opsStrongAdj: 1,
      newsShockMult: 2.5,
      prShockMult: 2.5,
    },
    {
      startingCash: 2200,
      startCashTaxRate: 0.18,
      visitFeeMult: 2.5,
      orderFeeM: 20,
      haltFine: 100,
      incomeTax: 200,
      wealthTax: 400,
      opsWeakAdj: -7,
      opsStrongAdj: 3,
      newsShockMult: 1.5,
      prShockMult: 1.5,
    },
    {
      startingCash: 2000,
      startCashTaxRate: 0.2,
      visitFeeMult: 2.5,
      orderFeeM: 20,
      haltFine: 100,
      incomeTax: 200,
      wealthTax: 400,
      opsWeakAdj: -8,
      opsStrongAdj: 2,
      newsShockMult: 2,
      prShockMult: 1.5,
    },
  ];
  hand.forEach((knobs, idx) => {
    out.push({ label: `hand_${idx}`, knobs });
  });

  // unused vars silence — keep for future denser sweeps
  void orderFees;
  void news;
  void pr;
  void weak;

  return out;
}

async function main() {
  const games = Number(argValue("--games") ?? 2000);
  const seed = Number(argValue("--seed") ?? 1);
  const players = (Number(argValue("--players") ?? 2) as 2 | 4);

  if (hasFlag("--baseline")) {
    const s = runTrial("baseline", {}, games, seed, players, 40);
    writeFileSync(
      resolve("balance-baseline.json"),
      JSON.stringify(s, null, 2),
    );
    console.log("Wrote balance-baseline.json");
    return;
  }

  if (hasFlag("--sweep")) {
    const grid = candidateGrid();
    console.log(`Sweeping ${grid.length} configs × ${games} games…`);
    const results: TrialStats[] = [];
    for (const c of grid) {
      results.push(runTrial(c.label, c.knobs, games, seed, players, 40));
    }
    results.sort((a, b) => b.score - a.score);
    const top = results.slice(0, 8);
    writeFileSync(
      resolve("balance-sweep.json"),
      JSON.stringify({ top, all: results }, null, 2),
    );
    console.log("\nTOP:");
    for (const t of top) {
      console.log(
        `${t.score.toFixed(3)} ${t.label} med=${t.medianTurns} <20=${(t.pctUnder20 * 100).toFixed(0)}% crash=${(t.bankruptcyRate * 100).toFixed(0)}%`,
      );
    }
    console.log("Wrote balance-sweep.json");
    // Print best knobs for lock-in
    console.log("\nBEST_KNOBS=", JSON.stringify(top[0]?.knobs, null, 2));
    return;
  }

  if (hasFlag("--validate")) {
    const knobsPath = argValue("--knobs");
    let knobs: Partial<BalanceKnobs> = {};
    if (knobsPath) {
      knobs = JSON.parse(
        await import("node:fs").then((fs) =>
          fs.readFileSync(resolve(knobsPath), "utf8"),
        ),
      );
    } else if (hasFlag("--best-from-sweep")) {
      const sweep = JSON.parse(
        await import("node:fs").then((fs) =>
          fs.readFileSync(resolve("balance-sweep.json"), "utf8"),
        ),
      );
      knobs = sweep.top[0].knobs;
    }
    const s2 = runTrial("validate_2p", knobs, games, seed, 2, 40);
    const s4 = runTrial(
      "validate_4p",
      knobs,
      Math.max(500, Math.floor(games / 5)),
      seed + 100000,
      4,
      40,
    );
    writeFileSync(
      resolve("balance-validate.json"),
      JSON.stringify({ knobs: { ...BALANCE }, s2, s4 }, null, 2),
    );
    console.log("Wrote balance-validate.json");
    return;
  }

  console.log(`Usage:
  --baseline [--games N]
  --sweep [--games N]
  --validate [--games N] [--best-from-sweep | --knobs file.json]
`);
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
