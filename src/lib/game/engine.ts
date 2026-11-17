import {
  HALT_INDEX,
  MAX_SHARES_OWNED,
  SHARES_PER_COMPANY,
  SHARES_PER_ETF,
  STANDARD_TURNS,
  type GameState,
  type LockedOrder,
  type PendingDecision,
  type PlayerState,
  type PlayerToken,
  type RegimeCard,
  type SectorDelta,
  type SectorId,
} from "@/shared/types";
import { money } from "@/lib/money";
import { BALANCE } from "./balance/knobs";
import {
  cashHoardTaxBoost,
  companySharesBySector,
  concentrationLossMultiplier,
} from "./balance/portfolioRisk";
import {
  BOARD,
  SECTOR_IDS,
  chargesVisitFee,
  isListedCompany,
  sectorForTile,
} from "./board";
import {
  emptySectorHistory,
  emptySectorIndex,
  freshPrDeck,
  openingPresetForDie,
} from "./content/cards";
import {
  companyByTileIndex,
  netOpsPerShare,
} from "./content/companies";
import {
  cardMatchesSide,
  PRICE_REACTIONS,
  pressureDeltas,
  prById,
  resolveMatchingPr,
} from "./content/priceReactions";
import { drawRandomRegime } from "./content/regimes";
import {
  bumpSector,
  clampSector,
  currentSharePrice,
  feePerShare,
  netWorth,
  sharePrice,
} from "./pricing";

const SECTOR_HISTORY_MAX = 64;

/** Append current sector levels once per turn (and at market open). */
function recordSectorHistory(state: GameState) {
  if (!state.sectorHistory) {
    state.sectorHistory = emptySectorHistory();
  }
  for (const sector of SECTOR_IDS) {
    const series = state.sectorHistory[sector] ?? [];
    series.push(state.sectorIndex[sector] ?? 0);
    if (series.length > SECTOR_HISTORY_MAX) {
      series.splice(0, series.length - SECTOR_HISTORY_MAX);
    }
    state.sectorHistory[sector] = series;
  }
}

export type EngineAction =
  | { type: "roll" }
  | { type: "dismiss" }
  | {
      type: "trade";
      action: "buy" | "sell" | "skip";
      tileIndex?: number;
      shares?: number;
      counterpartyId?: string | null;
    }
  | { type: "pay_jail" }
  | { type: "end_turn" }
  | { type: "declare_bankrupt" };

function pushLog(state: GameState, msg: string) {
  state.log = [msg, ...state.log].slice(0, 50);
}

function currentPlayer(state: GameState): PlayerState {
  const p = state.players[state.turnIndex];
  if (!p) throw new Error("No current player");
  return p;
}

function livingPlayers(state: GameState): PlayerState[] {
  return state.players.filter((p) => !p.bankrupt);
}

function enqueue(state: GameState, pending: PendingDecision) {
  if (!state.pending) state.pending = pending;
  else state.pendingQueue.push(pending);
}

function advancePending(state: GameState) {
  state.pending = state.pendingQueue.shift() ?? null;
}

function checkWinner(state: GameState) {
  const alive = livingPlayers(state);
  if (alive.length === 1) {
    state.phase = "finished";
    state.winnerId = alive[0]!.id;
    state.pending = null;
    state.pendingQueue = [];
    pushLog(state, `${alive[0]!.name} wins the market!`);
    return;
  }
  // maxTurns <= 0 means unlimited; only bankruptcy ends the table.
  if (state.maxTurns > 0 && alive.every((p) => p.turnsDone >= state.maxTurns)) {
    finishByNetWorth(state);
  }
}

function finishByNetWorth(state: GameState) {
  const alive = livingPlayers(state);
  if (alive.length === 0) return;
  alive.sort((a, b) => {
    const nw = netWorth(state, b.id) - netWorth(state, a.id);
    if (nw !== 0) return nw;
    if (b.cash !== a.cash) return b.cash - a.cash;
    const sharesA = state.holdings
      .filter((h) => h.ownerId === a.id)
      .reduce((s, h) => s + h.shares, 0);
    const sharesB = state.holdings
      .filter((h) => h.ownerId === b.id)
      .reduce((s, h) => s + h.shares, 0);
    return sharesB - sharesA;
  });
  state.phase = "finished";
  state.winnerId = alive[0]!.id;
  state.pending = null;
  state.pendingQueue = [];
  pushLog(
    state,
    `Market closes. ${alive[0]!.name} wins with ${money(netWorth(state, alive[0]!.id))} net worth.`,
  );
}

function sharesOwned(state: GameState, tileIndex: number, ownerId: string): number {
  return state.holdings.find((h) => h.tileIndex === tileIndex && h.ownerId === ownerId)?.shares ?? 0;
}

function floatForTile(tileIndex: number): number {
  const tile = BOARD[tileIndex];
  return tile?.kind === "etf" ? SHARES_PER_ETF : SHARES_PER_COMPANY;
}

