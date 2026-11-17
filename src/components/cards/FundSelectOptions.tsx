"use client";

import {
  BOT_FUNDS,
  FUND_KIND_ORDER,
  type FundKind,
} from "@/lib/game/bots/botRoster";
import { useT, type MessageKey } from "@/lib/i18n";

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

/** `<optgroup>` list for fund pickers — by fund kind. */
export function FundSelectOptions({
  disabledNames = [],
}: {
  disabledNames?: string[];
}) {
  const t = useT();
  const blocked = new Set(disabledNames.map((n) => n.toLowerCase()));

  return (
    <>
      {FUND_KIND_ORDER.map((kind) => {
        const funds = BOT_FUNDS.filter((f) => f.kind === kind);
        if (funds.length === 0) return null;
        return (
          <optgroup key={kind} label={t(KIND_KEY[kind])}>
            {funds.map((f) => (
              <option
                key={f.name}
                value={f.name}
                disabled={blocked.has(f.name.toLowerCase())}
                title={f.blurb}
              >
                {f.name}
              </option>
            ))}
          </optgroup>
        );
      })}
    </>
  );
}

export function fundKindLabelKey(kind: FundKind): MessageKey {
  return KIND_KEY[kind];
}

export function fundKindShortKey(kind: FundKind): MessageKey {
  return KIND_SHORT[kind];
}
