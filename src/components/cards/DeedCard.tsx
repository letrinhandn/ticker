"use client";

import {
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  BOARD,
  GROUP_COLORS,
  SECTOR_CODE,
  SECTOR_LABELS,
  sectorForTile,
} from "@/lib/game/board";
import { FUNDS_BY_TILE, fundSleeveValue } from "@/lib/game/content/funds";
import { money } from "@/lib/money";
import type { GameState } from "@/shared/types";
import { CompanyLogo } from "./CompanyLogo";
import { EtfPie } from "./EtfPie";
import { MarketNewsTileCard } from "./MarketNewsCard";
import { CornerDeedCard } from "./CornerDeedCard";
import { TaxCard } from "./TaxCard";
import {
  companyByTileIndex,
  revenueAtLevel,
} from "@/lib/game/content/companies";
import { fundNameKey, sectorNameKey, useT } from "@/lib/i18n";
import { feePerShare, sharePrice } from "@/lib/game/pricing";
import { useGameFxOptional } from "@/lib/fx/GameFxContext";
import { HALT_FINE } from "@/shared/types";

const faceBase: CSSProperties = {
  backfaceVisibility: "hidden",
  WebkitBackfaceVisibility: "hidden",
  borderRadius: 12,
  border: "1px solid rgba(20,20,20,0.85)",
  overflow: "hidden",
  boxShadow:
    "0 1px 0 rgba(255,255,255,0.5) inset, 0 16px 36px rgba(0,0,0,0.38)",
};

