"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  eventCardCenterRect,
  PriceReactionDeckCard,
} from "@/components/cards/DeckCards";
import { BOARD, sectorForTile } from "@/lib/game/board";
import { PRICE_REACTIONS } from "@/lib/game/content/priceReactions";
import { FX_TIMING } from "@/lib/fx/types";
import { useT } from "@/lib/i18n";
import type {
  LockedOrder,
  PriceReactionCard,
  SectorDelta,
  SectorId,
} from "@/shared/types";

const MAX_SKIP_FACES = 5;

type Phase = "deal" | "flip" | "hold" | "zoom" | "lock" | "gather" | "done";

type Box = { x: number; y: number; w: number; h: number };

function lookupPr(id: string) {
  return PRICE_REACTIONS.find((c) => c.id === id) ?? null;
}

function pileBox(): Box | null {
  const el = document.querySelector(".deck-stack.deck-pr");
  const r = el?.getBoundingClientRect();
  if (!r) return null;
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

function tableSlot(pile: Box, index: number): Box {
  const gap = Math.max(6, pile.w * 0.12);
  const leftSide = pile.x > window.innerWidth * 0.35;
  const fan = Math.min(index, 5) * 7;
  const w = pile.w;
  const h = pile.h;
  const x = leftSide
    ? pile.x - gap - w - fan
    : pile.x + pile.w + gap + fan;
  const y = pile.y + (index % 3);
  return { x, y, w, h };
}

/**
 * Render the real EventCard at natural size, shrink with transform:scale.
 * Same layout as zoom — only the scale changes (physical card pattern).
 */
function ScaledPrCard({
  box,
  natural,
  card,
  forceFlipped,
  primary = null,
  applied = [],
  side = null,
  footer,
  className = "",
  tweenMs,
  zIndex = 84,
}: {
  box: Box;
  natural: Box;
  card: PriceReactionCard;
  forceFlipped: boolean;
  primary?: SectorId | null;
  applied?: SectorDelta[];
  side?: "buy" | "sell" | null;
  footer?: ReactNode;
  className?: string;
  tweenMs?: number;
  zIndex?: number;
}) {
  const scale = Math.min(box.w / natural.w, box.h / natural.h);
  const tx = box.x + box.w / 2 - (natural.x + natural.w / 2);
  const ty = box.y + box.h / 2 - (natural.y + natural.h / 2);
  const gathering = className.includes("is-gathering");

  return (
    <div
      className={`fx-pr-scaled${className ? ` ${className}` : ""}`}
      style={
        {
          left: natural.x,
          top: natural.y,
          width: natural.w,
          height: natural.h,
          zIndex,
          transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
          opacity: gathering ? 0 : undefined,
          transition: tweenMs
            ? `transform ${tweenMs}ms cubic-bezier(0.22, 0.9, 0.28, 1), opacity ${tweenMs}ms ease`
            : "none",
          pointerEvents: "auto",
        } as CSSProperties
      }
      onClick={(e) => e.stopPropagation()}
    >
      <PriceReactionDeckCard
        className="is-event is-mill"
        card={card}
        primary={primary}
        applied={applied}
        side={side}
        forceFlipped={forceFlipped}
        interactive={false}
        footer={footer}
      />
    </div>
  );
}

/**
 * Mill full PR cards (scaled) onto the table beside the pile.
 * Match zooms to 1:1 → gather → caller shuffles.
 */
export function PrMillPortal({
  milled,
  matchId,
  order,
  deltas,
  settleLine,
  active,
  onDone,
  watch = false,
  peeked = false,
  onHide,
}: {
  milled: string[];
  matchId: string;
  order?: LockedOrder;
  deltas?: SectorDelta[];
  settleLine?: string;
  active: boolean;
  onDone: () => void;
  watch?: boolean;
  peeked?: boolean;
  onHide?: () => void;
}) {
  const t = useT();
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>("deal");
  const [index, setIndex] = useState(0);
  const [faceUp, setFaceUp] = useState(false);
  /** False = still at pile; true = slid to table (enables CSS transition). */
  const [onTable, setOnTable] = useState(false);
  const [pile, setPile] = useState<Box | null>(null);
  const [natural, setNatural] = useState<Box>(() => {
    const c = eventCardCenterRect();
    return { x: c.x, y: c.y, w: c.w, h: c.h };
  });
  const onDoneRef = useRef(onDone);
  const runId = useRef(0);
  const finishedRef = useRef(false);

  const sequenceKey = `${matchId}|${milled
    .filter((id) => id !== matchId)
    .slice(0, MAX_SKIP_FACES)
    .join(",")}`;

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  const sequence = useMemo(() => {
    const skips = sequenceKey.split("|")[1]?.split(",").filter(Boolean) ?? [];
    return [...skips, matchId];
  }, [sequenceKey, matchId]);

  const currentId = sequence[Math.min(index, sequence.length - 1)] ?? matchId;
  const card = lookupPr(currentId);
  const revealed = sequence.slice(0, Math.max(0, index));
  const primary = order ? sectorForTile(BOARD[order.tileIndex]!) : null;
  const applied = deltas ?? [];
  const side = order?.side ?? null;

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (!active) {
      queueMicrotask(() => {
        setPhase("deal");
        setIndex(0);
        setFaceUp(false);
        setOnTable(false);
        setPile(null);
      });
      return;
    }

    const id = ++runId.current;
    finishedRef.current = false;
    const skips = sequenceKey.split("|")[1]?.split(",").filter(Boolean) ?? [];
    const cards = [...skips, matchId];
    const p = pileBox();
    const c = eventCardCenterRect();
    queueMicrotask(() => {
      setPile(p);
      setNatural({ x: c.x, y: c.y, w: c.w, h: c.h });
      setIndex(0);
      setFaceUp(false);
      setOnTable(false);
      setPhase("deal");
    });

    const slideMs = FX_TIMING.prTableSlideMs;
    const flipMs = FX_TIMING.prTableFlipMs;
    const holdMs = FX_TIMING.prTableHoldMs;
    const zoomMs = FX_TIMING.prMatchZoomMs;
    const lockMs = FX_TIMING.prMillLockMs;
    const gatherMs = FX_TIMING.prGatherMs;

    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => {
      timers.push(window.setTimeout(fn, ms));
    };

    const finishOnce = () => {
      if (id !== runId.current || finishedRef.current) return;
      finishedRef.current = true;
      setPhase("done");
      onDoneRef.current();
    };

    // Lay every reject onto the table, then zoom the match — shuffle only via onDone.
    const playCard = (i: number) => {
      if (id !== runId.current) return;
      setIndex(i);
      setFaceUp(false);
      setOnTable(false);
      setPhase("deal");

      later(() => {
        if (id !== runId.current) return;
        setOnTable(true);
        later(() => {
          if (id !== runId.current) return;
          setPhase("flip");
          setFaceUp(true);
          later(() => {
            if (id !== runId.current) return;
            setPhase("hold");
            later(() => {
              if (id !== runId.current) return;
              if (i < cards.length - 1) {
                playCard(i + 1);
                return;
              }
              setPhase("zoom");
                later(() => {
                  if (id !== runId.current) return;
                  setPhase("lock");
                  later(() => {
                    if (id !== runId.current) return;
                    // Keep match FACE-UP while flying home — flip-to-back
                    // before gather looked like a stuck card over the desk.
                    setPhase("gather");
                    later(finishOnce, gatherMs);
                  }, lockMs);
                }, zoomMs);
            }, holdMs);
          }, flipMs);
        }, slideMs);
      }, 32);
    };

    later(() => playCard(0), 40);

    return () => {
      runId.current += 1;
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [active, matchId, sequenceKey]);

  if (!mounted || !active || phase === "done" || !card) return null;

  const basePile = pile ?? {
    x: natural.x,
    y: natural.y + 80,
    w: 64,
    h: 86,
  };
  const slot = tableSlot(basePile, index);
  const zoomed = phase === "zoom" || phase === "lock";
  const gathering = phase === "gather";

  let activeBox: Box = onTable ? slot : basePile;
  let tweenMs: number | undefined = onTable
    ? FX_TIMING.prTableSlideMs
    : undefined;

  if (phase === "zoom" || phase === "lock") {
    activeBox = natural;
    tweenMs = phase === "zoom" ? FX_TIMING.prMatchZoomMs : undefined;
  } else if (gathering) {
    // Face stays up (forceFlipped={!faceUp}); fly home then fade via CSS.
    activeBox = basePile;
    tweenMs = FX_TIMING.prGatherMs;
  } else if (phase === "flip" || phase === "hold") {
    activeBox = slot;
    tweenMs = undefined;
  }

  const node = (
    <div
      className={`fx-deck-layer fx-pr-mill-layer${watch ? " is-watch" : ""}${peeked ? " is-peek-hidden" : ""}`}
      aria-hidden={peeked || !watch || undefined}
      onClick={watch && !peeked ? () => onHide?.() : undefined}
      style={watch && !peeked ? { pointerEvents: "auto" } : undefined}
    >
      {zoomed ? (
        <div className={`fx-pr-mill-veil${watch ? " is-watch" : ""}`} />
      ) : null}

      {revealed.map((id, i) => {
        const c = lookupPr(id);
        if (!c) return null;
        const s = tableSlot(basePile, i);
        return (
          <ScaledPrCard
            key={`spent-${id}`}
            className={gathering ? "is-gathering" : "is-spent"}
            box={gathering ? basePile : s}
            natural={natural}
            card={c}
            forceFlipped={false}
            tweenMs={gathering ? FX_TIMING.prGatherMs : undefined}
            zIndex={83}
          />
        );
      })}

      <ScaledPrCard
        key={`active-${currentId}-${index}`}
        className={
          gathering ? "is-gathering" : zoomed ? "is-focus" : ""
        }
        box={activeBox}
        natural={natural}
        card={card}
        forceFlipped={!faceUp}
        primary={zoomed || gathering ? primary : null}
        applied={zoomed || gathering ? applied : []}
        side={zoomed || gathering ? side : null}
        tweenMs={tweenMs}
        zIndex={gathering ? 85 : zoomed ? 86 : 85}
        footer={
          zoomed && faceUp ? (
            <>
              <p className="fx-pr-mill-badge is-match">{t("pr.millMatch")}</p>
              {settleLine ? (
                <p className="db-event-settle">{settleLine}</p>
              ) : null}
            </>
          ) : null
        }
      />
    </div>
  );

  return createPortal(node, document.body);
}
