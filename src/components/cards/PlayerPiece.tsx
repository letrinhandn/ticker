"use client";

import {
  botFundByName,
  isBotFundName,
  isBotPlayerId,
} from "@/lib/game/bots/botRoster";
import type { PlayerToken } from "@/shared/types";
import { FundLogo } from "./FundLogo";

const TOKEN_HEX: Record<PlayerToken, string> = {
  amber: "#e8a54b",
  teal: "#3ecfbe",
  rose: "#e07a8a",
  violet: "#9b7edc",
};

/** Shared seat mark — same face on HUD cards and board tokens. */
export function PlayerPiece({
  name,
  playerId,
  token,
  size = 22,
  className = "",
  jailed = false,
}: {
  name: string;
  playerId?: string;
  token: PlayerToken;
  size?: number;
  className?: string;
  jailed?: boolean;
}) {
  const isFund =
    isBotFundName(name) || (playerId != null && isBotPlayerId(playerId));
  const fund = botFundByName(name);

  if (isFund && fund) {
    return (
      <span
        className={`player-piece is-fund${jailed ? " is-jailed" : ""}${className ? ` ${className}` : ""}`}
        style={{ width: size, height: size }}
        aria-hidden
      >
        <FundLogo name={name} size={size} className="player-piece-fund" />
      </span>
    );
  }

  const initial = (name.trim().charAt(0) || "?").toUpperCase();
  return (
    <span
      className={`player-piece is-human token-${token}${jailed ? " is-jailed" : ""}${className ? ` ${className}` : ""}`}
      style={{
        width: size,
        height: size,
        background: TOKEN_HEX[token],
        fontSize: Math.max(10, Math.round(size * 0.48)),
      }}
      aria-hidden
    >
      {initial}
    </span>
  );
}

export function seatAccentColor(name: string, token: PlayerToken): string {
  return botFundByName(name)?.color ?? TOKEN_HEX[token];
}
