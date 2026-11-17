"use client";

import { useEffect, useState } from "react";
import { GameRoom } from "@/components/room/GameRoom";
import { useT } from "@/lib/i18n";
import { getDisplayName, setDisplayName } from "@/lib/net/playerId";

/**
 * Room entry — one path into GameRoom/Lobby (no separate name dialog).
 */
export function RoomClient({
  code,
  withBot = false,
  preferWatch = false,
  fund1,
  fund2,
}: {
  code: string;
  withBot?: boolean;
  preferWatch?: boolean;
  fund1?: string;
  fund2?: string;
}) {
  const t = useT();
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    const existing = getDisplayName().trim();
    const next = existing || "Player";
    if (!existing) setDisplayName(next);
    setName(next);
  }, []);

  if (!code) {
    return (
      <div className="page-pad">
        <p>{t("room.invalid")}</p>
      </div>
    );
  }

  if (!name) {
    return (
      <div className="page-pad">
        <p className="muted">{t("room.loading")}</p>
      </div>
    );
  }

  return (
    <GameRoom
      roomCode={code}
      name={name}
      withBot={withBot}
      preferWatch={preferWatch}
      fund1={fund1}
      fund2={fund2}
    />
  );
}
