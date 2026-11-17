"use client";

import { useEffect } from "react";
import { BoardBackdrop } from "@/components/board/BoardBackdrop";
import { MenuDialog, MenuStage } from "@/components/shell/MenuDialog";
import { useT } from "@/lib/i18n";
import {
  getDisplayName,
  randomRoomCode,
  setDisplayName,
} from "@/lib/net/playerId";

/**
 * No separate home — open straight into a room lobby.
 */
export default function HomePage() {
  const t = useT();

  useEffect(() => {
    const name = getDisplayName().trim() || "Player";
    setDisplayName(name);
    window.location.replace(`/r/${randomRoomCode()}`);
  }, []);

  return (
    <main
      className="relative h-dvh max-h-dvh min-h-dvh overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 30% 20%, rgba(46, 125, 70, 0.35), transparent 50%), #0d1f14",
      }}
    >
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
        <MenuDialog>
          <p className="m-0 text-center font-[family-name:var(--font-display)] text-[clamp(1.85rem,7vw,2.6rem)] font-extrabold leading-none text-[#f2efe6]">
            {t("brand.name")}
          </p>
          <p className="m-0 text-[#a8b5ae]">{t("lobby.connecting")}</p>
        </MenuDialog>
      </MenuStage>
    </main>
  );
}
