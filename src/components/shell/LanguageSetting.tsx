"use client";

import type { ComponentType } from "react";
import { useLocale, type Locale } from "@/lib/i18n";

function FlagEn({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden
    >
      <rect width="24" height="24" rx="4" fill="#b22234" />
      <path
        fill="#fff"
        d="M0 3.4h24v2.2H0zm0 4.4h24v2.2H0zm0 4.4h24v2.2H0zm0 4.4h24v2.2H0z"
      />
      <rect width="11" height="11" rx="0" fill="#3c3b6e" />
      <circle cx="2.2" cy="2.2" r="0.55" fill="#fff" />
      <circle cx="4.4" cy="2.2" r="0.55" fill="#fff" />
      <circle cx="6.6" cy="2.2" r="0.55" fill="#fff" />
      <circle cx="8.8" cy="2.2" r="0.55" fill="#fff" />
      <circle cx="3.3" cy="3.8" r="0.55" fill="#fff" />
      <circle cx="5.5" cy="3.8" r="0.55" fill="#fff" />
      <circle cx="7.7" cy="3.8" r="0.55" fill="#fff" />
      <circle cx="2.2" cy="5.4" r="0.55" fill="#fff" />
      <circle cx="4.4" cy="5.4" r="0.55" fill="#fff" />
      <circle cx="6.6" cy="5.4" r="0.55" fill="#fff" />
      <circle cx="8.8" cy="5.4" r="0.55" fill="#fff" />
      <circle cx="3.3" cy="7" r="0.55" fill="#fff" />
      <circle cx="5.5" cy="7" r="0.55" fill="#fff" />
      <circle cx="7.7" cy="7" r="0.55" fill="#fff" />
      <circle cx="2.2" cy="8.6" r="0.55" fill="#fff" />
      <circle cx="4.4" cy="8.6" r="0.55" fill="#fff" />
      <circle cx="6.6" cy="8.6" r="0.55" fill="#fff" />
      <circle cx="8.8" cy="8.6" r="0.55" fill="#fff" />
    </svg>
  );
}

function FlagVi({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden
    >
      <rect width="24" height="24" rx="4" fill="#da251d" />
      <path
        fill="#ff0"
        d="M12 5.2l1.45 4.46h4.69l-3.8 2.76 1.45 4.46L12 14.12l-3.79 2.76 1.45-4.46-3.8-2.76h4.69L12 5.2z"
      />
    </svg>
  );
}

const LANG_META: Record<
  Locale,
  { short: string; Flag: ComponentType<{ className?: string }> }
> = {
  en: { short: "EN", Flag: FlagEn },
  vi: { short: "VI", Flag: FlagVi },
};

export function LanguageSetting({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { locale, setLocale, locales, label, t } = useLocale();

  return (
    <div
      className={`lang-setting${compact ? " is-compact" : ""} ${className}`.trim()}
      role="group"
      aria-label={t("lang.label")}
    >
      {!compact ? (
        <span className="lang-setting-label">{t("lang.label")}</span>
      ) : null}
      <div className="lang-setting-toggle">
        {locales.map((code: Locale) => {
          const meta = LANG_META[code];
          const Flag = meta.Flag;
          return (
            <button
              key={code}
              type="button"
              className={`lang-setting-btn${locale === code ? " is-active" : ""}`}
              aria-pressed={locale === code}
              onClick={() => setLocale(code)}
            >
              <Flag className="lang-setting-flag" />
              <span className="lang-setting-btn-text">
                {compact ? meta.short : label(code)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
