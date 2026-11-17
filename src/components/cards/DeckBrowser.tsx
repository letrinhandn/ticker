"use client";

import { createPortal } from "react-dom";
import { PRICE_REACTIONS } from "@/lib/game/content/priceReactions";
import { REGIME_CARDS } from "@/lib/game/content/regimes";
import type { GameState, PriceReactionCard, RegimeCard } from "@/shared/types";
import { useT } from "@/lib/i18n";
import { MarketNewsDeckCard, PriceReactionDeckCard } from "./DeckCards";

export function DeckBrowser({
  kind,
  game,
  onClose,
}: {
  kind: "pr" | "regime";
  game: GameState;
  onClose: () => void;
}) {
  const t = useT();
  const isPr = kind === "pr";
  const remaining = isPr
    ? null
    : new Set(game.regimeDeck);
  const discarded = isPr
    ? null
    : new Set(game.regimeDiscard);

  const cards = isPr
    ? [...PRICE_REACTIONS].sort((a, b) =>
        a.id.localeCompare(b.id, undefined, { numeric: true }),
      )
    : [...REGIME_CARDS].sort((a, b) =>
        a.id.localeCompare(b.id, undefined, { numeric: true }),
      );

  const title = isPr ? t("deck.priceReaction") : t("deck.marketNews");

  return createPortal(
    <div
      className="modal-overlay db-overlay is-browse"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`db-shell ${isPr ? "is-pr" : "is-regime"}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="db-head">
          <div className="db-head-copy">
            <p className="db-kicker">{title}</p>
            <h2 className="db-title">
              {t("deck.cardsCount", { count: cards.length })}
            </h2>
          </div>
          <button type="button" className="db-close" onClick={onClose}>
            {t("common.close")}
          </button>
        </header>

        <div className={`db-scroll${isPr ? "" : " is-regime-grid"}`}>
          {cards.map((card) => {
            if (isPr) {
              const pr = card as PriceReactionCard;
              return (
                <PriceReactionDeckCard
                  key={pr.id}
                  card={pr}
                />
              );
            }

            const rg = card as RegimeCard;
            const inDeck = remaining!.has(rg.id);
            const used = discarded!.has(rg.id);
            const status = inDeck ? undefined : used ? t("deck.drawn") : undefined;
            return (
              <MarketNewsDeckCard
                key={rg.id}
                card={rg}
                status={status}
                className={inDeck ? "" : "is-spent"}
              />
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
