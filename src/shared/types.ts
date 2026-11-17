/** Shared protocol + Marketpoly V5 game types (client + PartyServer). */

export const PROTOCOL_VERSION = 5;
export const MAX_PLAYERS = 4;
/**
 * V5.2 skill balance — risk triangle (whale / cash / thin / corner).
 * See `balance/knobs.ts` + `balance/portfolioRisk.ts`.
 */
export const STARTING_CASH = 1700;
/** @deprecated V5 START uses cash tax + ops; kept for old logs/tests. */
export const START_PAY_BULL = 200;
/** @deprecated V5 START uses cash tax + ops; kept for old logs/tests. */
export const START_PAY_BEAR = 100;
/**
 * V5: floor(cash × rate × escalation [+ hoard]) paid when passing START.
 * High base so idle cash is punished and desks must buy/sell.
 */
export const START_CASH_TAX_RATE = 0.22;
/** V5: flat order fee after a company Price Reaction settle (active desks ok). */
export const ORDER_FEE_M = 10;
export const HALT_INDEX = 10;
export const GO_TO_HALT_INDEX = 30;
export const HALT_FINE = 100;
export const JAIL_INDEX = 10;
export const GO_TO_JAIL_INDEX = 30;
export const JAIL_FINE = 100;
export const SHARES_PER_COMPANY = 10;
/** ETF funds are a single unit on the market (shown as 1/1). */
export const SHARES_PER_ETF = 1;
export const MAX_SHARES_OWNED = 10;
/** Can bankrupt if over-levered — keep moderate so skill cash-buffer matters. */
export const INCOME_TAX = 120;
export const WEALTH_TAX = 250;
/** 0 = unlimited turns (game ends only by bankruptcy / last player standing). */
export const STANDARD_TURNS = 0;
export const SECTOR_MIN = -5;
export const SECTOR_MAX = 5;

export type TileKind =
  | "go"
  | "company"
  | "etf"
  | "tax"
  | "regime"
  | "halt"
  | "free"
  | "goto_halt"
  /** @deprecated playtest ETF — kept for old snapshots */
  | "broker"
  | "utility"
  | "exchange";

export type ColorGroup =
  | "brown"
  | "lightblue"
  | "pink"
  | "orange"
  | "red"
  | "yellow"
  | "green"
  | "darkblue"
  | "etf"
  | "none"
  /** @deprecated */
  | "railroad"
  | "utility";

export type SectorId =
  | "staples"
  | "energy"
  | "comms"
  | "industrials"
  | "financials"
  | "discretionary"
  | "healthcare"
  | "tech";

export type BoardTile = {
  index: number;
  name: string;
  ticker?: string;
  logo?: string;
  kind: TileKind;
  group: ColorGroup;
  /** Base share price P₀ (one 10% share) in M$. */
  price?: number;
  /** Visit fee / share (companies). Defaults to round(P₀/10). */
  visitFeePerShare?: number;
  /** START settlement ops (companies). */
  revenueBasePerShare?: number;
  fixedCostPerShare?: number;
  special?: boolean;
  taxAmount?: number;
};

export type PlayerToken = "amber" | "teal" | "rose" | "violet";
export const PLAYER_TOKENS: PlayerToken[] = ["amber", "teal", "rose", "violet"];

export function nextPlayerToken(used: Iterable<PlayerToken>): PlayerToken {
  const taken = new Set(used);
  return PLAYER_TOKENS.find((t) => !taken.has(t)) ?? "amber";
}

export type PlayerState = {
  id: string;
  name: string;
  token: PlayerToken;
  cash: number;
  position: number;
  inJail: boolean;
  jailTurns: number;
  bankrupt: boolean;
  turnsDone: number;
};

export type ShareHolding = {
  tileIndex: number;
  ownerId: string;
  /** 1–10 shares (10%–100%). */
  shares: number;
};

export type MarketRegime = "bull" | "bear";

export type TradeSide = "buy" | "sell";

/** Sector-track delta on a Price Reaction matrix cell (−5…+5). */
export type PrMark = number;

/** Independent MUA / BÁN values in one matrix cell. */
export type PrCell = { buy: number; sell: number };

export type PrRange = { min: number; max: number };

/** One OR-clause inside matchConditionsBySide[side].anyOf (fields AND). */
export type PrMatchClause = {
  shares?: PrRange;
  tradedSectorLevelBefore?: PrRange;
  tradedSectorIds?: string[];
};

export type PrMatchSide = {
  anyOf: PrMatchClause[];
  labelEn?: string;
  labelVi?: string;
};

export type PriceReactionCard = {
  id: string;
  title: string;
  titleVi?: string;
  text?: string;
  textEn?: string;
  intensity?: string;
  feePerExecutedOrderM: number;
  matchConditionsBySide: Record<TradeSide, PrMatchSide>;
  /** matrix[tradedSector][affectedSector] */
  matrix: Record<SectorId, Record<SectorId, PrCell>>;
  drawCoverageAnchor?: boolean;
};

export type RegimeCard = {
  id: string;
  title: string;
  titleVi?: string;
  regime: MarketRegime;
  shocks: Partial<Record<SectorId, number>>;
  text: string;
  textEn?: string;
};

export type LockedOrder = {
  side: TradeSide;
  tileIndex: number;
  shares: number;
  /** true = forced liquidation (still draws PR). */
  forced?: boolean;
  /** Counterparty player id for P2P; null/undefined = bank. */
  counterpartyId?: string | null;
};