function sharesOnMarket(state: GameState, tileIndex: number): number {
  const taken = state.holdings
    .filter((h) => h.tileIndex === tileIndex)
    .reduce((s, h) => s + h.shares, 0);
  return Math.max(0, floatForTile(tileIndex) - taken);
}

function setShares(state: GameState, tileIndex: number, ownerId: string, shares: number) {
  const i = state.holdings.findIndex((h) => h.tileIndex === tileIndex && h.ownerId === ownerId);
  if (shares <= 0) {
    if (i >= 0) state.holdings.splice(i, 1);
    return;
  }
  if (i >= 0) state.holdings[i]!.shares = shares;
  else state.holdings.push({ tileIndex, ownerId, shares });
}

function applyDeltas(state: GameState, deltas: SectorDelta[]) {
  for (const d of deltas) bumpSector(state, d.sector, d.delta);
}

/** Project share price after applying deltas (clamped tracks), without mutating state. */
function projectedSharePrice(
  state: GameState,
  tileIndex: number,
  deltas: SectorDelta[],
): number {
  const tile = BOARD[tileIndex];
  if (!tile?.price) return 0;
  const sector = sectorForTile(tile);
  if (!sector) return tile.price;
  const levels = { ...state.sectorIndex };
  for (const d of deltas) {
    levels[d.sector] = clampSector((levels[d.sector] ?? 0) + d.delta);
  }
  return sharePrice(tile.price, levels[sector] ?? 0);
}

/**
 * Apply Market News / opening shocks onto sector tracks.
 * Must match `card.shocks` exactly — no runtime scaling (UI + FX read the same map).
 */
function applyRegimeShocks(
  state: GameState,
  shocks: Partial<Record<SectorId, number>>,
) {
  for (const [sector, delta] of Object.entries(shocks)) {
    if (typeof delta === "number" && delta !== 0) {
      bumpSector(state, sector as SectorId, delta);
    }
  }
}

/** V5 News tile: sample from full 100 with replacement. */
function drawNews(state: GameState, rng: () => number, reason: string): RegimeCard {
  const card = drawRandomRegime(rng);
  state.regime = card.regime;
  state.activeRegimeId = card.id;
  applyRegimeShocks(state, card.shocks);
  pushLog(
    state,
    `${reason} ${card.title} → ${card.regime === "bull" ? "BULL" : "BEAR"}. ${card.textEn ?? card.text}`,
  );
  return card;
}

/**
 * V5 START ops: Σ (rev(level) − cost) × shares for company holdings only.
 * Concentrated weak-sector books take amplified losses (whale crash risk).
 */
function companyOpsTotal(state: GameState, playerId: string): number {
  const { total: shareTotal, bySector } = companySharesBySector(
    state,
    playerId,
  );
  let total = 0;
  for (const h of state.holdings) {
    if (h.ownerId !== playerId || h.shares <= 0) continue;
    const tile = BOARD[h.tileIndex];
    if (!tile || tile.kind !== "company") continue;
    const company = companyByTileIndex(h.tileIndex);
    const sector = sectorForTile(tile);
    if (!company || !sector) continue;
    const level = state.sectorIndex[sector] ?? 0;
    let net = netOpsPerShare(
      company.revenueBasePerShareM,
      company.fixedCostPerShareM,
      level,
      company.basePricePerShareM,
    );
    if (net < 0 && shareTotal > 0) {
      const weight = bySector[sector] / shareTotal;
      net *= concentrationLossMultiplier(weight, level);
    }
    total += net * h.shares;
  }
  return total;
}

/**
 * Sell holdings until `player.cash >= need` or nothing left.
 * Forced sells: no order fee (otherwise cheap names net ~0 and look like
 * "held stock then died"). Sells enough shares per ticket to cover the gap.
 */
function forcedLiquidate(
  state: GameState,
  player: PlayerState,
  need: number,
  rng: () => number,
): number {
  const cashBefore = player.cash;
  while (player.cash < need) {
    const mine = state.holdings
      .filter((h) => h.ownerId === player.id && h.shares > 0)
      .slice()
      .sort(
        (a, b) =>
          currentSharePrice(state, a.tileIndex) -
          currentSharePrice(state, b.tileIndex),
      );
    const h = mine[0];
    if (!h) break;

    const price = Math.max(1, currentSharePrice(state, h.tileIndex));
    const gap = need - player.cash;
    const sharesNeeded = Math.min(
      h.shares,
      10,
      Math.max(1, Math.ceil(gap / price)),
    );

    const order: LockedOrder = {
      side: "sell",
      tileIndex: h.tileIndex,
      shares: sharesNeeded,
      forced: true,
    };
    const result = executeOrder(state, player, order, rng, true);
    if (!result || result.settledShares <= 0) break;
    pushLog(
      state,
      `${player.name} liquidates ${result.settledShares}× ${BOARD[h.tileIndex]!.name} @ ${money(result.settlePrice)} (PR: ${result.card.title}).`,
    );
  }
  return Math.max(0, player.cash - cashBefore);
}

