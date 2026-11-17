import type { BalanceScenario } from "./types";

export const BALANCE_SCENARIOS: BalanceScenario[] = [
  { id: "smoke2", players: 2, maxTurns: 25, vitestGames: 20, cliGames: 200 },
  {
    id: "standard2",
    players: 2,
    maxTurns: 40,
    vitestGames: 50,
    cliGames: 500,
  },
  {
    id: "standard4",
    players: 4,
    maxTurns: 40,
    vitestGames: 30,
    cliGames: 300,
  },
  { id: "shortCap", players: 2, maxTurns: 15, vitestGames: 20, cliGames: 200 },
];

export function scenarioById(id: string): BalanceScenario {
  const s = BALANCE_SCENARIOS.find((x) => x.id === id);
  if (!s) {
    throw new Error(
      `Unknown scenario "${id}". Known: ${BALANCE_SCENARIOS.map((x) => x.id).join(", ")}`,
    );
  }
  return s;
}