export type SectorDelta = { sector: SectorId; delta: number };

/** Player↔player cash move shown on the settle ticket (visit fees, etc.). */
export type CashTransfer = {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
  /** Shares that drove a visit fee line. */
  shares?: number;
};

export type PendingDecision =
  | {
      type: "info";
      tileIndex: number;
      title: string;
      body: string;
      /** Signed cash (negative = paid out). Triggers full-screen settle FX. */
      amount?: number;
      /** How to present the cash settle ticket (default from amount sign). */
      cashKind?: "buy" | "sell" | "pay" | "receive";
      shares?: number;
      unitPrice?: number;
      /** Who paid whom — visit fees and other P2P cash. */
      transfers?: CashTransfer[];
      /**
       * Multiple settle tickets shown together (START tax + company rev).
       * One dismiss closes the whole stack.
       */
      bundle?: {
        title: string;
        body?: string;
        /** Signed cash (negative = paid out). */
        amount: number;
        cashKind: "buy" | "sell" | "pay" | "receive";
      }[];
      /**
       * Go-to-SEC card: stay on tile 30 until dismiss, then warp to HALT.
       * Avoids hopping the long way around the board and skipping the goto tile.
       */
      sendToHalt?: boolean;
    }
  | {
      type: "trade";
      /** Remaining voluntary orders this turn (usually 1). */
      tradesLeft: number;
      /** Listed company/ETF tile just landed on — required to open the desk. */
      focusTile: number;
    }
  | {
      type: "price_reaction";
      card: PriceReactionCard;
      order: LockedOrder;
      deltas: SectorDelta[];
      /** Shares actually settled (may be less than ordered on buy). */
      settledShares: number;
      settlePrice: number;
      totalCash: number;
      /**
       * PR ids skipped before the match (draw order). Client mills these
       * face-up until `card` locks. Capped for payload size.
       */
      milled?: string[];
    }
  | {
      type: "regime";
      card: RegimeCard;
      text: string;
    }
  | {
      type: "halt";
      canPay: boolean;
    };

export type GamePhase = "lobby" | "playing" | "finished";

export type GameState = {
  phase: GamePhase;
  players: PlayerState[];
  turnIndex: number;
  holdings: ShareHolding[];
  sectorIndex: Record<SectorId, number>;
  /** Sector index (−5…+5) sampled each turn (and at market open). */
  sectorHistory: Record<SectorId, number[]>;
  regime: MarketRegime;
  /** Active regime card id (for display). */
  activeRegimeId: string | null;
  prDeck: string[];
  prDiscard: string[];
  regimeDeck: string[];
  regimeDiscard: string[];
  lastDice: [number, number] | null;
  pending: PendingDecision | null;
  pendingQueue: PendingDecision[];
  winnerId: string | null;
  log: string[];
  /** Voluntary trades remaining this turn. */
  tradesLeft: number;
  passedStartThisMove: boolean;
  /**
   * Passed START this roll: settle tax/ops first, then land on dismiss.
   * Keeps each cash card matched to its own ledger change.
   */
  awaitingLandAfterStart: boolean;
  maxTurns: number;
};

export type LobbySeat = {
  playerId: string;
  name: string;
  token: PlayerToken;
  ready: boolean;
  connected: boolean;
  isBot?: boolean;
};

export type WaitingPlayer = {
  playerId: string;
  name: string;
};

export type RoomSnapshot = {
  protocolVersion: number;
  roomCode: string;
  hostId: string | null;
  seats: LobbySeat[];
  /** Claimable empty chairs (invitees sit themselves; host may fill with a fund). */
  openSlots: number;
  /** In the room but not seated yet. */
  waiting: WaitingPlayer[];
  game: GameState | null;
  /** Server drives every seated seat (funds and players). Clients watch only. */
  autoPlay?: boolean;
};

export type ClientMessage =
  | { type: "hello"; playerId: string; name: string }
  | { type: "set_ready"; ready: boolean }
  /** Host opens one empty chair (up to MAX_PLAYERS total). */
  | { type: "add_open_seat" }
  /** Host removes one empty chair. */
  | { type: "remove_open_seat" }
  /** Waiting player claims one open chair. */
  | { type: "claim_seat" }
  /** Seated human leaves their chair (becomes waiting); frees an open slot. */
  | { type: "leave_seat" }
  | { type: "add_bot"; fund?: string }
  /** Remove one fund; omit playerId to drop the last bot seat. */
  | { type: "remove_bot"; playerId?: string }
  /** Swap a fund seat to another roster name. */
  | { type: "replace_bot"; playerId: string; fund?: string }
  /** Host removes another lobby seat (friend or fund). */
  | { type: "kick"; playerId: string }
  /** Start auto-play with seated funds/players (optional fund fill when empty). */
  | { type: "start_auto"; fund1?: string; fund2?: string }
  | { type: "start" }
  /** Host (or autoplay viewer) starts a fresh match with the same seats. */
  | { type: "restart" }
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

export type ServerMessage =
  | { type: "welcome"; playerId: string; snapshot: RoomSnapshot }
  | { type: "snapshot"; snapshot: RoomSnapshot }
  | { type: "error"; message: string }
  | { type: "rejected"; reason: string };
