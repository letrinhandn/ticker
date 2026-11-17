import type { SectorId } from "@/shared/types";
import { money } from "@/lib/money";
import { fxMs } from "@/lib/prefs/gamePrefs";
import { FX_TIMING } from "@/lib/fx/types";
import { playCashDelta } from "@/lib/sfx/sounds";

const SEAT_CORNERS = ["bl", "tr", "tl", "br"] as const;

export type PegWorthDelta = {
  playerId: string;
  delta: number;
  seatIndex: number;
};

function seatPoint(playerId: string, seatIndex: number): { x: number; y: number } {
  const node = document.querySelector(
    `[data-hud-cash="${CSS.escape(playerId)}"]`,
  );
  if (node) {
    const r = node.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
  }
  const w = window.innerWidth;
  const h = window.innerHeight;
  const corner = SEAT_CORNERS[seatIndex] ?? "br";
  switch (corner) {
    case "bl":
      return { x: 24, y: h - 88 };
    case "br":
      return { x: w - 24, y: h - 88 };
    case "tl":
      return { x: 24, y: 72 };
    default:
      return { x: w - 24, y: 72 };
  }
}

function pegPoint(sector: SectorId): { x: number; y: number } {
  const peg = document.querySelector(
    `[data-sector-peg="${CSS.escape(sector)}"]`,
  );
  if (peg) {
    const r = peg.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
  }
  const row = document.querySelector(
    `button.sector-row [data-sector-peg="${CSS.escape(sector)}"]`,
  )?.closest("button.sector-row");
  if (row) {
    const r = row.getBoundingClientRect();
    return { x: r.left + r.width * 0.72, y: r.top + r.height / 2 };
  }
  return { x: window.innerWidth * 0.5, y: window.innerHeight * 0.55 };
}

/**
 * Pop +/- at the sector peg, then fly each chip onto the matching seat.
 * Imperative DOM (same approach as settle cash) so it never depends on
 * React paint timing for the chip itself.
 */
export function playPegWorthFlies(
  sector: SectorId,
  deltas: PegWorthDelta[],
): Promise<void> {
  if (typeof document === "undefined" || deltas.length === 0) {
    return Promise.resolve();
  }

  const layer = document.createElement("div");
  layer.className = "settle-cash-fly-layer peg-worth-fly-layer";
  layer.setAttribute("aria-hidden", "true");
  document.body.appendChild(layer);

  const start = pegPoint(sector);
  const duration = fxMs(FX_TIMING.pegWorthFlyMs);
  const anims: Animation[] = [];

  for (let i = 0; i < deltas.length; i++) {
    const fly = deltas[i]!;
    const positive = fly.delta >= 0;
    const end = seatPoint(fly.playerId, fly.seatIndex);
    const el = document.createElement("span");
    el.className = `settle-cash-fly is-peg-fly${positive ? " is-up" : " is-down"}`;
    el.textContent = `${positive ? "+" : "−"}${money(Math.abs(fly.delta))}`;
    el.style.cssText = [
      `left:${start.x}px`,
      `top:${start.y}px`,
      `z-index:${170 + i}`,
    ].join(";");
    layer.appendChild(el);

    // Stagger slightly when several seats are hit from one peg.
    const delay = i * 70;
    window.setTimeout(() => {
      playCashDelta(fly.delta, { volume: 0.85 });
    }, delay);
    const anim = el.animate(
      [
        {
          offset: 0,
          opacity: 0,
          left: `${start.x}px`,
          top: `${start.y}px`,
          transform: "translate(-50%, -50%) scale(0.4)",
        },
        {
          offset: 0.12,
          opacity: 1,
          left: `${start.x}px`,
          top: `${start.y}px`,
          transform: "translate(-50%, -50%) scale(1.22)",
        },
        {
          offset: 0.28,
          opacity: 1,
          left: `${start.x}px`,
          top: `${start.y}px`,
          transform: "translate(-50%, -50%) scale(1.05)",
        },
        {
          offset: 1,
          opacity: 0.15,
          left: `${end.x}px`,
          top: `${end.y}px`,
          transform: "translate(-50%, -50%) scale(0.88)",
        },
      ],
      {
        duration,
        delay,
        easing: "cubic-bezier(0.22, 0.82, 0.2, 1)",
        fill: "forwards",
      },
    );
    anims.push(anim);
  }

  const done = Promise.all(
    anims.map((a) => a.finished.catch(() => undefined)),
  ).then(() => {
    layer.remove();
  });

  // Safety if a browser drops finished.
  window.setTimeout(() => layer.remove(), duration + deltas.length * 70 + 200);

  return done;
}
