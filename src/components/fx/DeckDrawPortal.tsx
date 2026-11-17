"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  DeckCardBackFace,
  eventCardCenterRect,
} from "@/components/cards/DeckCards";
import { FX_TIMING, type FxDeckKind } from "@/lib/fx/types";
import { useT } from "@/lib/i18n";
import { playSfx } from "@/lib/sfx/sounds";

type Phase = "idle" | "animating" | "done";

function pileRect(deck: FxDeckKind): DOMRect | null {
  const sel =
    deck === "pr" ? ".deck-stack.deck-pr" : ".deck-stack.deck-regime";
  return document.querySelector(sel)?.getBoundingClientRect() ?? null;
}

/**
 * Draws a card-back from the board pile up to center, or returns it to the pile.
 * After return, call `shuffleDeckPile` so the stack shuffles in place.
 */
export function DeckDrawPortal({
  deck,
  active,
  direction = "draw",
  onDone,
}: {
  deck: FxDeckKind;
  active: boolean;
  direction?: "draw" | "return";
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [from, setFrom] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null,
  );
  const [to, setTo] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null,
  );
  const [mounted, setMounted] = useState(false);
  const t = useT();

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (!active) {
      queueMicrotask(() => {
        setPhase("idle");
        setFrom(null);
        setTo(null);
      });
      return;
    }

    const pile = pileRect(deck);
    const mid = eventCardCenterRect();
    if (!pile) {
      onDone();
      return;
    }

    const pileBox = {
      x: pile.left,
      y: pile.top,
      w: pile.width,
      h: pile.height,
    };

    queueMicrotask(() => {
      if (direction === "draw") {
        setFrom(pileBox);
        setTo(mid);
      } else {
        setFrom(mid);
        setTo(pileBox);
      }
      setPhase("animating");
    });

    const ms =
      direction === "draw" ? FX_TIMING.deckFlyMs : FX_TIMING.deckReturnMs;
    const timer = window.setTimeout(() => {
      setPhase("done");
      onDone();
    }, ms);

    return () => window.clearTimeout(timer);
  }, [active, deck, direction, onDone]);

  if (
    !mounted ||
    !active ||
    phase === "idle" ||
    phase === "done" ||
    !from ||
    !to
  ) {
    return null;
  }

  const ms =
    direction === "draw" ? FX_TIMING.deckFlyMs : FX_TIMING.deckReturnMs;
  const animClass =
    direction === "draw" ? "fx-deck-fly is-draw" : "fx-deck-fly is-return";

  const node = (
    <div className="fx-deck-layer" aria-hidden>
      <div
        className={animClass}
        style={
          {
            "--fx-from-x": `${from.x}px`,
            "--fx-from-y": `${from.y}px`,
            "--fx-from-w": `${from.w}px`,
            "--fx-from-h": `${from.h}px`,
            "--fx-to-x": `${to.x}px`,
            "--fx-to-y": `${to.y}px`,
            "--fx-to-w": `${to.w}px`,
            "--fx-to-h": `${to.h}px`,
            animationDuration: `${ms}ms`,
          } as CSSProperties
        }
      >
        <DeckCardBackFace
          variant={deck === "pr" ? "pr" : "news"}
          label={deck === "pr" ? t("deck.prLabel") : t("deck.newsLabel")}
        />
      </div>
    </div>
  );

  return createPortal(node, document.body);
}

/** Two-layer pile shuffle on the board deck — only place that plays shuffle SFX. */
export function shuffleDeckPile(
  deck: FxDeckKind,
  onDone?: () => void,
  ms = FX_TIMING.deckShuffleMs,
) {
  const sel =
    deck === "pr" ? ".deck-stack.deck-pr" : ".deck-stack.deck-regime";
  const pile = document.querySelector(sel)?.closest(".deck-pile");
  const stack = document.querySelector(sel);
  pile?.classList.add("is-shuffling");
  stack?.classList.add("is-shuffling");
  // Sound starts with the 2-layer fan animation — nowhere else.
  playSfx("cardShuffle");
  window.setTimeout(() => {
    pile?.classList.remove("is-shuffling");
    stack?.classList.remove("is-shuffling");
    onDone?.();
  }, ms);
}
