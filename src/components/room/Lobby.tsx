"use client";

import { useEffect, useRef, useState } from "react";
import {
  botFundByName,
  pickBotFundName,
} from "@/lib/game/bots/botRoster";
import { useT } from "@/lib/i18n";
import {
  getDisplayName,
  randomRoomCode,
  setDisplayName,
} from "@/lib/net/playerId";
import { useRoom } from "@/lib/net/RoomContext";
import { FundLogo } from "@/components/cards/FundLogo";
import { FundPicker } from "@/components/cards/FundPicker";
import { fundKindShortKey } from "@/components/cards/FundSelectOptions";
import { LanguageSetting } from "@/components/shell/LanguageSetting";
import { MenuDialog } from "@/components/shell/MenuDialog";
import { MAX_PLAYERS, type LobbySeat } from "@/shared/types";

/** Expanded row: open chair index, or filled seat playerId. */
type ActiveSeat = `open:${number}` | string | null;

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
  const [pickFund, setPickFund] = useState(fund1 || "");
  const [editFund, setEditFund] = useState("");
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const autoWatchSent = useRef(false);

  const openSlots = snapshot?.openSlots ?? 0;
  const seatCount = snapshot?.seats.length ?? 0;
  const tableSlots = seatCount + openSlots;

  useEffect(() => {
    setOrigin(window.location.origin);
    setNameDraft(getDisplayName() || meNameFallback());
  }, []);

  function meNameFallback() {
    return "Player";
  }

  function saveName() {
    const next = nameDraft.trim().slice(0, 16) || "Player";
    setDisplayName(next);
    setNameDraft(next);
  }

  function goJoinOther() {
    const code = joinCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length < 4) return;
    saveName();
    window.location.assign(`/r/${code}`);
  }

  function goNewTable() {
    saveName();
    window.location.assign(`/r/${randomRoomCode()}`);
  }

  useEffect(() => {
    if (!pickFund) setPickFund(pickBotFundName());
  }, [pickFund]);

  useEffect(() => {
    if (!snapshot || !activeSeat || activeSeat.startsWith("open:")) return;
    const seat = snapshot.seats.find((s) => s.playerId === activeSeat);
    if (seat?.isBot) setEditFund(seat.name);
  }, [snapshot, activeSeat]);

  // Deep-link watch: start once the table has enough ready seats.
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
      <MenuDialog>
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
  /** No humans seated → watch lobby (inferred, no mode toggle). */
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
  /** Auto-play: 2+ seats filled, no open chairs, every human ready (funds always ready). */
  const canStartAuto =
    canManage &&
    openSlots === 0 &&
    (seatCount >= 2
      ? humans.every((s) => s.ready && s.connected)
      : isWatchLobby);
  const invite = `${origin || ""}/r/${snapshot.roomCode}`;
  const takenNames = snapshot.seats.map((s) => s.name);
  const waitingOthers = waiting.filter((w) => w.playerId !== playerId);

  const seatRows: Array<
    | { kind: "filled"; seat: LobbySeat; index: number }
    | { kind: "open"; index: number; openIndex: number }
  > = [
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
    <MenuDialog labelledBy="lobby-title">
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

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {seatRows.map((row) => {
          if (row.kind === "open") {
            const activeId = `open:${row.openIndex}` as const;
            const selected = activeSeat === activeId;
            const canOpen = canManage || isWaiting;
            return (
              <li key={activeId} className="flex flex-col gap-2">
                <button
                  type="button"
                  className={`flex w-full items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm ${
                    selected
                      ? "border-[#d4a24c] bg-[#d4a24c]/15 text-[#f2efe6]"
                      : "border-white/25 bg-black/10 text-[#a8b5ae]"
                  }`}
                  onClick={() => {
                    if (canOpen) toggleActive(activeId);
                  }}
                  disabled={!canOpen}
                >
                  <span className="text-[0.65rem] font-bold uppercase tracking-wider">
                    {t("lobby.seatN", { n: row.index + 1 })}
                  </span>
                  <span className="flex-1">{t("lobby.emptyHuman")}</span>
                </button>

                {canOpen && selected && (
                  <div className="flex flex-col gap-2 rounded-xl border border-white/15 bg-black/30 p-3">
                    {isWaiting && (
                      <button
                        type="button"
                        className="btn btn-primary w-full justify-center"
                        onClick={() => {
                          send({ type: "claim_seat" });
                          setActiveSeat(null);
                        }}
                      >
                        {t("lobby.claimSeat")}
                      </button>
                    )}

                    {canManage && (
                      <>
                        <FundPicker
                          value={pickFund}
                          onChange={setPickFund}
                          disabledNames={takenNames}
                          ariaLabel={t("lobby.pickFund")}
                        />
                        {botFundByName(pickFund)?.blurb ? (
                          <p className="m-0 text-[0.72rem] leading-snug text-[#a8b5ae]">
                            {botFundByName(pickFund)!.blurb}
                          </p>
                        ) : null}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="btn btn-secondary flex-1 justify-center"
                            onClick={() => {
                              send({ type: "add_bot", fund: pickFund });
                              setActiveSeat(null);
                              setPickFund(
                                pickBotFundName(Math.random, [
                                  ...takenNames,
                                  pickFund,
                                ]),
                              );
                            }}
                          >
                            {t("lobby.addFundSlot")}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() =>
                              setPickFund(
                                pickBotFundName(Math.random, takenNames),
                              )
                            }
                          >
                            {t("lobby.shuffleFund")}
                          </button>
                        </div>
                        <button
                          type="button"
                          className="btn btn-ghost w-full justify-center text-xs"
                          onClick={() => {
                            send({ type: "remove_open_seat" });
                            setActiveSeat(null);
                          }}
                        >
                          {t("lobby.removeSeat")}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          }

          const seat = row.seat;
          const selected = activeSeat === seat.playerId;
          const isSelf = seat.playerId === playerId;

          return (
            <li key={seat.playerId} className="flex flex-col gap-2">
              <button
                type="button"
                className={`flex w-full items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm text-[#f2efe6] ${
                  selected
                    ? "border-[#d4a24c] bg-[#d4a24c]/15"
                    : "border-white/10 bg-black/20"
                }`}
                onClick={() => {
                  if (!canManage) return;
                  toggleActive(seat.playerId);
                }}
                disabled={!canManage}
              >
                <span className="text-[0.65rem] font-bold uppercase tracking-wider text-[#a8b5ae]">
                  {t("lobby.seatN", { n: row.index + 1 })}
                </span>
                {seat.isBot ? (
                  <FundLogo key={seat.name} name={seat.name} size={22} />
                ) : (
                  <span className={`token token-${seat.token}`} />
                )}
                <span className="min-w-0 flex-1 truncate">
                  {seat.name}
                  {isSelf ? ` (${t("common.you")})` : ""}
                  {seat.isBot
                    ? (() => {
                        const fund = botFundByName(seat.name);
                        if (!fund) return ` (${t("common.fund")})`;
                        return ` (${t(fundKindShortKey(fund.kind))})`;
                      })()
                    : ""}
                  {!seat.connected && !seat.isBot
                    ? ` (${t("common.offline")})`
                    : ""}
                </span>
                <span
                  className={
                    seat.ready ? "text-[#3d9b7a]" : "text-[#a8b5ae]"
                  }
                >
                  {seat.ready ? t("common.ready") : t("common.notReady")}
                </span>
              </button>

              {canManage && selected && seat.isBot && (
                <div className="flex flex-col gap-2 rounded-xl border border-white/15 bg-black/30 p-3">
                  <FundPicker
                    value={editFund || seat.name}
                    onChange={setEditFund}
                    disabledNames={takenNames.filter((n) => n !== seat.name)}
                    ariaLabel={t("lobby.changeFund")}
                  />
                  {botFundByName(editFund || seat.name)?.blurb ? (
                    <p className="m-0 text-[0.72rem] leading-snug text-[#a8b5ae]">
                      {botFundByName(editFund || seat.name)!.blurb}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary flex-1 justify-center"
                      disabled={!editFund || editFund === seat.name}
                      onClick={() => {
                        send({
                          type: "replace_bot",
                          playerId: seat.playerId,
                          fund: editFund,
                        });
                      }}
                    >
                      {t("lobby.applyFund")}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost flex-1 justify-center"
                      onClick={() => {
                        const next = pickBotFundName(
                          Math.random,
                          takenNames.filter((n) => n !== seat.name),
                        );
                        setEditFund(next);
                        send({
                          type: "replace_bot",
                          playerId: seat.playerId,
                          fund: next,
                        });
                      }}
                    >
                      {t("lobby.shuffleFund")}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost w-full justify-center"
                      onClick={() => {
                        send({
                          type: "remove_bot",
                          playerId: seat.playerId,
                        });
                        setActiveSeat("open:0");
                      }}
                    >
                      {t("lobby.botToOpen")}
                    </button>
                  </div>
                </div>
              )}

              {canManage && selected && !seat.isBot && isSelf && (
                <div className="flex flex-col gap-2 rounded-xl border border-white/15 bg-black/30 p-3">
                  <button
                    type="button"
                    className="btn btn-ghost w-full justify-center"
                    onClick={() => {
                      send({ type: "leave_seat" });
                      setActiveSeat(null);
                    }}
                  >
                    {t("lobby.leaveToWatch")}
                  </button>
                </div>
              )}

              {canManage && selected && !seat.isBot && !isSelf && (
                <div className="flex flex-col gap-2 rounded-xl border border-white/15 bg-black/30 p-3">
                  <button
                    type="button"
                    className="btn btn-ghost w-full justify-center"
                    onClick={() => {
                      send({ type: "kick", playerId: seat.playerId });
                      setActiveSeat(null);
                    }}
                  >
                    {t("lobby.kickPlayer")}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {showAddSeat && (
        <button
          type="button"
          className="btn btn-secondary w-full justify-center border border-[#d4a24c]/60 py-2.5 text-sm font-semibold"
          onClick={() => {
            send({ type: "add_open_seat" });
            setActiveSeat(`open:${openSlots}`);
          }}
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
          onClick={startAutoPlay}
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
    </MenuDialog>
  );
}
