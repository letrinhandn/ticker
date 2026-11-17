"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createGame } from "@/lib/game/engine";
import { GameFxProvider } from "@/lib/fx/GameFxContext";
import { useT } from "@/lib/i18n";
import { RoomProvider, useRoom } from "@/lib/net/RoomContext";
import { BrowseHoldProvider } from "@/lib/ui/BrowseHoldContext";
import { Board } from "@/components/board/Board";
import { BoardBackdrop } from "@/components/board/BoardBackdrop";
import { GameHUD } from "@/components/hud/GameHUD";
import { GameSettings } from "@/components/hud/GameSettings";
import { MenuStage } from "@/components/shell/MenuDialog";
import { nextPlayerToken, type PlayerToken } from "@/shared/types";
import { Lobby } from "./Lobby";

function RoomTopBar({ roomCode }: { roomCode: string }) {
  const t = useT();
  return (
    <header className="topbar topbar-slim">
      <Link href="/" className="brand-link">
        {t("brand.name")}
      </Link>
      <div className="topbar-end">
        <GameSettings roomCode={roomCode} />
        <span className="topbar-code">{roomCode.toUpperCase()}</span>
      </div>
    </header>
  );
}

function lobbyPreviewSeats(
  seats: { playerId: string; name: string; token: PlayerToken }[],
) {
  if (seats.length >= 2) {
    return seats.map((s) => ({
      id: s.playerId,
      name: s.name,
      token: s.token,
    }));
  }
  const used: PlayerToken[] = seats.map((s) => s.token);
  const filled = seats.map((s) => ({
    id: s.playerId,
    name: s.name,
    token: s.token,
  }));
  while (filled.length < 2) {
    const token = nextPlayerToken(used);
    used.push(token);
    filled.push({
      id: `preview-${filled.length}`,
      name: filled.length === 0 ? "A" : "B",
      token,
    });
  }
  return filled;
}

function RoomInner({
  preferWatch = false,
  fund1,
  fund2,
  roomCode,
}: {
  preferWatch?: boolean;
  fund1?: string;
  fund2?: string;
  roomCode: string;
}) {
  const t = useT();
  const { snapshot, status, error } = useRoom();
  const [lobbyOpen, setLobbyOpen] = useState(true);
  const playing = Boolean(snapshot?.game && snapshot.game.phase !== "lobby");

  const seatKey = (snapshot?.seats ?? [])
    .map((s) => `${s.playerId}:${s.token}:${s.name}`)
    .join("|");
  const previewGame = useMemo(() => {
    const seats = snapshot?.seats ?? [];
    return createGame(lobbyPreviewSeats(seats), () => 0.42);
    // Recreate when seat roster changes so tokens/names match the lobby.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seatKey encodes seats
  }, [seatKey]);

  if (status === "rejected") {
    return (
      <div className="page-pad">
        <div className="panel">
          <h2>{t("room.cantJoin")}</h2>
          <p>{error}</p>
          <Link className="btn btn-primary" href="/">
            {t("room.backHome")}
          </Link>
        </div>
      </div>
    );
  }

  if (playing && snapshot?.game) {
    return (
      <>
        <RoomTopBar roomCode={roomCode} />
        <GameFxProvider>
          <BrowseHoldProvider>
            <div className="game-stage">
              <Board game={snapshot.game} />
              <GameHUD />
            </div>
          </BrowseHoldProvider>
        </GameFxProvider>
      </>
    );
  }

  // Lobby: modal over the table; tap outside to peek the real board (browse only).
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <BrowseHoldProvider>
        <div className="absolute inset-0 z-0">
          {lobbyOpen ? (
            <BoardBackdrop blurred />
          ) : (
            // Must fill the stage: an unsized .game-stage collapses and fit-scale
            // locks to minScale (tiny board stuck at the top).
            <div className="game-stage pointer-events-auto absolute inset-0 h-full w-full">
              <Board game={previewGame} fillStage />
            </div>
          )}
        </div>

        {lobbyOpen ? (
          <>
            <div
              className="pointer-events-none absolute inset-0 z-10"
              style={{
                background:
                  "radial-gradient(ellipse at 50% 45%, rgba(8, 18, 12, 0.2), rgba(8, 18, 12, 0.7) 72%)",
              }}
              aria-hidden
            />
            <MenuStage onDismiss={() => setLobbyOpen(false)}>
              <Lobby preferWatch={preferWatch} fund1={fund1} fund2={fund2} />
            </MenuStage>
          </>
        ) : (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-50 flex justify-center p-3"
            style={{
              paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))",
              paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0px))",
              paddingRight: "max(0.75rem, env(safe-area-inset-right, 0px))",
            }}
          >
            <button
              type="button"
              className="pointer-events-auto rounded-full border border-white/20 bg-[rgba(14,32,22,0.88)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#f2efe6] shadow-lg backdrop-blur-md"
              onClick={() => setLobbyOpen(true)}
              aria-label={t("lobby.reopen")}
            >
              {t("lobby.reopen")}
            </button>
          </div>
        )}
      </BrowseHoldProvider>
    </div>
  );
}

export function GameRoom({
  roomCode,
  name,
  withBot = false,
  preferWatch = false,
  fund1,
  fund2,
}: {
  roomCode: string;
  name: string;
  withBot?: boolean;
  preferWatch?: boolean;
  fund1?: string;
  fund2?: string;
}) {
  return (
    <RoomProvider
      roomCode={roomCode}
      name={name}
      withBot={withBot}
      botMode={{
        vsBot: withBot && !preferWatch,
        autoBots: false,
        fund1,
        fund2,
      }}
    >
      <div className="room-root">
        <RoomInner
          roomCode={roomCode}
          preferWatch={preferWatch}
          fund1={fund1}
          fund2={fund2}
        />
      </div>
    </RoomProvider>
  );
}
