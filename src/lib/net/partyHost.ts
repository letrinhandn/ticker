/** PartyServer host for partysocket. Local wrangler uses 8787. */
export function getPartyHost(): string {
  if (typeof window !== "undefined") {
    const fromEnv = process.env.NEXT_PUBLIC_PARTY_HOST;
    if (fromEnv) return fromEnv.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
  const fromEnv = process.env.NEXT_PUBLIC_PARTY_HOST;
  if (fromEnv) return fromEnv.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return "localhost:8787";
}

export const PARTY_NAME = "plot-room";
