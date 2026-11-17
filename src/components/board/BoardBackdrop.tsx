"use client";

import { useEffect, useRef, useState } from "react";
import { BOARD, GROUP_COLORS } from "@/lib/game/board";
import { tileGridPosition } from "@/lib/game/engine";
import { useT } from "@/lib/i18n";

/**
 * Read-only scaled board for home / menu backdrop (no room, no interactions).
 */
export function BoardBackdrop({ blurred = true }: { blurred?: boolean }) {
  const t = useT();
  const shellRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [fit, setFit] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const shell = shellRef.current;
    const table = tableRef.current;
    if (!shell || !table) return;

    const measure = () => {
      const sw = shell.clientWidth;
      const sh = shell.clientHeight;
      const tw = table.offsetWidth;
      const th = table.offsetHeight;
      if (tw < 1 || th < 1 || sw < 1 || sh < 1) return;
      const next = Math.min(sw / tw, sh / th) * 0.96;
      setScale(next);
      setFit({ w: tw * next, h: th * next });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(shell);
    return () => ro.disconnect();
  }, []);

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
      <div
        className="board-shell"
        ref={shellRef}
        style={{
          ["--hud-pad-x" as string]: "clamp(0.75rem, 3vw, 2rem)",
          ["--hud-pad-y" as string]: "clamp(0.75rem, 3vh, 2rem)",
        }}
      >
        <div
          className="board-fit"
          style={fit.w ? { width: fit.w, height: fit.h } : undefined}
        >
          <div
            className="mono-table"
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