function payCash(
  state: GameState,
  from: PlayerState,
  amount: number,
  to: PlayerState | null,
  rng: () => number,
  opts: { bankruptIfShort?: boolean } = {},
): boolean {
  if (amount <= 0) return true;
  const bankruptIfShort = opts.bankruptIfShort !== false;
  if (from.cash < amount) {
    forcedLiquidate(state, from, amount, rng);
  }
  if (from.cash < amount) {
    const have = from.cash;
    from.cash = 0;
    if (to) to.cash += have;
    if (bankruptIfShort) {
      bankruptPlayer(state, from);
      return false;
    }
    // Soft obligation (tax tiles): wipe cash after liquidation, stay alive.
    return false;
  }
  from.cash -= amount;
  if (to) to.cash += amount;
  return true;
}

function bankruptPlayer(state: GameState, player: PlayerState) {
  player.bankrupt = true;
  player.cash = 0;
  player.inJail = false;
  state.holdings = state.holdings.filter((h) => h.ownerId !== player.id);
  state.awaitingLandAfterStart = false;
  pushLog(state, `${player.name} goes bankrupt.`);
  state.pending = null;
  state.pendingQueue = [];
  checkWinner(state);
  if (state.phase === "playing") advanceTurn(state);
}

/** After START tax/ops card dismisses, resolve the tile landed on. */
function finishLandAfterStart(
  state: GameState,
  player: PlayerState,
  rng: () => number,
) {
  if (!state.awaitingLandAfterStart) return;
  if (state.pending) return;
  state.awaitingLandAfterStart = false;
  if (player.bankrupt || state.phase !== "playing") return;
  landOn(state, player, rng);
}

function resolveMoveLanding(
  state: GameState,
  player: PlayerState,
  rng: () => number,
) {
  if (state.passedStartThisMove) {
    afterStartEffects(state, player, rng);
    if (player.bankrupt || state.phase !== "playing") {
      state.awaitingLandAfterStart = false;
      return;
    }
    // Settle START first; landOn runs when that card is dismissed.
    state.awaitingLandAfterStart = true;
    return;
  }
  state.awaitingLandAfterStart = false;
  landOn(state, player, rng);
}

type VisitFeeResult = {
  totalPaid: number;
  transfers: {
    fromId: string;
    fromName: string;
    toId: string;
    toName: string;
    amount: number;
    shares: number;
  }[];
};

/** Collect visit fees; returns total paid + per-owner transfer lines for the settle card. */
function collectVisitFees(
  state: GameState,
  visitor: PlayerState,
  tileIndex: number,
  rng: () => number,
): VisitFeeResult {
  const empty: VisitFeeResult = { totalPaid: 0, transfers: [] };
  const tile = BOARD[tileIndex]!;
  if (!chargesVisitFee(tile) || !tile.price) return empty;
  const maxTurns = Math.max(0, ...state.players.map((p) => p.turnsDone));
  const escalate = 1 + BALANCE.visitEscalationPerTurn * maxTurns;
  const per = Math.max(
    1,
    Math.round(feePerShare(tile.price, tile.visitFeePerShare) * escalate),
  );
  const holders = state.holdings.filter(
    (h) => h.tileIndex === tileIndex && h.ownerId !== visitor.id,
  );
  if (holders.length === 0) {
    pushLog(state, `${tile.name}: no outside shareholders, no fee.`);
    return empty;
  }

  let totalPaid = 0;
  const transfers: VisitFeeResult["transfers"] = [];
  for (const h of holders) {
    const owner = state.players.find((p) => p.id === h.ownerId);
    if (!owner || owner.bankrupt) continue;
    const due = per * h.shares;
    if (!payCash(state, visitor, due, owner, rng)) {
      return { totalPaid, transfers };
    }
    totalPaid += due;
    transfers.push({
      fromId: visitor.id,
      fromName: visitor.name,
      toId: owner.id,
      toName: owner.name,
      amount: due,
      shares: h.shares,
    });
    pushLog(
      state,
      `${visitor.name} pays ${money(due)} fee to ${owner.name} (${h.shares}× ${tile.name}).`,
    );
  }
  if (totalPaid > 0) {
    pushLog(state, `Visit fees at ${tile.name}: ${money(totalPaid)} total.`);
  }
  return { totalPaid, transfers };
}

function landPreviewBody(tile: (typeof BOARD)[number]): string {
  switch (tile.kind) {
    case "company":
      // Title / DeedCard already show the name — keep body short.
      return "Review the listing, then place one order or skip.";
    case "etf":
      return "Fund units with no visit fee. Trades do not draw Price Reaction.";
    case "regime":
      return "Market News: draw a headline that moves sector tracks.";
    case "free":
      return "Weekend is rest only. No trading this stop.";
    case "go":
      return "START square: tax and ops settle here. No trading.";
    case "halt":
      return "Just visiting SEC Investigation, not under investigation. No trading this stop.";
    default:
      return `Landed on ${tile.name}.`;
  }
}

