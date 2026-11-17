"use client";

import { AnimatedHudCash } from "@/components/hud/AnimatedHudCash";
import { PlayerPiece, seatAccentColor } from "@/components/cards/PlayerPiece";
import { useGameFxOptional } from "@/lib/fx/GameFxContext";
import { portfolioValue } from "@/lib/game/pricing";
import { useT } from "@/lib/i18n";
import { moneySeat } from "@/lib/money";
import type { GameState } from "@/shared/types";

const SEAT_CORNERS = ["bl", "tr", "tl", "br"] as const;

export function SeatStrip({
  game,
  playerId,
  currentId,
  diceRolling,
  tokensMoving,
  onOpenProfile,
}: {
  game: GameState;
  playerId: string;
  currentId: string | undefined;
  diceRolling: boolean;
  tokensMoving: boolean;
  onOpenProfile: (id: string) => void;
}) {
  const t = useT();
  const fx = useGameFxOptional();

  return (
    <>
      {game.players.map((p, i) => {
        const corner = SEAT_CORNERS[i] ?? "br";
        const active = currentId === p.id;
        const mine = p.id === playerId;
        const shares = game.holdings
          .filter((x) => x.ownerId === p.id)
          .reduce((s, h) => s + h.shares, 0);
        const shownCash = fx?.displayCash[p.id] ?? p.cash;
        const book =
          fx?.holdingsVisual != null
            ? { ...game, holdings: fx.holdingsVisual }
            : game;
        const assets = portfolioValue(
          book,
          p.id,
          fx?.seatSectorVisual ?? fx?.sectorVisual ?? game.sectorIndex,
        );
        const shownWorth = shownCash + assets;
        const flash = fx?.cashFlash[p.id];
        const accent = seatAccentColor(p.name, p.token);
        const status = p.bankrupt
          ? t("hud.out")
          : p.inJail
            ? t("hud.sec")
            : active
              ? diceRolling
                ? t("hud.rolling")
                : tokensMoving
                  ? t("hud.moving")
                  : t("hud.turn")
              : t("hud.sharesCount", { count: shares });
        return (
          <button
            type="button"
            key={p.id}
            className={`hud-player hud-${corner}${active ? " is-active" : ""}${mine ? " is-me" : ""}${p.bankrupt ? " is-out" : ""}${fx?.bankruptPlayerId === p.id ? " is-busting" : ""}`}
            style={{ ["--seat-accent" as string]: accent }}
            onClick={() => onOpenProfile(p.id)}
            aria-label={t("hud.openProfile", { name: p.name })}
          >
            <PlayerPiece
              name={p.name}
              playerId={p.id}
              token={p.token}
              size={28}
              jailed={p.inJail}
              className="hud-seat-piece"
            />
            <div className="hud-player-meta">
              <p className="hud-name">
                {p.name}
                {mine ? ` (${t("common.you")})` : ""}
              </p>
              <AnimatedHudCash
                playerId={p.id}
                value={shownWorth}
                flash={flash}
              />
              <p className="hud-sub">
                {p.bankrupt
                  ? status
                  : t("hud.seatMeta", {
                      cash: moneySeat(shownCash),
                      status,
                    })}
              </p>
            </div>
          </button>
        );
      })}
    </>
  );
}
