"use client";

import {
  botFundByName,
  pickBotFundName,
} from "@/lib/game/bots/botRoster";
import { useT } from "@/lib/i18n";
import type { ClientMessage, LobbySeat } from "@/shared/types";
import { FundLogo } from "@/components/cards/FundLogo";
import { FundPicker } from "@/components/cards/FundPicker";
import { fundKindShortKey } from "@/components/cards/FundSelectOptions";

/** Expanded row: open chair index, or filled seat playerId. */
export type ActiveSeat = `open:${number}` | string | null;

export type SeatRow =
  | { kind: "filled"; seat: LobbySeat; index: number }
  | { kind: "open"; index: number; openIndex: number };

export function LobbySeats({
  seatRows,
  activeSeat,
  onToggleActive,
  setActiveSeat,
  canManage,
  isWaiting,
  playerId,
  pickFund,
  setPickFund,
  editFund,
  setEditFund,
  takenNames,
  send,
}: {
  seatRows: SeatRow[];
  activeSeat: ActiveSeat;
  onToggleActive: (id: ActiveSeat) => void;
  setActiveSeat: (id: ActiveSeat) => void;
  canManage: boolean;
  isWaiting: boolean;
  playerId: string | null;
  pickFund: string;
  setPickFund: (v: string) => void;
  editFund: string;
  setEditFund: (v: string) => void;
  takenNames: string[];
  send: (msg: ClientMessage) => void;
}) {
  const t = useT();

  return (
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
                  if (canOpen) onToggleActive(activeId);
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
                onToggleActive(seat.playerId);
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
                className={seat.ready ? "text-[#3d9b7a]" : "text-[#a8b5ae]"}
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
  );
}
