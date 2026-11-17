import type { FundKind } from "@/lib/game/bots/botRoster";
import type { MessageKey } from "@/lib/i18n";

const KIND_KEY: Record<FundKind, MessageKey> = {
  index: "fund.kind.index",
  value: "fund.kind.value",
  growth: "fund.kind.growth",
  sovereign: "fund.kind.sovereign",
  activist: "fund.kind.activist",
  event: "fund.kind.event",
  multi_strat: "fund.kind.multi_strat",
  macro: "fund.kind.macro",
  quant: "fund.kind.quant",
  market_make: "fund.kind.market_make",
};

const KIND_SHORT: Record<FundKind, MessageKey> = {
  index: "fund.kindShort.index",
  value: "fund.kindShort.value",
  growth: "fund.kindShort.growth",
  sovereign: "fund.kindShort.sovereign",
  activist: "fund.kindShort.activist",
  event: "fund.kindShort.event",
  multi_strat: "fund.kindShort.multi_strat",
  macro: "fund.kindShort.macro",
  quant: "fund.kindShort.quant",
  market_make: "fund.kindShort.market_make",
};

export function fundKindLabelKey(kind: FundKind): MessageKey {
  return KIND_KEY[kind];
}

export function fundKindShortKey(kind: FundKind): MessageKey {
  return KIND_SHORT[kind];
}
