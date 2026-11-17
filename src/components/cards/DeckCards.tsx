"use client";

import {
  useId,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  GROUP_COLORS,
  SECTOR_CODE,
  SECTOR_IDS,
  SECTOR_LABELS,
} from "@/lib/game/board";
import { sectorNameKey, useLocale, useT } from "@/lib/i18n";
import type {
  PriceReactionCard,
  RegimeCard,
  SectorDelta,
  SectorId,
} from "@/shared/types";

/**
 * Physical deck size — same for Price Reaction & Market News (PR matrix is the standard).
 * Portrait 3:4; content scrolls inside if needed.
 */
export const PCARD_SIZE_STYLE: CSSProperties = {
  width: "min(22.5rem, calc(100vw - 1.5rem), 68vh)",
  aspectRatio: "3 / 4",
  maxHeight: "min(85vh, 36rem)",
};

/** Pixel box for the event/mill card — matches `.pcard.is-event` / PCARD_SIZE_STYLE. */
export function eventCardCenterRect(win = typeof window !== "undefined" ? window : null) {
  if (!win) return { x: 0, y: 0, w: 360, h: 480 };
  const rem =
    parseFloat(getComputedStyle(win.document.documentElement).fontSize) || 16;
  let w = Math.min(22.5 * rem, win.innerWidth - 1.5 * rem, win.innerHeight * 0.68);
  let h = w * (4 / 3);
  const maxH = Math.min(win.innerHeight * 0.85, 36 * rem);
  if (h > maxH) {
    h = maxH;
    w = h * (3 / 4);
  }
  return {
    w,
    h,
    x: win.innerWidth / 2 - w / 2,
    y: win.innerHeight / 2 - h / 2,
  };
}

/** Soft premium geometry for dark card backs — portrait 3:4 (same as physical card). */
export function MonopolyDeckBack(_props?: { variant?: "pr" | "news" }) {
  const uid = useId().replace(/:/g, "");
  const latticeId = `deckLattice-${uid}`;
  return (
    <svg
      className="deck-mono-blocks"
      viewBox="0 0 75 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <pattern
          id={latticeId}
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M8 0H0V8"
            fill="none"
            stroke="rgba(247,244,239,0.08)"
            strokeWidth="0.5"
          />
        </pattern>
      </defs>
      <rect x="0" y="0" width="75" height="100" fill={`url(#${latticeId})`} />
      <rect
        x="3.5"
        y="3.5"
        width="68"
        height="93"
        rx="2.5"
        fill="none"
        stroke="rgba(247,244,239,0.16)"
        strokeWidth="0.85"
      />
      <rect
        x="7.5"
        y="7.5"
        width="60"
        height="85"
        rx="1.8"
        fill="none"
        stroke="rgba(247,244,239,0.11)"
        strokeWidth="0.65"
      />
      <path
        d="M13 13h10M13 13v10"
        fill="none"
        stroke="rgba(247,244,239,0.24)"
        strokeWidth="0.95"
        strokeLinecap="square"
      />
      <path
        d="M62 13h-10M62 13v10"
        fill="none"
        stroke="rgba(247,244,239,0.24)"
        strokeWidth="0.95"
        strokeLinecap="square"
      />
      <path
        d="M13 87h10M13 87v-10"
        fill="none"
        stroke="rgba(247,244,239,0.24)"
        strokeWidth="0.95"
        strokeLinecap="square"
      />
      <path
        d="M62 87h-10M62 87v-10"
        fill="none"
        stroke="rgba(247,244,239,0.24)"
        strokeWidth="0.95"
        strokeLinecap="square"
      />
      <ellipse
        cx="37.5"
        cy="50"
        rx="16"
        ry="16"
        fill="none"
        stroke="rgba(247,244,239,0.1)"
        strokeWidth="0.85"
      />
    </svg>
  );
}

