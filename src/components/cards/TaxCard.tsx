"use client";

import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { money } from "@/lib/money";

type TaxKind = "income" | "wealth";

export function TaxCard({
  amount,
  kind = "income",
  footer,
  compact = false,
}: {
  amount: number;
  kind?: TaxKind;
  footer?: ReactNode;
  compact?: boolean;
}) {
  const t = useT();
  const top = kind === "wealth" ? t("tax.wealthTop") : t("tax.incomeTop");
  const art =
    kind === "wealth" ? "/tiles/wealth-tax.svg" : "/tiles/income-tax.svg";

  return (
    <article
      className={`mono-corner-card mono-corner-tax is-${kind}${compact ? " is-compact" : ""}`}
    >
      <div className="mono-corner-shell">
        <div className="mono-corner-face">
          <p className="mono-corner-top">{top}</p>
          <div className="mono-corner-art-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="mono-corner-art" src={art} alt="" draggable={false} />
          </div>
          <p className="mono-corner-bottom">{t("tax.bottom")}</p>
          <p className="mono-corner-amount">{money(amount)}</p>
          <p className="mono-corner-note">
            {t("tax.note", { amount: money(amount) })}
          </p>
        </div>
      </div>
      {footer}
    </article>
  );
}
