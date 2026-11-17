"use client";

export type PieSlice = {
  id: string;
  value: number;
  color: string;
  label?: string;
};

function buildGradient(slices: PieSlice[]): string {
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0);
  if (total <= 0) {
    return "#d7d0c4 0deg 360deg";
  }
  let angle = 0;
  const stops: string[] = [];
  for (const slice of slices) {
    const span = (Math.max(0, slice.value) / total) * 360;
    const next = angle + span;
    stops.push(`${slice.color} ${angle}deg ${next}deg`);
    angle = next;
  }
  if (angle < 360) {
    stops.push(`#d7d0c4 ${angle}deg 360deg`);
  }
  return stops.join(", ");
}

/** Weighted donut for portfolio / ETF composition. */
export function HoldingsPie({
  slices,
  size = 112,
  hole = "42%",
  className = "",
  emptyLabel = "Empty",
}: {
  slices: PieSlice[];
  size?: number;
  hole?: string;
  className?: string;
  emptyLabel?: string;
}) {
  const active = slices.filter((s) => s.value > 0);
  const empty = active.length === 0;

  return (
    <span
      className={`holdings-pie ${className}`.trim()}
      role="img"
      aria-label={
        empty
          ? emptyLabel
          : active.map((s) => `${s.label ?? s.id}`).join(", ")
      }
      style={{
        position: "relative",
        display: "block",
        width: size,
        height: size,
        borderRadius: "50%",
        background: `conic-gradient(${buildGradient(active)})`,
        boxShadow:
          "0 0 0 2px #111, 0 0 0 4px #fffef9, 0 8px 18px rgba(0,0,0,0.18)",
        flex: "0 0 auto",
      }}
    >
      <span
        style={{
          position: "absolute",
          inset: hole,
          borderRadius: "50%",
          background: "linear-gradient(180deg, #fffef9 0%, #f3ecdf 100%)",
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)",
          display: "grid",
          placeItems: "center",
          fontSize: "0.58rem",
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: empty ? "rgba(26,26,26,0.4)" : "transparent",
        }}
      >
        {empty ? emptyLabel : null}
      </span>
    </span>
  );
}
