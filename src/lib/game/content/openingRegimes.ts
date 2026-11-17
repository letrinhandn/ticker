/**
 * V5 opening: 1d6 — faces 1–5 apply presets (from real Market News ids);
 * face 6 keeps all sectors at 0.
 */
import type { MarketRegime, SectorId } from "@/shared/types";
import raw from "@/content/openingRegimes.json";

export type OpeningPreset = {
  die: number;
  sourceNewsId: string;
  nameEn: string;
  nameVi: string;
  regime: MarketRegime;
  shocks: Partial<Record<SectorId, number>>;
};

export const OPENING_PRESETS: OpeningPreset[] = (
  raw.presets as OpeningPreset[]
).map((p) => ({
  ...p,
  regime: p.regime === "bear" ? "bear" : "bull",
}));

export function openingPresetForDie(die: number): OpeningPreset | null {
  if (die < 1 || die > 5) return null;
  return OPENING_PRESETS.find((p) => p.die === die) ?? null;
}
