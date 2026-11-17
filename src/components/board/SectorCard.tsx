"use client";

import { createPortal } from "react-dom";
import {
  GROUP_COLORS,
  SECTOR_CODE,
  SECTOR_LABELS,
  companiesInSector,
} from "@/lib/game/board";
import { currentSharePrice } from "@/lib/game/pricing";
import { useGameFxOptional } from "@/lib/fx/GameFxContext";
import { money } from "@/lib/money";
import type { GameState, SectorId } from "@/shared/types";
import { sectorNameKey, useT } from "@/lib/i18n";
import { CompanyLogo } from "@/components/cards/CompanyLogo";
import { companyChartColor, SectorSparkline } from "./SectorSparkline";

export function SectorCard({
  sector,
  game,
  onClose,
  onOpenCompany,
}: {
  sector: SectorId;
  game: GameState;
  onClose: () => void;
  onOpenCompany?: (tileIndex: number) => void;
}) {
  const t = useT();
  const fx = useGameFxOptional();
  const meta = SECTOR_LABELS.find((s) => s.sector === sector);
  const group = meta?.group ?? "none";
  const label = t(sectorNameKey(sector));
  const code = SECTOR_CODE[sector];
  const light = group === "yellow" || group === "lightblue";
  const ink = light ? "#1a1a1a" : "#fff";
  const band = GROUP_COLORS[group] ?? "#333";
  const idx = fx?.sectorVisual[sector] ?? game.sectorIndex[sector] ?? 0;
  const companies = companiesInSector(sector);
  const recorded = game.sectorHistory?.[sector] ?? [];
  const history =
    recorded.length === 0
      ? [idx]
      : recorded[recorded.length - 1] === idx
        ? recorded
        : [...recorded, idx];

  return createPortal(
    <div
      className="modal-overlay sc-overlay is-browse"
      onClick={onClose}
      role="presentation"
    >
      <article
        className="sc-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${code} ${label}`}
      >
        <header className="sc-band" style={{ background: band, color: ink }}>
          <div className="sc-band-top">
            <span className="sc-code">{code}</span>
            <span className="sc-index">
              {t("sector.index", {
                value: idx > 0 ? `+${idx}` : idx,
              })}
            </span>
          </div>
          <h2 className="sc-title">{label}</h2>
          <p className="sc-sub">
            {t("sector.companiesIn", { count: companies.length })}
          </p>
        </header>

        <SectorSparkline
          series={history}
          sectorColor={band}
          companies={companies.map((tile, i) => ({
            ticker: tile.ticker ?? tile.name,
            name: tile.name,
            basePrice: tile.price ?? 0,
            color: companyChartColor(i),
          }))}
          label={t("sector.history")}
          sectorLegend={t("sector.historySector")}
          priceLegend={t("sector.historyPrice")}
        />

        <ul className="sc-list">
          {companies.map((tile) => {
            const base = tile.price ?? 0;
            const price = currentSharePrice(game, tile.index);
            const tone =
              price > base ? "up" : price < base ? "down" : "flat";
            return (
              <li key={tile.index}>
                <button
                  type="button"
                  className="sc-row"
                  onClick={() => {
                    onOpenCompany?.(tile.index);
                    onClose();
                  }}
                >
                  {tile.logo ? (
                    <CompanyLogo
                      src={tile.logo}
                      alt={tile.ticker ?? tile.name}
                      className="sc-logo"
                    />
                  ) : (
                    <span className="sc-logo sc-logo-fallback">
                      {(tile.ticker ?? tile.name).slice(0, 2)}
                    </span>
                  )}
                  <span className="sc-meta">
                    <strong>{tile.name}</strong>
                    <em>{tile.ticker ?? ""}</em>
                  </span>
                  <span className={`sc-price is-${tone}`}>
                    {tone !== "flat" && (
                      <span className="sc-price-arrow" aria-hidden>
                        {tone === "up" ? "▲" : "▼"}
                      </span>
                    )}
                    {money(price)}
                    <span className="sc-unit">{t("sector.perShare")}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <footer className="sc-foot">
          <button type="button" className="sc-close" onClick={onClose}>
            {t("common.close")}
          </button>
        </footer>
      </article>
    </div>,
    document.body,
  );
}