/**
 * Land card before tile effects.
 * Skip listed company/ETF (trade desk is the one reveal), News/tax/goto/START
 * (those have their own cards), so we never flash deed → thinking twice.
 */
function enqueueLandPreview(state: GameState, tile: (typeof BOARD)[number]) {
  if (
    tile.kind === "tax" ||
    tile.kind === "goto_halt" ||
    tile.kind === "regime" ||
    tile.kind === "go" ||
    isListedCompany(tile)
  ) {
    return;
  }
  enqueue(state, {
    type: "info",
    tileIndex: tile.index,
    title: tile.name,
    body: landPreviewBody(tile),
  });
}

type OrderResult = {
  card: ReturnType<typeof prById>;
  deltas: SectorDelta[];
  settledShares: number;
  settlePrice: number;
  totalCash: number;
};

/**
 * ETF: settle at live fund price — no Price Reaction, no sector track moves.
 */
function executeEtfOrder(
  state: GameState,
  player: PlayerState,
  order: LockedOrder,
  silent = false,
): OrderResult | null {
  const tile = BOARD[order.tileIndex];
  if (!tile || tile.kind !== "etf" || !tile.price) return null;

  const float = floatForTile(order.tileIndex);
  let shares = Math.max(1, Math.min(float, order.shares));
  if (order.side === "buy") {
    const owned = sharesOwned(state, order.tileIndex, player.id);
    const room = Math.min(float - owned, sharesOnMarket(state, order.tileIndex));
    if (room <= 0) return null;
    // ETF: always take the full remaining float (1 unit).
    shares = room;
  } else {
    const owned = sharesOwned(state, order.tileIndex, player.id);
    if (owned <= 0) return null;
    shares = Math.min(shares, owned);
  }

  const settlePrice = currentSharePrice(state, order.tileIndex);
  let settledShares = shares;
  let totalCash = 0;

  if (order.side === "buy") {
    if (player.cash < settlePrice * shares) {
      pushLog(
        state,
        `${player.name}'s buy of ${tile.name} fails. Cannot afford ${money(settlePrice)}/unit.`,
      );
      if (!silent) {
        state.pending = {
          type: "info",
          tileIndex: tile.index,
          title: tile.ticker ?? tile.name,
          body: `Not enough cash to buy fund units @ ${money(settlePrice)}.`,
        };
      }
      return { card: prById("PR-23"), deltas: [], settledShares: 0, settlePrice, totalCash: 0 };
    }
    settledShares = shares;
    totalCash = settledShares * settlePrice;
    player.cash -= totalCash;
    const owned = sharesOwned(state, order.tileIndex, player.id);
    setShares(state, order.tileIndex, player.id, owned + settledShares);
    pushLog(
      state,
      `${player.name} buys ${settledShares}× ${tile.name} @ ${money(settlePrice)} (${money(totalCash)}). ETF, no PR.`,
    );
  } else {
    totalCash = settledShares * settlePrice;
    player.cash += totalCash;
    const owned = sharesOwned(state, order.tileIndex, player.id);
    setShares(state, order.tileIndex, player.id, owned - settledShares);
    pushLog(
      state,
      `${player.name} sells ${settledShares}× ${tile.name} @ ${money(settlePrice)} (${money(totalCash)}). ETF, no PR.`,
    );
  }

  if (!silent) {
    state.pending = {
      type: "info",
      tileIndex: tile.index,
      title: tile.ticker ?? tile.name,
      body: `${order.side === "buy" ? "Bought" : "Sold"} ${settledShares} units @ ${money(settlePrice)} = ${money(totalCash)}. ETF does not draw Price Reaction.`,
      amount: order.side === "buy" ? -totalCash : totalCash,
      cashKind: order.side,
      shares: settledShares,
      unitPrice: settlePrice,
    };
  }

  return {
    card: prById("PR-23"),
    deltas: [],
    settledShares,
    settlePrice,
    totalCash,
  };
}

/**
 * V5 worst-case buy cost among PR cards matching side + share count.
 * Used before draw — if unaffordable, reject order (do not draw).
 */
function worstCaseBuyCost(
  state: GameState,
  tileIndex: number,
  sector: SectorId,
  shares: number,
  levelBefore: number,
): number {
  let worst = 0;
  for (const card of PRICE_REACTIONS) {
    if (!cardMatchesSide(card, "buy", shares, sector, levelBefore)) continue;
    const deltas = pressureDeltas(card, sector, shares, "buy");
    const projected = projectedSharePrice(state, tileIndex, deltas);
    const cost = shares * projected + BALANCE.orderFeeM;
    if (cost > worst) worst = cost;
  }
  return worst;
}