/** Shared physical card back — used by flippable cards and board piles. */
export function DeckCardBackFace({
  variant,
  label,
}: {
  variant: "pr" | "news";
  label: string;
}) {
  return (
    <div className="pcard-back-inner">
      <MonopolyDeckBack variant={variant} />
      <div className={`pcard-back-mark${variant === "news" ? " is-news" : " is-pr"}`}>
        {variant === "pr" ? (
          <>
            <span className="pcard-back-art" aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="pcard-back-candles"
                src="/decks/candles.svg"
                alt=""
                draggable={false}
              />
            </span>
            <span className="pcard-back-label">{label}</span>
          </>
        ) : (
          <span className="pcard-back-news-stack">
            <svg
              className="pcard-back-animal pcard-back-bull"
              viewBox="0 0 512 512"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden
            >
              <path
                fill="#22c55e"
                d="M68.596 28.182c-86.767 50.67-51.027 136.884 123.35 136.884l2.835-70.433c-71.07 14-169.105 15.57-126.184-66.45zm378.455 0c42.92 82.022-55.114 80.45-126.185 66.45l2.836 70.434c174.378 0 210.117-86.213 123.35-136.884zM174.206 220.768c-3.798.104-7.758.785-11.816 2.087-1.887 29.822 11.63 50.308 48.516 39.88-.462-26.26-16.194-42.53-36.7-41.967zm167.213 0c-20.507-.563-36.24 15.707-36.7 41.966 36.886 10.43 50.404-10.057 48.518-39.88-4.058-1.3-8.02-1.982-11.818-2.086zm-53.123 162.7l-10.793 15.266c15.535 10.978 19.19 32.196 8.21 47.73C274.736 462 253.533 465.64 238 454.663c-15.535-10.978-19.19-32.193-8.21-47.728 2.03-2.875 4.483-5.42 7.288-7.543l-11.263-14.894c-4.34 3.283-8.153 7.203-11.292 11.645-16.805 23.784-11.098 56.982 12.685 73.788 23.784 16.806 56.956 11.098 73.762-12.686 16.806-23.783 11.11-56.967-12.672-73.773z"
              />
            </svg>
            <span className="pcard-back-label">{label}</span>
            <svg
              className="pcard-back-animal pcard-back-bear"
              viewBox="0 0 512 512"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden
            >
              <path
                fill="#ef4444"
                d="M220.41 35.389c-.584-.175-9.216 1.425-18.76 7.976-8.948 6.143-18.914 15.31-27.283 25.137l.34.268c-6.134 7.797-13.129 16.816-17.613 25.767-4.485 8.951-6.294 17.19-3.989 24.71l-17.209 5.274c-4.144-13.518-.522-26.817 5.104-38.046 2.208-4.408 4.753-8.587 7.398-12.52C105.378 74.11 62.33 71.25 18 66.748v409.828a264.891 264.891 0 0 1 24.8-19.922l1.901-1.345 2.313-.254c24.034-2.65 55.821-6.651 84.908-15.803 29.086-9.152 54.934-23.401 68.633-45.191l2.558-4.073 4.809-.134c91.21-2.547 140.126-19.862 193.652-50.153.126-.095.252-.199.377-.295-6.874-.376-14.493-.65-22.334-.617-20.444.086-42.1 3.08-51.367 8.973l-9.658-15.188c16.106-10.242 39.29-11.694 60.949-11.785 15.73-.066 30.683 1.026 40.254 1.797 6.938-7.739 13.533-16.503 19.18-25.514 5.066-8.086 9.33-16.386 12.537-24.177-3.821-.55-7.395-1.642-10.633-3.258-8.283-4.134-14.026-11.447-16.754-19.596-3.827-11.432-2.087-24.798 5.268-35.777l-64.641-23.35.277-6.598c.396-9.422-6.387-27.053-14.601-34.712-21.568-20.112-46.91-21.58-78.06-33.93l-3.554-1.408-1.453-3.536c-10.662-25.924-17.06-44.024-23.47-55.5-6.412-11.475-11.574-16.287-23.48-19.841zm-5.808 20.82l9.84 15.072c-29.07 18.978-29.771 34.937-31.23 51.65l-17.93-1.562c1.5-17.208 5.882-43.33 39.32-65.16zM119.6 135.473l8.119 16.064c-42.266 21.357-60.741 47.237-65.88 70.451 14.366-11.279 29.7-17.184 50.218-16.46l15.238.538-7.834 13.08c-17.268 28.834-22.552 42.534-26.24 59.696 4.017-1.528 8.007-2.635 12.119-2.979 9.78-.818 19.142 2.28 29.105 7.746l9.5 5.211-6.869 8.383c-9.978 12.178-13.966 20.02-15.224 27.56-.477 2.856-.454 5.974-.198 9.333 2.711-2.798 5.58-5.305 8.942-7.198 9.125-5.137 19.745-5.825 33.097-4.632l-1.601 17.927c-11.9-1.063-18.132-.162-22.666 2.391-4.534 2.553-8.91 7.798-14.88 18.39l-11.05 19.614-5.516-21.826c-3.535-13.99-5.842-25.216-3.882-36.961 1.486-8.91 5.434-17.37 12.002-26.742-3.422-1.103-6.376-1.5-9.258-1.258-5.244.439-11.572 3.057-20.965 9.203l-17.365 11.361 3.572-20.441c4.283-24.513 7.539-40.242 23.588-69.49-14.037 2.56-23.415 10.322-37.408 25.492l-13.442 14.57-2.12-19.709c-3.829-35.558 16.816-78.954 76.898-109.314zm143.707 26.976c17.788 7.852 39.24 14.301 56.859 16.617l3.707 17.616c-3.852.81-7.24.644-10.861.07-1.363 9.026-9.537 15.736-18.74 15.736-10.089 0-18.946-8.06-18.946-18.396 0-2.45.511-4.766 1.404-6.883-8.85-3.702-23.717-6.978-28.798-14.723 5.796-2.514 14.755-10.553 15.375-10.037zM443.633 225.4c-3.758 6.287-4.294 13.381-2.438 18.928 1.396 4.17 3.941 7.317 7.721 9.203 2.142 1.07 4.803 1.797 8.147 1.823.303-1.51.546-2.968.707-4.348-.926-6.793-6.555-16.61-14.137-25.606z"
              />
            </svg>
          </span>
        )}
      </div>
    </div>
  );
}

