"use client";

import type { CSSProperties } from "react";
import {
  GROUP_COLORS,
  SECTOR_CODE,
  SECTOR_LABELS,
} from "@/lib/game/board";
import { sectorNameKey, useT } from "@/lib/i18n";
import type { SectorId } from "@/shared/types";

/** Demo peg positions so the tutorial board is not a flat row of zeros. */
const DEMO_LEVELS: Record<SectorId, number> = {
  staples: 0,
  energy: 1,
  comms: -1,
  industrials: 2,
  financials: -2,
  discretionary: 0,
  healthcare: 1,
  tech: 3,
};

/** Read-only copy of the in-game sector peg rail for the tutorial. */
export function TutorialSectorBoard() {
  const t = useT();

  return (
    <div className="tut-sector-wrap">
      <div className="tut-sector-board sector-board" aria-label={t("sector.scale")}>
        <div className="sector-head">
          <span className="sector-scale-label">{t("sector.scale")}</span>
          <div className="sector-scale" aria-hidden>
            {Array.from({ length: 11 }, (_, i) => i - 5).map((n) => (
              <span
                key={n}
                className={`sector-scale-tick${n === 0 ? " is-zero" : ""}`}
              >
                {n > 0 ? `+${n}` : n}
              </span>
            ))}
          </div>
        </div>
        {SECTOR_LABELS.map((s) => {
          const v = Math.max(-5, Math.min(5, DEMO_LEVELS[s.sector] ?? 0));
          const slot = v + 6;
          const ink =
            s.group === "yellow" || s.group === "lightblue" ? "#1a1a1a" : "#fff";
          const sectorName = t(sectorNameKey(s.sector));
          return (
            <div
              key={s.sector}
              className="sector-row"
              title={`${sectorName}: ${v > 0 ? `+${v}` : v}`}
            >
              <span
                className="sector-label"
                style={{ background: GROUP_COLORS[s.group], color: ink }}
              >
                {SECTOR_CODE[s.sector]}
              </span>
              <div
                className="sector-track"
                style={{ "--peg-slot": slot } as CSSProperties}
              >
                <span className="sector-groove" aria-hidden />
                <span className="sector-zero" aria-hidden />
                <span className="sector-slots" aria-hidden>
                  {Array.from({ length: 11 }, (_, i) => (
                    <i key={i} />
                  ))}
                </span>
                <span
                  className="sector-peg"
                  style={{ background: GROUP_COLORS[s.group] }}
                  aria-hidden
                />
              </div>
            </div>
          );
        })}
      </div>
      <ul className="tut-sector-legend">
        {SECTOR_LABELS.map((s) => {
          const ink =
            s.group === "yellow" || s.group === "lightblue" ? "#1a1a1a" : "#fff";
          return (
            <li key={s.sector}>
              <span
                className="tut-sector-chip"
                style={{ background: GROUP_COLORS[s.group], color: ink }}
              >
                {SECTOR_CODE[s.sector]}
              </span>
              <span>{t(sectorNameKey(s.sector))}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
