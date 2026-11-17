/**
 * Price-action / sector-tape signals from sectorHistory.
 * Pure reads — no new game rules; desks that use these should outplay level-only bots.
 */
import type { GameState, SectorId } from "@/shared/types";
import { SECTOR_IDS } from "../board";

export type SectorTape = {
  level: number;
  /** Δ over last lookback steps (positive = rising). */
  mom: number;
  /** level − recent mean (positive = rich vs own history). */
  stretch: number;
  /** Consecutive same-sign steps at the end of the series. */
  streak: number;
  /** Stdev of recent levels. */
  vol: number;
  /** level − cross-sector median (positive = rich vs board). */
  rel: number;
  samples: number;
};

export type DeskEdge = {
  tape: SectorTape;
  /** Mean-reversion score: + want buy dips / − fade rips. */
  meanRev: number;
  /** Trend / momentum score: + follow strength. */
  trend: number;
  /** Multi-strat blend (0.55 trend + 0.45 mean-rev when vol high flips). */
  blend: number;
  /** Cheap vs history + board → aggressive dip buy. */
  buyDip: boolean;
  /** Rich / stretched → take profit / dump. */
  fadeRally: boolean;
  /** Healthy uptrend worth adding. */
  followUp: boolean;
  /** Crash continuation — cut. */
  broken: boolean;
};

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  let v = 0;
  for (const x of xs) v += (x - m) * (x - m);
  return Math.sqrt(v / (xs.length - 1));
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const a = [...xs].sort((p, q) => p - q);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 === 1
    ? (a[mid] ?? 0)
    : ((a[mid - 1] ?? 0) + (a[mid] ?? 0)) / 2;
}

function streakLen(series: number[]): number {
  if (series.length < 2) return 0;
  let s = 0;
  let sign = 0;
  for (let i = series.length - 1; i > 0; i--) {
    const d = (series[i] ?? 0) - (series[i - 1] ?? 0);
    if (d === 0) break;
    const sg = d > 0 ? 1 : -1;
    if (sign === 0) sign = sg;
    if (sg !== sign) break;
    s += 1;
  }
  return sign * s;
}

/** Read sector tape; short history falls back to level-only. */
export function readSectorTape(
  state: GameState,
  sector: SectorId | null,
): SectorTape {
  const level = sector ? (state.sectorIndex[sector] ?? 0) : 0;
  const raw =
    sector && state.sectorHistory
      ? (state.sectorHistory[sector] ?? [])
      : [];
  // Always include live peg so tape matches what the player sees now.
  const series =
    raw.length === 0 || raw[raw.length - 1] !== level ? [...raw, level] : raw;
  const window = series.slice(-8);
  const samples = window.length;
  const look = Math.min(3, Math.max(1, samples - 1));
  const mom =
    samples >= 2
      ? (window[samples - 1] ?? 0) - (window[samples - 1 - look] ?? 0)
      : 0;
  const stretch = samples >= 3 ? level - mean(window) : level * 0.35;
  const vol = stdev(window);
  const streak = streakLen(window);

  const boardLevels = SECTOR_IDS.map((s) => state.sectorIndex[s] ?? 0);
  const rel = level - median(boardLevels);

  return { level, mom, stretch, streak, vol, rel, samples };
}

/**
 * Composite edge for skilled desks.
 * Positive blend → lean long; negative → lean flat/short inventory.
 */
export function deskEdge(state: GameState, sector: SectorId | null): DeskEdge {
  const tape = readSectorTape(state, sector);
  const { level, mom, stretch, streak, vol, rel } = tape;

  // Mean-reversion: buy when stretched down / rich relative.
  const meanRev =
    -stretch * 1.1 - rel * 0.45 - Math.sign(level) * Math.max(0, Math.abs(level) - 2) * 0.25;

  // Trend: follow momentum + streak, dampened when already extreme.
  const extremePenalty = Math.abs(level) >= 4 ? 0.55 : Math.abs(level) >= 3 ? 0.25 : 0;
  const trend = mom * 0.9 + streak * 0.35 + rel * 0.2 - extremePenalty * Math.sign(mom || level);

  // When vol is elevated, multi leans more mean-rev (regime risk).
  const volW = Math.min(0.65, 0.35 + vol * 0.08);
  const blend = trend * (1 - volW) + meanRev * volW;

  const buyDip =
    level <= -1 &&
    (stretch <= -0.6 || mom <= -1 || meanRev >= 0.8 || (level <= -2 && rel <= 0));
  const fadeRally =
    level >= 2 &&
    (stretch >= 0.8 || mom >= 1 || meanRev <= -0.7 || (level >= 3 && streak >= 2));
  const followUp =
    level >= 1 &&
    level <= 3 &&
    mom >= 0 &&
    streak >= 0 &&
    stretch <= 1.2 &&
    !fadeRally;
  const broken =
    level <= -2 && (mom <= -1 || streak <= -2 || (level <= -3 && stretch < 0));

  return { tape, meanRev, trend, blend, buyDip, fadeRally, followUp, broken };
}
