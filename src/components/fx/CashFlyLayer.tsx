"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SectorId } from "@/shared/types";
import { useGameFxOptional } from "@/lib/fx/GameFxContext";
import {
  cashFlySeatPoint,
  createCashFlyElement,
} from "@/lib/fx/cashFlyDom";
import { fxMs } from "@/lib/prefs/gamePrefs";
import { FX_TIMING } from "@/lib/fx/types";

function originForFly(fromSector?: SectorId): { x: number; y: number } {
  if (fromSector) {
    const peg = document.querySelector(
      `[data-sector-peg="${CSS.escape(fromSector)}"]`,
    );
    if (peg) {
      const r = peg.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
    }
  }
  return { x: window.innerWidth * 0.5, y: window.innerHeight * 0.42 };
}

/**
 * Cash / peg reprice chips: fly onto the seat net-worth figure.
 */
export function CashFlyLayer({ playerIds }: { playerIds: string[] }) {
  const fx = useGameFxOptional();
  const layerRef = useRef<HTMLDivElement>(null);
  const seen = useRef<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (!mounted || !fx) return;
    const layer = layerRef.current;
    if (!layer) return;

    for (const fly of fx.cashFlies) {
      if (seen.current.has(fly.id)) continue;
      seen.current.add(fly.id);

      const seatIndex = playerIds.indexOf(fly.playerId);
      const end = cashFlySeatPoint(
        fly.playerId,
        seatIndex >= 0 ? seatIndex : 0,
      );
      const start = originForFly(fly.fromSector);
      const fromPeg = fly.fromSector != null;
      const dx = end.x - start.x;
      const dy = end.y - start.y;

      const el = createCashFlyElement({
        signed: fly.delta,
        start,
        extraClass: fromPeg ? "is-peg-fly" : "",
        clearChrome: true,
      });
      layer.appendChild(el);

      const duration = fxMs(
        fromPeg ? FX_TIMING.pegWorthFlyMs : FX_TIMING.cashFlyMs,
      );
      const anim = el.animate(
        [
          {
            offset: 0,
            opacity: 1,
            transform: "translate(-50%, -50%) scale(0.88)",
          },
          {
            offset: 0.1,
            opacity: 1,
            transform: "translate(-50%, -50%) scale(1.18)",
          },
          {
            offset: 0.72,
            opacity: 1,
            transform: `translate(calc(-50% + ${dx * 0.82}px), calc(-50% + ${dy * 0.82}px)) scale(1.04)`,
          },
          {
            offset: 1,
            opacity: 0.12,
            transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.9)`,
          },
        ],
        {
          duration,
          easing: "cubic-bezier(0.22, 0.82, 0.2, 1)",
          fill: "forwards",
        },
      );
      anim.finished
        .catch(() => undefined)
        .finally(() => {
          el.remove();
          seen.current.delete(fly.id);
        });
    }
  }, [mounted, fx, fx?.cashFlies, playerIds]);

  if (!fx || !mounted) return null;

  return createPortal(
    <div ref={layerRef} className="settle-cash-fly-layer" aria-hidden />,
    document.body,
  );
}