function FlippablePcard({
  variant,
  className = "",
  front,
  backLabel,
  /** Controlled back-face. `true` = show back (same as tap-flip). */
  forceFlipped,
  interactive = true,
}: {
  variant: "pr" | "news";
  className?: string;
  front: ReactNode;
  backLabel: string;
  forceFlipped?: boolean;
  interactive?: boolean;
}) {
  const t = useT();
  const [flipped, setFlipped] = useState(false);
  const showBack = forceFlipped ?? flipped;

  return (
    <article
      className={`pcard pcard-shell pcard-${variant}${showBack ? " is-flipped" : ""} ${className}`.trim()}
      style={PCARD_SIZE_STYLE}
      onClick={interactive ? () => setFlipped((v) => !v) : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setFlipped((v) => !v);
              }
            }
          : undefined
      }
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? showBack : undefined}
      aria-label={
        interactive
          ? showBack
            ? t("deck.flipFront")
            : t("deck.flipBack")
          : undefined
      }
      title={interactive ? t("deck.tapFlipCard") : undefined}
      aria-hidden={!interactive ? true : undefined}
    >
      <div className="pcard-flipper">
        <div className="pcard-face pcard-face-front">{front}</div>
        <div className="pcard-face pcard-face-back" aria-hidden={!showBack}>
          <DeckCardBackFace variant={variant} label={backLabel} />
        </div>
      </div>
    </article>
  );
}

/** JSON: số trong ô = mức ngành (±). 0 = để trống. */
function formatLevel(mark: number) {
  if (mark === 0) return "";
  return mark > 0 ? `+${mark}` : `${mark}`;
}

