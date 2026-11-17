"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { LanguageSetting } from "@/components/shell/LanguageSetting";
import { useT } from "@/lib/i18n";
import { getDisplayName, setDisplayName } from "@/lib/net/playerId";
import { useRoom } from "@/lib/net/RoomContext";
import { useGamePrefs } from "@/lib/prefs/GamePrefsProvider";
import { playDiceRoll, playSfx, playStamp, unlockSfx } from "@/lib/sfx/sounds";

/**
 * In-game settings — language, sound, name, room, restart / resign / leave.
 * One fixed FX speed; SFX lives here only (no HUD toggle).
 */
export function GameSettings({ roomCode }: { roomCode: string }) {
  const router = useRouter();
  const t = useT();
  const { snapshot, send, playerId } = useRoom();
  const { prefs, setSfxMuted, setSfxVolume } = useGamePrefs();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [mounted, setMounted] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameSaved, setNameSaved] = useState(false);

  const game = snapshot?.game ?? null;
  const playing = Boolean(game && game.phase === "playing");
  const me = game?.players.find((p) => p.id === playerId) ?? null;
  const canResign = Boolean(playing && me && !me.bankrupt);
  const isHost = snapshot?.hostId === playerId;
  const canRestart = Boolean(
    game && (isHost || snapshot?.hostId == null || Boolean(me)),
  );

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (!open) {
      queueMicrotask(() => {
        setCopied(null);
        setNameSaved(false);
      });
      return;
    }
    queueMicrotask(() => setNameDraft(getDisplayName() || me?.name || ""));
  }, [open, me?.name]);

  async function copyText(kind: "code" | "link", text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
    } catch {
      setCopied(null);
    }
  }

  function saveName() {
    const next = nameDraft.trim().slice(0, 16) || "Player";
    setDisplayName(next);
    setNameDraft(next);
    setNameSaved(true);
  }

  function resign() {
    if (!canResign) return;
    const ok = window.confirm(t("settings.resignConfirm"));
    if (!ok) return;
    send({ type: "declare_bankrupt" });
    setOpen(false);
  }

  function leaveTable() {
    // Mid-match leave keeps the seat in play under autoplay; then exit room.
    if (playing && me && !me.bankrupt) {
      send({ type: "leave_seat" });
    }
    router.push("/");
  }

  function restart() {
    if (!canRestart) return;
    const ok = window.confirm(t("settings.restartConfirm"));
    if (!ok) return;
    send({ type: "restart" });
    setOpen(false);
  }

  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/r/${roomCode.toUpperCase()}`
      : `/r/${roomCode.toUpperCase()}`;

  const panel =
    open && mounted
      ? createPortal(
          <div
            className="modal-overlay is-browse game-settings-overlay"
            role="presentation"
            onClick={() => setOpen(false)}
          >
            <article
              className="game-settings-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="game-settings-title"
              onClick={(e) => e.stopPropagation()}
            >
              <header className="game-settings-head">
                <h2 id="game-settings-title">{t("settings.title")}</h2>
                <button
                  type="button"
                  className="game-settings-close"
                  onClick={() => setOpen(false)}
                  aria-label={t("common.close")}
                >
                  ×
                </button>
              </header>

              <div className="game-settings-body">
                <section className="game-settings-block">
                  <p className="game-settings-label">{t("lang.label")}</p>
                  <LanguageSetting compact />
                </section>

                <section className="game-settings-block">
                  <p className="game-settings-label">{t("settings.sound")}</p>
                  <label className="game-settings-check">
                    <input
                      type="checkbox"
                      checked={!prefs.sfxMuted}
                      onChange={(e) => {
                        unlockSfx();
                        setSfxMuted(!e.target.checked);
                        if (e.target.checked) playSfx("click");
                      }}
                    />
                    <span>{t("settings.sfxOn")}</span>
                  </label>
                  <div className="game-settings-volume-row">
                    <label
                      className="game-settings-volume-label"
                      htmlFor="game-settings-sfx-volume"
                    >
                      {t("settings.sfxVolume")}
                    </label>
                    <input
                      id="game-settings-sfx-volume"
                      className="game-settings-volume"
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={Math.round(prefs.sfxVolume * 100)}
                      disabled={prefs.sfxMuted}
                      aria-valuetext={`${Math.round(prefs.sfxVolume * 100)}%`}
                      onPointerDown={() => unlockSfx()}
                      onChange={(e) => {
                        unlockSfx();
                        setSfxVolume(Number(e.target.value) / 100);
                      }}
                      onPointerUp={() => {
                        playSfx("cardFlip");
                      }}
                    />
                    <span className="game-settings-volume-pct">
                      {Math.round(prefs.sfxVolume * 100)}%
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary game-settings-copy"
                      disabled={prefs.sfxMuted}
                      onClick={() => {
                        unlockSfx();
                        playDiceRoll();
                        window.setTimeout(() => playStamp(), 420);
                      }}
                    >
                      {t("settings.sfxTest")}
                    </button>
                  </div>
                </section>

                <section className="game-settings-block">
                  <p className="game-settings-label">{t("settings.yourName")}</p>
                  <div className="game-settings-name-row">
                    <input
                      className="game-settings-input"
                      value={nameDraft}
                      maxLength={16}
                      onChange={(e) => {
                        setNameDraft(e.target.value);
                        setNameSaved(false);
                      }}
                      placeholder={t("home.yourName")}
                      aria-label={t("settings.yourName")}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary game-settings-copy"
                      onClick={saveName}
                    >
                      {nameSaved
                        ? t("settings.nameSaved")
                        : t("settings.saveName")}
                    </button>
                  </div>
                </section>

                <section className="game-settings-block">
                  <p className="game-settings-label">{t("settings.room")}</p>
                  <div className="game-settings-code-row">
                    <span className="game-settings-code">
                      {roomCode.toUpperCase()}
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary game-settings-copy"
                      onClick={() =>
                        void copyText("code", roomCode.toUpperCase())
                      }
                    >
                      {copied === "code"
                        ? t("settings.copied")
                        : t("settings.copy")}
                    </button>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary game-settings-link-btn"
                    onClick={() => void copyText("link", inviteUrl)}
                  >
                    {copied === "link"
                      ? t("settings.linkCopied")
                      : t("settings.copyLink")}
                  </button>
                </section>

                <section className="game-settings-actions">
                  {canRestart ? (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={restart}
                    >
                      {t("settings.restart")}
                    </button>
                  ) : null}
                  {canResign ? (
                    <button
                      type="button"
                      className="btn btn-danger game-settings-danger"
                      onClick={resign}
                    >
                      {t("settings.resign")}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={leaveTable}
                  >
                    {t("settings.leave")}
                  </button>
                </section>
              </div>
            </article>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        className="game-settings-btn"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t("settings.title")}
        onClick={() => setOpen(true)}
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          aria-hidden
          fill="currentColor"
        >
          <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.07 7.07 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 14.3 2h-4.6a.5.5 0 0 0-.49.42l-.36 2.54c-.59.24-1.13.55-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.31 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.43 14.5a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.43.34.68.24l2.39-.96c.5.39 1.04.7 1.63.94l.36 2.54c.05.24.25.42.49.42h4.6c.24 0 .44-.18.49-.42l.36-2.54c.59-.24 1.13-.55 1.63-.94l2.39.96c.25.1.54 0 .68-.24l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
        </svg>
        <span className="game-settings-btn-label">{t("settings.title")}</span>
      </button>
      {panel}
    </>
  );
}
