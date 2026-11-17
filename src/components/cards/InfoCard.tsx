"use client";

import { useEffect, useRef } from "react";
import { BOARD } from "@/lib/game/board";
import { FX_TIMING } from "@/lib/fx/types";
import { fxMs } from "@/lib/prefs/gamePrefs";
import type { GameState } from "@/shared/types";
import { DeedCard } from "./DeedCard";

/**
 * Landing reveal (no cash). Money events use CashSettlePortal instead.
 * Auto-dismisses; no Continue / Skip wait / “resolving” chrome.
 */
export function InfoCard({
  title,
  body,
  tileIndex,
  game,
  onDismiss,
  /** Watching another seat — no blur; tap outside peeks away. */
  watch = false,
  peeked = false,
  onHide,
  /** User is reading another card — keep this mounted; dismiss waits. */
  hold = false,
}: {
  title: string;
  body: string;
  /** @deprecated Cash uses CashSettlePortal — ignored here. */
  amount?: number;
  tileIndex?: number;
  game?: GameState | null;
  onDismiss?: () => void;
  watch?: boolean;
  peeked?: boolean;
  onHide?: () => void;
  hold?: boolean;
}) {
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!onDismissRef.current || hold) return;
    const t = window.setTimeout(() => {
      onDismissRef.current?.();
    }, fxMs(FX_TIMING.infoRevealMs));
    return () => window.clearTimeout(t);
  }, [title, body, tileIndex, hold]);

  const tile = tileIndex != null ? BOARD[tileIndex] : undefined;
  const overlayClass = `modal-overlay event-overlay${watch ? " is-watch" : ""}${peeked ? " is-peek-hidden" : ""}`;
  const onBackdrop = watch && !peeked
    ? () => onHide?.()
    : undefined;

  // Cash amounts use CashSettlePortal (gavel) — deed only shows copy.
  const footer = body ? (
    <div className="land-deed-footer">
      <p className="land-deed-hint m-0">{body}</p>
    </div>
  ) : null;

  if (tile && tileIndex != null) {
    return (
      <div
        className={overlayClass}
        role="dialog"
        aria-modal="true"
        onClick={onBackdrop}
      >
        <div className="land-deed-wrap" onClick={(e) => e.stopPropagation()}>
          <DeedCard tileIndex={tileIndex} game={game} footer={footer} />
        </div>
      </div>
    );
  }

  return (
    <div
      className={overlayClass}
      role="dialog"
      aria-modal="true"
      onClick={onBackdrop}
    >
      <article
        className="event-card event-info"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="event-head">
          <h3 className="event-title">{title}</h3>
        </div>
        <div className="event-body">
          <p className="event-text m-0">{body}</p>
        </div>
      </article>
    </div>
  );
}
