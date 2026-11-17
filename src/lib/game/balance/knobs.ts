/**
 * Live balance knobs — mutable for Monte Carlo sweeps; defaults match shipped constants.
 *
 * Risk triangle (every stance has a counter):
 * - Whale / corner: visit income + strong ops, but concentrationLossMult on crashes
 * - Cash hoard: fee safety + optionality, but START tax + cashHoardTaxExtra + missed rents
 * - Thin diversify: smooth ops, weak rent power, still hit by broad news
 * - Underdog: land on whale blocks (visit fees) + dump PR into their sector + buy dips
 */
import {
  HALT_FINE,
  INCOME_TAX,
  ORDER_FEE_M,
  STARTING_CASH,
  START_CASH_TAX_RATE,
  WEALTH_TAX,
} from "@/shared/types";

export type BalanceKnobs = {
  startingCash: number;
  startCashTaxRate: number;
  orderFeeM: number;
  /** Multiplier on visit fee (P₀/10 or tile.visitFee). */
  visitFeeMult: number;
  haltFine: number;
  incomeTax: number;
  wealthTax: number;
  /**
   * Target flat (level −1…+1) ops yield as a fraction of P₀.
   * Blended with each company's raw rev−cost so names stay distinct.
   */
  opsFlatYieldPct: number;
  /** 0 = pure JSON margin, 1 = pure target yield. */
  opsFlatBlend: number;
  /** Weak-band (−5…−2) ops adj as a fraction of P₀ (negative). */
  opsWeakPct: number;
  /** Strong-band (+2…+5) ops adj as a fraction of P₀ (positive). */
  opsStrongPct: number;
  /**
   * @deprecated Absolute fallback for catalog / old sweeps. Prefer pct knobs.
   * Kept in sync as round(200 × pct) for display.
   */
  opsWeakAdj: number;
  /** @deprecated See opsWeakAdj. */
  opsStrongAdj: number;
  /**
   * @deprecated Must stay 1. Runtime shock scaling desyncs pegs from the card face.
   */
  newsShockMult: number;
  /** @deprecated Must stay 1 — see newsShockMult. */
  prShockMult: number;
  /**
   * Late-game pressure: effective START tax rate *=
   * (1 + taxEscalationPerTurn * player.turnsDone).
   */
  taxEscalationPerTurn: number;
  /**
   * Late-game pressure: visit fees *=
   * (1 + visitEscalationPerTurn * maxPlayerTurnsDone).
   */
  visitEscalationPerTurn: number;
  /**
   * When a sector is ≥ this weight of company shares and weak (≤−2),
   * ops losses on that sector scale toward concentrationLossMult.
   */
  concentrationWeightGate: number;
  /** Max ops-loss multiplier for a fully concentrated weak sector. */
  concentrationLossMult: number;
  /** Cash/NW above this starts paying cashHoardTaxExtra on START. */
  cashHoardNwRatio: number;
  /** Max additive START tax rate when nearly 100% cash. */
  cashHoardTaxExtra: number;
};

export const DEFAULT_BALANCE_KNOBS: BalanceKnobs = {
  startingCash: STARTING_CASH,
  startCashTaxRate: START_CASH_TAX_RATE,
  orderFeeM: ORDER_FEE_M,
  visitFeeMult: 2.55,
  haltFine: HALT_FINE,
  incomeTax: INCOME_TAX,
  wealthTax: WEALTH_TAX,
  opsFlatYieldPct: 0.012,
  opsFlatBlend: 0.35,
  opsWeakPct: -0.07,
  opsStrongPct: 0.06,
  opsWeakAdj: Math.round(200 * -0.07),
  opsStrongAdj: Math.round(200 * 0.06),
  newsShockMult: 1,
  prShockMult: 1,
  taxEscalationPerTurn: 0.065,
  visitEscalationPerTurn: 0.07,
  concentrationWeightGate: 0.38,
  concentrationLossMult: 2.15,
  cashHoardNwRatio: 0.4,
  cashHoardTaxExtra: 0.16,
};

/** Mutable singleton used by the engine. */
export const BALANCE: BalanceKnobs = { ...DEFAULT_BALANCE_KNOBS };

export function setBalanceKnobs(partial: Partial<BalanceKnobs>): void {
  Object.assign(BALANCE, partial);
  if (partial.opsWeakPct != null) {
    BALANCE.opsWeakAdj = Math.round(200 * partial.opsWeakPct);
  }
  if (partial.opsStrongPct != null) {
    BALANCE.opsStrongAdj = Math.round(200 * partial.opsStrongPct);
  }
}

export function resetBalanceKnobs(): void {
  Object.assign(BALANCE, DEFAULT_BALANCE_KNOBS);
}

export function snapshotKnobs(): BalanceKnobs {
  return { ...BALANCE };
}
