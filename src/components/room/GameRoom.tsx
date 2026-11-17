"use client";

import { useT } from "@/lib/i18n";
import { GameFxProvider } from "@/lib/fx/GameFxContext";
import { RoomProvider, useRoom } from "@/lib/net/RoomContext";
import { BrowseHoldProvider } from "@/lib/ui/BrowseHoldContext";
import { Board } from "@/components/board/Board";
import { BoardBackdrop } from "@/components/board/BoardBackdrop";
import { GameHUD } from "@/components/hud/GameHUD";
import { GameSettings } from "@/components/hud/GameSettings";
import { MenuStage } from "@/components/shell/MenuDialog";
import { Lobby } from "./Lobby";

function RoomTopBar({ roomCode }: { roomCode: string }) {
  const t = useT();
  return (
    <header className="topbar topbar-slim">
      <a
        href="/"
        className="brand-link"
        onClick={(e) => {
          e.preventDefault();
          window.location.assign("/");
        }}
      >
        {t("brand.name")}
      </a>
      <div className="topbar-end">
        <GameSettings roomCode={roomCode} />
        <span className="topbar-code">{roomCode.toUpperCase()}</span>
      </div>
    </header>
  );
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
  const playing = Boolean(snapshot?.game && snapshot.game.phase !== "lobby");

  if (status === "rejected") {
    return (
      <div className="page-pad">
        <div className="panel">
          <h2>{t("room.cantJoin")}</h2>
          <p>{error}</p>
          <a
            className="btn btn-primary"
            href="/"
            onClick={(e) => {
              e.preventDefault();
              window.location.assign("/");
            }}
          >
            {t("room.backHome")}
          </a>
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

  // Lobby only — one dialog, no topbar (same as former home).
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <div className="absolute inset-0 z-0">
        <BoardBackdrop blurred />
      </div>
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            "radial-gradient(ellipse at 50% 45%, rgba(8, 18, 12, 0.2), rgba(8, 18, 12, 0.7) 72%)",
        }}
        aria-hidden
      />
      <MenuStage>
        <Lobby preferWatch={preferWatch} fund1={fund1} fund2={fund2} />
      </MenuStage>
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
