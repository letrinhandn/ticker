"use client";

import { createPortal } from "react-dom";
import { BOARD, GROUP_COLORS } from "@/lib/game/board";
import {
  botFundByName,
  isBotFundName,
  isBotPlayerId,
} from "@/lib/game/bots/botRoster";
import { companyByTileIndex } from "@/lib/game/content/companies";
import { FUNDS_BY_TILE } from "@/lib/game/content/funds";
import { currentSharePrice, netWorth, portfolioValue } from "@/lib/game/pricing";
import { fundNameKey, useT } from "@/lib/i18n";
import { money } from "@/lib/money";
import type { GameState } from "@/shared/types";
import { HoldingsPie, type PieSlice } from "@/components/board/HoldingsPie";
import { FundLogo } from "@/components/cards/FundLogo";
import { fundKindShortKey } from "@/components/cards/FundSelectOptions";

export function PlayerProfile({
  game,
  playerId,
  viewerId,
  onClose,
  /** Stagger pie reveal after a filled trade. */
  tradeReveal = false,
  /** User opened this — keep above bot/other-player game cards. */
  browse = false,
  /** Auto trade reveal while watching — no blur; tap outside peeks away. */
  watch = false,
  peeked = false,
}: {
  game: GameState;
  playerId: string;
  viewerId?: string | null;
  onClose: () => void;
  tradeReveal?: boolean;
  browse?: boolean;
  watch?: boolean;
  peeked?: boolean;
}) {
  const t = useT();
  const player = game.players.find((p) => p.id === playerId);
  if (!player) return null;

  const mine = viewerId === player.id;
  const raw = game.holdings
    .filter((h) => h.ownerId === player.id)
    .map((h) => {
      const tile = BOARD[h.tileIndex]!;
      const price = currentSharePrice(game, h.tileIndex);
      const company =
        tile.kind === "company" ? companyByTileIndex(h.tileIndex) : undefined;
      const fund = tile.kind === "etf" ? FUNDS_BY_TILE[h.tileIndex] : undefined;
      const revenuePer =
        company?.revenueBasePerShareM ?? tile.revenueBasePerShare ?? 0;
      const costPer =
        company?.fixedCostPerShareM ?? tile.fixedCostPerShare ?? 0;
      return {
        tileIndex: h.tileIndex,
        kind: tile.kind,
        name: fund ? t(fundNameKey(fund.id)) : tile.name,
        ticker: tile.ticker ?? tile.name,
        group: tile.group,
        shares: h.shares,
        price,
        value: price * h.shares,
        estRev: revenuePer * h.shares,
        estCost: costPer * h.shares,
        fund,
      };
    })
    .sort((a, b) => b.value - a.value);

  const companies = raw.filter((h) => h.kind === "company");
  const etfs = raw.filter((h) => h.kind === "etf");

  const companyValue = companies.reduce((s, h) => s + h.value, 0);
  const etfValue = etfs.reduce((s, h) => s + h.value, 0);
  const assets = portfolioValue(game, player.id);
  const worth = netWorth(game, player.id);
  const estRev = companies.reduce((s, h) => s + h.estRev, 0);
  const estCost = companies.reduce((s, h) => s + h.estCost, 0);
  const companyShares = companies.reduce((s, h) => s + h.shares, 0);
  const etfUnits = etfs.reduce((s, h) => s + h.shares, 0);

  const companySlices: PieSlice[] = companies.map((h) => ({
    id: h.ticker,
    label: h.ticker,
    value: h.value,
    color: h.group !== "none" ? GROUP_COLORS[h.group] : "#5a6b5e",
  }));

  const isFund = isBotPlayerId(player.id) || isBotFundName(player.name);
  const fundMeta = botFundByName(player.name);
  const fundKindLabel = fundMeta
    ? t(fundKindShortKey(fundMeta.kind))
    : null;
  const status = player.bankrupt
    ? t("portfolio.bankrupt")
    : player.inJail
      ? t("portfolio.inSec")
      : isFund
        ? fundKindLabel ?? t("portfolio.rivalFund")
        : null;

  const kicker = mine
    ? t("portfolio.yours")
    : isFund
      ? t("portfolio.fund")
      : t("portfolio.generic");

  return createPortal(
    <div
      className={`modal-overlay${browse ? " is-browse" : ""}${watch ? " is-watch" : ""}${peeked ? " is-peek-hidden" : ""}`}
      role="presentation"
      onClick={peeked ? undefined : onClose}
    >
      <article
        className={`pp-card${tradeReveal ? " is-trade-reveal" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-profile-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="pp-head">
          <div className="pp-head-main">
            {isFund ? (
              <FundLogo name={player.name} size={36} className="pp-fund-logo" />
            ) : (
              <span className={`pp-token token-${player.token}`} aria-hidden />
            )}
            <div className="pp-head-copy">
              <p className="pp-kicker">{kicker}</p>
              <h2 id="player-profile-title" className="pp-name">
                {player.name}
              </h2>
              {status ? <p className="pp-status">{status}</p> : null}
              {fundMeta?.blurb ? (
                <p className="pp-status" style={{ opacity: 0.75 }}>
                  {fundMeta.blurb}
                </p>
              ) : null}
            </div>
          </div>
          <button type="button" className="pp-close" onClick={onClose}>
            {t("common.close")}
          </button>
        </header>

        <div className="pp-scroll">
          <section
            className="pp-panel pp-summary"
            aria-label={t("portfolio.balance")}
          >
            <div className="pp-block">
              <p className="pp-block-label">{t("portfolio.balance")}</p>
              <div className="pp-stat-row is-balance">
                <div className="pp-stat">
                  <span>{t("portfolio.cash")}</span>
                  <strong>{money(player.cash)}</strong>
                </div>
                <div className="pp-stat">
                  <span>{t("portfolio.assets")}</span>
                  <strong>{money(assets)}</strong>
                </div>
                <div className="pp-stat is-accent">
                  <span>{t("portfolio.netWorth")}</span>
                  <strong>{money(worth)}</strong>
                </div>
              </div>
            </div>
            <div className="pp-block">
              <p className="pp-block-label">{t("portfolio.operations")}</p>
              <div className="pp-stat-row is-ops">
                <div className="pp-stat">
                  <span>{t("portfolio.estRev")}</span>
                  <strong>{money(estRev)}</strong>
                </div>
                <div className="pp-stat">
                  <span>{t("portfolio.estCosts")}</span>
                  <strong>{money(estCost)}</strong>
                </div>
              </div>
            </div>
          </section>

          <section className="pp-panel" aria-label={t("portfolio.companies")}>
            <div className="pp-panel-head">
              <h3>{t("portfolio.companies")}</h3>
              <p>
                {companies.length === 0
                  ? t("portfolio.noShares")
                  : t("portfolio.companySummary", {
                      value: money(companyValue),
                      count: companyShares,
                    })}
              </p>
            </div>

            {/* Pie + color legend only — no long company rows. */}
            <div className={`pp-pie-block${tradeReveal ? " is-reveal" : ""}`}>
              <HoldingsPie
                slices={companySlices}
                size={118}
                emptyLabel={t("portfolio.none")}
                className={tradeReveal ? "is-pie-spin" : ""}
              />
              {companies.length > 0 ? (
                <ul className="pp-legend">
                  {companies.map((h) => {
                    const pct =
                      companyValue > 0
                        ? Math.round((h.value / companyValue) * 100)
                        : 0;
                    const band =
                      h.group !== "none" ? GROUP_COLORS[h.group] : "#5a6b5e";
                    return (
                      <li key={h.tileIndex}>
                        <span
                          className="pp-swatch"
                          style={{ background: band }}
                          aria-hidden
                        />
                        <span className="pp-legend-meta">
                          <strong>{h.ticker}</strong>
                          <em>
                            {t("portfolio.legendShares", {
                              shares: h.shares,
                              pct,
                            })}
                          </em>
                        </span>
                        <span className="pp-legend-val">{money(h.value)}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="pp-empty">{t("portfolio.noCompanyShares")}</p>
              )}
            </div>
          </section>

          <section className="pp-panel" aria-label={t("portfolio.etfs")}>
            <div className="pp-panel-head">
              <h3>{t("portfolio.etfs")}</h3>
              <p>
                {etfs.length === 0
                  ? t("portfolio.noUnits")
                  : t("portfolio.etfSummary", {
                      value: money(etfValue),
                      count: etfUnits,
                    })}
              </p>
            </div>

            {etfs.length === 0 ? (
              <p className="pp-empty">{t("portfolio.noEtfUnits")}</p>
            ) : (
              <ul className="pp-legend">
                {etfs.map((h) => (
                  <li key={h.tileIndex}>
                    <span
                      className="pp-swatch"
                      style={{
                        background:
                          h.group !== "none"
                            ? GROUP_COLORS[h.group]
                            : "#2f4f4f",
                      }}
                      aria-hidden
                    />
                    <span className="pp-legend-meta">
                      <strong>{h.ticker}</strong>
                      <em>
                        {t("portfolio.etfLine", {
                          ticker: h.ticker,
                          shares: h.shares,
                          price: money(h.price),
                        })}
                      </em>
                    </span>
                    <span className="pp-legend-val">{money(h.value)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </article>
    </div>,
    document.body,
  );
}
