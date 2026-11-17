import type { GameState } from "@/shared/types";
import { chooseBotAction, botStepDelayMs } from "./bot";
import { applyAction, type EngineAction } from "../engine";

export type BotStep = {
  action: EngineAction;
  state: GameState;
  delayMs: number;
};

/**
 * Advance the bot one legal action. Returns null when it is no longer the bot's turn
 * (or the game ended / bot cannot move).
 */
export function stepBot(
  state: GameState,
  botId: string,
  isBot: (playerId: string) => boolean,
  rng: () => number = Math.random,
): BotStep | null {
  if (state.phase !== "playing") return null;
  const current = state.players[state.turnIndex];
  if (!current || current.bankrupt || !isBot(current.id) || current.id !== botId) {
    return null;
  }

  let action = chooseBotAction(state, botId);
  if (!action) return null;

  let next = applyAction(state, botId, action, rng);

  // Unstick: if the chosen action was a no-op, force a safe progress action.
  if (sameFingerPrint(state, next)) {
    action = forceProgress(state);
    if (!action) return null;
    next = applyAction(state, botId, action, rng);
    if (sameFingerPrint(state, next)) return null;
  }

  return { action, state: next, delayMs: botStepDelayMs(action) };
}

function sameFingerPrint(a: GameState, b: GameState) {
  return (
    a.turnIndex === b.turnIndex &&
    JSON.stringify(a.pending) === JSON.stringify(b.pending) &&
    JSON.stringify(a.lastDice) === JSON.stringify(b.lastDice) &&
    a.log[0] === b.log[0] &&
    a.players[a.turnIndex]?.cash === b.players[b.turnIndex]?.cash
  );
}

function forceProgress(state: GameState): EngineAction | null {
  const pending = state.pending;
  if (
    pending?.type === "info" ||
    pending?.type === "price_reaction" ||
    pending?.type === "regime"
  ) {
    return { type: "dismiss" };
  }
  if (pending?.type === "trade") {
    return { type: "trade", action: "skip" };
  }
  if (pending?.type === "halt") {
    return pending.canPay ? { type: "pay_jail" } : { type: "roll" };
  }
  if (!state.lastDice) return { type: "roll" };
  return { type: "end_turn" };
}

/** Run until a human must act (or cap). Used by tests / sync hosts. */
export function runBotUntilHuman(
  state: GameState,
  isBot: (playerId: string) => boolean,
  rng: () => number = Math.random,
  maxSteps = 48,
): GameState {
  let cur = state;
  for (let i = 0; i < maxSteps; i++) {
    const current = cur.players[cur.turnIndex];
    if (!current || cur.phase !== "playing" || !isBot(current.id)) return cur;
    const step = stepBot(cur, current.id, isBot, rng);
    if (!step) return cur;
    cur = step.state;
  }
  return cur;
}
