"use client";

import { BOARD, GROUP_COLORS } from "@/lib/game/board";
import { tileGridPosition } from "@/lib/game/engine";
import { useT } from "@/lib/i18n";
import { useFitScale } from "@/lib/ui/useFitScale";

/**
 * Read-only scaled board for home / menu backdrop (no room, no interactions).
 */
export function BoardBackdrop({ blurred = true }: { blurred?: boolean }) {
  const t = useT();
  const { shellRef, tableRef, scale, w: fitW, h: fitH } = useFitScale({
    factor: 0.96,
    maxScale: 1.4,
    subtractPadding: true,
  });

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={
        blurred
          ? {
              filter: "blur(7px) saturate(0.9)",
              transform: "scale(1.04)",
              opacity: 0.88,
            }
          : undefined
      }
      aria-hidden
    >
      <div className="board-shell home-board-shell" ref={shellRef}>
        <div
          className="board-fit"
          style={fitW ? { width: fitW, height: fitH } : undefined}
        >
          <div
            className="board-table"
            ref={tableRef}
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            <div className="board-grid">
              {BOARD.map((tile) => {
                const { row, col } = tileGridPosition(tile.index);
                const band =
                  tile.group !== "none" &&
                  (tile.kind === "company" || tile.kind === "etf")
                    ? GROUP_COLORS[tile.group]
                    : undefined;
                const side =
                  tile.index === 0 ||
                  tile.index === 10 ||
                  tile.index === 20 ||
                  tile.index === 30
                    ? "corner"
                    : tile.index < 10
                      ? "bottom"
                      : tile.index < 20
                        ? "left"
                        : tile.index < 30
                          ? "top"
                          : "right";
                return (
                  <div
                    key={tile.index}
                    className={`tile kind-${tile.kind} side-${side}`}
                    style={{
                      gridRow: row + 1,
                      gridColumn: col + 1,
                      ["--band" as string]: band,
                    }}
                  >
                    {band && tile.kind !== "etf" ? (
                      <span className="tile-band" />
                    ) : null}
                    <span className="tile-body">
                      {tile.kind === "company" || tile.kind === "etf"
                        ? null
                        : (
                          <span className="tile-name">{tile.name}</span>
                        )}
                    </span>
                  </div>
                );
              })}
              <div className="board-center">
                <div className="center-brand-wrap">
                  <p className="board-center-brand">{t("brand.name")}</p>
                  <p className="board-center-sub">{t("brand.tagline")}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
