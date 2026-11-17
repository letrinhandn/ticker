import { PLAYER_TOKENS, type SectorId } from "@/shared/types";
import { BOARD, SECTOR_IDS, sectorForTile } from "@/lib/game/board";
import { createGame } from "@/lib/game/engine";
import { stepBot } from "@/lib/game/bots/botRunner";
import { netWorth } from "@/lib/game/pricing";
import { BALANCE } from "./knobs";
import { mulberry32 } from "./rng";
import type {
  MatchEndReason,
  MatchPlayerResult,
  MatchResult,
} from "./types";

export type RunMatchOpts = {
  players: 2 | 3 | 4;
  maxTurns: number;
  seed: number;
  /** Safety cap on bot steps (default 8000). */
  maxSteps?: number;
  /**
   * Display names for seats (must match `BOT_FUNDS` to pick strategies).
   * Defaults to Bot0… which all fall back to multi_strat.
   */
  seatNames?: string[];
};

function emptySectorMap(fill: number): Record<SectorId, number> {
  return Object.fromEntries(SECTOR_IDS.map((s) => [s, fill])) as Record<
    SectorId,
    number
  >;
}

function bump(
  map: Record<string, number>,
  key: string | number,
  by = 1,
): void {
  const k = String(key);
  map[k] = (map[k] ?? 0) + by;
}

function parseOpeningDie(log0: string | undefined): number | null {
  if (!log0) return null;
  const m = /d6=(\d+)/.exec(log0);
  return m ? Number(m[1]) : null;
}

/**
 * Seeded headless bot-vs-bot match with full telemetry.
 * All seats are bots (`() => true`).
 */
