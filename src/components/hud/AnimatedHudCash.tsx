"use client";

import { useEffect, useRef, useState } from "react";
import { moneySeat } from "@/lib/money";
import { fxMs } from "@/lib/prefs/gamePrefs";
import { FX_TIMING } from "@/lib/fx/types";

/**
 * Seat money readout (net worth) — eases between values so +/- lands visibly.
 * `data-hud-cash` stays the cash-fly land target.
 */
export function AnimatedHudCash({
  playerId,
  value,
  flash,
}: {
  playerId: string;
  value: number;
  flash?: "up" | "down" | null;
}) {
  const [shown, setShown] = useState(value);
  const [dir, setDir] = useState<"up" | "down" | null>(null);
  const shownRef = useRef(shown);
  const rafRef = useRef<number | null>(null);

  shownRef.current = shown;

  useEffect(() => {
    const from = shownRef.current;
    const to = value;
    if (from === to) {
      setDir(null);
      return;
    }

    setDir(to > from ? "up" : "down");
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);

    // Peg steps are ~sectorStepMs; keep seat ease short enough to track them.
    const duration = fxMs(
      Math.min(
        FX_TIMING.settleCashFlyMs,
        Math.max(FX_TIMING.sectorStepMs, 420),
      ),
    );
    const start = performance.now();
    const delta = to - from;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      const next = Math.round(from + delta * eased);
      setShown(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setShown(to);
        setDir(null);
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [value]);

  const tone =
    flash === "up" || dir === "up"
      ? " is-flash-up"
      : flash === "down" || dir === "down"
        ? " is-flash-down"
        : "";

  return (
    <p className={`hud-cash${tone}`} data-hud-cash={playerId}>
      {moneySeat(shown)}
    </p>
  );
}
