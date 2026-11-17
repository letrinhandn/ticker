import { MAX_SHARES_OWNED } from "@/shared/types";
import { BALANCE } from "../balance/knobs";
import { BOARD, sectorForTile } from "../board";
import type { EngineAction } from "../engine";
import {
  pickDumpTarget,
  rivalSectorShares,
  sellTrigger,
  sharesBySector,
  sectorWeight,
  type BotTradeStance,
  type DeskView,
} from "./botDesk";
import type { FundKind } from "./botRoster";

export type FundStrategy = {
  kind: FundKind;
  /** Cash-pressure multiplier for raise_cash (>1 = sells sooner). */
  raiseCashMult: number;
  /**
   * Style: share of buy-budget to spend on a normal accumulate.
   * No hard share cap — size is min(market, room, floor(spend/price)).
   */
  buyBudgetFrac: number;
  /** Style: budget fraction on corner_dip (defaults to min(1, buy+0.25)). */
  cornerBudgetFrac?: number;
  chooseStance: (d: DeskView) => BotTradeStance;
  sizeBuy?: (d: DeskView, stance: BotTradeStance, base: number) => number;
  sizeSell?: (d: DeskView, stance: BotTradeStance, base: number) => number;
};

function canAfford(d: DeskView, shares: number): boolean {
  return shares >= 1 && shares * d.price <= d.budget;
}

function dumpBookRipe(
  d: DeskView,
  minShares: number,
): { tileIndex: number; shares: number } | null {
  if (d.total < 3) return null;
  const dump = pickDumpTarget(d.state, d.botId, d.focus);
  if (!dump || dump.shares < minShares) return null;
  const dumpTile = BOARD[dump.tileIndex];
  if (!dumpTile) return null;
  const dumpSector = sectorForTile(dumpTile);
  const dumpLevel = dumpSector ? (d.state.sectorIndex[dumpSector] ?? 0) : 0;
  const dumpRival = dumpSector
    ? rivalSectorShares(d.state, d.botId, dumpSector)
    : 0;
  const { total, bySector } = sharesBySector(d.state, d.botId);
  const dumpWeight = dumpSector
    ? sectorWeight(bySector, total, dumpSector)
    : 0;
  const concentrated = total >= 4 && dumpWeight >= 0.45;
  if (dumpLevel >= 2 || dumpRival >= 3 || (concentrated && dumpLevel >= 1)) {
    return dump;
  }
  return null;
}

function etfIfUseful(d: DeskView): BotTradeStance | null {
  if (d.focusKind !== "etf") return null;
  if (d.market < 1 || d.owned > 0) return "cash_hold";
  if (
    (d.total === 0 || d.concentrated || d.total < 3) &&
    d.market * d.price <= d.budget
  ) {
    return "etf_hedge";
  }
  return "cash_hold";
}

/**
 * Passive index — ETF + rare dip adds. Real-world: market beta, not alpha.
 * Weakness: slow deploy → cash tax; never pressures tape.
 */
const indexStrategy: FundStrategy = {
  kind: "index",
  raiseCashMult: 1.02,
  buyBudgetFrac: 0.4,
  cornerBudgetFrac: 0.64,
  chooseStance(d) {
    if (d.cash < sellTrigger(d.cash, 1.02) && d.total > 0) return "raise_cash";
    const etf = etfIfUseful(d);
    if (etf) return etf;
    if (d.owned >= 2 && d.level >= 2) return "take_profit";
    if (d.owned >= 3 && d.level <= -3 && d.weight >= 0.4) return "cut_loss";
    if (
      d.focusKind === "company" &&
      d.market >= 2 &&
      d.budget >= d.price * 2 &&
      (d.level <= -2 || d.edge.buyDip) &&
      d.weight < 0.4
    ) {
      return "corner_dip";
    }
    if (
      d.focusKind === "company" &&
      d.level <= -1 &&
      d.market >= 1 &&
      canAfford(d, 1) &&
      d.weight < 0.4 &&
      (d.edge.buyDip || d.level <= -2 || d.total < 3)
    ) {
      return "accumulate";
    }
    return "cash_hold";
  },
};

/**
 * Deep value — only blood, hold for years. Real-world: can lag for long stretches.
 * Weakness: cash tax while waiting; misses mild rallies.
 */
