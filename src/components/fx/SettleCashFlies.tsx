"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  cashFlySeatPoint,
  createCashFlyElement,
} from "@/lib/fx/cashFlyDom";
import { fxMs } from "@/lib/prefs/gamePrefs";
import { FX_TIMING } from "@/lib/fx/types";
import { playCashDelta } from "@/lib/sfx/sounds";

export type SettleCashFly = {
  id: string;
  signed: number;
  /** Prefer exact HUD cash node via playerId. */
  playerId?: string;
  /** Fallback seat index 0..3, or -1 for fund. */
  seatIndex: number;
};

/**
 * Full-viewport cash chips: start at settle card center, land on the
 * exact seat cash figure (`data-hud-cash`).
 */
export function SettleCashFlies({
  flies,
  active,
  onLanded,
  /** Tax / START / fees: stamp only — skip harsh bill-counter layers. */
  cashSfx = true,
}: {
  flies: SettleCashFly[];
  active: boolean;
  onLanded?: () => void;
  cashSfx?: boolean;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const landedRef = useRef(onLanded);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    landedRef.current = onLanded;
  }, [onLanded]);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (!mounted || !active || flies.length === 0) return;
    const layer = layerRef.current;
    if (!layer) return;

    let cancelled = false;
    let done = false;
    const markLanded = () => {
      if (cancelled || done) return;
      done = true;
      landedRef.current?.();
    };

    const duration = fxMs(FX_TIMING.settleCashFlyMs);
    const start = {
      x: window.innerWidth * 0.5,
      y: window.innerHeight * 0.46,
    };
    const anims: Animation[] = [];
    const sfxTimers: number[] = [];

    flies.forEach((fly, i) => {
      const el = createCashFlyElement({
        signed: fly.signed,
        start,
        clearChrome: true,
      });
      layer.appendChild(el);

      const delay = i * 70;
      if (cashSfx) {
        sfxTimers.push(
          window.setTimeout(() => {
            if (cancelled) return;
            playCashDelta(fly.signed, { volume: 0.72 });
          }, delay),
        );
      }

      const end = cashFlySeatPoint(fly.playerId, fly.seatIndex);
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
            transform: "translate(-50%, -50%) scale(1.14)",
          },
          {
            offset: 0.82,
            opacity: 1,
            transform: "translate(-50%, -50%) scale(1.02)",
          },
          {
            offset: 1,
            opacity: 0.12,
            left: `${end.x}px`,
            top: `${end.y}px`,
            transform: "translate(-50%, -50%) scale(0.9)",
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
    });

    Promise.all(anims.map((a) => a.finished.catch(() => undefined))).then(
      markLanded,
    );
    const safety = window.setTimeout(
      markLanded,
      duration + flies.length * 70 + 120,
    );

    return () => {
      cancelled = true;
      window.clearTimeout(safety);
      for (const t of sfxTimers) window.clearTimeout(t);
      for (const anim of anims) anim.cancel();
      layer.replaceChildren();
    };
  }, [mounted, active, flies, cashSfx]);

  if (!mounted || !active || flies.length === 0) return null;

  return createPortal(
    <div ref={layerRef} className="settle-cash-fly-layer" aria-hidden />,
    document.body,
  );
}

export function seatIndexForPlayer(
  playerId: string | undefined,
  playerIds: string[],
): number {
  if (!playerId) return 0;
  const idx = playerIds.indexOf(playerId);
  return idx >= 0 ? idx : 0;
}
