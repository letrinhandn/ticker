import type { SectorId } from "@/shared/types";

export type FxDeckKind = "pr" | "regime";

export type FxEvent =
  | {
      type: "cashDelta";
      playerId: string;
      delta: number;
      /** ms — staged START can queue two beats */
      delayMs?: number;
    }
  | {
      type: "sectorBump";
      sector: SectorId;
      from: number;
      to: number;
    }
  | {
      type: "landPulse";
      tileIndex: number;
    }
  | {
      type: "deckDraw";
      deck: FxDeckKind;
      key: string;
    }
  | {
      type: "bankrupt";
      playerId: string;
    }
  | {
      type: "win";
      winnerId: string;
    }
  | {
      type: "opening";
    };

export type CashFlyItem = {
  id: string;
  playerId: string;
  delta: number;
  createdAt: number;
  /** Peg mark origin when this fly is a sector reprice, not a cash settle. */
  fromSector?: SectorId;
};

export type DeckDrawState = {
  deck: FxDeckKind;
  key: string;
  phase: "flying" | "done";
} | null;

export const FX_TIMING = {
  cashFlyMs: 500,
  landPulseMs: 280,
  /** Lift from pile → center (card back). */
  deckFlyMs: 680,
  /** Center → back into pile. */
  deckReturnMs: 550,
  /** Pile shuffle after return. */
  deckShuffleMs: 700,
  /** Full-size flip when gathering match away. */
  prMillFlipMs: 480,
  /** Slide from pile → table beside it (small). */
  prTableSlideMs: 260,
  /** Flip on the table (mini). */
  prTableFlipMs: 360,
  /** Beat on table face before next / zoom. */
  prTableHoldMs: 200,
  /** Match zooms from table → event size. */
  prMatchZoomMs: 620,
  /** Hold zoomed match before gather. */
  prMillLockMs: 640,
  /** Spent + match slide back to pile (before shuffle). */
  prGatherMs: 480,
  /** Brief beat after gather before pile shuffle (cash/pegs still held). */
  prShuffleDelayMs: 120,
  /** Market News: hold flipped face before gather (no EventCard). */
  /** Face-up hold so the headline is readable before pegs move. */
  newsRevealLockMs: 1600,
  /** Info / deed card dwell before auto-dismiss (no Continue). */
  infoRevealMs: 2400,
  /** Order desk fade before settle hammer. */
  tradeCloseMs: 280,
  /** Deed + settle jaws fly in apart. */
  settleWindupMs: 480,
  /** Jaws clamp shut (deed + ticket adjacent). */
  settleClampMs: 560,
  /** Gavel strike + ink stamp on both cards. */
  settleStrikeMs: 640,
  /** Hold stamped ticket so the fill is readable before cash flies. */
  settleHoldMs: 900,
  /** Total chip flight from card center → player seat. */
  settleCashFlyMs: 1100,
  /** Dwell after cash lands before dismiss / portfolio / next card. */
  settleAfterFlyMs: 1100,
  /** Portfolio open: pie + staggered rows, then auto-close. */
  portfolioRevealMs: 2400,
  /** One sector-index step on the board peg (visible slide). */
  sectorStepMs: 380,
  /** Beat after peg lands before worth chips leave the peg. */
  pegWorthPauseMs: 160,
  /** Peg → seat portfolio delta flight. */
  pegWorthFlyMs: 900,
  /** Max time spent stepping one sector (choreograph helper). */
  sectorCapMs: 2400,
  /** Pause after one sector finishes before the next moves. */
  sectorGapMs: 320,
  bankruptMs: 900,
  winMs: 1400,
  openingMs: 500,
} as const;
