"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BOARD } from "@/lib/game/board";
import { useGameFxOptional } from "@/lib/fx/GameFxContext";
import { FX_TIMING } from "@/lib/fx/types";
import { fxMs } from "@/lib/prefs/gamePrefs";
import { useT, type MessageKey } from "@/lib/i18n";
import { money } from "@/lib/money";
import type { CashTransfer } from "@/shared/types";
import { CompanyLogo } from "@/components/cards/CompanyLogo";
import { DeedCard } from "@/components/cards/DeedCard";
import {
  seatIndexForPlayer,
  SettleCashFlies,
  type SettleCashFly,
} from "./SettleCashFlies";
import { playSfx, playStamp } from "@/lib/sfx/sounds";

export type CashSettleKind = "buy" | "sell" | "pay" | "receive";

export type CashSettleTicket = {
  kind: CashSettleKind;
  title: string;
  subtitle?: string;
  /** Absolute cash magnitude. */
  amount: number;
  tileIndex?: number;
  shares?: number;
  unitPrice?: number;
  fee?: number;
  transfers?: CashTransfer[];
};

type Phase =
  | "windup"
  | "clamp"
  | "strike"
  | "flying"
  | "hold"
  | "parked"
  | "done";

type PayLine = {
  label: string;
  value: string;
  tone?: "out" | "in" | "muted";
};

type TFn = (key: MessageKey, vars?: Record<string, string | number>) => string;

function kindStamp(kind: CashSettleKind, t: TFn) {
  if (kind === "buy") return t("settle.hammerBuy");
  if (kind === "sell") return t("settle.hammerSell");
  if (kind === "pay") return t("settle.hammerPay");
  return t("settle.hammerReceive");
}

function SettleStamp({
  kind,
  struck,
  t,
  className = "",
}: {
  kind: CashSettleKind;
  struck: boolean;
  t: TFn;
  className?: string;
}) {
  return (
    <span
      className={`settle-ticket-stamp is-${kind}${struck ? " is-on" : ""}${
        className ? ` ${className}` : ""
      }`}
      aria-hidden
    >
      <span className="settle-ticket-stamp-mark" />
      <span className="settle-ticket-stamp-text">{kindStamp(kind, t)}</span>
      <span className="settle-ticket-stamp-mark" />
    </span>
  );
}

function kindLabel(kind: CashSettleKind, t: TFn) {
  if (kind === "buy") return t("trade.buy");
  if (kind === "sell") return t("trade.sell");
  if (kind === "pay") return t("settle.kindPay");
  return t("settle.kindReceive");
}

function partyLine(
  kind: CashSettleKind,
  actorName: string | undefined,
  counterpartyName: string | undefined,
  hasTransfers: boolean,
  t: TFn,
) {
  if (!actorName || hasTransfers) return null;
  const isTrade = kind === "buy" || kind === "sell";
  const other =
    counterpartyName ??
    (isTrade ? t("settle.counterpartyMarket") : t("settle.counterpartyBank"));
  if (kind === "buy") {
    return t("settle.partyBuy", { actor: actorName, counterparty: other });
  }
  if (kind === "sell") {
    return t("settle.partySell", { actor: actorName, counterparty: other });
  }
  if (kind === "pay") {
    return t("settle.partyPay", { actor: actorName, counterparty: other });
  }
  return t("settle.partyReceive", { actor: actorName, counterparty: other });
}

function buildLines(ticket: CashSettleTicket, t: TFn): PayLine[] {
  const isTrade = ticket.kind === "buy" || ticket.kind === "sell";
  const lines: PayLine[] = [];
  if (isTrade) {
    if (ticket.shares != null) {
      lines.push({ label: t("settle.lineShares"), value: String(ticket.shares) });
    }
    if (ticket.unitPrice != null) {
      lines.push({
        label: t("settle.linePrice"),
        value: money(ticket.unitPrice),
      });
    }
    if (ticket.fee != null && ticket.fee > 0) {
      lines.push({
        label: t("settle.lineFee"),
        value: money(ticket.fee),
        tone: "muted",
      });
    }
  } else if (ticket.transfers && ticket.transfers.length > 0) {
    const shareSum = ticket.transfers.reduce(
      (n, tr) => n + (tr.shares ?? 0),
      0,
    );
    if (shareSum > 0) {
      lines.push({ label: t("settle.lineShares"), value: String(shareSum) });
    }
  }
  return lines;
}

