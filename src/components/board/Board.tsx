"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  BOARD,
  GROUP_COLORS,
  SECTOR_CODE,
  SECTOR_LABELS,
  isListedCompany,
} from "@/lib/game/board";
import {
  getShareFloat,
  getSharesOnMarket,
  tileGridPosition,
} from "@/lib/game/engine";
import { FUNDS_BY_TILE } from "@/lib/game/content/funds";
import { currentSharePrice } from "@/lib/game/pricing";
import type {
  GameState,
  PlayerState,
  PlayerToken,
  SectorId,
} from "@/shared/types";
import { sectorNameKey, useT, type MessageKey } from "@/lib/i18n";
import { useGameFxOptional } from "@/lib/fx/GameFxContext";
import { useRoom } from "@/lib/net/RoomContext";
import { useGameActions } from "@/lib/net/useGameActions";
import { fxMs } from "@/lib/prefs/gamePrefs";
import { useBrowseHoldActive } from "@/lib/ui/BrowseHoldContext";
import { CompanyLogo } from "@/components/cards/CompanyLogo";
import { DeckBrowser } from "@/components/cards/DeckBrowser";
import { DeckCardBackFace } from "@/components/cards/DeckCards";
import { DeedCard } from "@/components/cards/DeedCard";
import { EtfPie } from "@/components/cards/EtfPie";
import { PlayerPiece } from "@/components/cards/PlayerPiece";
import { PlayerProfile } from "@/components/hud/PlayerProfile";
import { DicePair } from "./Dice";
import { SectorCard } from "./SectorCard";

const BOARD_SIZE = 40;

function tileGlyph(kind: string, t: (key: MessageKey) => string) {
  switch (kind) {
    case "go":
      return t("board.tileStart");
    case "halt":
    case "jail":
      return t("board.tileSec");
    case "free":
      return t("board.tileWeekend");
    case "goto_halt":
    case "gotojail":
      return t("board.tileGotoSec");
    case "regime":
      return t("board.tileNews");
    case "tax":
      return t("board.tileTax");
    default:
      return "";
  }
}

function isInspectable(kind: string) {
  return (
    kind === "company" ||
    kind === "etf" ||
    kind === "tax" ||
    kind === "regime" ||
    kind === "free" ||
    kind === "halt" ||
    kind === "goto_halt" ||
    kind === "go"
  );
}

function forwardPath(from: number, to: number): number[] {
  if (from === to) return [];
  const steps: number[] = [];
  let i = from;
  for (let n = 0; n < BOARD_SIZE + 4; n++) {
    i = (i + 1) % BOARD_SIZE;
    steps.push(i);
    if (i === to) break;
  }
  return steps;
}

function cellCenter(index: number) {
  const { row, col } = tileGridPosition(index);
  return {
    left: `calc((${col} + 0.5) * var(--cell))`,
    top: `calc((${row} + 0.5) * var(--cell))`,
  };
}

type VisualToken = {
  id: string;
  name: string;
  token: PlayerToken;
  index: number;
  hopping: boolean;
};

/**
 * Display tokens hop after dice settle. Never snap `display` to the server
 * tile while `hold` (dice rolling) — that was teleporting pieces before hop.
 */
