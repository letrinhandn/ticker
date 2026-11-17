"use client";

import { useEffect, useRef, useState } from "react";
import { pickBotFundName } from "@/lib/game/bots/botRoster";
import { useT } from "@/lib/i18n";
import {
  getDisplayName,
  setDisplayName,
} from "@/lib/net/playerId";
import { useRoom } from "@/lib/net/RoomContext";
import { LanguageSetting } from "@/components/shell/LanguageSetting";
import { MenuDialog } from "@/components/shell/MenuDialog";
import { MAX_PLAYERS } from "@/shared/types";
import {
  LobbyActions,
} from "./LobbyActions";
import {
  type ActiveSeat,
  LobbySeats,
  type SeatRow,
} from "./LobbySeats";

export function Lobby({
  preferWatch = false,
  fund1,
  fund2,
}: {
  preferWatch?: boolean;
  fund1?: string;
  fund2?: string;
}) {
  const t = useT();
  const { playerId, snapshot, send, status, error } = useRoom();
  const [origin, setOrigin] = useState("");
  const [activeSeat, setActiveSeat] = useState<ActiveSeat>(null);
  const [pickFund, setPickFund] = useState(() => fund1 || pickBotFundName());
  const [editFund, setEditFund] = useState("");
  const [nameDraft, setNameDraft] = useState(() => getDisplayName() || "Player");
  const autoWatchSent = useRef(false);

  const openSlots = snapshot?.openSlots ?? 0;
  const seatCount = snapshot?.seats.length ?? 0;
  const tableSlots = seatCount + openSlots;

  useEffect(() => {
    queueMicrotask(() => setOrigin(window.location.origin));
  }, []);

  function saveName() {
    const next = nameDraft.trim().slice(0, 16) || "Player";
    setDisplayName(next);
    setNameDraft(next);
  }

  useEffect(() => {
    if (!snapshot || !activeSeat || activeSeat.startsWith("open:")) return;
    const seat = snapshot.seats.find((s) => s.playerId === activeSeat);
    if (seat?.isBot) queueMicrotask(() => setEditFund(seat.name));
  }, [snapshot, activeSeat]);

  useEffect(() => {
    if (!preferWatch || !snapshot || autoWatchSent.current) return;
    if (snapshot.game) return;
    if ((snapshot.openSlots ?? 0) > 0) return;
    const meSeat = snapshot.seats.find((s) => s.playerId === playerId);
    const humanN = snapshot.seats.filter((s) => !s.isBot).length;
    const humansOk = snapshot.seats
      .filter((s) => !s.isBot)
      .every((s) => s.ready && s.connected);
    const waitingMe = Boolean(
      playerId &&
        !meSeat &&
        (snapshot.waiting ?? []).some((w) => w.playerId === playerId),
    );
    const manage =
      (meSeat && !meSeat.isBot && (snapshot.hostId === playerId || humanN === 1)) ||
      (humanN === 0 && waitingMe);
    if (!manage) return;
    const canFillFunds = humanN === 0 && snapshot.seats.length < 2;
    const readyTable = snapshot.seats.length >= 2 && humansOk;
    if (!readyTable && !canFillFunds) return;
    autoWatchSent.current = true;
    const seatedBots = snapshot.seats.filter((s) => s.isBot);
    const f1 = fund1 || seatedBots[0]?.name;
    const f2 =
      fund2 ||
      seatedBots[1]?.name ||
      pickBotFundName(Math.random, f1 ? [f1] : []);
    send({ type: "start_auto", fund1: f1, fund2: f2 });
  }, [preferWatch, snapshot, playerId, fund1, fund2, send]);

  if (!snapshot) {
    return (
      <MenuDialog onClick={(e) => e.stopPropagation()}>
        <p className="m-0 text-center font-[family-name:var(--font-display)] text-[clamp(1.85rem,7vw,2.6rem)] font-extrabold leading-none text-[#f2efe6]">
          {t("brand.name")}
        </p>
        <p className="m-0 text-[#a8b5ae]">
          {status === "connecting"
            ? t("lobby.connecting")
            : (error ?? t("lobby.waitingEllipsis"))}
        </p>
      </MenuDialog>
    );
  }

  const waiting = snapshot.waiting ?? [];
  const me = snapshot.seats.find((s) => s.playerId === playerId);
  const isWaiting = Boolean(
    playerId && !me && waiting.some((w) => w.playerId === playerId),
  );
  const isHost = snapshot.hostId === playerId;
  const humans = snapshot.seats.filter((s) => !s.isBot);
  const bots = snapshot.seats.filter((s) => s.isBot);
  const humanCount = humans.length;
  const isWatchLobby = humanCount === 0;
  const canManage = Boolean(
    (me && !me.isBot && (isHost || humanCount === 1)) ||
      (isWatchLobby && isWaiting),
  );
  const underMaxSeats = tableSlots < MAX_PLAYERS;
  const showAddSeat = canManage && underMaxSeats;
  const canStartMatch =
    Boolean(me && !me.isBot) &&
    canManage &&
    seatCount >= 2 &&
    openSlots === 0 &&
    humans.every((s) => s.ready && s.connected);
  const canStartAuto =
    canManage &&
    openSlots === 0 &&
    (seatCount >= 2
      ? humans.every((s) => s.ready && s.connected)
      : isWatchLobby);
  const invite = `${origin || ""}/r/${snapshot.roomCode}`;
  const takenNames = snapshot.seats.map((s) => s.name);
  const waitingOthers = waiting.filter((w) => w.playerId !== playerId);

  const seatRows: SeatRow[] = [
    ...snapshot.seats.map((seat, i) => ({
      kind: "filled" as const,
      seat,
      index: i,
    })),
    ...Array.from({ length: openSlots }, (_, openIndex) => ({
      kind: "open" as const,
      index: seatCount + openIndex,
      openIndex,
    })),
  ];

  function toggleActive(id: ActiveSeat) {
    setActiveSeat((cur) => (cur === id ? null : id));
  }

  function startAutoPlay() {
    if (!canStartAuto) return;
    const f1 = fund1 || bots[0]?.name;
    const f2 =
      fund2 ||
      bots[1]?.name ||
      (isWatchLobby && seatCount < 2
        ? pickBotFundName(Math.random, f1 ? [f1] : [])
        : undefined);
    send({ type: "start_auto", fund1: f1, fund2: f2 });
  }

  return (
    <MenuDialog
      labelledBy="lobby-title"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="m-0 text-center font-[family-name:var(--font-display)] text-[clamp(1.85rem,7vw,2.6rem)] font-extrabold leading-none tracking-tight text-[#f2efe6]">
        {t("brand.name")}
      </p>
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="min-w-0">
          <h2
            id="lobby-title"
            className="m-0 text-base font-semibold text-[#d4a24c]"
          >
            {t("lobby.title")}
          </h2>
          <p className="m-0 mt-0.5 font-mono text-lg tracking-[0.16em] text-[#d4a24c]">
            {snapshot.roomCode}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost shrink-0 px-3 py-1.5 text-xs"
          onClick={() => navigator.clipboard.writeText(invite)}
        >
          {t("lobby.copyInvite")}
        </button>
      </div>

      <LanguageSetting />

      <div className="flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-[#f2efe6]"
          value={nameDraft}
          maxLength={16}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={saveName}
          placeholder={t("home.yourName")}
          aria-label={t("home.yourName")}
        />
        <button
          type="button"
          className="btn btn-ghost shrink-0 px-3"
          onClick={saveName}
        >
          {t("settings.saveName")}
        </button>
      </div>

      <p className="m-0 text-[0.72rem] uppercase tracking-wider text-[#a8b5ae]">
        {t("lobby.seats", {
          filled: tableSlots,
          max: MAX_PLAYERS,
        })}
      </p>

      {waitingOthers.length > 0 && canManage && (
        <p className="m-0 text-[0.75rem] text-[#a8b5ae]">
          {t("lobby.waitingList", {
            names: waitingOthers.map((w) => w.name).join(", "),
          })}
        </p>
      )}

      <LobbySeats
        seatRows={seatRows}
        activeSeat={activeSeat}
        onToggleActive={toggleActive}
        setActiveSeat={setActiveSeat}
        canManage={canManage}
        isWaiting={isWaiting}
        playerId={playerId}
        pickFund={pickFund}
        setPickFund={setPickFund}
        editFund={editFund}
        setEditFund={setEditFund}
        takenNames={takenNames}
        send={send}
      />

      <LobbyActions
        showAddSeat={showAddSeat}
        onAddSeat={() => {
          send({ type: "add_open_seat" });
          setActiveSeat(`open:${openSlots}`);
        }}
        error={error}
        me={me}
        send={send}
        isWatchLobby={isWatchLobby}
        canManage={canManage}
        canStartMatch={canStartMatch}
        canStartAuto={canStartAuto}
        onStartAuto={startAutoPlay}
        onSaveName={saveName}
      />
    </MenuDialog>
  );
}
