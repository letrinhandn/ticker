"use client";

import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { money } from "@/lib/money";
import { HALT_FINE } from "@/shared/types";

type Variant = "halt" | "goto_halt" | "free" | "go";

export function MonopolyCornerCard({
  variant,
  footer,
  compact = false,
}: {
  variant: Variant;
  footer?: ReactNode;
  compact?: boolean;
}) {
  const t = useT();
  const c =
    variant === "go"
      ? {
          top: t("corner.goTop"),
          bottom: t("corner.goBottom"),
          art: "/tiles/start.svg",
          note: t("corner.goNote"),
          faceClass: "mono-corner-go",
        }
      : variant === "free"
        ? {
            top: t("corner.freeTop"),
            bottom: t("corner.freeBottom"),
            art: "/tiles/weekend.svg",
            note: t("corner.freeNote"),
            faceClass: "",
          }
        : variant === "halt"
          ? {
              top: t("corner.secTop"),
              bottom: t("corner.secBottom"),
              art: "/tiles/sec.svg",
              note: t("corner.secNote", { amount: money(HALT_FINE) }),
              faceClass: "",
            }
          : {
              top: t("corner.gotoTop"),
              bottom: t("corner.gotoBottom"),
              art: "/tiles/to-sec.svg",
              note: t("corner.gotoNote"),
              faceClass: "",
            };

  return (
    <article
      className={`mono-corner-card mono-corner-${variant}${c.faceClass ? ` ${c.faceClass}` : ""}${compact ? " is-compact" : ""}`}
    >
      <div className="mono-corner-shell">
        <div className="mono-corner-face">
          <p className="mono-corner-top">{c.top}</p>
          <div className="mono-corner-art-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="mono-corner-art"
              src={c.art}
              alt=""
              draggable={false}
            />
          </div>
          <p className="mono-corner-bottom">{c.bottom}</p>
          {variant === "go" ? (
            <ul className="mono-corner-bullets">
              <li>{t("corner.goBulletTax")}</li>
              <li>{t("corner.goBulletOps")}</li>
              <li>{t("corner.goBulletTrade")}</li>
            </ul>
          ) : (
            <p className="mono-corner-note">{c.note}</p>
          )}
        </div>
      </div>
      {footer}
    </article>
  );
}
