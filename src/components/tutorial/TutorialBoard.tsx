"use client";

import { BOARD, GROUP_COLORS } from "@/lib/game/board";
import { tileGridPosition } from "@/lib/game/engine";
import { useT } from "@/lib/i18n";
import { useFitScale } from "@/lib/ui/useFitScale";

/** Read-only full table for the tutorial, same tiles as the live board. */
export function TutorialBoard() {
  const t = useT();
  const { shellRef, tableRef, scale, w: fitW, h: fitH } = useFitScale({
    factor: 0.98,
    maxScale: 1.25,
    subtractPadding: true,
  });

  return (
    <div className="tut-board-wrap" aria-label={t("board.aria")}>
      <div className="board-shell home-board-shell tut-board-shell" ref={shellRef}>
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
            <div className="board-grid" role="img" aria-label={t("board.aria")}>
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
                      {tile.kind === "company" || tile.kind === "etf" ? null : (
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
