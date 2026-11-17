"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";

const PIP_LAYOUT: Record<number, Array<[number, number]>> = {
  1: [[50, 50]],
  2: [
    [28, 28],
    [72, 72],
  ],
  3: [
    [28, 28],
    [50, 50],
    [72, 72],
  ],
  4: [
    [28, 28],
    [72, 28],
    [28, 72],
    [72, 72],
  ],
  5: [
    [28, 28],
    [72, 28],
    [50, 50],
    [28, 72],
    [72, 72],
  ],
  6: [
    [28, 22],
    [72, 22],
    [28, 50],
    [72, 50],
    [28, 78],
    [72, 78],
  ],
};

function DieFace({
  value,
  rolling,
  size,
  delayMs = 0,
  idleFace,
}: {
  value: number | null;
  rolling?: boolean;
  size: "sm" | "md";
  delayMs?: number;
  idleFace: number;
}) {
  const [display, setDisplay] = useState(value ?? idleFace);

  useEffect(() => {
    if (!rolling) {
      const face = value ?? idleFace;
      queueMicrotask(() => setDisplay(face));
      return;
    }
    let alive = true;
    queueMicrotask(() => setDisplay(1 + Math.floor(Math.random() * 6)));
    const id = window.setInterval(() => {
      if (!alive) return;
      setDisplay(1 + Math.floor(Math.random() * 6));
    }, 55);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [rolling, value, idleFace]);

  const t = useT();
  const n = display >= 1 && display <= 6 ? display : idleFace;
  const pips = PIP_LAYOUT[n] ?? PIP_LAYOUT[1]!;

  return (
    <div
      className={`die-cube die-${size}${rolling ? " is-rolling" : ""}`}
      style={rolling ? { animationDelay: `${delayMs}ms` } : undefined}
      aria-label={
        rolling ? t("dice.rolling") : t("dice.dieN", { n })
      }
    >
      <div className="die-face-front">
        {pips.map(([x, y], i) => (
          <span
            key={i}
            className="die-pip"
            style={{ left: `${x}%`, top: `${y}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function DicePair({
  values,
  rolling = false,
  size = "md",
}: {
  values: [number, number] | null;
  rolling?: boolean;
  size?: "sm" | "md";
}) {
  const t = useT();
  return (
    <div
      className={`dice-pair${rolling ? " rolling" : ""}`}
      aria-live="polite"
      aria-label={
        rolling
          ? t("dice.rollingPair")
          : values
            ? t("dice.values", { a: values[0], b: values[1] })
            : t("dice.ready")
      }
    >
      <DieFace
        value={values?.[0] ?? null}
        rolling={rolling}
        size={size}
        delayMs={0}
        idleFace={5}
      />
      <DieFace
        value={values?.[1] ?? null}
        rolling={rolling}
        size={size}
        delayMs={90}
        idleFace={2}
      />
      {values && !rolling && (
        <span className="dice-sum" aria-hidden>
          {values[0] + values[1]}
        </span>
      )}
    </div>
  );
}
