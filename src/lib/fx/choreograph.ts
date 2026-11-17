import type { GameState, SectorDelta, SectorId } from "@/shared/types";
import { SECTOR_IDS } from "@/lib/game/board";
import { clampSector } from "@/lib/game/pricing";
import type { FxEvent } from "./types";
import { FX_TIMING } from "./types";

export type SectorBumpEvent = Extract<FxEvent, { type: "sectorBump" }>;

/** Merge bumps for the same sector: keep earliest `from`, latest `to`. Drop no-ops. */
export function coalesceSectorBumps(
  bumps: SectorBumpEvent[],
): SectorBumpEvent[] {
  const bySector = new Map<SectorId, SectorBumpEvent>();
  for (const b of bumps) {
    const prev = bySector.get(b.sector);
    if (!prev) {
      bySector.set(b.sector, b);
      continue;
    }
    bySector.set(b.sector, {
      type: "sectorBump",
      sector: b.sector,
      from: prev.from,
      to: b.to,
    });
  }
  return [...bySector.values()].filter((b) => b.from !== b.to);
}

/** Bumps that match a PR card's deltas after clamp (same as engine apply). */
export function bumpsFromDeltas(
  levelsBefore: Record<SectorId, number>,
  deltas: SectorDelta[],
): SectorBumpEvent[] {
  const out: SectorBumpEvent[] = [];
  for (const d of deltas) {
    if (d.delta === 0) continue;
    const from = levelsBefore[d.sector] ?? 0;
    const to = clampSector(from + d.delta);
    if (from !== to) {
      out.push({ type: "sectorBump", sector: d.sector, from, to });
    }
  }
  return coalesceSectorBumps(out);
}

/** Raw sector-index movement between two snapshots. */
export function sectorIndexBumps(
  prev: GameState,
  next: GameState,
): SectorBumpEvent[] {
  const out: SectorBumpEvent[] = [];
  for (const sector of SECTOR_IDS) {
    const from = prev.sectorIndex[sector] ?? 0;
    const to = next.sectorIndex[sector] ?? 0;
    if (from !== to) {
      out.push({ type: "sectorBump", sector, from, to });
    }
  }
  return out;
}

/**
 * Only animate bumps the card claims AND the board actually took — exact
 * from/to agreement. Drops phantom FX when card face / engine disagree.
 */
export function intersectBumps(
  fromCard: SectorBumpEvent[],
  fromIndex: SectorBumpEvent[],
): SectorBumpEvent[] {
  const bySector = new Map(fromIndex.map((b) => [b.sector, b]));
  const out: SectorBumpEvent[] = [];
  for (const cardBump of fromCard) {
    const actual = bySector.get(cardBump.sector);
    if (
      actual &&
      actual.from === cardBump.from &&
      actual.to === cardBump.to
    ) {
      out.push(cardBump);
    }
  }
  return coalesceSectorBumps(out);
}

/** Pure diff: previous → next game snapshot into ordered FX beats. */
export function diffGameFx(
  prev: GameState | null,
  next: GameState,
): FxEvent[] {
  const events: FxEvent[] = [];

  if (!prev) {
    // Mid-reveal join: pegs are already at post-card levels — don't replay.
    const pending = next.pending?.type;
    if (pending === "price_reaction" || pending === "regime") {
      return events;
    }
    const anyShock = SECTOR_IDS.some((s) => (next.sectorIndex[s] ?? 0) !== 0);
    if (anyShock) events.push({ type: "opening" });
    for (const sector of SECTOR_IDS) {
      const to = next.sectorIndex[sector] ?? 0;
      if (to !== 0) {
        events.push({ type: "sectorBump", sector, from: 0, to });
      }
    }
    return events;
  }

  // Cash deltas
  for (const p of next.players) {
    const before = prev.players.find((x) => x.id === p.id);
    if (!before) continue;
    const delta = p.cash - before.cash;
    if (delta !== 0) {
      events.push({ type: "cashDelta", playerId: p.id, delta });
    }
    if (!before.bankrupt && p.bankrupt) {
      events.push({ type: "bankrupt", playerId: p.id });
    }
  }

  // Card reveals (PR / Market News): bump from the card's own deltas/shocks.
  // While that card is still pending, skip raw index diffs so pegs don't
  // double-play or jump before the reveal finishes.
  const becamePr =
    next.pending?.type === "price_reaction" &&
    prev.pending?.type !== "price_reaction";
  const becameNews =
    next.pending?.type === "regime" && prev.pending?.type !== "regime";
  const cardStillShowing =
    (next.pending?.type === "price_reaction" &&
      prev.pending?.type === "price_reaction") ||
    (next.pending?.type === "regime" && prev.pending?.type === "regime");

  if (becamePr && next.pending?.type === "price_reaction") {
    // Prefer pending.deltas (what the engine applied). Cross-check vs index
    // so we never animate a bump the board did not take (clamp / mismatch).
    const fromCard = bumpsFromDeltas(
      prev.sectorIndex,
      next.pending.deltas ?? [],
    );
    const fromIndex = sectorIndexBumps(prev, next);
    events.push(...intersectBumps(fromCard, fromIndex));
  } else if (becameNews && next.pending?.type === "regime") {
    const shocks = next.pending.card.shocks ?? {};
    const deltas = (
      Object.entries(shocks) as [SectorId, number][]
    )
      .filter(([, delta]) => typeof delta === "number" && delta !== 0)
      .map(([sector, delta]) => ({ sector, delta }));
    const fromCard = bumpsFromDeltas(prev.sectorIndex, deltas);
    const fromIndex = sectorIndexBumps(prev, next);
    events.push(...intersectBumps(fromCard, fromIndex));
  } else if (!cardStillShowing) {
    for (const sector of SECTOR_IDS) {
      const from = prev.sectorIndex[sector] ?? 0;
      const to = next.sectorIndex[sector] ?? 0;
      if (from !== to) {
        events.push({ type: "sectorBump", sector, from, to });
      }
    }
  }

  // Land pulse when someone moved to a new tile this snapshot
  for (const p of next.players) {
    const before = prev.players.find((x) => x.id === p.id);
    if (!before || before.bankrupt || p.bankrupt) continue;
    if (before.position !== p.position) {
      events.push({ type: "landPulse", tileIndex: p.position });
    }
  }

  if (
    prev.phase !== "finished" &&
    next.phase === "finished" &&
    next.winnerId
  ) {
    events.push({ type: "win", winnerId: next.winnerId });
  }

  return events;
}

/** Duration to block UI for a sector bump beat (one step at a time). */
export function sectorBumpMs(from: number, to: number): number {
  const steps = Math.max(1, Math.abs(to - from));
  return Math.min(FX_TIMING.sectorCapMs, steps * FX_TIMING.sectorStepMs);
}

export function displayCashMap(
  game: GameState,
  overrides: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of game.players) {
    out[p.id] = overrides[p.id] ?? p.cash;
  }
  return out;
}

export type SectorVisual = Record<SectorId, number>;

export function cloneSectorIndex(game: GameState): SectorVisual {
  const out = {} as SectorVisual;
  for (const s of SECTOR_IDS) out[s] = game.sectorIndex[s] ?? 0;
  return out;
}