/**
 * Lock order → draw PR → apply bars → settle at NEW price + fixed ORDER_FEE_M.
 * Buy: reject before draw if worst-case unaffordable.
 * ETF: no PR (see executeEtfOrder).
 * `silent`: skip setting pending (used for forced liquidation).
 */
function executeOrder(
  state: GameState,
  player: PlayerState,
  order: LockedOrder,
  rng: () => number,
  silent = false,
): OrderResult | null {
  const tile = BOARD[order.tileIndex];
  if (!tile || !isListedCompany(tile) || !tile.price) return null;

  if (tile.kind === "etf") {
    return executeEtfOrder(state, player, order, silent);
  }

  const sector = sectorForTile(tile);
  if (!sector) return null;

  let shares = Math.max(1, Math.min(10, order.shares));
  if (order.side === "buy") {
    const owned = sharesOwned(state, order.tileIndex, player.id);
    const room = Math.min(MAX_SHARES_OWNED - owned, sharesOnMarket(state, order.tileIndex));
    if (room <= 0) return null;
    shares = Math.min(shares, room);
    const levelBefore = state.sectorIndex[sector] ?? 0;
    const worst = worstCaseBuyCost(
      state,
      order.tileIndex,
      sector,
      shares,
      levelBefore,
    );
    if (worst <= 0 || player.cash < worst) return null;
  } else {
    const owned = sharesOwned(state, order.tileIndex, player.id);
    if (owned <= 0) return null;
    shares = Math.min(shares, owned);
  }

  const levelBefore = state.sectorIndex[sector] ?? 0;
  let resolved;
  try {
    // V5: no mid-draw afford skip — worst-case already checked for buys.
    resolved = resolveMatchingPr(
      {
        side: order.side,
        shares,
        tradedSector: sector,
        levelBefore,
      },
      rng,
    );
  } catch {
    return null;
  }

  const { card, deltas, rejected } = resolved;
  applyDeltas(state, deltas);

  const settlePrice = currentSharePrice(state, order.tileIndex);
  // Forced liquidation sells waive the flat order fee so shares can actually
  // cover visit fees / taxes / ops — otherwise fee≈price on cheap names.
  const fee =
    order.side === "sell" && order.forced ? 0 : BALANCE.orderFeeM;
  const settledShares = shares;
  let totalCash = 0;

  if (order.side === "buy") {
    totalCash = settledShares * settlePrice + fee;
    if (player.cash < totalCash) return null;
    player.cash -= totalCash;
    const owned = sharesOwned(state, order.tileIndex, player.id);
    setShares(state, order.tileIndex, player.id, owned + settledShares);

    pushLog(
      state,
      `${player.name} buys ${settledShares}× ${tile.name} @ ${money(settlePrice)} (+fee ${money(fee)}) = ${money(totalCash)} after ${card.title}.`,
    );
  } else {
    totalCash = settledShares * settlePrice - fee;
    player.cash += totalCash;
    const owned = sharesOwned(state, order.tileIndex, player.id);
    setShares(state, order.tileIndex, player.id, owned - settledShares);
    pushLog(
      state,
      `${player.name} sells ${settledShares}× ${tile.name} @ ${money(settlePrice)}${fee > 0 ? ` (−fee ${money(fee)})` : " (forced, no fee)"} = ${money(totalCash)} after ${card.title}.`,
    );
  }

  if (!silent) {
    state.pending = {
      type: "price_reaction",
      card,
      order: { ...order, shares },
      deltas,
      settledShares,
      settlePrice,
      totalCash,
      // First rejects only — enough for the mill FX without a huge payload.
      milled: rejected.slice(0, 12),
    };
  }

  return { card, deltas, settledShares, settlePrice, totalCash };
}

/** Trade desk only for a listed company/ETF you just landed on. */
function offerTrade(state: GameState, focusTile: number) {
  if (state.tradesLeft <= 0) return;
  const tile = BOARD[focusTile];
  if (!tile || !isListedCompany(tile)) return;
  enqueue(state, {
    type: "trade",
    tradesLeft: state.tradesLeft,
    focusTile,
  });
}

