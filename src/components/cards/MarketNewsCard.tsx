"use client";

import { useMemo, type ReactNode } from "react";
import { REGIME_CARDS } from "@/lib/game/content/regimes";
import { useT } from "@/lib/i18n";
import type { MarketRegime, RegimeCard, SectorDelta, SectorId } from "@/shared/types";
import { MarketNewsDeckCard } from "./DeckCards";

function shocksFromDeltas(
  deltas?: SectorDelta[],
): Partial<Record<SectorId, number>> {
  if (!deltas) return {};
  return Object.fromEntries(deltas.map((d) => [d.sector, d.delta]));
}

/** Inspect: one random designed Market News card (same UI as deck pile). */
export function MarketNewsTileCard({ footer }: { footer?: ReactNode }) {
  const card = useMemo(
    () => REGIME_CARDS[Math.floor(Math.random() * REGIME_CARDS.length)]!,
    [],
  );
  return (
    <>
      <MarketNewsDeckCard className="is-event" card={card} />
      {footer}
    </>
  );
}

/** Drawn Market News event, same shell as deck browser. */
export function MarketNewsEventCard({
  title,
  text,
  market,
  deltas,
  cardId = "NEWS",
}: {
  title?: string;
  text: string;
  market?: MarketRegime;
  deltas?: SectorDelta[];
  cardId?: string;
  /** @deprecated Ignored — no continue / resolving chrome. */
  onDismiss?: () => void;
  preview?: boolean;
}) {
  const t = useT();
  const tone = market === "bear" ? "bear" : "bull";
  const card: Pick<RegimeCard, "id" | "title" | "text" | "regime" | "shocks"> = {
    id: cardId,
    title: title ?? t("deck.marketNews"),
    text,
    regime: market ?? tone,
    shocks: shocksFromDeltas(deltas),
  };

  return <MarketNewsDeckCard className="is-event" card={card} />;
}
