/**
 * Market News — 100 cards (50 bull / 50 bear) from EN/VI deck JSON.
 */
import type { MarketRegime, RegimeCard, SectorId } from "@/shared/types";
import { SECTOR_CODE, SECTOR_IDS } from "../board";
import { shuffleInPlace } from "./shuffle";
import raw from "@/content/marketNews100.json";

const CODE_TO_SECTOR = Object.fromEntries(
  SECTOR_IDS.map((id) => [SECTOR_CODE[id], id]),
) as Record<string, SectorId>;

type RawCard = {
  id: string;
  name?: string;
  nameEn?: string;
  nameVi?: string;
  market: MarketRegime;
  headlineVi?: string;
  headlineEn?: string;
  deltaLevelsBySector?: Record<string, number>;
};

function parseCard(rawCard: RawCard): RegimeCard {
  const shocks: Partial<Record<SectorId, number>> = {};
  for (const [code, delta] of Object.entries(
    rawCard.deltaLevelsBySector ?? {},
  )) {
    const sector = CODE_TO_SECTOR[code];
    if (!sector || !delta) continue;
    shocks[sector] = delta;
  }

  return {
    id: rawCard.id,
    title: rawCard.nameEn ?? rawCard.name ?? rawCard.id,
    titleVi: rawCard.nameVi,
    regime: rawCard.market === "bear" ? "bear" : "bull",
    shocks,
    text: rawCard.headlineVi ?? "",
    textEn: rawCard.headlineEn,
  };
}

export const REGIME_CARDS: RegimeCard[] = (raw.cards as unknown as RawCard[]).map(
  parseCard,
);

const BY_ID = Object.fromEntries(
  REGIME_CARDS.map((c) => [c.id, c]),
) as Record<string, RegimeCard>;

export function regimeById(id: string): RegimeCard {
  const card = BY_ID[id];
  if (!card) throw new Error(`Unknown news card ${id}`);
  return card;
}

export function freshRegimeDeck(rng: () => number): string[] {
  return shuffleInPlace(
    REGIME_CARDS.map((c) => c.id),
    rng,
  );
}

/** V5 News tile: always sample from the full 100 (with replacement). */
export function drawRandomRegime(rng: () => number): RegimeCard {
  const i = Math.floor(rng() * REGIME_CARDS.length);
  return REGIME_CARDS[i] ?? REGIME_CARDS[0]!;
}

export function emptySectorIndex(): Record<SectorId, number> {
  return Object.fromEntries(SECTOR_IDS.map((s) => [s, 0])) as Record<
    SectorId,
    number
  >;
}

export function emptySectorHistory(): Record<SectorId, number[]> {
  return Object.fromEntries(SECTOR_IDS.map((s) => [s, [] as number[]])) as Record<
    SectorId,
    number[]
  >;
}