function SettleTicketCard({
  ticket,
  actorName,
  counterpartyName,
  struck,
  compact,
  hideStamp = false,
  t,
}: {
  ticket: CashSettleTicket;
  actorName?: string;
  counterpartyName?: string;
  struck: boolean;
  compact?: boolean;
  /** Clamp mode uses one bridge seal across both cards. */
  hideStamp?: boolean;
  t: TFn;
}) {
  const tile = ticket.tileIndex != null ? BOARD[ticket.tileIndex] : undefined;
  const moneyOut = ticket.kind === "buy" || ticket.kind === "pay";
  const signed = `${moneyOut ? "−" : "+"}${money(Math.abs(ticket.amount))}`;
  const logoAlt = ticket.subtitle ?? ticket.title;
  const party = partyLine(
    ticket.kind,
    actorName,
    counterpartyName,
    Boolean(ticket.transfers?.length),
    t,
  );
  const lines = buildLines(ticket, t);

  return (
    <article
      className={`settle-ticket is-${ticket.kind}${struck ? " is-struck" : ""}${
        compact ? " is-compact" : ""
      }`}
    >
      <header className="settle-ticket-head">
        {tile?.logo ? (
          <CompanyLogo
            src={tile.logo}
            alt={logoAlt}
            className="settle-ticket-logo"
          />
        ) : (
          <span className="settle-ticket-logo is-fallback">
            {(ticket.subtitle ?? ticket.title).slice(0, 2).toUpperCase()}
          </span>
        )}
        <div className="settle-ticket-id">
          {ticket.subtitle ? (
            <p className="settle-ticket-ticker">{ticket.subtitle}</p>
          ) : null}
          <p className="settle-ticket-name">{ticket.title}</p>
        </div>
        <span className={`settle-ticket-chip is-${ticket.kind}`}>
          {kindLabel(ticket.kind, t)}
        </span>
      </header>

      <div className="settle-ticket-body">
        {party ? <p className="settle-ticket-party">{party}</p> : null}

        {ticket.transfers && ticket.transfers.length > 0 ? (
          <div className="settle-ticket-transfers">
            {ticket.transfers.map((tr, i) => (
              <div
                className="settle-ticket-transfer"
                key={`${tr.fromId}-${tr.toId}-${i}`}
              >
                <p className="settle-ticket-transfer-who">
                  {t("settle.transferPaid", {
                    from: tr.fromName,
                    to: tr.toName,
                  })}
                </p>
                <p
                  className={`settle-ticket-transfer-amt${
                    moneyOut ? " is-out" : " is-in"
                  }`}
                >
                  {tr.shares != null
                    ? `${t("settle.transferShares", { shares: tr.shares })}  `
                    : null}
                  {money(tr.amount)}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {lines.length > 0 ? (
          <div className="settle-ticket-lines">
            {lines.map((line) => (
              <div className="settle-ticket-row" key={line.label}>
                <span className="settle-ticket-row-label">{line.label}</span>
                <span
                  className={`settle-ticket-row-value${
                    line.tone === "out"
                      ? " is-out"
                      : line.tone === "in"
                        ? " is-in"
                        : line.tone === "muted"
                          ? " is-muted"
                          : ""
                  }`}
                >
                  {line.value}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="settle-ticket-total">
          <span className="settle-ticket-total-label">
            {t("settle.lineTotal")}
          </span>
          <span
            className={`settle-ticket-total-value${
              moneyOut ? " is-out" : " is-in"
            }`}
          >
            {signed}
          </span>
        </div>
      </div>

      {!hideStamp ? (
        <SettleStamp kind={ticket.kind} struck={struck} t={t} />
      ) : null}
    </article>
  );
}

/**
 * Full-screen money beat (paper paycheck + gavel).
 * Buy/sell fills, visit fees, tax — who, fee, total in plain lines.
 * Pass `bundle` to stamp several tickets in one stack (START tax + rev).
 */
export function CashSettlePortal({
  kind,
  title,
  subtitle,
  amount,
  tileIndex,
  shares,
  unitPrice,
  fee,
  actorName,
  actorId,
  playerIds = [],
  counterpartyName,
  transfers,
  bundle,
  active,
  onDone,
  watch = false,
  peeked = false,
  onHide,
  /** User is reading another card — finish FX but wait to dismiss. */
  hold = false,
}: {
  kind: CashSettleKind;
  title: string;
  subtitle?: string;
  /** Absolute cash magnitude shown as the total. */
  amount: number;
  tileIndex?: number;
  shares?: number;
  unitPrice?: number;
  /** Order / settle fee (omit or 0 to hide). */
  fee?: number;
  /** Who initiated the cash move. */
  actorName?: string;
  /** Seat owner for cash-fly target. */
  actorId?: string;
  /** Table seat order (same as HUD corners). */
  playerIds?: string[];
  /** Market, bank, or named player. */
  counterpartyName?: string;
  /** Player↔player lines (visit fee: who paid whom). */
  transfers?: CashTransfer[];
  /** Extra tickets stacked under the first (START tax + rev). */
  bundle?: CashSettleTicket[];
  active: boolean;
  onDone: () => void;
  watch?: boolean;
  peeked?: boolean;
  onHide?: () => void;
  hold?: boolean;
}) {
  const t = useT();
  const fx = useGameFxOptional();
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>("windup");
  const [flyBatch, setFlyBatch] = useState<SettleCashFly[]>([]);
  const onDoneRef = useRef(onDone);
  const holdRef = useRef(hold);
  const absorbRef = useRef(fx?.absorbHeldCash);
  const runId = useRef(0);
  const flySeq = useRef(0);
  const cashLanded = useRef(false);

  onDoneRef.current = onDone;
  holdRef.current = hold;
  absorbRef.current = fx?.absorbHeldCash;

  const tickets: CashSettleTicket[] = useMemo(
    () =>
      bundle && bundle.length > 0
        ? bundle
        : [
            {
              kind,
              title,
              subtitle,
              amount,
              tileIndex,
              shares,
              unitPrice,
              fee,
              transfers,
            },
          ],
    [
      bundle,
      kind,
      title,
      subtitle,
      amount,
      tileIndex,
      shares,
      unitPrice,
      fee,
      transfers,
    ],
  );
  const stackKey = tickets
    .map((x) => `${x.title}:${x.amount}:${x.kind}`)
    .join("|");
  const playerIdsKey = playerIds.join("|");

  const buildFlies = (): SettleCashFly[] => {
    const next: SettleCashFly[] = [];
    const actorSeat = seatIndexForPlayer(actorId, playerIds);
    for (const ticket of tickets) {
      if (ticket.transfers && ticket.transfers.length > 0) {
        for (const tr of ticket.transfers) {
          if (tr.amount === 0) continue;
          next.push({
            id: `sf-${flySeq.current++}`,
            signed: tr.amount,
            playerId: tr.toId,
            seatIndex: seatIndexForPlayer(tr.toId, playerIds),
          });
          next.push({
            id: `sf-${flySeq.current++}`,
            signed: -tr.amount,
            playerId: tr.fromId,
            seatIndex: seatIndexForPlayer(tr.fromId, playerIds),
          });
        }
        continue;
      }
      const out = ticket.kind === "buy" || ticket.kind === "pay";
      const signed = out ? -Math.abs(ticket.amount) : Math.abs(ticket.amount);
      if (signed === 0) continue;
      // Always land on the acting player's cash figure.
      next.push({
        id: `sf-${flySeq.current++}`,
        signed,
        playerId: actorId,
        seatIndex: actorSeat,
      });
    }
    return next;
  };

  const finishAfterFly = () => {
    if (holdRef.current) {
      setPhase("parked");
      return;
    }
    setPhase("done");
    onDoneRef.current();
  };

  const onCashLanded = () => {
    if (cashLanded.current) return;
    cashLanded.current = true;
    const id = runId.current;
    absorbRef.current?.();
    setPhase("hold");
    window.setTimeout(() => {
      if (id !== runId.current) return;
      finishAfterFly();
    }, fxMs(FX_TIMING.settleAfterFlyMs));
  };

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!active) {
      setPhase("windup");
      setFlyBatch([]);
      cashLanded.current = false;
      return;
    }

    const id = ++runId.current;
    cashLanded.current = false;
    setPhase("windup");
    setFlyBatch([]);
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => {
      timers.push(window.setTimeout(fn, ms));
    };

    const useClamp =
      (kind === "sell" || kind === "buy") &&
      tileIndex != null &&
      !(bundle && bundle.length > 1);

    const startStrike = () => {
      if (id !== runId.current) return;
      setPhase("strike");
      playStamp({ volume: 1 });
      later(() => {
        if (id !== runId.current) return;
        // Let the stamped ticket breathe before cash motion / dismiss.
        later(() => {
          if (id !== runId.current) return;
          const nextFlies = buildFlies();
          if (nextFlies.length === 0) {
            absorbRef.current?.();
            setPhase("hold");
            later(() => {
              if (id !== runId.current) return;
              finishAfterFly();
            }, fxMs(FX_TIMING.settleAfterFlyMs));
            return;
          }
          setPhase("flying");
          setFlyBatch(nextFlies);
          later(() => {
            if (id !== runId.current) return;
            if (!cashLanded.current) onCashLanded();
          }, fxMs(FX_TIMING.settleCashFlyMs) + 180);
        }, fxMs(FX_TIMING.settleHoldMs));
      }, fxMs(FX_TIMING.settleStrikeMs));
    };

    later(() => {
      if (id !== runId.current) return;
      if (useClamp) {
        setPhase("clamp");
        // Jaws close on deed + ticket before the stamp.
        playSfx("cardFlip", { volume: 0.85, playbackRate: 0.9 });
        later(startStrike, fxMs(FX_TIMING.settleClampMs));
        return;
      }
      startStrike();
    }, fxMs(FX_TIMING.settleWindupMs));

    return () => {
      runId.current += 1;
      for (const timer of timers) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stackKey, actorId, playerIdsKey]);

  useEffect(() => {
    if (hold || phase !== "parked") return;
    setPhase("done");
    onDoneRef.current();
  }, [hold, phase]);

  if (!mounted || !active || phase === "done") return null;

  const struck =
    phase === "strike" ||
    phase === "flying" ||
    phase === "hold" ||
    phase === "parked";
  const clamped = phase === "clamp" || struck;
  const stacked = tickets.length > 1;
  const useClamp =
    (kind === "sell" || kind === "buy") &&
    tileIndex != null &&
    !stacked;
  const primary = tickets[0]!;

  const gavel = (
    <div className={`settle-gavel${useClamp ? " is-clamp" : ""}`} aria-hidden>
      <div className={`settle-gavel-arm${struck ? " is-hit" : " is-raise"}`}>
        <svg viewBox="0 0 120 100" width="100%" height="100%">
          <path
            d="M58 34 L92 78"
            fill="none"
            stroke="#c4a574"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M86 70 L96 86"
            fill="none"
            stroke="#8a6a3e"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <rect
            x="22"
            y="22"
            width="48"
            height="20"
            rx="4"
            fill="#2c2c2c"
            stroke="#111"
            strokeWidth="1.5"
            transform="rotate(-32 46 32)"
          />
          <rect
            x="34"
            y="25"
            width="9"
            height="14"
            rx="1.5"
            fill="#d4a24c"
            transform="rotate(-32 38.5 32)"
          />
        </svg>
      </div>
      {struck ? (
        <>
          <span className="settle-gavel-shock is-a" />
          <span className="settle-gavel-shock is-b" />
        </>
      ) : null}
    </div>
  );

  return createPortal(
    <div
      className={`settle-overlay${watch ? " is-watch" : ""}${peeked ? " is-peek-hidden" : ""}${
        phase === "flying" || phase === "hold" ? " is-cash-flying" : ""
      }`}
      aria-hidden={peeked || !watch || undefined}
      onClick={watch && !peeked ? () => onHide?.() : undefined}
    >
      <div
        className={`settle-stage${stacked ? " is-stack" : ""}${
          useClamp ? " is-clamp" : ""
        }`}
        onClick={watch ? (e) => e.stopPropagation() : undefined}
      >
        {useClamp ? (
          <div
            className={`settle-clamp is-${kind} is-${phase}${
              clamped ? " is-clamped" : ""
            }${struck ? " is-struck" : ""}`}
          >
            <div className="settle-clamp-pulse">
              <div className="settle-clamp-jaw is-deed">
                <div className="settle-clamp-deed">
                  <DeedCard tileIndex={tileIndex!} compact />
                </div>
              </div>
              <div className="settle-clamp-jaw is-ticket">
                <SettleTicketCard
                  ticket={primary}
                  actorName={actorName}
                  counterpartyName={counterpartyName}
                  struck={struck}
                  compact
                  hideStamp
                  t={t}
                />
              </div>
            </div>
            <SettleStamp
              kind={kind}
              struck={struck}
              t={t}
              className="is-bridge"
            />
            {gavel}
          </div>
        ) : (
          <div className="settle-strike-zone">
            <div className={stacked ? "settle-ticket-stack" : undefined}>
              {tickets.map((ticket) => (
                <SettleTicketCard
                  key={`${ticket.title}:${ticket.amount}:${ticket.kind}`}
                  ticket={ticket}
                  actorName={actorName}
                  counterpartyName={counterpartyName}
                  struck={struck}
                  compact={stacked}
                  t={t}
                />
              ))}
            </div>
            {gavel}
          </div>
        )}
      </div>

      <SettleCashFlies
        flies={flyBatch}
        active={phase === "flying" || phase === "hold" || phase === "parked"}
        onLanded={onCashLanded}
        // Tax/START/fee: stamp only. Buy/sell: real bill-counter (no ding).
        cashSfx={kind === "buy" || kind === "sell"}
      />
    </div>,
    document.body,
  );
}
