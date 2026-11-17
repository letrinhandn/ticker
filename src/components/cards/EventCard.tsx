"use client";

import { BOARD, sectorForTile } from "@/lib/game/board";
import { useT } from "@/lib/i18n";
import { money } from "@/lib/money";
import type {
  LockedOrder,
  PriceReactionCard,
  RegimeCard,
  SectorDelta,
} from "@/shared/types";
import { MarketNewsDeckCard, PriceReactionDeckCard } from "./DeckCards";

/** Deck event shell — no Continue / “resolving” footer (FX portals dismiss). */
export function EventCard({
  deck,
  title,
  text,
  deltas,
  settleLine,
  card,
  regimeCard,
  order,
}: {
  deck: "price_reaction" | "regime";
  title?: string;
  text?: string;
  deltas?: SectorDelta[];
  settleLine?: string;
  card?: PriceReactionCard;
  regimeCard?: RegimeCard;
  order?: LockedOrder;
  /** @deprecated Ignored — no continue button on event cards. */
  onDismiss?: () => void;
}) {
  const t = useT();
  const isPr = deck === "price_reaction";
  const primary =
    isPr && order ? sectorForTile(BOARD[order.tileIndex]!) : null;

  const settle = settleLine ? (
    <p className="db-event-settle">{settleLine}</p>
  ) : null;

  if (!isPr) {
    const news =
      regimeCard ??
      ({
        id: "NEWS",
        title: title ?? t("deck.marketNews"),
        text: text ?? "",
        regime: "bull" as const,
        shocks: Object.fromEntries(
          (deltas ?? []).map((d) => [d.sector, d.delta]),
        ),
      } satisfies Pick<
        RegimeCard,
        "id" | "title" | "text" | "regime" | "shocks"
      >);

    return (
      <div className="modal-overlay event-overlay" role="dialog" aria-modal="true">
        <MarketNewsDeckCard
          className="is-event is-from-mill"
          card={news}
          footer={settle}
        />
      </div>
    );
  }

  if (!card) return null;

  return (
    <div className="modal-overlay event-overlay" role="dialog" aria-modal="true">
      <PriceReactionDeckCard
        className="is-event is-from-mill"
        card={card}
        primary={primary}
        applied={deltas ?? []}
        side={order?.side ?? null}
        footer={settle}
      />
    </div>
  );
}

export function settleSummary(
  t: (key: "settle.failed" | "settle.buy" | "settle.sell", vars?: Record<string, string | number>) => string,
  side: "buy" | "sell",
  shares: number,
  settlePrice: number,
  totalCash: number,
): string {
  if (shares <= 0) return t("settle.failed");
  return t(side === "buy" ? "settle.buy" : "settle.sell", {
    shares,
    price: money(settlePrice),
    total: money(totalCash),
  });
}
