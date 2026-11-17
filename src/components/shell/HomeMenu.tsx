"use client";

import { useEffect, useState, type FormEvent } from "react";
import { botFundByName, pickBotFundName } from "@/lib/game/bots/botRoster";
import { useT } from "@/lib/i18n";
import {
  getDisplayName,
  randomRoomCode,
  setDisplayName,
} from "@/lib/net/playerId";
import { FundPicker } from "@/components/cards/FundPicker";
import { LanguageSetting } from "./LanguageSetting";
import { MenuDialog, MenuStage } from "./MenuDialog";

type Mode = "create" | "join" | "bot" | "auto";

/** Full navigation — soft client nav can leave `/` stacked over `/r/...`. */
function goRoom(path: string) {
  window.location.assign(path);
}

/**
 * Entry dialog — always starts on Create room.
 * Uses Tailwind utilities so styles ship even if globals.css chunks lag.
 */
export function HomeMenu() {
  const t = useT();
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [mode, setMode] = useState<Mode>("create");
  const [fund1, setFund1] = useState("");
  const [fund2, setFund2] = useState("");

  useEffect(() => {
    setName(getDisplayName());
  }, []);

  useEffect(() => {
    if (mode !== "auto") return;
    if (!fund1) setFund1(pickBotFundName());
    if (!fund2) {
      setFund2(pickBotFundName(Math.random, fund1 ? [fund1] : []));
    }
  }, [mode, fund1, fund2]);

  function ensureName() {
    const n = name.trim() || "Player";
    setDisplayName(n);
    return n;
  }

  function onCreate(e: FormEvent) {
    e.preventDefault();
    ensureName();
    goRoom(`/r/${randomRoomCode()}`);
  }

  function onBot(e: FormEvent) {
    e.preventDefault();
    ensureName();
    // Same lobby as create — user adds a fund seat themselves (no ?bot=1 auto-fill).
    goRoom(`/r/${randomRoomCode()}`);
  }

  function onAuto(e: FormEvent) {
    e.preventDefault();
    ensureName();
    const a = fund1 || pickBotFundName();
    const b = fund2 || pickBotFundName(Math.random, [a]);
    // Land in lobby — host confirms "Watch auto-play" (no instant skip).
    const q = new URLSearchParams({ watch: "1", f1: a, f2: b });
    goRoom(`/r/${randomRoomCode()}?${q.toString()}`);
  }

  function onJoin(e: FormEvent) {
    e.preventDefault();
    ensureName();
    const code = joinCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length < 4) return;
    goRoom(`/r/${code}`);
  }

  function shuffleFunds() {
    const a = pickBotFundName();
    const b = pickBotFundName(Math.random, [a]);
    setFund1(a);
    setFund2(b);
  }

  const title =
    mode === "create"
      ? t("home.createRoom")
      : mode === "bot"
        ? t("home.playVsBot")
        : mode === "auto"
          ? t("home.watchFunds")
          : t("home.joinRoom");

  return (
    <MenuStage>
      <MenuDialog labelledBy="home-menu-title">
        <p className="m-0 text-center font-[family-name:var(--font-display)] text-[clamp(1.9rem,7vw,3.1rem)] font-extrabold leading-none tracking-tight text-[#f2efe6]">
          {t("brand.name")}
        </p>
        <h2
          id="home-menu-title"
          className="m-0 text-center text-lg font-semibold text-[#d4a24c]"
        >
          {title}
        </h2>
        <p className="m-0 mx-auto max-w-[34ch] text-center text-sm leading-snug text-[#a8b5ae]">
          {t("home.tagline")}
        </p>

        <LanguageSetting />

        <div className="flex flex-wrap gap-2">
          {(
            [
              ["create", t("home.createRoom")],
              ["bot", t("home.playVsBot")],
              ["auto", t("home.watchFunds")],
              ["join", t("home.joinRoom")],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${
                mode === id
                  ? "border-[#d4a24c] bg-[#d4a24c]/20 text-[#f2efe6]"
                  : "border-white/15 bg-black/20 text-[#a8b5ae]"
              }`}
              onClick={() => setMode(id)}
              aria-pressed={mode === id}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "create" && (
          <form className="flex flex-col gap-2" onSubmit={onCreate}>
            <label
              htmlFor="name-create"
              className="text-[0.72rem] uppercase tracking-wider text-[#a8b5ae]"
            >
              {t("home.yourName")}
            </label>
            <input
              id="name-create"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={16}
              placeholder="Alex"
              autoFocus
              className="w-full rounded-[10px] border border-white/15 bg-black/30 px-3 py-2.5 text-base text-[#f2efe6] outline-none focus:outline focus:outline-2 focus:outline-[#d4a24c]"
            />
            <button type="submit" className="btn btn-primary mt-1 w-full justify-center">
              {t("home.createGo")}
            </button>
          </form>
        )}

        {mode === "bot" && (
          <form className="flex flex-col gap-2" onSubmit={onBot}>
            <label
              htmlFor="name-bot"
              className="text-[0.72rem] uppercase tracking-wider text-[#a8b5ae]"
            >
              {t("home.yourName")}
            </label>
            <input
              id="name-bot"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={16}
              placeholder="Alex"
              autoFocus
              className="w-full rounded-[10px] border border-white/15 bg-black/30 px-3 py-2.5 text-base text-[#f2efe6] outline-none focus:outline focus:outline-2 focus:outline-[#d4a24c]"
            />
            <button type="submit" className="btn btn-secondary mt-1 w-full justify-center">
              {t("home.startVsBot")}
            </button>
          </form>
        )}

        {mode === "auto" && (
          <form className="flex flex-col gap-2" onSubmit={onAuto}>
            <label
              htmlFor="name-auto"
              className="text-[0.72rem] uppercase tracking-wider text-[#a8b5ae]"
            >
              {t("home.yourName")}
            </label>
            <input
              id="name-auto"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={16}
              placeholder="Alex"
              className="w-full rounded-[10px] border border-white/15 bg-black/30 px-3 py-2.5 text-base text-[#f2efe6] outline-none focus:outline focus:outline-2 focus:outline-[#d4a24c]"
            />
            <label
              htmlFor="fund1"
              className="text-[0.72rem] uppercase tracking-wider text-[#a8b5ae]"
            >
              {t("home.fundA")}
            </label>
            <FundPicker
              id="fund1"
              value={fund1}
              onChange={(next) => {
                setFund1(next);
                if (next === fund2) {
                  setFund2(pickBotFundName(Math.random, [next]));
                }
              }}
              ariaLabel={t("home.fundA")}
            />
            {botFundByName(fund1)?.blurb ? (
              <p className="m-0 text-[0.72rem] leading-snug text-[#a8b5ae]">
                {botFundByName(fund1)!.blurb}
              </p>
            ) : null}
            <label
              htmlFor="fund2"
              className="text-[0.72rem] uppercase tracking-wider text-[#a8b5ae]"
            >
              {t("home.fundB")}
            </label>
            <FundPicker
              id="fund2"
              value={fund2}
              onChange={(next) => {
                setFund2(next);
                if (next === fund1) {
                  setFund1(pickBotFundName(Math.random, [next]));
                }
              }}
              disabledNames={fund1 ? [fund1] : []}
              ariaLabel={t("home.fundB")}
            />
            {botFundByName(fund2)?.blurb ? (
              <p className="m-0 text-[0.72rem] leading-snug text-[#a8b5ae]">
                {botFundByName(fund2)!.blurb}
              </p>
            ) : null}
            <div className="mt-1 flex flex-wrap gap-2">
              <button type="submit" className="btn btn-secondary flex-1 justify-center">
                {t("home.startAuto")}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={shuffleFunds}
              >
                {t("home.shuffleFunds")}
              </button>
            </div>
          </form>
        )}

        {mode === "join" && (
          <form className="flex flex-col gap-2" onSubmit={onJoin}>
            <label
              htmlFor="name-join"
              className="text-[0.72rem] uppercase tracking-wider text-[#a8b5ae]"
            >
              {t("home.yourName")}
            </label>
            <input
              id="name-join"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={16}
              placeholder="Sam"
              className="w-full rounded-[10px] border border-white/15 bg-black/30 px-3 py-2.5 text-base text-[#f2efe6] outline-none focus:outline focus:outline-2 focus:outline-[#d4a24c]"
            />
            <label
              htmlFor="code"
              className="text-[0.72rem] uppercase tracking-wider text-[#a8b5ae]"
            >
              {t("home.roomCode")}
            </label>
            <input
              id="code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="ABC123"
              autoFocus
              className="w-full rounded-[10px] border border-white/15 bg-black/30 px-3 py-2.5 text-base tracking-[0.18em] text-[#f2efe6] outline-none focus:outline focus:outline-2 focus:outline-[#d4a24c]"
            />
            <button type="submit" className="btn btn-primary mt-1 w-full justify-center">
              {t("home.join")}
            </button>
          </form>
        )}

        <p className="m-0 text-[0.7rem] leading-snug text-[#a8b5ae]/80">
          {t("home.disclaimer")}
        </p>
      </MenuDialog>
    </MenuStage>
  );
}
