"use client";

import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { money } from "@/lib/money";
import { HALT_FINE } from "@/shared/types";

type Variant = "halt" | "goto_halt" | "free" | "go";

export function CornerDeedCard({
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
          faceClass: "corner-deed-go",
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
      className={`corner-deed-card corner-deed-${variant}${c.faceClass ? ` ${c.faceClass}` : ""}${compact ? " is-compact" : ""}`}
    >
      <div className="corner-deed-shell">
        <div className="corner-deed-face">
          <p className="corner-deed-top">{c.top}</p>
          <div className="corner-deed-art-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="corner-deed-art"
              src={c.art}
              alt=""
              draggable={false}
            />
          </div>
          <p className="corner-deed-bottom">{c.bottom}</p>
          {variant === "go" ? (
            <ul className="corner-deed-bullets">
              <li>{t("corner.goBulletTax")}</li>
              <li>{t("corner.goBulletOps")}</li>
              <li>{t("corner.goBulletTrade")}</li>
            </ul>
          ) : (
            <p className="corner-deed-note">{c.note}</p>
          )}
        </div>
      </div>
      {footer}
    </article>
  );
}