const valueStrategy: FundStrategy = {
  kind: "value",
  raiseCashMult: 0.95,
  buyBudgetFrac: 0.48,
  cornerBudgetFrac: 0.82,
  chooseStance(d) {
    if (d.cash < sellTrigger(d.cash, 0.88) && d.total > 0) return "raise_cash";
    if (d.focusKind === "etf") {
      if (
        d.total === 0 &&
        d.market >= 1 &&
        d.owned === 0 &&
        d.market * d.price <= d.budget
      ) {
        return "etf_hedge";
      }
      return "cash_hold";
    }
    if (d.owned >= 2 && d.level >= 3) return "take_profit";
    if (d.owned >= 4 && d.level <= -4 && d.weight >= 0.55) return "cut_loss";
    if (
      d.focusKind === "company" &&
      d.level <= -2 &&
      d.market >= 2 &&
      d.budget >= d.price * Math.min(d.market, 3)
    ) {
      return "corner_dip";
    }
    // Deep value: blood only (+ empty-book escape).
    if (
      d.focusKind === "company" &&
      d.market >= 1 &&
      canAfford(d, 1) &&
      (d.level <= -2 ||
        (d.level <= -1 && d.edge.buyDip) ||
        (d.total === 0 && d.level <= 0))
    ) {
      return "accumulate";
    }
    return "cash_hold";
  },
};

/** Growth / VC public — add to winners, cut losers early. */
const growthStrategy: FundStrategy = {
  kind: "growth",
  raiseCashMult: 1.08,
  buyBudgetFrac: 0.5,
  cornerBudgetFrac: 0.82,
  chooseStance(d) {
    const soft = d.fundName === "SoftBank";
    if (d.cash < sellTrigger(d.cash, soft ? 0.9 : 1.08) && d.total > 0) {
      return "raise_cash";
    }
    if (d.focusKind === "etf") {
      if (d.total === 0 && d.market >= 1 && d.market * d.price <= d.budget) {
        return "etf_hedge";
      }
      return "cash_hold";
    }
    if (d.owned >= 2 && (d.edge.broken || d.level <= -2)) return "cut_loss";
    if (d.owned >= 2 && (d.edge.fadeRally || d.level >= 2)) return "take_profit";
    // Momentum + mild dips — still refuse chasing a fade.
    if (
      d.focusKind === "company" &&
      d.market >= 1 &&
      d.budget >= d.price &&
      !d.edge.fadeRally &&
      d.level <= 1 &&
      (d.edge.followUp ||
        d.edge.buyDip ||
        d.level <= -1 ||
        (d.owned >= 1 && d.edge.tape.mom > 0) ||
        (d.total === 0 && d.level <= 0))
    ) {
      if ((d.edge.buyDip || d.level <= -1) && d.market >= 2) return "corner_dip";
      return "accumulate";
    }
    return "cash_hold";
  },
  sizeBuy(d, stance, base) {
    if (d.fundName === "SoftBank") {
      const room = MAX_SHARES_OWNED - d.owned;
      const spend = Math.floor(d.budget * 0.7);
      return Math.min(
        d.market,
        room,
        Math.floor(spend / Math.max(1, d.price)),
      );
    }
    if (stance === "accumulate" && d.owned === 0 && d.level >= 0) {
      return Math.min(base, Math.max(1, Math.floor(base * 0.65)));
    }
    if (d.edge.followUp) return Math.max(base, Math.floor(base * 1.05));
    return base;
  },
};

/**
 * Sovereign — diversify, ETF hedge, never dump. Real-world: huge AUM, muted alpha.
 * Weakness: underweights winners; slow.
 */
const sovereignStrategy: FundStrategy = {
  kind: "sovereign",
  raiseCashMult: 1.06,
  buyBudgetFrac: 0.38,
  cornerBudgetFrac: 0.68,
  chooseStance(d) {
    if (d.cash < sellTrigger(d.cash, 1.06) && d.total > 0) return "raise_cash";
    const etf = etfIfUseful(d);
    if (etf) return etf;
    if (d.owned >= 2 && d.level >= 2) return "take_profit";
    if (d.owned >= 2 && d.level <= -3 && d.weight >= 0.35) return "cut_loss";
    if (
      d.focusKind === "company" &&
      d.market >= 2 &&
      d.budget >= d.price * 2 &&
      d.weight < 0.34 &&
      (d.level <= -2 || d.edge.buyDip)
    ) {
      return "corner_dip";
    }
    if (
      d.focusKind === "company" &&
      d.level <= -1 &&
      d.market >= 1 &&
      canAfford(d, 1) &&
      d.weight < 0.33
    ) {
      return "accumulate";
    }
    return "cash_hold";
  },
};

