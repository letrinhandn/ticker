"use client";

import { GROUP_COLORS, SECTOR_LABELS } from "@/lib/game/board";
import type { SectorId } from "@/shared/types";

function colorForSector(sector: SectorId): string {
  const group = SECTOR_LABELS.find((s) => s.sector === sector)?.group ?? "etf";
  return GROUP_COLORS[group] ?? "#2f4f4f";
}

const SIZES = {
  tile: 18,
  /** Top/bottom edge cells — large enough to read, fits with price under. */
  tileSm: 18,
  deed: 52,
} as const;

/** Equal-slice pie for ETF sleeves — inline styles (avoid CSS-module leaks under Turbopack). */
export function EtfPie({
  sectors,
  size = "tile",
  className,
}: {
  sectors: SectorId[];
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const colors = sectors.map(colorForSector);
  const n = Math.max(colors.length, 1);
  const step = 360 / n;
  const gradient = colors
    .map((c, i) => `${c} ${i * step}deg ${(i + 1) * step}deg`)
    .join(", ");
  const px = SIZES[size];
  const hole = size === "deed" ? "28%" : "22%";

  return (
    <span
      className={className}
      aria-hidden
      style={{
        position: "relative",
        display: "block",
        flex: "0 0 auto",
        width: px,
        height: px,
        margin: size === "deed" ? "0 auto 0.55rem" : undefined,
        borderRadius: "50%",
        background: `conic-gradient(${gradient})`,
        boxShadow:
          "0 0 0 1.5px rgba(255,255,255,0.95), 0 1px 3px rgba(0,0,0,0.28)",
      }}
    >
      <span
        style={{
          position: "absolute",
          inset: hole,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.92)",
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)",
        }}
      />
    </span>
  );
}
