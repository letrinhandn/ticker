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
      className={`corner-deed-card corner-deed-tax is-${kind}${compact ? " is-compact" : ""}`}
    >
      <div className="corner-deed-shell">
        <div className="corner-deed-face">
          <p className="corner-deed-top">{top}</p>
          <div className="corner-deed-art-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="corner-deed-art" src={art} alt="" draggable={false} />
          </div>
          <p className="corner-deed-bottom">{t("tax.bottom")}</p>
          <p className="corner-deed-amount">{money(amount)}</p>
          <p className="corner-deed-note">
            {t("tax.note", { amount: money(amount) })}
          </p>
        </div>
      </div>
      {footer}
    </article>
  );
}
