/**
 * Famous funds / desks as bot rivals — grouped by fund kind.
 * Each kind has its own trading strategy in `fundStrategies.ts`.
 * Logos under `/public/funds` are original game marks (not official trademarks).
 */

export type FundKind =
  | "index" // passive / long-only asset manager
  | "value" // deep value / buy & hold
  | "growth" // growth / public VC book
  | "sovereign" // SWF long horizon
  | "activist" // activist hedge fund
  | "event" // event-driven hedge fund
  | "multi_strat" // pod multi-strategy HF
  | "macro" // global macro / CTA
  | "quant" // systematic quant
  | "market_make"; // market maker / liquidity

export type BotFund = {
  name: string;
  initials: string;
  /** Brand-ish mark color */
  color: string;
  ink?: string;
  kind: FundKind;
  /** One-line desk style for lobby UI */
  blurb: string;
};

/** Display order in fund pickers. */
export const FUND_KIND_ORDER: FundKind[] = [
  "index",
  "value",
  "growth",
  "sovereign",
  "activist",
  "event",
  "multi_strat",
  "macro",
  "quant",
  "market_make",
];

export const BOT_FUNDS: BotFund[] = [
  // —— Index / long-only asset managers ——
  {
    name: "Vanguard",
    initials: "VG",
    color: "#9a1b1b",
    kind: "index",
    blurb: "Buys ETFs first and only adds a little on deep dips.",
  },
  {
    name: "Capital Group",
    initials: "CG",
    color: "#9a3412",
    kind: "index",
    blurb: "Slow long-only buys. Never dumps to pressure the tape.",
  },
  {
    name: "BlackRock",
    initials: "BLK",
    color: "#111827",
    kind: "index",
    blurb: "Uses ETF hedges and takes profit late.",
  },

  // —— Value ——
  {
    name: "Berkshire",
    initials: "BRK",
    color: "#1e3a5f",
    kind: "value",
    blurb: "Buys crashes and refuses to chase rallies.",
  },
  {
    name: "Baupost",
    initials: "BAU",
    color: "#3f3f46",
    kind: "value",
    blurb: "Waits for hard selloffs, then exits only when rich.",
  },

  // —— Growth / VC public ——
  {
    name: "Sequoia",
    initials: "SEQ",
    color: "#166534",
    kind: "growth",
    blurb: "Adds into winners and cuts losers quickly.",
  },
  {
    name: "Coatue",
    initials: "CT",
    color: "#6d28d9",
    kind: "growth",
    blurb: "Sizes up dips in strong growth sectors.",
  },
  {
    name: "Tiger Global",
    initials: "TG",
    color: "#c2410c",
    kind: "growth",
    blurb: "Takes large growth positions when prices look cheap.",
  },
  {
    name: "SoftBank",
    initials: "SB",
    color: "#a16207",
    kind: "growth",
    blurb: "Buys big and keeps a thin cash buffer.",
  },

  // —— Sovereign ——
  {
    name: "Temasek",
    initials: "TEM",
    color: "#115e59",
    kind: "sovereign",
    blurb: "Spreads risk and hedges concentration with ETFs.",
  },

  // —— Activist HF ——
  {
    name: "Pershing Square",
    initials: "PS",
    color: "#9f1239",
    kind: "activist",
    blurb: "Dumps blocks to pressure crowded sectors.",
  },
  {
    name: "Elliott",
    initials: "ELL",
    color: "#1e293b",
    kind: "activist",
    blurb: "Corners float and squeezes rival books.",
  },

  // —— Event-driven HF ——
  {
    name: "Farallon",
    initials: "FAR",
    color: "#075985",
    kind: "event",
    blurb: "Buys after shocks and exits when the thesis breaks.",
  },

  // —— Multi-strat HF ——
  {
    name: "Citadel",
    initials: "CI",
    color: "#0b3d2e",
    kind: "multi_strat",
    blurb: "Dumps, corners, hedges, and holds cash in one book.",
  },
  {
    name: "Point72",
    initials: "P72",
    color: "#1d4ed8",
    kind: "multi_strat",
    blurb: "Buys low, sells high, and keeps cash tight.",
  },
  {
    name: "Millennium",
    initials: "ML",
    color: "#134e4a",
    kind: "multi_strat",
    blurb: "Hedges heavy concentration and dumps ripe names.",
  },

  // —— Macro / CTA ——
  {
    name: "Bridgewater",
    initials: "BW",
    color: "#1a365d",
    kind: "macro",
    blurb: "Times cash and ETF hedges before chasing moves.",
  },
  {
    name: "Man Group",
    initials: "MAN",
    color: "#831843",
    kind: "macro",
    blurb: "Trends into strength and stays flat when unclear.",
  },
  {
    name: "Winton",
    initials: "WIN",
    color: "#4c1d95",
    kind: "macro",
    blurb: "Rides sector momentum and keeps dry powder ready.",
  },

  // —— Quant ——
  {
    name: "Renaissance",
    initials: "REN",
    color: "#7c2d12",
    kind: "quant",
    blurb: "Corners dips for mean reversion and cuts losses hard.",
  },
  {
    name: "Two Sigma",
    initials: "2Σ",
    color: "#0e7490",
    kind: "quant",
    blurb: "Buys reversion dips and hedges overweight sectors.",
  },
  {
    name: "D.E. Shaw",
    initials: "DES",
    color: "#312e81",
    kind: "quant",
    blurb: "Trades precise sizes and dumps early when edged.",
  },
  {
    name: "AQR",
    initials: "AQR",
    color: "#0f766e",
    kind: "quant",
    blurb: "Mean-reverts dips and neutralizes risk with ETFs.",
  },

  // —— Market maker ——
  {
    name: "Jane Street",
    initials: "JS",
    color: "#b45309",
    kind: "market_make",
    blurb: "Vacuums available float and flattens into strength.",
  },
];