/**
 * Activist HF — corner + dump pressure. Real-world: high skill, high variance.
 * Weakness: concentration / failed campaigns.
 */
const activistStrategy: FundStrategy = {
  kind: "activist",
  raiseCashMult: 1.08,
  buyBudgetFrac: 0.54,
  cornerBudgetFrac: 0.88,
  chooseStance(d) {
    if (d.cash < sellTrigger(d.cash, 1.08) && d.total > 0) return "raise_cash";
    // Campaign exit on stretched / contested books.
    if (
      dumpBookRipe(d, 3) &&
      (d.edge.fadeRally || (d.level >= 2 && d.rival >= 2))
    ) {
      return "dump_pressure";
    }
    if (
      d.owned >= 2 &&
      (d.edge.fadeRally || d.level >= 3 || (d.concentrated && d.level >= 2))
    ) {
      return "take_profit";
    }
    if (
      d.owned >= 2 &&
      (d.edge.broken || (d.level <= -3 && d.weight >= 0.3))
    ) {
      return "cut_loss";
    }
    if (d.focusKind === "etf") return etfIfUseful(d) ?? "cash_hold";
    if (
      d.focusKind === "company" &&
      d.market >= 2 &&
      d.budget >= d.price * Math.min(d.market, 3) &&
      (d.edge.buyDip || d.level <= -1 || (d.rival >= 2 && d.level <= 0))
    ) {
      return "corner_dip";
    }
    if (
      d.focusKind === "company" &&
      d.market >= 1 &&
      canAfford(d, 1) &&
      (d.edge.buyDip ||
        d.edge.followUp ||
        (d.level <= -1 && d.rival >= 1) ||
        (d.rival >= 1 && d.level <= 1))
    ) {
      return "accumulate";
    }
    return "cash_hold";
  },
};

/** Event-driven — buy post-shock, cut broken thesis, opportunistic dump. */
const eventStrategy: FundStrategy = {
  kind: "event",
  raiseCashMult: 0.95,
  buyBudgetFrac: 0.62,
  cornerBudgetFrac: 0.98,
  chooseStance(d) {
    if (d.cash < sellTrigger(d.cash, 0.98) && d.total > 0) return "raise_cash";
    if (d.owned >= 2 && (d.edge.broken || d.level <= -3)) return "cut_loss";
    if (d.owned >= 2 && (d.edge.fadeRally || d.level >= 3)) return "take_profit";
    if (dumpBookRipe(d, 3) && (d.edge.fadeRally || d.level >= 2)) {
      return "dump_pressure";
    }
    if (d.focusKind === "etf") return etfIfUseful(d) ?? "cash_hold";
    // Dislocations + mild mean-rev dips — still refuse chasing rallies.
    const shocked =
      d.edge.buyDip ||
      d.level <= -2 ||
      (d.level <= -1 &&
        (Math.abs(d.edge.tape.mom) >= 1 ||
          d.edge.tape.stretch <= -0.5 ||
          d.edge.meanRev > 0.1)) ||
      (d.level <= 0 && d.edge.meanRev > 0.25 && d.edge.tape.stretch <= 0);
    if (
      d.focusKind === "company" &&
      shocked &&
      d.market >= 2 &&
      d.budget >= d.price * 2
    ) {
      return "corner_dip";
    }
    if (
      d.focusKind === "company" &&
      d.market >= 1 &&
      canAfford(d, 1) &&
      (shocked || (d.level <= 0 && d.edge.meanRev > 0.1) || d.total === 0)
    ) {
      return "accumulate";
    }
    return "cash_hold";
  },
};

/**
 * Pod multi-strat — full toolkit. Real-world elite (Citadel / Millennium tier).
 * Reads tape blend: trend + mean-rev by vol. Weakness: every sleeve wrong at once.
 */
