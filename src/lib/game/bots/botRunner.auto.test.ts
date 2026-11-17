import { describe, expect, it } from "vitest";
import { createGame } from "../engine";
import { isBotPlayerId } from "./botRoster";
import { runBotUntilHuman } from "./botRunner";

describe("two-bot auto-play runner", () => {
  it("runs until one fund is bankrupt or step cap", () => {
    let g = createGame(
      [
        { id: "bot-rival", name: "Citadel", token: "amber" },
        { id: "bot-1", name: "Bridgewater", token: "teal" },
      ],
      () => 0.42,
    );

    g = runBotUntilHuman(g, isBotPlayerId, () => 0.37, 200);

    const bots = g.players.filter((p) => isBotPlayerId(p.id));
    expect(bots).toHaveLength(2);
    // Either finished, or still playing after cap — must stay authoritative.
    expect(g.phase === "finished" || g.phase === "playing").toBe(true);
    if (g.phase === "finished") {
      expect(g.winnerId && isBotPlayerId(g.winnerId)).toBe(true);
    }
  });
});
