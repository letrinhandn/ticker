"use client";

import { sharePrice } from "@/lib/game/pricing";

export type SectorChartCompany = {
  ticker: string;
  name: string;
  basePrice: number;
  color: string;
};

const COMPANY_PALETTE = ["#1f6feb", "#c45c26", "#0f766e", "#7c3aed"];
/** Always leave room for this many future turns on the X axis. */
const FUTURE_TURNS = 5;

/**
 * One Y axis (share price M$). Solid = each ticker; dashed = mean of those
 * prices at each sector-index sample.
 */
export function SectorSparkline({
  series,
  sectorColor,
  companies,
  label,
  sectorLegend,
  priceLegend,
}: {
  /** Sector index samples (−5…+5) over turns — used only to price shares. */
  series: number[];
  sectorColor: string;
  companies: SectorChartCompany[];
  label: string;
  sectorLegend: string;
  priceLegend: string;
}) {
  const levels = series.length > 0 ? series : [0];
  const n = levels.length;
  const lastTurn = Math.max(0, n - 1);
  const axisMax = lastTurn + FUTURE_TURNS;

  const companySeries = companies.map((c) => ({
    ...c,
    values: levels.map((lvl) => sharePrice(c.basePrice, lvl)),
  }));

  const sectorAvg = levels.map((_, i) => {
    if (companySeries.length === 0) return 0;
    const sum = companySeries.reduce((s, c) => s + (c.values[i] ?? 0), 0);
    return sum / companySeries.length;
  });

  const allPrices = [
    ...companySeries.flatMap((c) => c.values),
    ...sectorAvg,
  ];
  const priceMin = allPrices.length ? Math.min(...allPrices) : 0;
  const priceMax = allPrices.length ? Math.max(...allPrices) : 1;
  const pricePad = Math.max(4, (priceMax - priceMin) * 0.14 || priceMax * 0.08);
  const pLo = Math.max(0, Math.floor(priceMin - pricePad));
  const pHi = Math.ceil(priceMax + pricePad);
  const pRange = Math.max(1, pHi - pLo);

  const w = 360;
  const h = 156;
  const padL = 36;
  const padR = 12;
  const padT = 18;
  const padB = 24;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const xAt = (turn: number) =>
    padL + (axisMax <= 0 ? 0 : (turn / axisMax) * innerW);
  const yPrice = (v: number) => padT + ((pHi - v) / pRange) * innerH;

  const linePath = (vals: number[]) => {
    if (vals.length === 0) return "";
    return vals
      .map((v, i) => {
        const x = xAt(i);
        const y = yPrice(v);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  };

  const mid = Math.round((pLo + pHi) / 2);
  const priceTicks = [pHi, mid, pLo].filter(
    (v, i, arr) => arr.indexOf(v) === i,
  );

  const turnLabels = (() => {
    const labels: { turn: number; text: string }[] = [{ turn: 0, text: "0" }];
    if (lastTurn > 0 && lastTurn !== axisMax) {
      labels.push({ turn: lastTurn, text: String(lastTurn) });
    }
    labels.push({ turn: axisMax, text: String(axisMax) });
    return labels;
  })();

  const endX = xAt(lastTurn);

  return (
    <div className="sc-chart" aria-label={label}>
      <div className="sc-chart-head">
        <p className="sc-chart-label">{label}</p>
        <ul className="sc-chart-legend">
          <li>
            <span
              className="sc-chart-swatch is-dashed"
              style={{ borderColor: sectorColor }}
            />
            {sectorLegend}
          </li>
          {companySeries.map((c) => (
            <li key={c.ticker}>
              <span
                className="sc-chart-swatch"
                style={{ background: c.color }}
              />
              {c.ticker}
            </li>
          ))}
        </ul>
      </div>
      <svg
        className="sc-chart-svg"
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-hidden
      >
        {priceTicks.map((tick) => (
          <line
            key={`g-${tick}`}
            x1={padL}
            x2={w - padR}
            y1={yPrice(tick)}
            y2={yPrice(tick)}
            className="sc-chart-grid"
          />
        ))}

        {lastTurn < axisMax && (
          <line
            x1={endX}
            x2={endX}
            y1={padT}
            y2={h - padB}
            className="sc-chart-now-guide"
          />
        )}

        <text
          x={padL - 4}
          y={padT - 4}
          className="sc-chart-axis-note"
          textAnchor="end"
        >
          {priceLegend}
        </text>

        {priceTicks.map((tick) => (
          <text
            key={`pl-${tick}`}
            x={padL - 5}
            y={yPrice(tick) + 3}
            className="sc-chart-tick-label is-left"
            textAnchor="end"
          >
            {tick}
          </text>
        ))}

        {companySeries.map((c) => (
          <g key={c.ticker}>
            <path
              d={linePath(c.values)}
              fill="none"
              stroke={c.color}
              strokeWidth={2.1}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle
              cx={endX}
              cy={yPrice(c.values[n - 1] ?? c.basePrice)}
              r={3}
              fill={c.color}
              stroke="#fff"
              strokeWidth={1.3}
            />
          </g>
        ))}

        {/* Avg last + white halo: often sits on a mid ticker (same scaled price). */}
        {companySeries.length > 0 && (
          <g>
            <path
              d={linePath(sectorAvg)}
              fill="none"
              stroke="#fffef9"
              strokeWidth={5}
              strokeDasharray="7 5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={linePath(sectorAvg)}
              fill="none"
              stroke={sectorColor}
              strokeWidth={2.8}
              strokeDasharray="7 5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle
              cx={endX}
              cy={yPrice(sectorAvg[n - 1] ?? 0)}
              r={4}
              fill={sectorColor}
              stroke="#fff"
              strokeWidth={2}
            />
          </g>
        )}

        {turnLabels.map(({ turn, text }) => (
          <text
            key={`t-${turn}`}
            x={xAt(turn)}
            y={h - 6}
            className="sc-chart-turn"
            textAnchor={
              turn === 0 ? "start" : turn === axisMax ? "end" : "middle"
            }
          >
            {text}
          </text>
        ))}

        <line
          x1={padL}
          x2={padL}
          y1={padT}
          y2={h - padB}
          className="sc-chart-origin"
        />
      </svg>
    </div>
  );
}

export function companyChartColor(index: number): string {
  return COMPANY_PALETTE[index % COMPANY_PALETTE.length]!;
}
