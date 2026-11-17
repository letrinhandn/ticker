import type { GameState } from "@/shared/types";
import { BALANCE } from "../balance/knobs";
import { BOARD, isListedCompany } from "../board";
import type { EngineAction } from "../engine";
import {
  buildDeskView,
  sellTrigger,
  type BotTradeStance,
} from "./botDesk";
import { botFundByName } from "./botRoster";
import { actionForDesk, strategyForKind } from "./fundStrategies";

export type { BotTradeStance } from "./botDesk";

/**
 * Pick a trade stance for this desk open — dispatched by fund kind.
 */
export function chooseBotTradeStance(
  state: GameState,
  botId: string,
  focus: number,
): BotTradeStance {
  const desk = buildDeskView(state, botId, focus);
  if (!desk) return "cash_hold";
  return strategyForKind(desk.kind).chooseStance(desk);
}

/**
 * Skill bot: each fund kind runs its own playbook
 * (index / value / growth / activist / quant / MM / …).
 */
export function chooseBotAction(state: GameState, botId: string): EngineAction | null {
  if (state.phase !== "playing") return null;
  const player = state.players.find((p) => p.id === botId);
  const current = state.players[state.turnIndex];
  if (!player || player.bankrupt || !current || current.id !== botId) return null;

  const pending = state.pending;
  const kind = botFundByName(player.name)?.kind ?? "multi_strat";
  const strat = strategyForKind(kind);

  if (
    pending?.type === "info" ||
    pending?.type === "price_reaction" ||
    pending?.type === "regime"
  ) {
    return { type: "dismiss" };
  }

  if (pending?.type === "trade") {
    const focus = pending.focusTile;
    if (
      focus == null ||
      !BOARD[focus] ||
      !isListedCompany(BOARD[focus]!)
    ) {
      return { type: "trade", action: "skip" };
    }
    const desk = buildDeskView(state, botId, focus);
    if (!desk) return { type: "trade", action: "skip" };
    const stance = strat.chooseStance(desk);
    return actionForDesk(desk, stance);
  }

  if (pending?.type === "halt") {
    if (player.jailTurns >= 1 && pending.canPay) return { type: "pay_jail" };
    if (
      pending.canPay &&
      player.cash >= BALANCE.haltFine + sellTrigger(player.cash, strat.raiseCashMult)
    ) {
      return { type: "pay_jail" };
    }
    return { type: "roll" };
  }

  if (!state.lastDice) {
    return { type: "roll" };
  }

  return { type: "end_turn" };
}

export function botStepDelayMs(action: EngineAction): number {
  switch (action.type) {
    case "roll":
      return 4200;
    case "dismiss":
      return 80;
    case "trade":
      return action.action === "skip" ? 500 : 1400;
    case "pay_jail":
      return 700;
    case "end_turn":
      return 80;
    default:
      return 400;
  }
}
