"use client";

import { useState, type ReactNode } from "react";
import { REGIME_CARDS } from "@/lib/game/content/regimes";
import { MarketNewsDeckCard } from "./DeckCards";

/** Inspect: one random designed Market News card (same UI as deck pile). */
export function MarketNewsTileCard({ footer }: { footer?: ReactNode }) {
  const [card] = useState(
    () => REGIME_CARDS[Math.floor(Math.random() * REGIME_CARDS.length)]!,
  );
  return (
    <>
      <MarketNewsDeckCard className="is-event" card={card} />
      {footer}
    </>
  );
}