const multiStratStrategy: FundStrategy = {
  kind: "multi_strat",
  raiseCashMult: 1.02,
  buyBudgetFrac: 0.5,
  cornerBudgetFrac: 0.8,
  chooseStance(d) {
    if (d.cash < sellTrigger(d.cash, 1.02) && d.total > 0) return "raise_cash";
    if (
      dumpBookRipe(d, 4) &&
      (d.edge.fadeRally || (d.level >= 2 && d.edge.blend < -0.2))
    ) {
      return "dump_pressure";
    }
    if (
      d.owned >= 2 &&
      (d.edge.fadeRally ||
        d.level >= 3 ||
        (d.concentrated && d.level >= 2 && d.edge.blend < 0))
    ) {
      return "take_profit";
    }
    if (
      d.owned >= 2 &&
      (d.edge.broken || (d.level <= -3 && d.weight >= 0.28))
    ) {
      return "cut_loss";
    }
    if (d.focusKind === "etf") return etfIfUseful(d) ?? "cash_hold";
    if (
      d.focusKind === "company" &&
      d.market >= 2 &&
      d.budget >= d.price * Math.min(d.market, 3) &&
      (d.edge.buyDip || (d.level <= -1 && d.edge.meanRev >= 0.4))
    ) {
      return "corner_dip";
    }
    if (
      d.focusKind === "company" &&
      d.market >= 1 &&
      canAfford(d, 1) &&
      !(d.concentrated && d.level >= 2 && d.edge.blend < 0) &&
      (d.edge.followUp ||
        d.edge.buyDip ||
        d.edge.blend >= 0.5 ||
        (d.level <= 0 && d.edge.blend >= 0.25))
    ) {
      return "accumulate";
    }
    return "cash_hold";
  },
  sizeBuy(d, stance, base) {
    const boost =
      stance === "corner_dip"
        ? 1.02
        : d.edge.blend > 0.5
          ? 0.98
          : d.edge.blend < 0
            ? 0.6
            : 0.92;
    return Math.max(1, Math.floor(base * boost));
  },
};

/**
 * Global macro / CTA — cash default until trend is clear.
 * Real-world: mixed recent years. Weakness: tax while flat; false breaks.
 */
const macroStrategy: FundStrategy = {
  kind: "macro",
  raiseCashMult: 1.02,
  buyBudgetFrac: 0.55,
  cornerBudgetFrac: 0.88,
  chooseStance(d) {
    if (d.cash < sellTrigger(d.cash, 1.02) && d.total > 0) return "raise_cash";
    if (d.focusKind === "etf") {
      if (
        d.market >= 1 &&
        d.owned === 0 &&
        (d.concentrated ||
          d.total < 2 ||
          Math.abs(d.level) >= 2 ||
          Math.abs(d.edge.tape.mom) >= 2) &&
        d.market * d.price <= d.budget
      ) {
        return "etf_hedge";
      }
      return "cash_hold";
    }
    if (d.owned >= 2 && (d.edge.fadeRally || d.level >= 3)) return "take_profit";
    if (d.owned >= 2 && (d.edge.broken || d.level <= -2)) return "cut_loss";
    if (dumpBookRipe(d, 4) && (d.level >= 3 || d.edge.tape.streak >= 3)) {
      return "dump_pressure";
    }
    const clearTrend =
      Math.abs(d.edge.tape.mom) >= 1 ||
      Math.abs(d.edge.tape.streak) >= 2 ||
      Math.abs(d.level) >= 2 ||
      d.edge.followUp;
    if (
      d.focusKind === "company" &&
      d.market >= 1 &&
      canAfford(d, 1) &&
      clearTrend &&
      (d.edge.followUp ||
        d.edge.buyDip ||
        Math.abs(d.level) >= 2 ||
        (d.edge.tape.mom >= 1 && d.level <= 1))
    ) {
      if (d.edge.buyDip && d.market >= 2) return "corner_dip";
      return "accumulate";
    }
    return "cash_hold";
  },
};

/**
 * Systematic quant — mean reversion + vol-aware sizing. Real-world top tier.
 * Weakness: crowded factor / regime shift (trend persists against the fade).
 */
