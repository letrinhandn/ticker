/**
 * Thin helpers over fund-kind strategies (kept for callers that imported profiles).
 */
import { botFundByName, type FundKind } from "./botRoster";
import { strategyForKind, type FundStrategy } from "./fundStrategies";

export type { BotTradeStance } from "./botDesk";
export type { FundKind };

export type BotProfile = FundStrategy & { kind: FundKind };

export function botProfileForName(name: string | undefined | null): BotProfile {
  const kind = (name && botFundByName(name)?.kind) || "multi_strat";
  return strategyForKind(kind);
}
