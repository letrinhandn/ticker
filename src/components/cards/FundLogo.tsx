"use client";

import { botFundByName, botFundLogoSrc } from "@/lib/game/bots/botRoster";

export function FundLogo({
  name,
  className = "",
  size = 28,
}: {
  name: string;
  className?: string;
  size?: number;
}) {
  const fund = botFundByName(name);
  const src = botFundLogoSrc(name);
  if (!fund || !src) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={`fund-logo ${className}`.trim()}
      src={src}
      alt=""
      width={size}
      height={size}
      draggable={false}
      style={{
        width: size,
        height: size,
        borderRadius: Math.max(6, Math.round(size * 0.22)),
        objectFit: "cover",
        flex: "0 0 auto",
        boxShadow: "0 0 0 1px rgba(0,0,0,0.2), 0 2px 6px rgba(0,0,0,0.18)",
        background: fund.color,
      }}
    />
  );
}
