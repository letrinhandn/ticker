"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { PartySocket } from "partysocket";
import type { ClientMessage, RoomSnapshot, ServerMessage } from "@/shared/types";
import { getPartyHost, PARTY_NAME } from "./partyHost";
import { getOrCreatePlayerId } from "./playerId";

type RoomContextValue = {
  playerId: string | null;
  snapshot: RoomSnapshot | null;
  status: "connecting" | "connected" | "rejected" | "error" | "closed";
  error: string | null;
  send: (msg: ClientMessage) => void;
  diceRolling: boolean;
  setDiceRolling: (v: boolean) => void;
  tokensMoving: boolean;
  setTokensMoving: (v: boolean) => void;
};

const RoomContext = createContext<RoomContextValue | null>(null);

export type RoomBotMode = {
  /** Classic vs one fund (`?bot=1`). */
  vsBot?: boolean;
  /** Spectator auto-play with two funds (`?bots=2`). */
  autoBots?: boolean;
  fund1?: string;
  fund2?: string;
};

export function RoomProvider({
  roomCode,
  name,
  withBot = false,
  botMode,
  children,
}: {
  roomCode: string;
  name: string;
  withBot?: boolean;
  botMode?: RoomBotMode;
  children: ReactNode;
}) {
  const vsBot = botMode?.vsBot ?? withBot;
  const autoBots = botMode?.autoBots ?? false;
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [status, setStatus] = useState<RoomContextValue["status"]>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [diceRolling, setDiceRolling] = useState(false);
  const [tokensMoving, setTokensMoving] = useState(false);
  const socketRef = useRef<PartySocket | null>(null);
  const snapshotRef = useRef<RoomSnapshot | null>(null);
  const diceRollingRef = useRef(false);
  const remoteRollTimer = useRef<number | null>(null);

  useEffect(() => {
    diceRollingRef.current = diceRolling;
  }, [diceRolling]);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    const id = getOrCreatePlayerId();
    const host = getPartyHost();
    const query: Record<string, string> = { playerId: id, name };
    // Lobby owns seat setup — do not request auto-bot via query.

    const socket = new PartySocket({
      host,
      party: PARTY_NAME,
      room: roomCode.toLowerCase(),
      query,
    });
    socketRef.current = socket;
    queueMicrotask(() => setStatus("connecting"));

    const onMessage = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(String(ev.data)) as ServerMessage;
        if (data.type === "welcome") {
          setPlayerId(data.playerId);
          setSnapshot(data.snapshot);
          setStatus("connected");
          setError(null);
        } else if (data.type === "snapshot") {
          const prevDice = snapshotRef.current?.game?.lastDice ?? null;
          const nextDice = data.snapshot.game?.lastDice ?? null;
          const diceChanged =
            JSON.stringify(prevDice) !== JSON.stringify(nextDice) &&
            nextDice != null;

          setSnapshot(data.snapshot);
          setStatus("connected");
          setError(null);

          // Bot / other client rolls: dice first, then hop — hold cards until arrival.
          if (diceChanged && !diceRollingRef.current) {
            setDiceRolling(true);
            setTokensMoving(true);
            void import("@/lib/sfx/sounds").then(({ playDiceRoll }) => {
              playDiceRoll();
            });
            if (remoteRollTimer.current) {
              window.clearTimeout(remoteRollTimer.current);
            }
            remoteRollTimer.current = window.setTimeout(() => {
              setDiceRolling(false);
            }, 1400);
          }
        } else if (data.type === "rejected") {
          setStatus("rejected");
          setError(data.reason);
        } else if (data.type === "error") {
          setError(data.message);
        }
      } catch {
        setError("Bad server message");
      }
    };

    const onOpen = () => setStatus("connected");
    const onClose = () => setStatus("closed");
    const onError = () => {
      setStatus("error");
      setError("Connection failed. Is the realtime server running?");
    };

    socket.addEventListener("message", onMessage);
    socket.addEventListener("open", onOpen);
    socket.addEventListener("close", onClose);
    socket.addEventListener("error", onError);

    return () => {
      socket.removeEventListener("message", onMessage);
      socket.removeEventListener("open", onOpen);
      socket.removeEventListener("close", onClose);
      socket.removeEventListener("error", onError);
      socket.close();
      socketRef.current = null;
      if (remoteRollTimer.current) window.clearTimeout(remoteRollTimer.current);
    };
  }, [roomCode, name, vsBot, autoBots, botMode?.fund1, botMode?.fund2]);

  const send = useCallback(
    (msg: ClientMessage) => {
      const id = playerId ?? getOrCreatePlayerId();
      // sessionId = sender (do not overwrite msg.playerId used by kick/replace_bot).
      socketRef.current?.send(JSON.stringify({ ...msg, sessionId: id }));
    },
    [playerId],
  );

  const value = useMemo(
    () => ({
      playerId,
      snapshot,
      status,
      error,
      send,
      diceRolling,
      setDiceRolling,
      tokensMoving,
      setTokensMoving,
    }),
    [playerId, snapshot, status, error, send, diceRolling, tokensMoving],
  );

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoom() {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error("useRoom outside RoomProvider");
  return ctx;
}
