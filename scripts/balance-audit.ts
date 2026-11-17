#!/usr/bin/env npx tsx
/**
 * Table + fund matrix audit. Writes balance-audit.json (gitignored).
 *
 *   npm run balance:audit -- --games 600 --fundGames 14
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runBatch } from "../src/lib/game/balance/batch";
import { scenarioById } from "../src/lib/game/balance/scenarios";
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

function pct(n: number, d: number): string {
  if (d <= 0) return "0%";
  return `${((100 * n) / d).toFixed(1)}%`;
}

function main() {
  const games = Number(argValue("--games") ?? 300);
  const fundGames = Number(argValue("--fundGames") ?? 12);
  const maxTurns = Number(argValue("--maxTurns") ?? 0);
  const seed = Number(argValue("--seed") ?? 42);

  console.log(`\n=== Table audit: standard2 × ${games} (maxTurns=${maxTurns}) ===\n`);
  const scenario = { ...scenarioById("standard2"), maxTurns };
  const report = runBatch({
    scenario,
    games,
    baseSeed: seed,
    omitMatches: false,
  });

  const byLevel: Record<string, { buy: number; sell: number; skip: number }> =
    {};
  let floorHits = 0;
  let ceilHits = 0;
  let floorGames = 0;
  let ceilGames = 0;
  const bankruptTurns: number[] = [];

  for (const m of report.matches) {
    if (m.sectorsHitFloor > 0) floorGames += 1;
    if (m.sectorsHitCeil > 0) ceilGames += 1;
    floorHits += m.sectorsHitFloor;
    ceilHits += m.sectorsHitCeil;
    for (const [lv, row] of Object.entries(m.companyTradesByLevel)) {
      if (!byLevel[lv]) byLevel[lv] = { buy: 0, sell: 0, skip: 0 };
      byLevel[lv]!.buy += row.buy;
      byLevel[lv]!.sell += row.sell;
      byLevel[lv]!.skip += row.skip;
    }
    for (const p of m.playerResults) {
      if (p.bankruptTurn != null) bankruptTurns.push(p.bankruptTurn);
    }
  }

  const levels = Object.keys(byLevel)
    .map(Number)
    .sort((a, b) => a - b);
  let buyLow = 0;
  let buyMid = 0;
  let buyHigh = 0;
  let sellLow = 0;
  let sellHigh = 0;
  let skipHigh = 0;
  for (const lv of levels) {
    const row = byLevel[String(lv)]!;
    if (lv <= -3) buyLow += row.buy;
    else if (lv >= 3) buyHigh += row.buy;
    else buyMid += row.buy;
    if (lv <= -3) sellLow += row.sell;
    if (lv >= 3) {
      sellHigh += row.sell;
      skipHigh += row.skip;
    }
  }
  const buys = levels.reduce((s, lv) => s + byLevel[String(lv)]!.buy, 0);

  console.log("End reasons:", report.endReasons);
  console.log(
    `Finished ${report.finished}/${report.games}  medianTurns=${report.medianTurns}  p90=${report.p90Turns}  mean=${report.meanTurns.toFixed(1)}`,
  );
  console.log(
    `Win by seat: ${report.winRateBySeat.map((r) => (r * 100).toFixed(1) + "%").join(" / ")}`,
  );
  console.log(
    `Buys/sells/game: ${report.meanBuysPerGame.toFixed(1)} / ${report.meanSellsPerGame.toFixed(1)}  orderFees=${report.meanOrderFees.toFixed(0)}  visitFees=${report.meanVisitFees.toFixed(0)}  NW gap=${report.meanNetWorthGap.toFixed(0)}`,
  );
  console.log(
    `PR coverage ${pct(report.prIdsSeen, 100)} (${report.prIdsSeen})  News ${pct(report.newsIdsSeen, 100)} (${report.newsIdsSeen})`,
  );
  if (bankruptTurns.length) {
    const sorted = [...bankruptTurns].sort((a, b) => a - b);
    const mid = sorted[Math.floor(sorted.length / 2)]!;
    console.log(
      `Bankrupt events: ${bankruptTurns.length}  median turn-out=${mid}`,
    );
  }

  console.log(
    `\n±5 rails: games w/ any floor ${pct(floorGames, games)}  any ceil ${pct(ceilGames, games)}  mean sectors/game floor=${(floorHits / games).toFixed(2)} ceil=${(ceilHits / games).toFixed(2)}`,
  );
  console.log("\nCompany desk by sector level (pre-PR):");
  console.log("  lv |  buy  sell  skip | buy% of desks");
  for (const lv of levels) {
    const row = byLevel[String(lv)]!;
    const acts = row.buy + row.sell + row.skip;
    console.log(
      `  ${String(lv).padStart(2)} | ${String(row.buy).padStart(5)} ${String(row.sell).padStart(5)} ${String(row.skip).padStart(5)} | ${pct(row.buy, acts).padStart(6)}`,
    );
  }
  console.log(
    `\nBuy mix: low(≤-3)=${pct(buyLow, buys)}  mid=${pct(buyMid, buys)}  high(≥3)=${pct(buyHigh, buys)}`,
  );
  console.log(
    `At ≥+3: sell=${sellHigh} skip=${skipHigh} buy=${buyHigh}  (fade vs chase)`,
  );
  console.log(
    `At ≤-3: buy=${buyLow} sell=${sellLow}  (dip catch vs dump)`,
  );

  // Fund matrix
  console.log(
    `\n=== Fund matrix ${FUND_KIND_ORDER.length}×${FUND_KIND_ORDER.length}, ${fundGames}/pair ===\n`,
  );
  for (const kind of FUND_KIND_ORDER) {
    const name = KIND_REP[kind];
    if (!fundsByKind(kind).find((f) => f.name === name)) {
      throw new Error(`Missing rep ${name} for ${kind}`);
    }
  }

  const winsByKind: Record<string, { wins: number; games: number }> =
    Object.fromEntries(
      FUND_KIND_ORDER.map((k) => [k, { wins: 0, games: 0 }]),
    );
  let fSeed = seed + 10_000;
  for (const a of FUND_KIND_ORDER) {
    for (const b of FUND_KIND_ORDER) {
      for (let g = 0; g < fundGames; g++) {
        const swap = g % 2 === 1;
        const names = swap
          ? [KIND_REP[b], KIND_REP[a]]
          : [KIND_REP[a], KIND_REP[b]];
        const match = runMatch({
          players: 2,
          maxTurns,
          seed: fSeed++,
          seatNames: names,
        });
        winsByKind[a]!.games += 1;
        winsByKind[b]!.games += 1;
        const winner = match.playerResults.find((p) => p.id === match.winnerId);
        if (!winner) continue;
        const winName = names[winner.seat]!;
        if (winName === KIND_REP[a]) winsByKind[a]!.wins += 1;
        if (winName === KIND_REP[b]) winsByKind[b]!.wins += 1;
      }
    }
  }

  const standings = FUND_KIND_ORDER.map((kind) => {
    const row = winsByKind[kind]!;
    return {
      kind,
      fund: KIND_REP[kind],
      winRate: row.wins / Math.max(1, row.games),
      wins: row.wins,
      games: row.games,
    };
  }).sort((x, y) => y.winRate - x.winRate);

  const rates = standings.map((s) => s.winRate);
  const mean = rates.reduce((s, x) => s + x, 0) / rates.length;
  const max = Math.max(...rates);
  const min = Math.min(...rates);

  for (const s of standings) {
    const bar = "█".repeat(Math.round(s.winRate * 40));
    console.log(
      `  ${s.kind.padEnd(12)} ${s.fund.padEnd(14)} ${(s.winRate * 100).toFixed(1)}%  ${bar}`,
    );
  }
  console.log(
    `\nFund spread max−min: ${((max - min) * 100).toFixed(1)}pp  mean=${(mean * 100).toFixed(1)}%`,
  );

  const out = {
    table: {
      games,
      endReasons: report.endReasons,
      medianTurns: report.medianTurns,
      p90Turns: report.p90Turns,
      meanTurns: report.meanTurns,
      winRateBySeat: report.winRateBySeat,
      meanBuysPerGame: report.meanBuysPerGame,
      meanSellsPerGame: report.meanSellsPerGame,
      meanOrderFees: report.meanOrderFees,
      meanVisitFees: report.meanVisitFees,
      meanNetWorthGap: report.meanNetWorthGap,
      floorGames,
      ceilGames,
      meanSectorsHitFloor: floorHits / games,
      meanSectorsHitCeil: ceilHits / games,
      companyTradesByLevel: byLevel,
      buyMix: {
        low: buyLow / Math.max(1, buys),
        mid: buyMid / Math.max(1, buys),
        high: buyHigh / Math.max(1, buys),
      },
    },
    funds: {
      standings,
      spread: max - min,
      mean,
    },
  };
  const path = resolve(process.cwd(), "balance-audit.json");
  writeFileSync(path, JSON.stringify(out, null, 2));
  console.log(`\nWrote ${path}`);
}

main();
