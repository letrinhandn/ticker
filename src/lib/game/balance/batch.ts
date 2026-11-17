import { PRICE_REACTIONS } from "@/lib/game/content/priceReactions";
import { REGIME_CARDS } from "@/lib/game/content/regimes";
import { runMatch } from "./simulate";
import { scenarioById } from "./scenarios";
import type { BalanceScenario, BatchReport, MatchResult } from "./types";

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
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

export type RunBatchOpts = {
  scenario: string | BalanceScenario;
  games?: number;
  baseSeed?: number;
  /** When true, omit per-match list from the returned report (CLI dumps stay smaller). */
  omitMatches?: boolean;
};

export function runBatch(opts: RunBatchOpts): BatchReport {
  const scenario =
    typeof opts.scenario === "string"
      ? scenarioById(opts.scenario)
      : opts.scenario;
  const games = opts.games ?? scenario.vitestGames;
  const baseSeed = opts.baseSeed ?? 1;

  const matches: MatchResult[] = [];
  for (let i = 0; i < games; i++) {
    matches.push(
      runMatch({
        players: scenario.players,
        maxTurns: scenario.maxTurns,
        seed: baseSeed + i,
      }),
    );
  }

  const finished = matches.filter((m) => m.phase === "finished").length;
  const endReasons: Record<string, number> = {};
  for (const m of matches) {
    endReasons[m.endReason] = (endReasons[m.endReason] ?? 0) + 1;
  }

  const winBySeat = Array.from({ length: scenario.players }, () => 0);
  const winById: Record<string, number> = {};
  for (const m of matches) {
    if (!m.winnerId) continue;
    const seat = m.playerResults.find((p) => p.id === m.winnerId)?.seat;
    if (seat != null) winBySeat[seat] = (winBySeat[seat] ?? 0) + 1;
    winById[m.winnerId] = (winById[m.winnerId] ?? 0) + 1;
  }
  const winRateBySeat = winBySeat.map((w) => w / games);
  const winRateByPlayerId = Object.fromEntries(
    Object.entries(winById).map(([id, w]) => [id, w / games]),
  );

  const turnsSorted = matches.map((m) => m.turns).sort((a, b) => a - b);
  const meanTurns =
    turnsSorted.reduce((s, t) => s + t, 0) / (turnsSorted.length || 1);

  const prSeen = new Set<string>();
  const newsSeen = new Set<string>();
  let buys = 0;
  let sells = 0;
  let orderFees = 0;
  let visitFees = 0;
  let nwGap = 0;

  for (const m of matches) {
    for (const id of m.prDraws) prSeen.add(id);
    for (const id of m.newsDraws) newsSeen.add(id);
    for (const p of m.playerResults) {
      buys += p.buys;
      sells += p.sells;
    }
    orderFees += m.orderFeesPaid;
    visitFees += m.visitFeesPaid;
    const nws = m.playerResults.map((p) => p.netWorth);
    nwGap += Math.max(...nws) - Math.min(...nws);
  }

  const report: BatchReport = {
    scenarioId: scenario.id,
    games,
    baseSeed,
    finished,
    endReasons,
    winRateBySeat,
    winRateByPlayerId,
    medianTurns: median(turnsSorted),
    p90Turns: percentile(turnsSorted, 90),
    meanTurns,
    prIdCoverage: prSeen.size / PRICE_REACTIONS.length,
    newsIdCoverage: newsSeen.size / REGIME_CARDS.length,
    prIdsSeen: prSeen.size,
    newsIdsSeen: newsSeen.size,
    meanBuysPerGame: buys / games,
    meanSellsPerGame: sells / games,
    meanOrderFees: orderFees / games,
    meanVisitFees: visitFees / games,
    meanNetWorthGap: nwGap / games,
    matches: opts.omitMatches ? [] : matches,
  };

  return report;
}