/** V5 START: cash tax + company rev/ops. One stacked settle (tax over rev). */
function afterStartEffects(state: GameState, player: PlayerState, rng: () => number) {
  if (!state.passedStartThisMove) return;

  const taxRate =
    BALANCE.startCashTaxRate *
      (1 + BALANCE.taxEscalationPerTurn * player.turnsDone) +
    cashHoardTaxBoost(state, player.id);
  const taxPctLabel = `${Math.round(taxRate * 1000) / 10}%`;
  const tax = Math.floor(player.cash * taxRate);
  if (tax > 0) {
    player.cash -= tax;
    pushLog(
      state,
      `${player.name} pays START tax ${money(tax)} (${taxPctLabel} cash).`,
    );
  } else {
    pushLog(state, `${player.name} pays START tax ${money(0)}.`);
  }

  const taxCard = {
    title: "START tax",
    body:
      tax > 0
        ? `Paid ${money(tax)} (${taxPctLabel} of cash) to the bank.`
        : `No START tax this pass (${money(0)}).`,
    amount: -tax,
    cashKind: "pay" as const,
  };

  if (player.bankrupt) {
    enqueue(state, {
      type: "info",
      tileIndex: 0,
      title: taxCard.title,
      body: taxCard.body,
      amount: taxCard.amount,
      cashKind: taxCard.cashKind,
      bundle: [taxCard],
    });
    return;
  }

  const ops = companyOpsTotal(state, player.id);
  if (ops > 0) {
    player.cash += ops;
    pushLog(state, `${player.name} collects company ops ${money(ops)}.`);
  } else if (ops < 0) {
    const due = -ops;
    pushLog(state, `${player.name} owes company ops ${money(due)}.`);
    payCash(state, player, due, null, rng);
  } else {
    pushLog(state, `${player.name} company ops settle at ${money(0)}.`);
  }

  if (player.bankrupt) {
    enqueue(state, {
      type: "info",
      tileIndex: 0,
      title: taxCard.title,
      body: taxCard.body,
      amount: taxCard.amount,
      cashKind: taxCard.cashKind,
      bundle: [taxCard],
    });
    return;
  }

  const revCard = {
    title: "Company rev",
    body:
      ops === 0
        ? `Revenue and costs settle at ${money(0)}.`
        : ops > 0
          ? `Collected ${money(ops)} from company revenue minus costs.`
          : `Paid ${money(-ops)} for company costs above revenue.`,
    amount: ops,
    cashKind: (ops < 0 ? "pay" : "receive") as "pay" | "receive",
  };

  enqueue(state, {
    type: "info",
    tileIndex: 0,
    title: "START",
    body: `${taxCard.body} ${revCard.body}`,
    amount: taxCard.amount + revCard.amount,
    cashKind: taxCard.cashKind,
    bundle: [taxCard, revCard],
  });
}

function landOn(state: GameState, player: PlayerState, rng: () => number) {
  if (state.phase !== "playing" || player.bankrupt) return;
  const tile = BOARD[player.position]!;
  pushLog(state, `${player.name} lands on ${tile.name}.`);

  if (tile.kind === "goto_halt") {
    // Stay on Go-to-SEC until the card dismisses — then warp to HALT.
    // Instant teleport here made tokens hop the long way and skip this tile.
    enqueue(state, {
      type: "info",
      tileIndex: tile.index,
      title: "Go to SEC Investigation",
      body: "You are sent to SEC Investigation. No START settlement. No trading this turn.",
      sendToHalt: true,
    });
    state.tradesLeft = 0;
    pushLog(state, `${player.name} hits Go to SEC Investigation.`);
    return;
  }

  enqueueLandPreview(state, tile);

  // Trading is only for listed company / ETF lands (with focusTile).
  // Weekend, START, tax, news, halt: land effects only — no order desk.
  if (tile.kind === "halt") {
    state.tradesLeft = 0;
    return;
  }

  if (tile.kind === "tax") {
    const due =
      tile.index === 4 ? BALANCE.incomeTax : BALANCE.wealthTax;
    // Full obligation — liquidate then bankrupt if still short (skill: keep cash buffer).
    payCash(state, player, due, null, rng);
    if (player.bankrupt) return;
    enqueue(state, {
      type: "info",
      tileIndex: tile.index,
      title: tile.name,
      body:
        tile.index === 4
          ? `Income Tax paid ${money(due)} to the bank.`
          : `Wealth Tax paid ${money(due)} to the bank.`,
      amount: -due,
      cashKind: "pay",
    });
    state.tradesLeft = 0;
    return;
  }

  if (tile.kind === "regime") {
    const card = drawNews(state, rng, `${player.name} hits a Market News square.`);
    enqueue(state, {
      type: "regime",
      card,
      text: `${card.title}: ${card.textEn ?? card.text}`,
    });
    state.tradesLeft = 0;
    return;
  }

  if (tile.kind === "free" || tile.kind === "go") {
    state.tradesLeft = 0;
    return;
  }

  if (isListedCompany(tile)) {
    if (chargesVisitFee(tile)) {
      const { totalPaid, transfers } = collectVisitFees(
        state,
        player,
        tile.index,
        rng,
      );
      if (player.bankrupt) return;
      if (totalPaid > 0) {
        const lines = transfers.map(
          (x) =>
            `${x.fromName} paid ${x.toName}: ${money(x.amount)} (${x.shares} shares)`,
        );
        enqueue(state, {
          type: "info",
          tileIndex: tile.index,
          title: "Visit fee",
          body: lines.join("; "),
          amount: -totalPaid,
          cashKind: "pay",
          transfers,
        });
      }
    }
    offerTrade(state, tile.index);
  }
}

function movePlayer(state: GameState, player: PlayerState, steps: number) {
  const prev = player.position;
  const next = (prev + steps) % 40;
  state.passedStartThisMove = next < prev || prev + steps >= 40;
  player.position = next;
}

