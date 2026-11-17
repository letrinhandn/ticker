import { money } from "@/lib/money";

export function settleSummary(
  t: (key: "settle.failed" | "settle.buy" | "settle.sell", vars?: Record<string, string | number>) => string,
  side: "buy" | "sell",
  shares: number,
  settlePrice: number,
  totalCash: number,
): string {
  if (shares <= 0) return t("settle.failed");
  return t(side === "buy" ? "settle.buy" : "settle.sell", {
    shares,
    price: money(settlePrice),
    total: money(totalCash),
  });
}
