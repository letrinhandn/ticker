"use client";

import { useEffect, useMemo, useState } from "react";
import { BOARD, isListedCompany } from "@/lib/game/board";
import { FUNDS_BY_TILE } from "@/lib/game/content/funds";
import {
  currentSharePrice,
  getShareFloat,
  getSharesOnMarket,
  getSharesOwned,
} from "@/lib/game/engine";
import { fundNameKey, useT } from "@/lib/i18n";
import { money } from "@/lib/money";
import type { GameState } from "@/shared/types";
import { MAX_SHARES_OWNED } from "@/shared/types";
import { CompanyLogo } from "@/components/cards/CompanyLogo";
import { DeedCard } from "@/components/cards/DeedCard";

export function TradeModal({
  game,
  playerId,
  focusTile,
  onTrade,
  onSkip,
  watchMode = false,
  actorName,
  closing = false,
  peeked = false,
  onHide,
}: {
  game: GameState;
  playerId: string;
  tradesLeft: number;
  focusTile?: number;
  onTrade: (action: "buy" | "sell", tileIndex: number, shares: number) => void;
  onSkip: () => void;
  /** Spectator / bot turn — show desk, no controls. */
  watchMode?: boolean;
  actorName?: string;
  /** Fade-out after a filled order before PR mill. */
  closing?: boolean;
  /** Local hide — stay mounted so dismiss / PR mill still advance. */
  peeked?: boolean;
  /** Tap outside peeks the card away (local); reopen from HUD. */
  onHide?: () => void;
}) {
  const t = useT();
  const ownedTileIndexes = useMemo(() => {
    const set = new Set<number>();
    for (const h of game.holdings) {
      if (h.ownerId === playerId && h.shares > 0) set.add(h.tileIndex);
    }
    return [...set];
  }, [game.holdings, playerId]);
  const holdings = useMemo(
    () =>
      ownedTileIndexes
        .map((i) => BOARD[i])
        .filter((c): c is NonNullable<typeof c> => !!c && isListedCompany(c)),
    [ownedTileIndexes],
  );
  const canBuyHere =
    focusTile != null && !!BOARD[focusTile] && isListedCompany(BOARD[focusTile]!);
  // Desk always keys off the landed listed tile — never invent another company.
  const [tileIndex, setTileIndex] = useState(
    focusTile ?? holdings[0]?.index ?? -1,
  );
  const [shares, setShares] = useState(1);
  const [mode, setMode] = useState<"buy" | "sell">(canBuyHere ? "buy" : "sell");

  useEffect(() => {
    const focused =
      focusTile != null ? BOARD[focusTile] : undefined;
    if (focused && isListedCompany(focused)) {
      setTileIndex(focusTile!);
      setMode("buy");
      return;
    }
    // No valid land focus — sell among real holdings only (else empty desk).
    setMode("sell");
    if (holdings[0]) setTileIndex(holdings[0].index);
    else setTileIndex(-1);
  }, [focusTile, holdings]);

  const player = game.players.find((p) => p.id === playerId);
  if (!player) return null;

  const tile = tileIndex >= 0 ? BOARD[tileIndex] : undefined;
  if (!tile || !isListedCompany(tile)) {
    // Invalid desk — only skip (engine also closes no-focus trades).
    return (
      <div
        className={`modal-overlay event-overlay is-watch${closing ? " is-trade-closing" : ""}${peeked ? " is-peek-hidden" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={closing || peeked || undefined}
        onClick={peeked ? undefined : () => onHide?.()}
      >
        <article
          className="trade-desk trade-modal-card"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="trade-desk-banner">
            <p className="trade-desk-kicker">{t("trade.title")}</p>
          </header>
          <div className="trade-desk-body">
            <p className="trade-desk-empty">{t("trade.buyOnlyLanded")}</p>
            {!watchMode && (
              <button type="button" className="trade-desk-skip" onClick={onSkip}>
                {t("trade.skip")}
              </button>
            )}
          </div>
        </article>
      </div>
    );
  }

  const isEtf = tile.kind === "etf";
  const fund = isEtf ? FUNDS_BY_TILE[tileIndex] : undefined;
  const displayName = fund ? t(fundNameKey(fund.id)) : tile.name;
  const owned = getSharesOwned(game, tileIndex, playerId);
  const market = getSharesOnMarket(game, tileIndex);
  const float = getShareFloat(tileIndex);
  const price = currentSharePrice(game, tileIndex);
  const maxOwn = isEtf ? float : MAX_SHARES_OWNED;

  const buyLockedToFocus =
    canBuyHere && mode === "buy" && tileIndex === focusTile;
  const etfFullBuy = isEtf && mode === "buy";
  const maxBuyAnnounce = Math.min(float, market, maxOwn - owned);
  const maxSell = Math.min(float, owned);
  // ETF buy: fixed to full remaining float (no 1–10 share slider).
  const maxQty = mode === "buy"
    ? etfFullBuy
      ? Math.max(market, 0)
      : Math.max(maxBuyAnnounce, 0)
    : maxSell;
  const qty = mode === "buy" && etfFullBuy
    ? maxQty
    : Math.max(1, Math.min(shares, Math.max(1, maxQty)));
  const canBuy =
    buyLockedToFocus &&
    maxBuyAnnounce >= 1 &&
    (!etfFullBuy || market >= 1);
  const canSell = maxSell >= 1;
  const canAct = mode === "buy" ? canBuy : canSell;

  const sellOptions = focusTile != null
    ? (() => {
        const focused = BOARD[focusTile]!;
        const rest = holdings.filter((c) => c.index !== focusTile);
        return isListedCompany(focused)
          ? [focused, ...rest]
          : holdings;
      })()
    : holdings;

  // Bot / spectator: same asset deed as land reveal + thinking beat.
  if (watchMode) {
    const thinker = actorName ?? player.name;
    return (
      <div
        className={`modal-overlay event-overlay is-watch${closing ? " is-trade-closing" : ""}${peeked ? " is-peek-hidden" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trade-thinking-label"
        aria-hidden={closing || peeked || undefined}
        onClick={peeked ? undefined : () => onHide?.()}
      >
        <div
          className={`land-deed-wrap${closing ? " is-closing" : ""}`}
          onClick={(e) => e.stopPropagation()}
        >
          <DeedCard
            tileIndex={tileIndex}
            game={game}
            footer={
              <div className="land-deed-footer trade-thinking-footer">
                <p
                  id="trade-thinking-label"
                  className="land-deed-hint trade-thinking m-0"
                >
                  <span className="trade-thinking-who">{thinker}</span>
                  <span className="trade-thinking-label">
                    {t("trade.thinking")}
                  </span>
                  <span className="trade-thinking-dots" aria-hidden>
                    <span />
                    <span />
                    <span />
                  </span>
                </p>
              </div>
            }
          />
        </div>
      </div>
    );
  }

  const total = canAct ? price * qty : 0;
  const sideClass = mode === "buy" ? "is-buy" : "is-sell";

  return (
    <div
      className={`modal-overlay event-overlay is-watch${closing ? " is-trade-closing" : ""}${peeked ? " is-peek-hidden" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="trade-card-title"
      aria-hidden={closing || peeked || undefined}
      onClick={peeked ? undefined : () => onHide?.()}
    >
      <article
        className={`trade-desk trade-modal-card ${sideClass}${closing ? " is-closing" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="trade-desk-banner">
          <p className="trade-desk-kicker">{t("trade.title")}</p>
          <h2 id="trade-card-title" className="trade-desk-name">
            {displayName}
          </h2>
          <div className="trade-desk-banner-row">
            <span className={`trade-desk-chip is-${mode}`}>
              {mode === "buy" ? t("trade.buy") : t("trade.sell")}
            </span>
            <span className="trade-desk-ticker">{tile.ticker ?? ""}</span>
          </div>
        </header>

        <div className="trade-desk-body">
          <div className="trade-desk-head">
            <div className="trade-desk-asset">
              {tile.logo ? (
                <CompanyLogo
                  src={tile.logo}
                  alt={tile.ticker ?? tile.name}
                  className="trade-desk-logo"
                />
              ) : (
                <span className="trade-desk-logo is-fallback">
                  {(tile.ticker ?? displayName).slice(0, 2)}
                </span>
              )}
              <div className="trade-desk-price">
                <span>{t("trade.livePrice")}</span>
                <strong>{money(price)}</strong>
              </div>
            </div>
          </div>

          <div
            className="trade-desk-sides"
            role="tablist"
            aria-label={t("trade.orderType")}
          >
            {(["buy", "sell"] as const).map((side) => {
              const disabled = side === "buy" && !canBuyHere;
              return (
                <button
                  key={side}
                  type="button"
                  role="tab"
                  aria-selected={mode === side}
                  disabled={disabled}
                  className={`trade-desk-side is-${side}${mode === side ? " is-on" : ""}`}
                  onClick={() => {
                    if (disabled) return;
                    setMode(side);
                    if (side === "buy" && focusTile != null) {
                      setTileIndex(focusTile);
                    }
                    setShares(1);
                  }}
                >
                  {side === "buy" ? t("trade.buy") : t("trade.sell")}
                </button>
              );
            })}
          </div>

          <p className="trade-desk-meta-line">
            <span>
              {t("trade.ownedShort")} {owned}/{maxOwn}
            </span>
            <span>
              {t("trade.marketShort")} {market}/{float}
            </span>
            <span>
              {t("trade.cashShort")} {money(player.cash)}
            </span>
          </p>

          {!canBuyHere && mode === "buy" ? (
            <p className="trade-desk-hint">{t("trade.buyOnlyLanded")}</p>
          ) : null}

          {mode === "sell" && sellOptions.length > 1 ? (
            <select
              className="trade-desk-select"
              value={tileIndex}
              onChange={(e) => {
                setTileIndex(Number(e.target.value));
                setShares(1);
              }}
              aria-label={t("trade.pickCompany")}
            >
              {sellOptions.map((c) => (
                <option key={c.index} value={c.index}>
                  {c.ticker} {c.name}
                </option>
              ))}
            </select>
          ) : null}

          {etfFullBuy ? (
            <p className="trade-desk-qty-note">
              {t("trade.etfFullBuy", { count: market })}
            </p>
          ) : (
            <div className="trade-desk-qty">
              <button
                type="button"
                className="trade-desk-step"
                disabled={!canAct || qty <= 1}
                onClick={() => setShares((q) => Math.max(1, q - 1))}
                aria-label={t("trade.fewer")}
              >
                −
              </button>
              <div className="trade-desk-qty-value">
                <strong>{canAct ? qty : 0}</strong>
                <span>{t("trade.shares")}</span>
              </div>
              <button
                type="button"
                className="trade-desk-step"
                disabled={!canAct || qty >= maxQty}
                onClick={() => setShares((q) => Math.min(maxQty, q + 1))}
                aria-label={t("trade.more")}
              >
                +
              </button>
            </div>
          )}

          <button
            type="button"
            className={`trade-desk-confirm is-${mode}`}
            disabled={!canAct}
            onClick={() => onTrade(mode, tileIndex, qty)}
          >
            <span>
              {mode === "buy"
                ? etfFullBuy
                  ? t("trade.confirmEtfFull")
                  : t("trade.confirmBuy")
                : t("trade.confirmSell")}
              {etfFullBuy ? "" : ` ${canAct ? qty : 0}`}
            </span>
            <strong>{money(total)}</strong>
          </button>

          <button type="button" className="trade-desk-skip" onClick={onSkip}>
            {t("trade.skip")}
          </button>
        </div>
      </article>
    </div>
  );
}