function advanceTurn(state: GameState) {
  if (state.phase !== "playing") return;
  const finishing = currentPlayer(state);
  if (!finishing.bankrupt) {
    finishing.turnsDone += 1;
  }
  recordSectorHistory(state);
  checkWinner(state);
  if (state.phase !== "playing") return;

  const n = state.players.length;
  for (let i = 0; i < n; i++) {
    state.turnIndex = (state.turnIndex + 1) % n;
    const p = state.players[state.turnIndex]!;
    if (!p.bankrupt) {
      state.lastDice = null;
      state.pending = null;
      state.pendingQueue = [];
      state.tradesLeft = 1;
      state.passedStartThisMove = false;
      state.awaitingLandAfterStart = false;
      if (p.inJail) {
        state.pending = {
          type: "halt",
          canPay: p.cash >= BALANCE.haltFine,
        };
      }
      pushLog(state, `${p.name}'s turn.`);
      return;
    }
  }
}

export function createGame(
  players: { id: string; name: string; token: PlayerToken }[],
  rng: () => number = Math.random,
): GameState {
  const sectorIndex = emptySectorIndex();
  const openingDie = 1 + Math.floor(rng() * 6);
  const preset = openingPresetForDie(openingDie);

  let regime: GameState["regime"] = "bull";
  let activeRegimeId: string | null = null;
  let openLog: string;

  if (preset) {
    regime = preset.regime;
    activeRegimeId = preset.sourceNewsId;
    for (const [sector, delta] of Object.entries(preset.shocks)) {
      if (typeof delta === "number") {
        sectorIndex[sector as SectorId] = clampSector(
          (sectorIndex[sector as SectorId] ?? 0) + delta,
        );
      }
    }
    openLog = `Market opens (d6=${openingDie}): ${preset.nameEn} (${regime === "bull" ? "BULL" : "BEAR"}). ${players[0]?.name ?? "Player"} starts.`;
  } else {
    openLog = `Market opens (d6=${openingDie}): flat open (BULL). ${players[0]?.name ?? "Player"} starts.`;
  }

  const state: GameState = {
    phase: "playing",
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      token: p.token,
      cash: BALANCE.startingCash,
      position: 0,
      inJail: false,
      jailTurns: 0,
      bankrupt: false,
      turnsDone: 0,
    })),
    turnIndex: 0,
    holdings: [],
    sectorIndex,
    sectorHistory: emptySectorHistory(),
    regime,
    activeRegimeId,
    prDeck: freshPrDeck(rng),
    prDiscard: [],
    regimeDeck: [],
    regimeDiscard: [],
    lastDice: null,
    pending: null,
    pendingQueue: [],
    winnerId: null,
    log: [openLog],
    tradesLeft: 1,
    passedStartThisMove: false,
    awaitingLandAfterStart: false,
    maxTurns: STANDARD_TURNS,
  };
  recordSectorHistory(state);
  return state;
}

