import { money } from "@/lib/money";

export const CASH_FLY_SEAT_CORNERS = ["bl", "tr", "tl", "br"] as const;
export type CashFlySeatCorner = (typeof CASH_FLY_SEAT_CORNERS)[number];

/** Fallback seat / fund anchors when the HUD cash node is missing. */
export function cashFlyFallbackPoint(seatIndex: number): { x: number; y: number } {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const corner: CashFlySeatCorner | "fund" =
    seatIndex < 0 ? "fund" : (CASH_FLY_SEAT_CORNERS[seatIndex] ?? "br");
  switch (corner) {
    case "bl":
      return { x: 24, y: h - 88 };
    case "br":
      return { x: w - 24, y: h - 88 };
    case "tl":
      return { x: 24, y: 72 };
    case "tr":
      return { x: w - 24, y: 72 };
    default:
      return { x: w * 0.5, y: h * 0.14 };
  }
}

/** Exact HUD net-worth node, or null if not mounted. */
export function cashFlyHudPoint(
  playerId: string | undefined,
): { x: number; y: number } | null {
  if (!playerId || typeof document === "undefined") return null;
  const node = document.querySelector(
    `[data-hud-cash="${CSS.escape(playerId)}"]`,
  );
  if (!node) return null;
  const r = node.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** Prefer HUD cash node; otherwise seat corner fallback. */
export function cashFlySeatPoint(
  playerId: string | undefined,
  seatIndex: number,
): { x: number; y: number } {
  return cashFlyHudPoint(playerId) ?? cashFlyFallbackPoint(seatIndex);
}

export type CreateCashFlyElOpts = {
  signed: number;
  start: { x: number; y: number };
  /** Extra classes after `settle-cash-fly` (e.g. `is-peg-fly`). */
  extraClass?: string;
  /** Strip card chrome (CashFlyLayer / SettleCashFlies). */
  clearChrome?: boolean;
  zIndex?: number;
};

/** Create + style a `.settle-cash-fly` chip at `start`. Caller appends + animates. */
export function createCashFlyElement({
  signed,
  start,
  extraClass = "",
  clearChrome = false,
  zIndex,
}: CreateCashFlyElOpts): HTMLSpanElement {
  const positive = signed >= 0;
  const el = document.createElement("span");
  el.className = [
    "settle-cash-fly",
    positive ? "is-up" : "is-down",
    extraClass,
  ]
    .filter(Boolean)
    .join(" ");
  el.textContent = `${positive ? "+" : "−"}${money(Math.abs(signed))}`;
  const parts = [`left:${start.x}px`, `top:${start.y}px`];
  if (clearChrome) {
    parts.push(
      "background:transparent",
      "box-shadow:none",
      "text-shadow:none",
      "border:none",
      "padding:0",
      "margin:0",
    );
  }
  if (zIndex != null) parts.push(`z-index:${zIndex}`);
  el.style.cssText = parts.join(";");
  return el;
}