export function DeedCard({
  tileIndex,
  compact = false,
  footer,
  game,
  forceFace,
  interactive,
}: {
  tileIndex: number;
  compact?: boolean;
  footer?: ReactNode;
  game?: GameState | null;
  /** Tutorial / static: show only one face, no flip shell. */
  forceFace?: "front" | "back";
  interactive?: boolean;
}) {
  const t = useT();
  const fx = useGameFxOptional();
  const [flipped, setFlipped] = useState(false);
  const tile = BOARD[tileIndex];
  if (!tile) return null;

  const band = tile.group !== "none" ? GROUP_COLORS[tile.group] : "#333";
  const lightBand = tile.group === "yellow" || tile.group === "lightblue";
  const isCompany = tile.kind === "company";
  const isEtf = tile.kind === "etf";
  const listed = isCompany || isEtf;
  const fund = isEtf ? FUNDS_BY_TILE[tileIndex] : undefined;
  const company = isCompany ? companyByTileIndex(tileIndex) : undefined;
  const sector = sectorForTile(tile);
  // Use animated peg level — live sectorIndex jumps on PR before the card flips.
  const sectorIdx = sector
    ? (fx?.sectorVisual[sector] ?? game?.sectorIndex[sector] ?? 0)
    : 0;
  const p0 = company?.basePricePerShareM ?? tile.price ?? 0;
  const fee =
    isCompany && p0
      ? feePerShare(p0, company?.visitFeePerShareM ?? tile.visitFeePerShare)
      : 0;
  const revenue = company?.revenueBasePerShareM ?? tile.revenueBasePerShare ?? 0;
  const sectorMeta = SECTOR_LABELS.find((s) => s.group === tile.group);
  const sectorLabel =
    tile.kind === "etf"
      ? t("kind.etf")
      : tile.kind === "free" ||
          tile.kind === "halt" ||
          tile.kind === "goto_halt"
        ? t("kind.corner")
        : sectorMeta
          ? t(sectorNameKey(sectorMeta.sector))
          : t("kind.company");
  const canFlipBase = isCompany && !compact && p0 > 0;
  const canFlip =
    canFlipBase && forceFace == null && interactive !== false;
  const showFront = forceFace !== "back";
  const staticBackOnly = forceFace === "back";
  const title = tile.ticker ?? tile.name;
  const displayName =
    isEtf && fund ? t(fundNameKey(fund.id)) : tile.name;
  const priceAtLevel = (idx: number) =>
    company?.pricePerShareByLevelM[idx] ?? sharePrice(p0, idx);

  const specialNote = (() => {
    if (listed) return null;
    if (tile.kind === "tax") {
      return t("deed.noteTax", {
        amount: money(tile.taxAmount ?? tile.price ?? 0),
      });
    }
    if (tile.kind === "free") {
      return t("deed.noteFree");
    }
    if (tile.kind === "halt") {
      return t("deed.noteHalt", { amount: money(HALT_FINE) });
    }
    if (tile.kind === "goto_halt") {
      return t("deed.noteGoto");
    }
    if (tile.kind === "go") {
      return t("deed.noteGo");
    }
    return null;
  })();

  if (tile.kind === "regime") {
    return <MarketNewsTileCard footer={footer} />;
  }

  if (tile.kind === "tax") {
    const amount = tile.taxAmount ?? tile.price ?? 0;
    const kind = tile.index === 38 || amount >= 200 ? "wealth" : "income";
    return (
      <TaxCard
        amount={amount}
        kind={kind}
        footer={footer}
        compact={compact}
      />
    );
  }

  if (
    tile.kind === "go" ||
    tile.kind === "free" ||
    tile.kind === "halt" ||
    tile.kind === "goto_halt"
  ) {
    return (
      <CornerDeedCard
        variant={tile.kind}
        footer={footer}
        compact={compact}
      />
    );
  }

  const toggleFlip = (e: MouseEvent | KeyboardEvent) => {
    e.stopPropagation();
    setFlipped((v) => !v);
  };

  const flipHandlers = canFlip
    ? {
        role: "button" as const,
        tabIndex: 0,
        "aria-pressed": flipped,
        "aria-label": flipped
          ? t("deed.flipBack", { title })
          : t("deed.flipFront", { name: displayName }),
        onClick: toggleFlip,
        onKeyDown: (e: KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleFlip(e);
          }
        },
      }
    : {};

  return (
    <article
      className={`deed-card ${compact ? "deed-compact" : ""} ${listed ? "is-listed" : ""}${flipped && forceFace == null ? " is-flipped" : ""}${lightBand ? " is-light-band" : ""}${forceFace ? " is-static-face" : ""}`}
      style={{
        ["--deed-band" as string]: band,
        perspective: canFlip ? 1200 : undefined,
      }}
    >
      <div
        className={`deed-flip${canFlip ? " is-interactive" : ""}`}
        style={{
          position: "relative",
          transformStyle: forceFace ? undefined : "preserve-3d",
          WebkitTransformStyle: forceFace ? undefined : "preserve-3d",
          transition: forceFace
            ? undefined
            : "transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)",
          transform:
            forceFace != null
              ? undefined
              : flipped
                ? "rotateY(180deg)"
                : "rotateY(0deg)",
          cursor: canFlip ? "pointer" : undefined,
        }}
        {...flipHandlers}
      >
        {showFront ? (
        <div
          className="deed-face deed-front"
          aria-hidden={forceFace == null ? flipped : false}
          style={{
            ...faceBase,
            position: "relative",
            background: "linear-gradient(180deg, #fffdf8 0%, #f3ecdf 100%)",
            color: "#1a1a1a",
            pointerEvents:
              forceFace == null && flipped ? "none" : "auto",
          }}
        >
          <header className="deed-header">
            <p className="deed-eyebrow">{sectorLabel}</p>
            <h3 className="deed-title">{displayName}</h3>
            {tile.ticker ? <span className="deed-chip">{tile.ticker}</span> : null}
          </header>

          <div className="deed-body">
            {tile.logo && (
              <CompanyLogo
                src={tile.logo}
                alt={tile.ticker ?? tile.name}
                className="deed-logo"
              />
            )}

            {isCompany && (
              <>
                <ul className="deed-rows">
                  <li>
                    <span>{t("deed.basePrice")}</span>
                    <strong>{money(p0)}</strong>
                  </li>
                  <li>
                    <span>{t("deed.visitFee")}</span>
                    <strong>{money(fee)}</strong>
                  </li>
                </ul>

                {!compact && (
                  <div className="deed-scale">
                    <p className="deed-scale-label">{t("deed.priceByLevel")}</p>
                    <ul>
                      {Array.from({ length: 11 }, (_, i) => i - 5).map((idx) => {
                        const label = idx > 0 ? `+${idx}` : String(idx);
                        return (
                          <li
                            key={idx}
                            className={idx === sectorIdx ? "is-live" : undefined}
                          >
                            <span>{label}</span>
                            <strong>{money(priceAtLevel(idx))}</strong>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                {canFlip && (
                  <p
                    className="deed-flip-hint"
                    style={{
                      width: "100%",
                      textAlign: "center",
                      alignSelf: "center",
                    }}
                  >
                    {t("deed.tapFlip")}
                  </p>
                )}
              </>
            )}

            {isEtf && fund && (() => {
              const liveLevels = fund.sectorIds.map(
                (s) => fx?.sectorVisual[s] ?? game?.sectorIndex[s] ?? 0,
              );
              return (
                <>
                  <EtfPie sectors={fund.sectorIds} size="deed" />
                  <ul className="deed-rows">
                    <li>
                      <span>{t("deed.basePriceShort")}</span>
                      <strong>{money(fund.basePricePerUnitM)}</strong>
                    </li>
                    <li>
                      <span>{t("deed.fee")}</span>
                      <strong>{money(0)}</strong>
                    </li>
                  </ul>
                  {!compact && (
                    <div
                      className="deed-etf-grid"
                      style={{
                        marginTop: "0.45rem",
                        paddingTop: "0.45rem",
                        borderTop: "1px solid rgba(0,0,0,0.12)",
                        display: "grid",
                        gridTemplateColumns: `2.2rem repeat(${fund.sectorIds.length}, minmax(0, 1fr))`,
                        columnGap: "0.35rem",
                        rowGap: "0.2rem",
                        alignItems: "center",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.55rem",
                          fontWeight: 800,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: "rgba(26,26,26,0.45)",
                        }}
                      >
                        {t("deck.level")}
                      </span>
                      {fund.sectorIds.map((s) => {
                        const group =
                          SECTOR_LABELS.find((x) => x.sector === s)?.group ??
                          "none";
                        const light =
                          group === "yellow" || group === "lightblue";
                        return (
                          <span
                            key={s}
                            style={{
                              display: "block",
                              textAlign: "center",
                              padding: "0.2rem 0.15rem",
                              borderRadius: "0.28rem",
                              fontSize: "0.62rem",
                              fontWeight: 800,
                              letterSpacing: "0.04em",
                              background: GROUP_COLORS[group],
                              color: light ? "#1a1a1a" : "#fff",
                              boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.12)",
                            }}
                          >
                            {SECTOR_CODE[s]}
                          </span>
                        );
                      })}
                      {Array.from({ length: 11 }, (_, i) => i - 5).flatMap(
                        (idx) => {
                          const sleeve = fundSleeveValue(
                            fund.baseContributionM,
                            idx,
                          );
                          const label = idx > 0 ? `+${idx}` : String(idx);
                          const anyCurrent = liveLevels.some((lv) => lv === idx);
                          return [
                            <span
                              key={`l-${idx}`}
                              style={{
                                fontSize: "0.7rem",
                                fontWeight: anyCurrent ? 900 : 800,
                                color: anyCurrent
                                  ? "#1a1a1a"
                                  : "rgba(26,26,26,0.5)",
                              }}
                            >
                              {label}
                            </span>,
                            ...fund.sectorIds.map((s, si) => {
                              const current = (liveLevels[si] ?? 0) === idx;
                              const group =
                                SECTOR_LABELS.find((x) => x.sector === s)
                                  ?.group ?? "none";
                              const light =
                                group === "yellow" || group === "lightblue";
                              return (
                                <strong
                                  key={`${s}-${idx}`}
                                  className={
                                    current
                                      ? `deed-etf-cell is-current${light ? " is-light" : ""}`
                                      : "deed-etf-cell"
                                  }
                                  style={
                                    current
                                      ? {
                                          background: GROUP_COLORS[group],
                                        }
                                      : undefined
                                  }
                                >
                                  {sleeve}
                                </strong>
                              );
                            }),
                          ];
                        },
                      )}
                    </div>
                  )}
                </>
              );
            })()}

            {specialNote && <p className="deed-note">{specialNote}</p>}
          </div>
        </div>
        ) : null}

        {(staticBackOnly || (canFlipBase && forceFace == null)) && (
          <div
            className="deed-face deed-back"
            aria-hidden={staticBackOnly ? false : !flipped}
            style={{
              ...faceBase,
              position: staticBackOnly ? "relative" : "absolute",
              inset: staticBackOnly ? undefined : 0,
              transform: staticBackOnly ? undefined : "rotateY(180deg)",
              display: "flex",
              flexDirection: "column",
              background: band,
              color: lightBand ? "#1a1a1a" : "#fff",
              borderColor: lightBand
                ? "rgba(0,0,0,0.45)"
                : "rgba(0,0,0,0.35)",
              pointerEvents:
                staticBackOnly || flipped ? "auto" : "none",
            }}
          >
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                gap: "0.35rem",
                padding: "0.75rem 0.7rem 0.65rem",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontFamily: "var(--font-display)",
                  fontSize: "1.1rem",
                  lineHeight: 1.1,
                  fontWeight: 800,
                  letterSpacing: "0.03em",
                }}
              >
                {title}
              </p>
              <div className="deed-scale deed-back-scale">
                <p className="deed-scale-label">{t("deed.revenueByLevel")}</p>
                <ul>
                  {Array.from({ length: 11 }, (_, i) => i - 5).map((idx) => {
                    const label = idx > 0 ? `+${idx}` : String(idx);
                    return (
                      <li
                        key={idx}
                        className={idx === sectorIdx ? "is-live" : undefined}
                      >
                        <span>{label}</span>
                        <strong>{money(revenueAtLevel(revenue, idx))}</strong>
                      </li>
                    );
                  })}
                </ul>
              </div>
              {forceFace == null ? (
                <p
                  className="deed-flip-hint"
                  style={{
                    marginTop: "0.2rem",
                    color: lightBand
                      ? "rgba(26,26,26,0.55)"
                      : "rgba(255,255,255,0.55)",
                  }}
                >
                  {t("deed.tapFlip")}
                </p>
              ) : null}
            </div>
          </div>
        )}
      </div>
      {footer}
    </article>
  );
}