export const BOT_FUND_NAMES = BOT_FUNDS.map((f) => f.name);

export function botFundByName(name: string): BotFund | undefined {
  return BOT_FUNDS.find((f) => f.name.toLowerCase() === name.toLowerCase());
}

export function fundsByKind(kind: FundKind): BotFund[] {
  return BOT_FUNDS.filter((f) => f.kind === kind);
}

/** Pick a fund; avoids `exclude` names when possible. Optional kind filter. */
export function pickBotFund(
  rng: () => number = Math.random,
  exclude: string[] = [],
  kind?: FundKind,
): BotFund {
  const blocked = new Set(exclude.map((n) => n.toLowerCase()));
  let pool = BOT_FUNDS.filter((f) => !blocked.has(f.name.toLowerCase()));
  if (kind) {
    const typed = pool.filter((f) => f.kind === kind);
    if (typed.length > 0) pool = typed;
  }
  const list = pool.length > 0 ? pool : BOT_FUNDS;
  const i = Math.floor(rng() * list.length) % list.length;
  return list[i]!;
}

export function pickBotFundName(
  rng: () => number = Math.random,
  exclude: string[] = [],
  kind?: FundKind,
): string {
  return pickBotFund(rng, exclude, kind).name;
}

export function isBotFundName(name: string): boolean {
  return Boolean(botFundByName(name));
}

/** Engine / seat ids for fund rivals (`bot-rival`, `bot-0`, `bot-1`, …). */
export function isBotPlayerId(id: string): boolean {
  return id === "bot-rival" || /^bot-\d+$/.test(id);
}

/** Resolve a preferred fund name from a URL slug or display name. */
export function resolveBotFundName(
  raw: string | null | undefined,
  exclude: string[] = [],
): string | null {
  if (!raw?.trim()) return null;
  const blocked = new Set(exclude.map((n) => n.toLowerCase()));
  const q = decodeURIComponent(raw).trim();
  const byName = botFundByName(q);
  if (byName && !blocked.has(byName.name.toLowerCase())) return byName.name;
  const bySlug = BOT_FUNDS.find((f) => botFundSlug(f.name) === botFundSlug(q));
  if (bySlug && !blocked.has(bySlug.name.toLowerCase())) return bySlug.name;
  return null;
}

export function botFundSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function botFundLogoSrc(name: string): string | undefined {
  if (!isBotFundName(name)) return undefined;
  return `/funds/${botFundSlug(name)}.svg`;
}