function deltaClass(mark: number) {
  if (mark > 0) return "is-up";
  if (mark < 0) return "is-down";
  return "is-zero";
}

function sectorChipStyle(id: SectorId) {
  const group = SECTOR_LABELS.find((s) => s.sector === id)?.group ?? "none";
  const light = group === "yellow" || group === "lightblue";
  return {
    background: GROUP_COLORS[group],
    color: light ? "#1a1a1a" : "#fff",
  };
}

function DualMarks({ buy, sell }: { buy: number; sell: number }) {
  if (buy === 0 && sell === 0) {
    return <span className="pr-dual-empty" />;
  }
  return (
    <>
      <span className={`pr-dual pr-dual-buy ${deltaClass(buy)}`}>
        {formatLevel(buy) || "\u00a0"}
      </span>
      <span className={`pr-dual pr-dual-sell ${deltaClass(sell)}`}>
        {formatLevel(sell) || "\u00a0"}
      </span>
    </>
  );
}

export function MiniPrMatrix({
  card,
  primary = null,
  applied = [],
  side = null,
}: {
  card: PriceReactionCard;
  primary?: SectorId | null;
  applied?: SectorDelta[];
  side?: "buy" | "sell" | null;
}) {
  const t = useT();
  const appliedMap = new Map(applied.map((d) => [d.sector, d.delta]));

  const axisLabelStyle = {
    display: "grid",
    placeItems: "center",
    fontSize: "0.58rem",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: "rgba(17,17,17,0.55)",
    lineHeight: 1,
  };

  return (
    <div className="db-matrix-wrap">
      <div
        className="db-matrix"
        aria-hidden
        style={{
          // col1: row sectors | cols 2-9: cells | col10: Giao dịch
          // row1: col sectors | rows 2-9: cells | row10: Phản ứng
          // Data rows use 1fr so the matrix fills the card body evenly.
          width: "100%",
          maxWidth: "100%",
          height: "100%",
          boxSizing: "border-box",
          gridTemplateColumns: "1.25rem repeat(8, minmax(0, 1fr)) 0.95rem",
          gridTemplateRows: "1.2rem repeat(8, minmax(0, 1fr)) 1rem",
          gap: "0.14rem",
        }}
      >
        <span
          className="db-matrix-axis db-matrix-corner"
          style={{ gridColumn: 1, gridRow: 1 }}
        />
        {SECTOR_IDS.map((col, i) => (
          <span
            key={`h-${col}`}
            className="db-matrix-axis is-sector"
            title={t(sectorNameKey(col))}
            style={{
              ...sectorChipStyle(col),
              gridColumn: i + 2,
              gridRow: 1,
            }}
          >
            {SECTOR_CODE[col]}
          </span>
        ))}
        <span className="db-matrix-pad" style={{ gridColumn: 10, gridRow: 1 }} />

        {SECTOR_IDS.map((row, ri) => (
          <div key={row} className="db-matrix-row">
            <span
              className={`db-matrix-axis is-sector${primary === row ? " is-primary" : ""}`}
              title={t(sectorNameKey(row))}
              style={{
                ...sectorChipStyle(row),
                gridColumn: 1,
                gridRow: ri + 2,
              }}
            >
              {SECTOR_CODE[row]}
            </span>
            {SECTOR_IDS.map((col, ci) => {
              const cell = card.matrix[row]?.[col] ?? { buy: 0, sell: 0 };
              const { buy, sell } = cell;
              const diagonal = row === col;
              const hit = primary === row && appliedMap.has(col);
              const flat = buy === 0 && sell === 0;
              return (
                <span
                  key={`${row}-${col}`}
                  className={`db-matrix-cell${flat ? " is-flat" : ""}${diagonal ? " is-diag" : ""}${primary === row ? " is-row-live" : ""}${hit ? " is-applied" : ""}${side === "buy" ? " is-side-buy" : ""}${side === "sell" ? " is-side-sell" : ""}`}
                  style={{ gridColumn: ci + 2, gridRow: ri + 2 }}
                  title={
                    flat
                      ? t("deck.cellFlat", {
                          from: SECTOR_CODE[row],
                          to: SECTOR_CODE[col],
                        })
                      : t("deck.cellBuySell", {
                          from: SECTOR_CODE[row],
                          to: SECTOR_CODE[col],
                          buy: formatLevel(buy) || "0",
                          sell: formatLevel(sell) || "0",
                        })
                  }
                >
                  <DualMarks buy={buy} sell={sell} />
                </span>
              );
            })}
          </div>
        ))}

        <span
          className="db-matrix-ylab"
          title={t("deck.tradeAxisTitle")}
          style={{
            ...axisLabelStyle,
            gridColumn: 10,
            gridRow: "2 / 10",
            writingMode: "vertical-rl",
          }}
        >
          {t("deck.tradeAxis")}
        </span>

        <span className="db-matrix-pad" style={{ gridColumn: 1, gridRow: 10 }} />
        <span
          className="db-matrix-xlab"
          title={t("deck.reactAxisTitle")}
          style={{
            ...axisLabelStyle,
            gridColumn: "2 / 10",
            gridRow: 10,
          }}
        >
          {t("deck.reactAxis")}
        </span>
        <span className="db-matrix-pad" style={{ gridColumn: 10, gridRow: 10 }} />
      </div>
    </div>
  );
}