export function applyAction(
  state: GameState,
  playerId: string,
  action: EngineAction,
  rng: () => number = Math.random,
): GameState {
  const next: GameState = structuredClone(state);
  if (next.phase !== "playing") return next;

  const player = next.players.find((p) => p.id === playerId);
  if (!player || player.bankrupt) return next;
  const current = currentPlayer(next);
  if (current.id !== playerId) return next;

  switch (action.type) {
    case "roll": {
      if (next.pending && next.pending.type !== "halt") return next;
      if (next.lastDice && !player.inJail) return next;

      if (player.inJail) {
        const d1 = 1 + Math.floor(rng() * 6);
        const d2 = 1 + Math.floor(rng() * 6);
        next.lastDice = [d1, d2];
        if (d1 === d2) {
          player.inJail = false;
          player.jailTurns = 0;
          next.pending = null;
          pushLog(next, `${player.name} rolls doubles and leaves SEC Investigation.`);
          movePlayer(next, player, d1 + d2);
          resolveMoveLanding(next, player, rng);
        } else {
          player.jailTurns += 1;
          pushLog(next, `${player.name} fails doubles (${d1}+${d2}).`);
          if (player.jailTurns >= 3) {
            if (!payCash(next, player, BALANCE.haltFine, null, rng)) return next;
            player.inJail = false;
            player.jailTurns = 0;
            next.pending = null;
            pushLog(next, `${player.name} pays ${money(BALANCE.haltFine)} after 3 turns.`);
            movePlayer(next, player, d1 + d2);
            resolveMoveLanding(next, player, rng);
          } else {
            next.pending = { type: "halt", canPay: player.cash >= BALANCE.haltFine };
          }
        }
        return next;
      }

      const d1 = 1 + Math.floor(rng() * 6);
      const d2 = 1 + Math.floor(rng() * 6);
      next.lastDice = [d1, d2];
      pushLog(next, `${player.name} rolls ${d1}+${d2}.`);
      movePlayer(next, player, d1 + d2);
      resolveMoveLanding(next, player, rng);
      return next;
    }

    case "dismiss": {
      if (!next.pending) return next;
      if (
        next.pending.type === "info" ||
        next.pending.type === "regime" ||
        next.pending.type === "price_reaction"
      ) {
        const sendToHalt =
          next.pending.type === "info" && next.pending.sendToHalt;
        const wasPr = next.pending.type === "price_reaction";
        const prFocus =
          wasPr && next.pending.type === "price_reaction"
            ? next.pending.order.tileIndex
            : undefined;
        if (sendToHalt) {
          player.position = HALT_INDEX;
          player.inJail = true;
          player.jailTurns = 0;
          next.awaitingLandAfterStart = false;
          pushLog(
            next,
            `${player.name} is sent to SEC Investigation.`,
          );
        }
        advancePending(next);
        if (
          wasPr &&
          next.tradesLeft > 0 &&
          !next.pending &&
          prFocus != null
        ) {
          // Re-open desk only for the listed tile that triggered this PR.
          offerTrade(next, prFocus);
        }
        finishLandAfterStart(next, player, rng);
      }
      return next;
    }

    case "trade": {
      if (!next.pending || next.pending.type !== "trade") return next;
      if (next.tradesLeft <= 0) return next;
      const pending = next.pending;
      // Desk without a landed listed focus is invalid — close it.
      if (
        pending.focusTile == null ||
        !BOARD[pending.focusTile] ||
        !isListedCompany(BOARD[pending.focusTile]!)
      ) {
        next.tradesLeft = 0;
        next.pending = null;
        advancePending(next);
        return next;
      }

      if (action.action === "skip") {
        next.tradesLeft = 0;
        next.pending = null;
        advancePending(next);
        pushLog(next, `${player.name} skips trading.`);
        return next;
      }

      const tileIndex = action.tileIndex;
      const shares = action.shares ?? 0;
      if (tileIndex == null || shares < 1 || shares > 10) return next;
      const tile = BOARD[tileIndex];
      if (!tile || !isListedCompany(tile)) return next;

      if (action.action === "buy") {
        // Buy only the listed tile you just landed on — no free shopping.
        if (tileIndex !== pending.focusTile) {
          return next;
        }
        const market = sharesOnMarket(next, tileIndex);
        const owned = sharesOwned(next, tileIndex, player.id);
        if (owned >= MAX_SHARES_OWNED) return next;
        if (market <= 0) return next;
        // ETF: all-or-nothing — must buy the full remaining float.
        if (tile.kind === "etf" && shares !== market) return next;
      } else {
        // Sell only holdings — never invent a ticker off the land focus.
        if (sharesOwned(next, tileIndex, player.id) < shares) return next;
      }

      // Consume trade slot before settle
      next.tradesLeft -= 1;
      next.pending = null;
      // Clear any queued trade — will re-offer after PR if needed
      next.pendingQueue = next.pendingQueue.filter((p) => p.type !== "trade");

      executeOrder(
        next,
        player,
        {
          side: action.action,
          tileIndex,
          shares,
          counterpartyId: action.counterpartyId ?? null,
        },
        rng,
      );

      // If more trades left, queue another trade after PR dismiss
      if (next.tradesLeft > 0) {
        // Will be offered on dismiss of price_reaction
      } else if (pending.focusTile != null && next.tradesLeft === 0) {
        // no-op
      }

      return next;
    }

    case "pay_jail": {
      if (!player.inJail) return next;
      if (!payCash(next, player, BALANCE.haltFine, null, rng)) return next;
      player.inJail = false;
      player.jailTurns = 0;
      next.pending = null;
      next.lastDice = null;
      pushLog(next, `${player.name} pays ${money(BALANCE.haltFine)} to leave SEC Investigation.`);
      return next;
    }

    case "end_turn": {
      if (next.pending) return next;
      if (!next.lastDice && !player.inJail) return next;
      advanceTurn(next);
      return next;
    }

    case "declare_bankrupt": {
      bankruptPlayer(next, player);
      return next;
    }
  }
}

export function tileGridPosition(index: number): { row: number; col: number } {
  if (index <= 10) return { row: 10, col: 10 - index };
  if (index <= 20) return { row: 10 - (index - 10), col: 0 };
  if (index <= 30) return { row: 0, col: index - 20 };
  return { row: index - 30, col: 10 };
}

export function listedCompanies() {
  return BOARD.filter(isListedCompany);
}

export function getSharesOwned(state: GameState, tileIndex: number, ownerId: string) {
  return sharesOwned(state, tileIndex, ownerId);
}

export function getSharesOnMarket(state: GameState, tileIndex: number) {
  return sharesOnMarket(state, tileIndex);
}

export function getShareFloat(tileIndex: number) {
  return floatForTile(tileIndex);
}

export { currentSharePrice, feePerShare };
export { pressureDeltas, prById, resolveMatchingPr } from "./content/priceReactions";