const quantStrategy: FundStrategy = {
  kind: "quant",
  raiseCashMult: 0.95,
  buyBudgetFrac: 0.5,
  cornerBudgetFrac: 0.8,
  chooseStance(d) {
    if (d.cash < sellTrigger(d.cash, 0.98) && d.total > 0) return "raise_cash";
    if (
      d.owned >= 2 &&
      (d.edge.fadeRally ||
        d.level >= 3 ||
        (d.level >= 2 && d.edge.meanRev <= -0.35 && d.edge.tape.mom <= 0))
    ) {
      return "take_profit";
    }
    if (
      d.owned >= 2 &&
      (d.edge.broken ||
        (d.level <= -3 && d.weight >= 0.3 && d.edge.blend < 0))
    ) {
      return "cut_loss";
    }
    if (
      dumpBookRipe(d, 3) &&
      (d.edge.fadeRally || (d.level >= 2 && d.rival >= 1))
    ) {
      return "dump_pressure";
    }
    if (d.focusKind === "etf") {
      if (
        d.market >= 1 &&
        d.owned === 0 &&
        (d.concentrated || d.weight >= 0.35 || d.edge.tape.vol >= 1.2) &&
        d.market * d.price <= d.budget
      ) {
        return "etf_hedge";
      }
      return "cash_hold";
    }
    if (
      d.focusKind === "company" &&
      d.market >= 2 &&
      d.budget >= d.price * Math.min(d.market, 3) &&
      (d.edge.buyDip ||
        (d.level <= -1 && d.edge.meanRev >= 0.25) ||
        d.edge.blend >= 0.45 ||
        d.level <= -2)
    ) {
      return "corner_dip";
    }
    if (
      d.focusKind === "company" &&
      d.market >= 1 &&
      canAfford(d, 1) &&
      !(d.concentrated && d.level >= 2) &&
      (d.edge.buyDip ||
        d.edge.followUp ||
        d.edge.blend >= 0.25 ||
        d.edge.meanRev >= 0.25 ||
        d.level <= -2 ||
        (d.level <= -1 && d.edge.blend >= 0.1))
    ) {
      return "accumulate";
    }
    return "cash_hold";
  },
  sizeBuy(d, stance, base) {
    const edgeBoost =
      d.edge.blend > 0.3 || d.edge.buyDip || d.edge.meanRev > 0.25
        ? 1.06
        : d.edge.blend > 0 || d.edge.meanRev > 0.1
          ? 1.0
          : 0.88;
    const volCut = d.edge.tape.vol > 2.5 ? 0.8 : 1;
    const mult = stance === "corner_dip" ? edgeBoost * 1.05 : edgeBoost * volCut;
    return Math.max(1, Math.floor(base * mult));
  },
};

/**
 * Market maker — vacuum float, warehouse on fair tape, flatten into strength.
 * Real-world elite (Jane Street tier). Weakness: forced inventory in a crash.
 */
const marketMakeStrategy: FundStrategy = {
  kind: "market_make",
  raiseCashMult: 1.02,
  buyBudgetFrac: 0.38,
  cornerBudgetFrac: 0.64,
  chooseStance(d) {
    if (d.cash < sellTrigger(d.cash, 1.02) && d.total > 0) return "raise_cash";
    // Forever-matrix: inventory hard-cap 3 + soft-tape only. Flat seed and
    // owned≥4 both blow the book past ~12–15pp; keep the soft-tape gate.
    if (
      d.owned >= 2 &&
      (d.edge.fadeRally ||
        d.level >= 2 ||
        (d.owned >= 3 && d.level >= 1) ||
        (d.owned >= 3 && d.edge.tape.stretch >= 0.35))
    ) {
      return "take_profit";
    }
    if (d.owned >= 2 && (d.edge.broken || d.level <= -2)) return "cut_loss";
    if (
      d.concentrated &&
      d.owned >= 4 &&
      (d.edge.fadeRally || d.level >= 2)
    ) {
      return "dump_pressure";
    }
    if (d.focusKind === "etf") {
      if (
        d.concentrated &&
        d.market >= 1 &&
        d.owned === 0 &&
        d.market * d.price <= d.budget
      ) {
        return "etf_hedge";
      }
      return "cash_hold";
    }
    const fair =
      Math.abs(d.edge.tape.stretch) <= 0.65 &&
      !d.edge.broken &&
      d.level <= -1;
    if (
      d.focusKind === "company" &&
      d.market >= 2 &&
      d.budget >= d.price * 2 &&
      (fair || d.edge.buyDip) &&
      d.owned < 3
    ) {
      return "corner_dip";
    }
    if (
      d.focusKind === "company" &&
      d.market >= 1 &&
      canAfford(d, 1) &&
      (fair || d.edge.buyDip || d.level <= -1) &&
      d.owned < 3
    ) {
      return "accumulate";
    }
    return "cash_hold";
  },
  sizeBuy(d, _stance, base) {
    if (d.edge.buyDip) return Math.max(1, Math.floor(base * 0.95));
    if (Math.abs(d.edge.tape.mom) >= 1) {
      return Math.max(1, Math.floor(base * 0.55));
    }
    return Math.max(1, Math.floor(base * 0.85));
  },
};