export function RegimeShocks({
  shocks,
}: {
  shocks: Partial<Record<SectorId, number>>;
}) {
  const t = useT();
  const entries = (Object.entries(shocks) as [SectorId, number][]).sort(
    (a, b) => Math.abs(b[1]) - Math.abs(a[1]),
  );
  if (entries.length === 0) return null;
  return (
    <ul className="db-shocks">
      {entries.map(([sector, delta]) => {
        const group =
          SECTOR_LABELS.find((s) => s.sector === sector)?.group ?? "none";
        const light = group === "yellow" || group === "lightblue";
        return (
          <li key={sector}>
            <span
              className="db-shock-swatch"
              style={{
                background: GROUP_COLORS[group],
                color: light ? "#1a1a1a" : "#fff",
              }}
            >
              {SECTOR_CODE[sector]}
            </span>
            <span className="db-shock-meta">
              <em>{t(sectorNameKey(sector))}</em>
              <strong className={delta > 0 ? "is-up" : "is-down"}>
                {formatLevel(delta)}
              </strong>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function PriceReactionDeckCard({
  card,
  primary = null,
  applied = [],
  side = null,
  footer,
  className = "",
  forceFlipped,
  interactive = true,
}: {
  card: PriceReactionCard;
  status?: string;
  primary?: SectorId | null;
  applied?: SectorDelta[];
  side?: "buy" | "sell" | null;
  footer?: ReactNode;
  className?: string;
  forceFlipped?: boolean;
  interactive?: boolean;
}) {
  const { locale } = useLocale();
  const t = useT();
  const title =
    locale === "vi" ? (card.titleVi ?? card.title) : card.title;
  const buySide = card.matchConditionsBySide.buy;
  const sellSide = card.matchConditionsBySide.sell;
  const buyLabel =
    locale === "vi"
      ? (buySide?.labelVi ?? buySide?.labelEn)
      : (buySide?.labelEn ?? buySide?.labelVi);
  const sellLabel =
    locale === "vi"
      ? (sellSide?.labelVi ?? sellSide?.labelEn)
      : (sellSide?.labelEn ?? sellSide?.labelVi);

  return (
    <FlippablePcard
      variant="pr"
      className={className}
      backLabel={t("deck.priceReaction")}
      forceFlipped={forceFlipped}
      interactive={interactive}
      front={
        <>
          <header className="pcard-banner">
            <h3 className="pcard-name">{title}</h3>
            {buyLabel || sellLabel ? (
              <div className="pcard-match">
                <p className="pcard-match-label">{t("deck.conditions")}</p>
                {buyLabel ? (
                  <p className="pcard-match-line is-buy">
                    <span className="pcard-side">{t("deck.buy")}</span>{" "}
                    {buyLabel}
                  </p>
                ) : null}
                {sellLabel ? (
                  <p className="pcard-match-line is-sell">
                    <span className="pcard-side">{t("deck.sell")}</span>{" "}
                    {sellLabel}
                  </p>
                ) : null}
              </div>
            ) : null}
          </header>

          <div className="pcard-body">
            <MiniPrMatrix
              card={card}
              primary={primary}
              applied={applied}
              side={side}
            />
            {footer ? (
              <div
                className="pcard-footer"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                {footer}
              </div>
            ) : null}
          </div>
        </>
      }
    />
  );
}

export function MarketNewsDeckCard({
  card,
  status,
  footer,
  className = "",
  forceFlipped,
  interactive = true,
}: {
  card: Pick<RegimeCard, "id" | "title" | "text" | "regime" | "shocks"> & {
    titleVi?: string;
    textEn?: string;
  };
  status?: string;
  footer?: ReactNode;
  className?: string;
  forceFlipped?: boolean;
  interactive?: boolean;
}) {
  const { locale } = useLocale();
  const t = useT();
  const tone = card.regime === "bear" ? "bear" : "bull";
  const title =
    locale === "vi" ? (card.titleVi ?? card.title) : card.title;
  const body =
    locale === "vi"
      ? (card.text || card.textEn || "")
      : (card.textEn || card.text || "");
  const chipStyle =
    tone === "bull"
      ? {
          display: "inline-grid",
          placeItems: "center",
          minWidth: "3.6rem",
          padding: "0.28rem 0.65rem",
          borderRadius: "4px",
          fontSize: "0.62rem",
          fontWeight: 800,
          letterSpacing: "0.1em",
          lineHeight: 1,
          color: "#14532d",
          background: "rgba(34, 197, 94, 0.28)",
        }
      : {
          display: "inline-grid",
          placeItems: "center",
          minWidth: "3.6rem",
          padding: "0.28rem 0.65rem",
          borderRadius: "4px",
          fontSize: "0.62rem",
          fontWeight: 800,
          letterSpacing: "0.1em",
          lineHeight: 1,
          color: "#7f1d1d",
          background: "rgba(239, 68, 68, 0.24)",
        };

  return (
    <FlippablePcard
      variant="news"
      className={`is-${tone} ${className}`.trim()}
      backLabel={t("deck.marketNews")}
      forceFlipped={forceFlipped}
      interactive={interactive}
      front={
        <>
          <header className="pcard-banner">
            <h3 className="pcard-name" style={{ color: "#111" }}>
              {title}
            </h3>
            <div
              className="pcard-stats"
              style={{
                marginTop: "0.45rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.4rem",
              }}
            >
              <span className={`pcard-regime-chip is-${tone}`} style={chipStyle}>
                {tone === "bull" ? "BULL" : "BEAR"}
              </span>
              {status ? (
                <span className="pcard-status" style={{ color: "#111" }}>
                  {status}
                </span>
              ) : null}
            </div>
          </header>

          <div
            className="pcard-body pcard-news-body"
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              gap: "0.65rem",
              padding: "0.65rem 0.7rem 0.8rem",
              textAlign: "center",
            }}
          >
            {body ? (
              <p
                className="pcard-sub is-body"
                style={{
                  margin: 0,
                  textAlign: "center",
                  width: "100%",
                  maxWidth: "26ch",
                }}
              >
                {body}
              </p>
            ) : null}
            <RegimeShocks shocks={card.shocks} />
            {footer ? (
              <div
                className="pcard-footer"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                {footer}
              </div>
            ) : null}
          </div>
        </>
      }
    />
  );
}