function useTokenMotion(
  players: PlayerState[],
  hold: boolean,
  setTokensMoving: (v: boolean) => void,
): VisualToken[] {
  const [visual, setVisual] = useState<VisualToken[]>([]);
  const display = useRef<Record<string, number>>({});
  const timers = useRef<number[]>([]);
  const busy = useRef(false);
  const posKey = players.map((p) => `${p.id}:${p.position}:${p.bankrupt ? 1 : 0}`).join("|");

  const paint = (list: PlayerState[], hoppingId: string | null = null) => {
    setVisual(
      list
        .filter((p) => !p.bankrupt)
        .map((p) => ({
          id: p.id,
          name: p.name,
          token: p.token,
          index: display.current[p.id] ?? p.position,
          hopping: hoppingId === p.id,
        })),
    );
  };

  const clearTimers = () => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  };

  // Seed display tiles once; never overwrite with server pos while holding.
  useEffect(() => {
    for (const p of players) {
      if (display.current[p.id] == null) {
        display.current[p.id] = p.position;
      }
    }
    for (const id of Object.keys(display.current)) {
      if (!players.some((p) => p.id === id && !p.bankrupt)) {
        delete display.current[id];
      }
    }
    if (!busy.current) paint(players);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- posKey captures moves
  }, [posKey, hold]);

  // While dice roll, if server already advanced a piece, keep the move lock
  // so HUD cards cannot open in the dice→hop gap.
  useEffect(() => {
    if (!hold) return;
    const needsHop = players.some(
      (p) =>
        !p.bankrupt && (display.current[p.id] ?? p.position) !== p.position,
    );
    if (needsHop) setTokensMoving(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- posKey captures moves
  }, [hold, posKey, setTokensMoving]);

  // After dice stop, hop along the path to the server tile.
  useEffect(() => {
    if (hold) return;

    const movers = players.filter(
      (p) => !p.bankrupt && (display.current[p.id] ?? p.position) !== p.position,
    );
    if (movers.length === 0) {
      busy.current = false;
      setTokensMoving(false);
      paint(players);
      return;
    }

    let cancelled = false;
    busy.current = true;
    setTokensMoving(true);
    clearTimers();

    const run = (index: number) => {
      if (cancelled) return;
      if (index >= movers.length) {
        busy.current = false;
        setTokensMoving(false);
        paint(players);
        return;
      }
      const p = movers[index]!;
      const from = display.current[p.id] ?? p.position;
      const path = forwardPath(from, p.position);
      // Jail warp / other non-dice jumps — teleport, don't walk the long way.
      if (path.length === 0 || path.length > 12) {
        display.current[p.id] = p.position;
        paint(players, p.id);
        const pause = window.setTimeout(() => run(index + 1), path.length > 12 ? 220 : 80);
        timers.current.push(pause);
        return;
      }
      let step = 0;
      const tick = () => {
        if (cancelled) return;
        const tile = path[step]!;
        display.current[p.id] = tile;
        paint(players, p.id);
        step += 1;
        if (step >= path.length) {
          display.current[p.id] = p.position;
          paint(players);
          const pause = window.setTimeout(() => run(index + 1), 80);
          timers.current.push(pause);
          return;
        }
        const t = window.setTimeout(tick, fxMs(220));
        timers.current.push(t);
      };
      tick();
    };
    run(0);

    return () => {
      cancelled = true;
      clearTimers();
      busy.current = false;
      // Keep tokensMoving true across effect restarts — only arrival clears it.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hold, posKey, setTokensMoving]);

  useEffect(() => {
    return () => {
      clearTimers();
      busy.current = false;
      setTokensMoving(false);
    };
  }, [setTokensMoving]);

  return visual;
}

function useBoardFit() {
  const shellRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 1, w: 0, h: 0 });

  useEffect(() => {
    const shell = shellRef.current;
    const table = tableRef.current;
    if (!shell || !table) return;

    const update = () => {
      // Keep board inside HUD corner cards
      const style = getComputedStyle(shell);
      const padX =
        (parseFloat(style.paddingLeft) || 0) +
        (parseFloat(style.paddingRight) || 0);
      const padY =
        (parseFloat(style.paddingTop) || 0) +
        (parseFloat(style.paddingBottom) || 0);
      const sw = Math.max(0, shell.clientWidth - padX);
      const sh = Math.max(0, shell.clientHeight - padY);
      // Measure unscaled size (offsetWidth ignores transform)
      const tw = table.offsetWidth;
      const th = table.offsetHeight;
      if (!sw || !sh || !tw || !th) return;
      const next = Math.min(sw / tw, sh / th);
      const scale = Number.isFinite(next) && next > 0 ? next : 1;
      setFit({ scale, w: tw * scale, h: th * scale });
    };

    const ro = new ResizeObserver(update);
    ro.observe(shell);
    ro.observe(table);
    update();
    window.addEventListener("orientationchange", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return { shellRef, tableRef, ...fit };
}

export function Board({ game }: { game: GameState }) {
  const t = useT();
  const { playerId, diceRolling, setTokensMoving } = useRoom();
  const { canRoll, roll } = useGameActions();
  const fx = useGameFxOptional();
  const [inspect, setInspect] = useState<number | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [deckBrowser, setDeckBrowser] = useState<"pr" | "regime" | null>(null);
  const [sectorCard, setSectorCard] = useState<SectorId | null>(null);
  useBrowseHoldActive(
    inspect != null ||
      profileId != null ||
      deckBrowser != null ||
      sectorCard != null,
  );
  const visualTokens = useTokenMotion(
    game.players,
    diceRolling,
    setTokensMoving,
  );
  const { shellRef, tableRef, scale, w: fitW, h: fitH } = useBoardFit();
  const landPulse = fx?.landPulseTile ?? null;
  const focusTile = fx?.focusTile ?? null;

  // Offset tokens that share a tile
  const counts: Record<number, number> = {};
  const offsets: Record<string, number> = {};
  for (const t of visualTokens) {
    const n = counts[t.index] ?? 0;
    counts[t.index] = n + 1;
    offsets[t.id] = n;
  }

  return (
    <div className="board-shell" ref={shellRef}>
      <div
        className="board-fit"
        style={
          fitW && fitH
            ? { width: fitW, height: fitH }
            : undefined
        }
      >
        <div
          className="mono-table"
          ref={tableRef}
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
        <div className="board-grid" role="grid" aria-label={t("board.aria")}>
          {BOARD.map((tile) => {
            const { row, col } = tileGridPosition(tile.index);
            const listed = isListedCompany(tile);
            const shareFloat = listed ? getShareFloat(tile.index) : null;
            const marketLeft = listed
              ? getSharesOnMarket(game, tile.index)
              : null;
            const band =
              tile.group !== "none" &&
              (tile.kind === "company" || tile.kind === "etf")
                ? GROUP_COLORS[tile.group]
                : undefined;
            const side =
              tile.index === 0 ||
              tile.index === 10 ||
              tile.index === 20 ||
              tile.index === 30
                ? "corner"
                : tile.index < 10
                  ? "bottom"
                  : tile.index < 20
                    ? "left"
                    : tile.index < 30
                      ? "top"
                      : "right";
            const title = tile.ticker
              ? `${tile.name} (${tile.ticker})`
              : tile.name;

            return (
              <button
                type="button"
                key={tile.index}
                className={`tile kind-${tile.kind} side-${side}${landPulse === tile.index ? " is-land-pulse" : ""}${focusTile === tile.index ? " is-trade-focus" : ""}`}
                style={{
                  gridRow: row + 1,
                  gridColumn: col + 1,
                  ["--band" as string]: band,
                }}
                title={title}
                onClick={() => {
                  if (isInspectable(tile.kind)) setInspect(tile.index);
                }}
              >
                {band && tile.kind !== "etf" && <span className="tile-band" />}
                <span className="tile-body">
                  {tile.kind === "etf" && FUNDS_BY_TILE[tile.index] ? (
                    <EtfPie
                      sectors={FUNDS_BY_TILE[tile.index]!.sectorIds}
                      size={side === "top" || side === "bottom" ? "tileSm" : "tile"}
                      className="tile-etf-pie"
                    />
                  ) : tile.logo &&
                    (tile.kind === "halt" ||
                      tile.kind === "goto_halt" ||
                      tile.kind === "free" ||
                      tile.kind === "tax" ||
                      tile.kind === "go") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={tile.logo}
                      alt={tile.name}
                      className={`tile-logo is-corner${
                        tile.kind === "free"
                          ? " is-weekend"
                          : tile.kind === "tax"
                            ? " is-tax"
                            : tile.kind === "go"
                              ? " is-start"
                              : " is-sec"
                      }`}
                      draggable={false}
                    />
                  ) : tile.logo ? (
                    <CompanyLogo
                      src={tile.logo}
                      alt={tile.ticker ?? tile.name}
                      className="tile-logo"
                    />
                  ) : null}
                  {(() => {
                    if (tile.kind === "tax") {
                      const label =
                        tile.index === 38 || (tile.taxAmount ?? 0) >= 200
                          ? t("tax.wealthTop")
                          : t("tax.incomeTop");
                      return (
                        <span className="tile-glyph is-corner is-tax">
                          {label}
                          {"\n"}
                          {t("tax.bottom")}
                        </span>
                      );
                    }
                    const glyph = tileGlyph(tile.kind, t);
                    if (
                      tile.kind === "halt" ||
                      tile.kind === "goto_halt" ||
                      tile.kind === "free" ||
                      tile.kind === "go"
                    ) {
                      return (
                        <span className={`tile-glyph is-corner is-${tile.kind}`}>
                          {glyph}
                        </span>
                      );
                    }
                    if (glyph) {
                      return <span className="tile-glyph">{glyph}</span>;
                    }
                    // Company / ETF: logo (or ETF pie) only — no ticker on the board.
                    if (tile.kind === "company" || tile.kind === "etf") {
                      return null;
                    }
                    return <span className="tile-name">{tile.name}</span>;
                  })()}
                  {isListedCompany(tile) && tile.price != null && (() => {
                    const live = currentSharePrice(game, tile.index);
                    const base = tile.price;
                    const tone =
                      live > base ? "up" : live < base ? "down" : "flat";
                    return (
                      <span
                        className={`tile-price is-${tone}`}
                        style={{
                          color:
                            tone === "up"
                              ? "#0a7a32"
                              : tone === "down"
                                ? "#c62828"
                                : undefined,
                        }}
                      >
                        {live}
                        {tone !== "flat" && (
                          <span className="tile-price-arrow" aria-hidden>
                            {tone === "up" ? "▲" : "▼"}
                          </span>
                        )}
                      </span>
                    );
                  })()}
                  {tile.kind === "tax" && tile.taxAmount != null && (
                    <span className="tile-price is-tax">{tile.taxAmount}</span>
                  )}
                  {listed && marketLeft != null && shareFloat != null && (
                    <span
                      className={`tile-holders${marketLeft === 0 ? " is-sold-out" : ""}${marketLeft < shareFloat ? " is-partial" : ""}`}
                      title={t("board.sharesAvail", {
                        left: marketLeft,
                        total: shareFloat,
                      })}
                    >
                      {marketLeft}/{shareFloat}
                    </span>
                  )}
                </span>
              </button>
            );
          })}

          <div className="board-center">
            <div className="center-brand-wrap">
              <p className="board-center-brand">{t("brand.name")}</p>
              <p className="board-center-sub">{t("brand.tagline")}</p>
            </div>
            <button
              type="button"
              className={`dice-hit${canRoll ? " can-roll" : ""}${diceRolling ? " is-rolling" : ""}`}
              onClick={roll}
              disabled={!canRoll}
              aria-label={canRoll ? t("board.rollDice") : t("board.dice")}
              title={canRoll ? t("board.tapToRoll") : undefined}
            >
              <DicePair values={game.lastDice} rolling={diceRolling} size="md" />
              {canRoll && (
                <span className="dice-hint">{t("board.tapToRoll")}</span>
              )}
            </button>
            <div className="center-decks" aria-label={t("board.decks")}>
              <div
                className="deck-pile"
                style={
                  {
                    "--deck-rest-rot": "-6deg",
                    transform: "rotate(var(--deck-rest-rot))",
                  } as CSSProperties
                }
              >
                <span className="deck-layer" style={{ transform: "translate(4px, 4px)", background: "#000" }} />
                <span className="deck-layer" style={{ transform: "translate(2px, 2px)", background: "#1a1a1a" }} />
                <button
                  type="button"
                  className="deck-stack deck-pr"
                  title={t("deck.priceReaction")}
                  aria-label={t("deck.viewPr")}
                  onClick={() => setDeckBrowser("pr")}
                >
                  <DeckCardBackFace variant="pr" label={t("deck.prLabel")} />
                </button>
              </div>
              <div
                className="deck-pile"
                style={
                  {
                    "--deck-rest-rot": "6deg",
                    transform: "rotate(var(--deck-rest-rot))",
                  } as CSSProperties
                }
              >
                <span className="deck-layer" style={{ transform: "translate(4px, 4px)", background: "#000" }} />
                <span className="deck-layer" style={{ transform: "translate(2px, 2px)", background: "#1a1a1a" }} />
                <button
                  type="button"
                  className="deck-stack deck-regime"
                  title={t("deck.marketNews")}
                  aria-label={t("deck.viewNews")}
                  onClick={() => setDeckBrowser("regime")}
                >
                  <DeckCardBackFace variant="news" label={t("deck.newsLabel")} />
                </button>
              </div>
            </div>
            <div className="sector-board" aria-label={t("sector.scale")}>
              <div className="sector-head">
                <span className="sector-scale-label">{t("sector.scale")}</span>
                <div className="sector-scale" aria-hidden>
                  {Array.from({ length: 11 }, (_, i) => i - 5).map((n) => (
                    <span
                      key={n}
                      className={`sector-scale-tick${n === 0 ? " is-zero" : ""}`}
                    >
                      {n > 0 ? `+${n}` : n}
                    </span>
                  ))}
                </div>
              </div>
              {SECTOR_LABELS.map((s) => {
                // Always prefer FX visual — it stays frozen at pre-PR levels
                // until presentation hold releases after mill.
                const raw =
                  fx != null
                    ? (fx.sectorVisual[s.sector] ?? 0)
                    : (game.sectorIndex[s.sector] ?? 0);
                const v = Math.max(-5, Math.min(5, raw));
                const slot = v + 6; /* 1..11 */
                const bumping = fx?.sectorBumpId === s.sector;
                const bumpDir = bumping ? (fx?.sectorBumpDir ?? 0) : 0;
                const ink =
                  s.group === "yellow" || s.group === "lightblue" ? "#1a1a1a" : "#fff";
                const sectorName = t(sectorNameKey(s.sector));
                return (
                  <button
                    type="button"
                    key={s.sector}
                    className={`sector-row${bumping ? " is-bumping" : ""}${bumpDir > 0 ? " is-up" : ""}${bumpDir < 0 ? " is-down" : ""}`}
                    title={`${sectorName}: ${v > 0 ? `+${v}` : v}`}
                    aria-label={t("sector.view", {
                      code: SECTOR_CODE[s.sector],
                      name: sectorName,
                    })}
                    onClick={() => setSectorCard(s.sector)}
                  >
                    <span
                      className="sector-label"
                      style={{ background: GROUP_COLORS[s.group], color: ink }}
                    >
                      {SECTOR_CODE[s.sector]}
                    </span>
                    <div
                      className="sector-track"
                      style={{ "--peg-slot": slot } as CSSProperties}
                    >
                      <span className="sector-groove" aria-hidden />
                      <span className="sector-zero" aria-hidden />
                      <span className="sector-slots" aria-hidden>
                        {Array.from({ length: 11 }, (_, i) => (
                          <i key={i} />
                        ))}
                      </span>
                      <span
                        className={`sector-peg${bumping ? " is-bumping" : ""}${bumpDir > 0 ? " is-up" : ""}${bumpDir < 0 ? " is-down" : ""}`}
                        style={{ background: GROUP_COLORS[s.group] }}
                        data-sector-peg={s.sector}
                        aria-hidden
                      />
                      {bumping ? (
                        <span
                          className={`sector-bump-tag${bumpDir > 0 ? " is-up" : " is-down"}`}
                          aria-hidden
                        >
                          {bumpDir > 0 ? "+1" : "−1"}
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="token-layer">
            {visualTokens.map((tok) => {
              const pos = cellCenter(tok.index);
              const share = counts[tok.index] ?? 1;
              const slot = offsets[tok.id] ?? 0;
              const dx = share > 1 ? (slot === 0 ? -7 : 7) : 0;
              const player = game.players.find((p) => p.id === tok.id);
              const landing =
                !tok.hopping && landPulse != null && landPulse === tok.index;
              return (
                <button
                  type="button"
                  key={tok.id}
                  className={`board-token is-piece${tok.hopping ? " hopping" : ""}${landing ? " is-landing" : ""}${player?.inJail ? " is-jailed" : ""}${fx?.bankruptPlayerId === tok.id ? " is-busting" : ""}`}
                  title={t("hud.openProfile", { name: tok.name })}
                  aria-label={t("hud.openProfile", { name: tok.name })}
                  onClick={(e) => {
                    e.stopPropagation();
                    setProfileId(tok.id);
                  }}
                  style={{
                    left: pos.left,
                    top: pos.top,
                    transform: `translate(calc(-50% + ${dx}px), -50%)`,
                  }}
                >
                  <PlayerPiece
                    name={tok.name}
                    playerId={tok.id}
                    token={tok.token}
                    size={26}
                    jailed={Boolean(player?.inJail)}
                  />
                </button>
              );
            })}
          </div>
        </div>
        </div>
      </div>

      {inspect != null &&
        createPortal(
          <div
            className="modal-overlay is-browse"
            onClick={() => setInspect(null)}
          >
            <div className="inspect-modal" onClick={(e) => e.stopPropagation()}>
              <DeedCard tileIndex={inspect} game={game} />
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setInspect(null)}
              >
                {t("common.close")}
              </button>
            </div>
          </div>,
          document.body,
        )}

      {deckBrowser && (
        <DeckBrowser
          kind={deckBrowser}
          game={game}
          onClose={() => setDeckBrowser(null)}
        />
      )}

      {sectorCard && (
        <SectorCard
          sector={sectorCard}
          game={game}
          onClose={() => setSectorCard(null)}
          onOpenCompany={(tileIndex) => setInspect(tileIndex)}
        />
      )}

      {profileId &&
        createPortal(
          <PlayerProfile
            game={game}
            playerId={profileId}
            viewerId={playerId}
            browse
            onClose={() => setProfileId(null)}
          />,
          document.body,
        )}
    </div>
  );
}
