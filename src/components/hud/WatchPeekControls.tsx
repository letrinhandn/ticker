"use client";

import { money } from "@/lib/money";
import { useT } from "@/lib/i18n";
import { HALT_FINE } from "@/shared/types";
import { playSfx } from "@/lib/sfx/sounds";

export function WatchPeekControls({
  myTradeOpen,
  peekAway,
  onShowTradeAgain,
  haltPending,
  isMyTurn,
  diceRolling,
  canPayFine,
  onRoll,
  onPayJail,
  canEnd,
  onEndTurn,
  isSpectator,
  isAwaySeat,
  isAutoPlay,
  isBotTurn,
  currentName,
  tokensMoving,
}: {
  myTradeOpen: boolean;
  peekAway: boolean;
  onShowTradeAgain: () => void;
  haltPending: boolean;
  isMyTurn: boolean;
  diceRolling: boolean;
  canPayFine: boolean;
  onRoll: () => void;
  onPayJail: () => void;
  canEnd: boolean;
  onEndTurn: () => void;
  isSpectator: boolean;
  isAwaySeat: boolean;
  isAutoPlay: boolean;
  isBotTurn: boolean;
  currentName: string | undefined;
  tokensMoving: boolean;
}) {
  const t = useT();

  return (
    <div className="hud-center-actions">
      {myTradeOpen && peekAway && (
        <button
          type="button"
          className="hud-chip hud-chip-pulse"
          onClick={onShowTradeAgain}
        >
          {t("trade.backToDesk")}
        </button>
      )}

      {haltPending && isMyTurn && (
        <div className="hud-chip-row">
          <button
            type="button"
            className="hud-chip hud-chip-pulse"
            disabled={diceRolling}
            onClick={onRoll}
          >
            {t("hud.tapDoubles")}
          </button>
          {canPayFine && (
            <button type="button" className="hud-chip" onClick={onPayJail}>
              {t("hud.payFine", { amount: money(HALT_FINE) })}
            </button>
          )}
        </div>
      )}

      {canEnd && (
        <button
          type="button"
          className="hud-end hud-end-pulse"
          onClick={() => {
            playSfx("turn");
            onEndTurn();
          }}
        >
          {t("hud.endTurn")}
        </button>
      )}

      {isSpectator && (
        <p className="hud-wait hud-spectating">
          {isAwaySeat
            ? t("hud.seatAway")
            : isAutoPlay
              ? t("hud.watchingAuto")
              : t("hud.spectating")}
        </p>
      )}
      {isBotTurn && currentName && !isSpectator && (
        <p className="hud-wait">
          {diceRolling
            ? t("hud.fundRolling", { name: currentName })
            : tokensMoving
              ? t("hud.fundMoving", { name: currentName })
              : t("hud.fundTurn", { name: currentName })}
        </p>
      )}
      {!isMyTurn && !isBotTurn && !isSpectator && currentName && (
        <p className="hud-wait">
          {t("hud.playerTurn", { name: currentName })}
        </p>
      )}
    </div>
  );
}
