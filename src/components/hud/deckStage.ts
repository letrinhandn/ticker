/** Shared deck-stage machine types for GameHUD / useDeckStage. */

export type DeckStage =
  | "idle"
  | "closingTrade"
  | "settling"
  | "portfolio"
  | "milling"
  | "drawing"
  | "showing"
  | "returning"
  | "shuffling"
  /** Hold released; waiting cash + peg FX to drain before dismiss. */
  | "waiting";

export function isDeckBusy(stage: DeckStage) {
  return stage !== "idle";
}

export function holdingsKey(
  holdings: { ownerId: string; tileIndex: number; shares: number }[],
) {
  return holdings
    .map((h) => `${h.ownerId}:${h.tileIndex}:${h.shares}`)
    .sort()
    .join("|");
}

export const EMPTY_MILLED: string[] = [];
