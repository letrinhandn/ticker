"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  BOT_FUNDS,
  FUND_KIND_ORDER,
  botFundByName,
  type FundKind,
} from "@/lib/game/bots/botRoster";
import { useT } from "@/lib/i18n";
import { FundLogo } from "./FundLogo";
import { fundKindLabelKey, fundKindShortKey } from "./FundSelectOptions";

/**
 * Custom fund picker with logos (native <select> cannot show images).
 */
export function FundPicker({
  value,
  onChange,
  disabledNames = [],
  ariaLabel,
  id,
}: {
  value: string;
  onChange: (name: string) => void;
  disabledNames?: string[];
  ariaLabel?: string;
  id?: string;
}) {
  const t = useT();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const blocked = new Set(disabledNames.map((n) => n.toLowerCase()));
  const selected = botFundByName(value) ?? BOT_FUNDS[0];
  const selectedName = selected?.name ?? value;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={`fund-picker${open ? " is-open" : ""}`} ref={rootRef}>
      <button
        id={id}
        type="button"
        className="fund-picker-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel ?? t("lobby.pickFund")}
        onClick={() => setOpen((v) => !v)}
      >
        <FundLogo name={selectedName} size={26} />
        <span className="fund-picker-trigger-copy">
          <span className="fund-picker-trigger-name">{selectedName}</span>
          {selected ? (
            <span className="fund-picker-trigger-kind">
              {t(fundKindShortKey(selected.kind))}
            </span>
          ) : null}
        </span>
        <span className="fund-picker-caret" aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <div
          id={listId}
          className="fund-picker-menu"
          role="listbox"
          aria-label={ariaLabel ?? t("lobby.pickFund")}
        >
          {FUND_KIND_ORDER.map((kind: FundKind) => {
            const funds = BOT_FUNDS.filter((f) => f.kind === kind);
            if (funds.length === 0) return null;
            return (
              <div key={kind} className="fund-picker-group">
                <p className="fund-picker-group-label">{t(fundKindLabelKey(kind))}</p>
                {funds.map((f) => {
                  const disabled = blocked.has(f.name.toLowerCase());
                  const active = f.name === selectedName;
                  return (
                    <button
                      key={f.name}
                      type="button"
                      role="option"
                      aria-selected={active}
                      disabled={disabled}
                      className={`fund-picker-option${active ? " is-active" : ""}`}
                      title={f.blurb}
                      onClick={() => {
                        if (disabled) return;
                        onChange(f.name);
                        setOpen(false);
                      }}
                    >
                      <FundLogo name={f.name} size={24} />
                      <span className="fund-picker-option-copy">
                        <span className="fund-picker-option-name">{f.name}</span>
                        <span className="fund-picker-option-blurb">{f.blurb}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