export function runMatch(opts: RunMatchOpts): MatchResult {
  const { players, maxTurns, seed } = opts;
  const maxSteps = opts.maxSteps ?? 8000;
  const rng = mulberry32(seed);

  const seats = Array.from({ length: players }, (_, i) => ({
    id: `bot-${i}`,
    name: opts.seatNames?.[i] ?? `Bot${i}`,
    token: PLAYER_TOKENS[i % PLAYER_TOKENS.length]!,
  }));

  let state = createGame(seats, rng);
  state.maxTurns = maxTurns;

  const openingDie = parseOpeningDie(state.log[0]);
  const openingPresetId = state.activeRegimeId;

  const diceSumHistogram: Record<string, number> = {};
  let jailDoubles = 0;
  let jailRolls = 0;
  const landsByTile: Record<string, number> = {};
  const landsByKind: Record<string, number> = {};
  const tradesByTile: Record<
    string,
    { buy: number; sell: number; skip: number }
  > = {};

  let orderFeesPaid = 0;
  let visitFeesPaid = 0;
  let startTaxPaid = 0;
  let startOpsNet = 0;
  let tileTaxesPaid = 0;
  let haltFinesPaid = 0;

  const prDraws: string[] = [];
  const newsDraws: string[] = [];

  const sectorMin = emptySectorMap(5);
  const sectorMax = emptySectorMap(-5);
  for (const s of SECTOR_IDS) {
    const v = state.sectorIndex[s] ?? 0;
    sectorMin[s] = v;
    sectorMax[s] = v;
  }
  const companyTradesByLevel: Record<
    string,
    { buy: number; sell: number; skip: number }
  > = {};
  const bumpLevelTrade = (
    level: number,
    action: "buy" | "sell" | "skip",
  ) => {
    const key = String(level);
    if (!companyTradesByLevel[key]) {
      companyTradesByLevel[key] = { buy: 0, sell: 0, skip: 0 };
    }
    companyTradesByLevel[key]![action] += 1;
  };

  const playerBuys = Object.fromEntries(seats.map((p) => [p.id, 0])) as Record<
    string,
    number
  >;
  const playerSells = Object.fromEntries(
    seats.map((p) => [p.id, 0]),
  ) as Record<string, number>;
  const playerSkips = Object.fromEntries(
    seats.map((p) => [p.id, 0]),
  ) as Record<string, number>;
  const bankruptTurn: Record<string, number | null> = Object.fromEntries(
    seats.map((p) => [p.id, null]),
  );

  const coverage = {
    companyLand: false,
    etfTrade: false,
    visitFee: false,
    prSettle: false,
    news: false,
    startPass: false,
    tax: false,
    halt: false,
  };

  const isBot = () => true;
  let steps = 0;
  let endReason: MatchEndReason = "stuck";
  let prevPositions = state.players.map((p) => p.position);

  const trackSectors = () => {
    for (const s of SECTOR_IDS) {
      const v = state.sectorIndex[s] ?? 0;
      sectorMin[s] = Math.min(sectorMin[s]!, v);
      sectorMax[s] = Math.max(sectorMax[s]!, v);
    }
  };

  const noteLand = (tileIndex: number) => {
    const tile = BOARD[tileIndex];
    if (!tile) return;
    bump(landsByTile, tileIndex);
    bump(landsByKind, tile.kind);
    if (tile.kind === "company") coverage.companyLand = true;
    if (tile.kind === "halt" || tile.kind === "goto_halt") coverage.halt = true;
    if (tile.kind === "tax") coverage.tax = true;
  };

  const notePendingAfter = () => {
    const p = state.pending;
    if (!p) return;
    if (p.type === "price_reaction") {
      prDraws.push(p.card.id);
      orderFeesPaid += BALANCE.orderFeeM;
      coverage.prSettle = true;
    } else if (p.type === "regime") {
      newsDraws.push(p.card.id);
      coverage.news = true;
    } else if (p.type === "info") {
      if (p.bundle?.length) {
        coverage.startPass = true;
        for (const b of p.bundle) {
          if (b.title.toLowerCase().includes("tax")) {
            startTaxPaid += Math.abs(b.amount);
          } else {
            startOpsNet += b.amount;
          }
        }
      } else if (p.transfers?.length) {
        const paid = p.transfers.reduce((s, t) => s + t.amount, 0);
        visitFeesPaid += paid;
        coverage.visitFee = true;
      } else if (
        typeof p.amount === "number" &&
        (p.title.toLowerCase().includes("tax") || p.tileIndex === 4 || p.tileIndex === 38)
      ) {
        tileTaxesPaid += Math.abs(p.amount);
        coverage.tax = true;
      } else if (p.sendToHalt) {
        coverage.halt = true;
      }
    } else if (p.type === "halt") {
      coverage.halt = true;
    }
  };

  while (state.phase === "playing" && steps < maxSteps) {
    const current = state.players[state.turnIndex];
    if (!current || current.bankrupt) {
      endReason = "stuck";
      break;
    }

    const before = state;
    const beforePendingType = before.pending?.type ?? null;
    const beforeBankrupt = before.players.map((p) => p.bankrupt);
    const wasInJail = current.inJail;

    const step = stepBot(state, current.id, isBot, rng);
    if (!step) {
      endReason = "stuck";
      break;
    }

    steps += 1;
    state = step.state;
    trackSectors();

    // Dice
    if (step.action.type === "roll" && state.lastDice) {
      const [d1, d2] = state.lastDice;
      bump(diceSumHistogram, d1 + d2);
      if (wasInJail) {
        jailRolls += 1;
        if (d1 === d2) jailDoubles += 1;
      }
    }

    if (step.action.type === "pay_jail") {
      haltFinesPaid += BALANCE.haltFine;
      coverage.halt = true;
    }

    // Lands — position change for acting player
    const afterPlayer = state.players.find((p) => p.id === current.id);
    if (afterPlayer && afterPlayer.position !== prevPositions[state.players.findIndex((p) => p.id === current.id)]) {
      noteLand(afterPlayer.position);
    }
    prevPositions = state.players.map((p) => p.position);

    // Trades
    if (step.action.type === "trade") {
      const tile =
        step.action.tileIndex ??
        (before.pending?.type === "trade" ? before.pending.focusTile : undefined);
      const key = String(tile ?? "?");
      if (!tradesByTile[key]) {
        tradesByTile[key] = { buy: 0, sell: 0, skip: 0 };
      }
      const row = tradesByTile[key]!;
      const boardTile = tile != null ? BOARD[tile] : undefined;
      const sector =
        boardTile && boardTile.kind === "company"
          ? sectorForTile(boardTile)
          : null;
      const levelAtTrade =
        sector != null ? (before.sectorIndex[sector] ?? 0) : null;
      if (step.action.action === "buy") {
        row.buy += 1;
        playerBuys[current.id] = (playerBuys[current.id] ?? 0) + 1;
        if (boardTile?.kind === "etf") coverage.etfTrade = true;
        if (levelAtTrade != null) bumpLevelTrade(levelAtTrade, "buy");
      } else if (step.action.action === "sell") {
        row.sell += 1;
        playerSells[current.id] = (playerSells[current.id] ?? 0) + 1;
        if (levelAtTrade != null) bumpLevelTrade(levelAtTrade, "sell");
      } else {
        row.skip += 1;
        playerSkips[current.id] = (playerSkips[current.id] ?? 0) + 1;
        if (levelAtTrade != null) bumpLevelTrade(levelAtTrade, "skip");
      }
    }

    // Newly appeared pending cards (only when type changes into one we care about)
    if (state.pending && state.pending.type !== beforePendingType) {
      notePendingAfter();
    }

    for (let i = 0; i < state.players.length; i++) {
      const p = state.players[i]!;
      if (p.bankrupt && !beforeBankrupt[i] && bankruptTurn[p.id] == null) {
        bankruptTurn[p.id] = p.turnsDone;
      }
    }

    if (state.phase === "finished") {
      // log[0] is the opening die line — check the close message at the end.
      const closeLine = [...state.log].reverse().find(
        (l) => l.includes("Market closes") || l.includes("wins the market"),
      );
      endReason = closeLine?.includes("Market closes")
        ? "maxTurns"
        : "bankruptcy";
      break;
    }
  }

  if (state.phase === "playing") {
    endReason = steps >= maxSteps ? "stepCap" : "stuck";
  }

  const turns = Math.max(...state.players.map((p) => p.turnsDone), 0);

  const playerResults: MatchPlayerResult[] = state.players.map((p, seat) => {
    const holdings = state.holdings
      .filter((h) => h.ownerId === p.id)
      .map((h) => ({ tileIndex: h.tileIndex, shares: h.shares }));
    const sharesHeld = holdings.reduce((s, h) => s + h.shares, 0);
    return {
      id: p.id,
      seat,
      cash: p.cash,
      netWorth: netWorth(state, p.id),
      bankrupt: p.bankrupt,
      bankruptTurn: bankruptTurn[p.id] ?? null,
      sharesHeld,
      holdings,
      buys: playerBuys[p.id] ?? 0,
      sells: playerSells[p.id] ?? 0,
      skips: playerSkips[p.id] ?? 0,
    };
  });

  return {
    seed,
    players,
    maxTurns,
    steps,
    turns,
    phase: state.phase,
    winnerId: state.winnerId,
    endReason,
    openingDie,
    openingPresetId,
    diceSumHistogram,
    jailDoubles,
    jailRolls,
    landsByTile,
    landsByKind,
    tradesByTile,
    orderFeesPaid,
    visitFeesPaid,
    startTaxPaid,
    startOpsNet,
    tileTaxesPaid,
    haltFinesPaid,
    prDraws,
    newsDraws,
    sectorFinal: { ...state.sectorIndex },
    sectorMin,
    sectorMax,
    companyTradesByLevel,
    sectorsHitFloor: SECTOR_IDS.filter((s) => sectorMin[s]! <= -5).length,
    sectorsHitCeil: SECTOR_IDS.filter((s) => sectorMax[s]! >= 5).length,
    playerResults,
    coverage,
  };
}
