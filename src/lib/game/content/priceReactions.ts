/**
 * Price Reaction — 100 cards (quantity EN/VI deck).
 * Match on declared share count only (per side). Each valid order:
 * shuffle all 100, draw until first quantity match, apply full row, restore pool.
 */
import type {
  PriceReactionCard,
  PrCell,
  PrMatchClause,
  PrMatchSide,
  PrRange,
  SectorDelta,
  SectorId,
  TradeSide,
} from "@/shared/types";
import { SECTOR_CODE, SECTOR_IDS } from "../board";
import { shuffleInPlace } from "./shuffle";
import raw from "@/content/priceReactions100.json";

export const CODE_TO_SECTOR = Object.fromEntries(
  SECTOR_IDS.map((id) => [SECTOR_CODE[id], id]),
) as Record<string, SectorId>;

type RawCell = { buy: number; sell: number };
type RawCard = {
  id: string;
  nameEn?: string;
  nameVi?: string;
  name?: string;
  headlineEn?: string;
  headlineVi?: string;
  intensity?: string;
  feePerExecutedOrderM: number;
  matchConditionsBySide: Record<TradeSide, PrMatchSide>;
  matrix: Record<string, Record<string, RawCell>>;
  drawCoverageAnchor?: boolean;
};

function emptyCell(): PrCell {
  return { buy: 0, sell: 0 };
}

function emptyRow(): Record<SectorId, PrCell> {
  return Object.fromEntries(SECTOR_IDS.map((s) => [s, emptyCell()])) as Record<
    SectorId,
    PrCell
  >;
}

function emptyMatrix(): Record<SectorId, Record<SectorId, PrCell>> {
  return Object.fromEntries(SECTOR_IDS.map((s) => [s, emptyRow()])) as Record<
    SectorId,
    Record<SectorId, PrCell>
  >;
}

function parseCard(rawCard: RawCard): PriceReactionCard {
  const matrix = emptyMatrix();
  for (const [rowCode, cols] of Object.entries(rawCard.matrix)) {
    const row = CODE_TO_SECTOR[rowCode];
    if (!row) continue;
    for (const [colCode, cell] of Object.entries(cols ?? {})) {
      const col = CODE_TO_SECTOR[colCode];
      if (!col || !cell) continue;
      matrix[row][col] = {
        buy: cell.buy ?? 0,
        sell: cell.sell ?? 0,
      };
    }
  }
  const match = rawCard.matchConditionsBySide ?? {
    buy: { anyOf: [{}], labelVi: "Mọi lệnh hợp lệ" },
    sell: { anyOf: [{}], labelVi: "Mọi lệnh hợp lệ" },
  };

  return {
    id: rawCard.id,
    title: rawCard.nameEn ?? rawCard.name ?? rawCard.id,
    titleVi: rawCard.nameVi,
    text: rawCard.headlineVi,
    textEn: rawCard.headlineEn,
    intensity: rawCard.intensity,
    feePerExecutedOrderM: rawCard.feePerExecutedOrderM ?? 5,
    matchConditionsBySide: match,
    matrix,
    drawCoverageAnchor: rawCard.drawCoverageAnchor,
  };
}

export const PRICE_REACTIONS: PriceReactionCard[] = (
  raw.cards as RawCard[]
).map(parseCard);

const BY_ID = Object.fromEntries(PRICE_REACTIONS.map((c) => [c.id, c])) as Record<
  string,
  PriceReactionCard
>;

export function prById(id: string): PriceReactionCard {
  const card = BY_ID[id];
  if (!card) throw new Error(`Unknown PR ${id}`);
  return card;
}

export function freshPrDeck(rng: () => number): string[] {
  return shuffleInPlace(
    PRICE_REACTIONS.map((c) => c.id),
    rng,
  );
}

function inRange(value: number, range: PrRange): boolean {
  return value >= range.min && value <= range.max;
}

function clauseMatches(
  clause: PrMatchClause,
  shares: number,
  tradedSector: SectorId,
  levelBefore: number,
): boolean {
  if (clause.shares && !inRange(shares, clause.shares)) return false;
  if (
    clause.tradedSectorLevelBefore &&
    !inRange(levelBefore, clause.tradedSectorLevelBefore)
  ) {
    return false;
  }
  if (clause.tradedSectorIds && clause.tradedSectorIds.length > 0) {
    const code = SECTOR_CODE[tradedSector];
    if (!clause.tradedSectorIds.includes(code)) return false;
  }
  return true;
}

/** Empty anyOf clause = always matches (coverage anchors). */
export function cardMatchesSide(
  card: PriceReactionCard,
  side: TradeSide,
  shares: number,
  tradedSector: SectorId,
  levelBefore: number,
): boolean {
  const block = card.matchConditionsBySide[side];
  if (!block?.anyOf?.length) return false;
  return block.anyOf.some((clause) =>
    clauseMatches(clause, shares, tradedSector, levelBefore),
  );
}

/**
 * Full traded-sector row for the chosen side (quantity does not scale).
 * Deltas are exactly the matrix cells — must match the card face / mill FX.
 */
export function pressureDeltas(
  card: PriceReactionCard,
  primary: SectorId,
  _shares: number,
  side: TradeSide,
): SectorDelta[] {
  const row = card.matrix[primary];
  const out: SectorDelta[] = [];
  for (const sector of SECTOR_IDS) {
    const cell = row[sector] ?? emptyCell();
    const delta = side === "buy" ? cell.buy : cell.sell;
    if (delta !== 0) out.push({ sector, delta });
  }
  return out;
}

export type PrResolveContext = {
  side: TradeSide;
  shares: number;
  tradedSector: SectorId;
  levelBefore: number;
  /** If set, skip cards that would make full buy unaffordable after deltas. */
  canAffordAfter?: (card: PriceReactionCard, deltas: SectorDelta[]) => boolean;
};

/**
 * Shuffle all 100, walk without replacement until first eligible match.
 * Rejected cards are skipped for this order only; pool is not persisted.
 */
export function resolveMatchingPr(
  ctx: PrResolveContext,
  rng: () => number,
  preferredOrder?: string[],
): { card: PriceReactionCard; deltas: SectorDelta[]; rejected: string[] } {
  const pool = preferredOrder?.length
    ? [
        ...preferredOrder,
        ...PRICE_REACTIONS.map((c) => c.id).filter(
          (id) => !preferredOrder.includes(id),
        ),
      ]
    : shuffleInPlace(
        PRICE_REACTIONS.map((c) => c.id),
        rng,
      );

  const rejected: string[] = [];
  for (const id of pool) {
    const card = prById(id);
    if (
      !cardMatchesSide(
        card,
        ctx.side,
        ctx.shares,
        ctx.tradedSector,
        ctx.levelBefore,
      )
    ) {
      rejected.push(id);
      continue;
    }
    const deltas = pressureDeltas(card, ctx.tradedSector, ctx.shares, ctx.side);
    if (ctx.canAffordAfter && !ctx.canAffordAfter(card, deltas)) {
      rejected.push(id);
      continue;
    }
    return { card, deltas, rejected };
  }

  throw new Error("No eligible Price Reaction card for order");
}

export function marksLabel(m: number): string {
  if (m === 0) return "";
  if (m > 0) return "+".repeat(Math.min(5, m));
  return "−".repeat(Math.min(5, -m));
}
