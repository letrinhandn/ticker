"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  eventCardCenterRect,
  MarketNewsDeckCard,
} from "@/components/cards/DeckCards";
import { FX_TIMING } from "@/lib/fx/types";
import { fxMs } from "@/lib/prefs/gamePrefs";
import type { RegimeCard } from "@/shared/types";

/**
 * Order:
 * 1. deal — back scales up from News pile → center
 * 2. flip — reveal headline
 * 3. lock — readable hold
 * 4. gather — face-up scales down into pile (transform only — no layout reflow)
 */
type Step = "deal" | "flip" | "lock" | "gather" | "done";

type Box = { x: number; y: number; w: number; h: number };

function newsPileBox(): Box | null {
  const r = document
    .querySelector(".deck-stack.deck-regime")
    ?.getBoundingClientRect();
  if (!r) return null;
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

function centerBox(): Box {
  const c = eventCardCenterRect();
  return { x: c.x, y: c.y, w: c.w, h: c.h };
}

/** Map natural card → target box via translate + uniform scale (keeps type/icons crisp). */
function fitTransform(natural: Box, target: Box) {
  const scale = Math.min(target.w / natural.w, target.h / natural.h);
  const tx = target.x + target.w / 2 - (natural.x + natural.w / 2);
  const ty = target.y + target.h / 2 - (natural.y + natural.h / 2);
  return { scale, tx, ty };
}

export function NewsRevealPortal({
  card,
  active,
  onDone,
  watch = false,
  peeked = false,
  onHide,
}: {
  card: Pick<RegimeCard, "id" | "title" | "text" | "regime" | "shocks"> & {
    titleVi?: string;
    textEn?: string;
  };
  active: boolean;
  onDone: () => void;
  /** Watching another seat — no veil blur; tap outside peeks away. */
  watch?: boolean;
  /** Local hide — stay mounted so gather/onDone still release sector pegs. */
  peeked?: boolean;
  onHide?: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<Step>("deal");
  const [pile, setPile] = useState<Box | null>(null);
  const [natural, setNatural] = useState<Box>(centerBox);
  const [tweenMs, setTweenMs] = useState(0);
  const onDoneRef = useRef(onDone);
  const runId = useRef(0);
  const finishedRef = useRef(false);

  onDoneRef.current = onDone;
  const showBack = step === "deal";

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!active) {
      setStep("deal");
      setPile(null);
      setTweenMs(0);
      finishedRef.current = false;
      return;
    }

    const id = ++runId.current;
    finishedRef.current = false;
    const p = newsPileBox();
    const n = centerBox();
    setPile(p);
    setNatural(n);
    setTweenMs(0);
    setStep("deal");

    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => {
      timers.push(window.setTimeout(fn, ms));
    };

    const finishOnce = () => {
      if (id !== runId.current || finishedRef.current) return;
      finishedRef.current = true;
      setStep("done");
      onDoneRef.current();
    };

    // Start deal tween on next frame so we paint at pile scale first.
    later(() => {
      if (id !== runId.current) return;
      setPile(newsPileBox());
      setNatural(centerBox());
      setTweenMs(fxMs(FX_TIMING.deckFlyMs));
      setStep("deal");
      // After deal duration, card sits at natural (scale 1).
      later(() => {
        if (id !== runId.current) return;
        setTweenMs(0);
        setStep("flip");
        later(() => {
          if (id !== runId.current) return;
          setStep("lock");
          later(() => {
            if (id !== runId.current) return;
            setPile(newsPileBox());
            setNatural(centerBox());
            setTweenMs(fxMs(FX_TIMING.deckReturnMs));
            setStep("gather");
            later(finishOnce, fxMs(FX_TIMING.deckReturnMs));
          }, fxMs(FX_TIMING.newsRevealLockMs));
        }, fxMs(FX_TIMING.prMillFlipMs));
      }, fxMs(FX_TIMING.deckFlyMs));
    }, 32);

    return () => {
      runId.current += 1;
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [active, card.id]);

  if (!mounted || !active || step === "done") return null;

  const pileBox = pile ?? {
    x: natural.x,
    y: natural.y + 80,
    w: 64,
    h: 86,
  };

  // deal: start at pile, tween to natural. gather: natural → pile. else natural.
  const target: Box =
    step === "deal" && tweenMs === 0
      ? pileBox
      : step === "gather"
        ? pileBox
        : natural;

  const { scale, tx, ty } = fitTransform(natural, target);
  const gathering = step === "gather";

  const node = (
    <div
      className={`fx-deck-layer fx-pr-mill-layer${watch ? " is-watch" : ""}${peeked ? " is-peek-hidden" : ""}`}
      aria-hidden={peeked || !watch || undefined}
      onClick={watch && !peeked ? () => onHide?.() : undefined}
      style={watch && !peeked ? { pointerEvents: "auto" } : undefined}
    >
      {!gathering ? (
        <div className={`fx-pr-mill-veil${watch ? " is-watch" : ""}`} />
      ) : null}
      <div
        className={`fx-news-scaled${gathering ? " is-gathering" : ""}`}
        style={
          {
            left: natural.x,
            top: natural.y,
            width: natural.w,
            height: natural.h,
            zIndex: 85,
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            opacity: gathering ? 0 : 1,
            transition: tweenMs
              ? `transform ${tweenMs}ms cubic-bezier(0.22, 0.9, 0.28, 1), opacity ${tweenMs}ms ease`
              : "none",
            "--fx-flip-ms": `${FX_TIMING.prMillFlipMs}ms`,
            pointerEvents: watch ? "auto" : undefined,
          } as CSSProperties
        }
        onClick={watch ? (e) => e.stopPropagation() : undefined}
      >
        <MarketNewsDeckCard
          className="is-event is-mill"
          card={card}
          forceFlipped={showBack}
          interactive={false}
        />
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
