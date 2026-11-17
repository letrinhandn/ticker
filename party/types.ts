import type { LobbySeat } from "../src/shared/types";

export type ConnState = { playerId?: string };

export type PersistedLobby = {
  hostId: string | null;
  seats: LobbySeat[];
  openSlots: number;
  viewers: string[];
  waitingNames: [string, string][];
  autoPlay: boolean;
  botSeq: number;
};

/** Avoid importing PlotRoom here — that cycle breaks Wrangler DO exports. */
export type Env = {
  PlotRoom: DurableObjectNamespace;
  NEXT_PUBLIC_PARTY_HOST?: string;
};