export const FUND_STRATEGIES: Record<FundKind, FundStrategy> = {
  index: indexStrategy,
  value: valueStrategy,
  growth: growthStrategy,
  sovereign: sovereignStrategy,
  activist: activistStrategy,
  event: eventStrategy,
  multi_strat: multiStratStrategy,
  macro: macroStrategy,
  quant: quantStrategy,
  market_make: marketMakeStrategy,
};

export function strategyForKind(kind: FundKind): FundStrategy {
  return FUND_STRATEGIES[kind];
}

export function defaultBuyShares(
  d: DeskView,
  stance: BotTradeStance,
  strat: FundStrategy,
): number {
  const room = MAX_SHARES_OWNED - d.owned;
  const unit = Math.max(1, d.price);
  if (stance === "etf_hedge") {
    return Math.min(d.market, room, Math.floor(d.budget / unit));
  }
  const frac =
    stance === "corner_dip"
      ? (strat.cornerBudgetFrac ?? Math.min(1, strat.buyBudgetFrac + 0.25))
      : strat.buyBudgetFrac;
  const spend = Math.floor(d.budget * Math.max(0, Math.min(1, frac)));
  return Math.min(d.market, room, Math.floor(spend / unit));
}

export function defaultSellShares(
  d: DeskView,
  stance: BotTradeStance,
): number {
  if (stance === "dump_pressure") {
    return pickDumpTarget(d.state, d.botId, d.focus)?.shares ?? 0;
  }
  if (stance === "cut_loss") return Math.min(d.owned, 10);
  if (stance === "take_profit") {
    return Math.min(
      d.owned,
      d.level >= 4 ? Math.min(d.owned, 10) : Math.min(d.owned, 6),
    );
  }
  if (stance === "raise_cash") {
    const maxShares = d.cash < BALANCE.incomeTax ? 10 : 8;
    const dump = pickDumpTarget(d.state, d.botId, d.focus);
    return dump ? Math.min(dump.shares, maxShares) : 0;
  }
  return 0;
}

export function actionForDesk(
  d: DeskView,
  stance: BotTradeStance,
): EngineAction {
  const strat = strategyForKind(d.kind);

  if (stance === "cash_hold") return { type: "trade", action: "skip" };

  if (
    stance === "raise_cash" ||
    stance === "dump_pressure" ||
    stance === "take_profit" ||
    stance === "cut_loss"
  ) {
    let shares = defaultSellShares(d, stance);
    if (strat.sizeSell) shares = strat.sizeSell(d, stance, shares);
    if (shares < 1) return { type: "trade", action: "skip" };
    const tileIndex =
      stance === "dump_pressure" || stance === "raise_cash"
        ? (pickDumpTarget(d.state, d.botId, d.focus)?.tileIndex ?? d.focus)
        : d.focus;
    return { type: "trade", action: "sell", tileIndex, shares };
  }

  let shares = defaultBuyShares(d, stance, strat);
  if (strat.sizeBuy) shares = strat.sizeBuy(d, stance, shares);
  shares = Math.max(0, Math.floor(shares));
  if (shares < 1) return { type: "trade", action: "skip" };
  return { type: "trade", action: "buy", tileIndex: d.focus, shares };
}
