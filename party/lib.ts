import type { Connection } from "partyserver";
import type { ServerMessage } from "../src/shared/types";

/** First fund seat keeps this id for vs-human / tests. */
export const BOT_ID = "bot-rival";
export const BOT_MAX_STEPS = 4000;

export function send(conn: Connection, msg: ServerMessage) {
  conn.send(JSON.stringify(msg));
}

export function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Chunked sleep so cancelBotLoop (botGen++) aborts within ~50ms. */
export async function sleepWhile(
  ms: number,
  still: () => boolean,
): Promise<boolean> {
  const step = 50;
  let left = ms;
  while (left > 0) {
    if (!still()) return false;
    const chunk = Math.min(step, left);
    await sleep(chunk);
    left -= chunk;
  }
  return still();
}

export function isFxCardPending(
  pending: { type: string } | null | undefined,
): boolean {
  return (
    pending?.type === "info" ||
    pending?.type === "price_reaction" ||
    pending?.type === "regime"
  );
}