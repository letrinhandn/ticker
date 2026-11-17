"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { randomRoomCode } from "@/lib/net/playerId";
import type { ClientMessage, LobbySeat } from "@/shared/types";

export function LobbyActions({
  showAddSeat,
  onAddSeat,
  error,
  me,
  send,
  isWatchLobby,
  canManage,
  canStartMatch,
  canStartAuto,
  onStartAuto,
  onSaveName,
}: {
  showAddSeat: boolean;
  onAddSeat: () => void;
  error: string | null;
  me: LobbySeat | undefined;
  send: (msg: ClientMessage) => void;
  isWatchLobby: boolean;
  canManage: boolean;
  canStartMatch: boolean;
  canStartAuto: boolean;
  onStartAuto: () => void;
  onSaveName: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState("");

  function goJoinOther() {
    const code = joinCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length < 4) return;
    onSaveName();
    router.push(`/r/${code}`);
  }

  function goNewTable() {
    onSaveName();
    router.push(`/r/${randomRoomCode()}`);
  }

  return (
    <>
      {showAddSeat && (
        <button
          type="button"
          className="btn btn-secondary w-full justify-center border border-[#d4a24c]/60 py-2.5 text-sm font-semibold"
          onClick={onAddSeat}
        >
          {t("lobby.addSlot")}
        </button>
      )}

      {error && <p className="error-text m-0">{error}</p>}

      {me && !me.isBot && (
        <button
          type="button"
          className="btn btn-secondary w-full justify-center"
          onClick={() => send({ type: "set_ready", ready: !me.ready })}
        >
          {me.ready ? t("lobby.unready") : t("lobby.readyUp")}
        </button>
      )}

      {!isWatchLobby && canManage && (
        <button
          type="button"
          className="btn btn-primary w-full justify-center"
          disabled={!canStartMatch}
          onClick={() => send({ type: "start" })}
        >
          {t("lobby.start")}
        </button>
      )}

      {canManage && (
        <button
          type="button"
          className={`btn w-full justify-center ${
            isWatchLobby ? "btn-primary" : "btn-secondary"
          }`}
          disabled={!canStartAuto}
          onClick={onStartAuto}
        >
          {t("lobby.watchAuto")}
        </button>
      )}

      <div className="flex flex-col gap-2 border-t border-white/10 pt-3">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-xl border border-white/12 bg-black/20 px-3 py-2 text-left text-sm text-[#f2efe6]"
          aria-expanded={showJoin}
          onClick={() => setShowJoin((v) => !v)}
        >
          <span>{t("lobby.joinOther")}</span>
          <span className="text-[#a8b5ae]" aria-hidden>
            {showJoin ? "−" : "+"}
          </span>
        </button>
        {showJoin ? (
          <div className="flex gap-2">
            <input
              className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-2 font-mono text-sm tracking-[0.14em] text-[#f2efe6] uppercase"
              value={joinCode}
              maxLength={6}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              aria-label={t("home.roomCode")}
            />
            <button
              type="button"
              className="btn btn-secondary shrink-0"
              onClick={goJoinOther}
            >
              {t("lobby.joinGo")}
            </button>
          </div>
        ) : null}
        <button
          type="button"
          className="btn btn-ghost w-full justify-center"
          onClick={goNewTable}
        >
          {t("lobby.newTable")}
        </button>
      </div>
    </>
  );
}
