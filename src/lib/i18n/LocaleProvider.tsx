"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  formatMessage,
  LOCALES,
  LOCALE_LABEL,
  MESSAGES,
  type Locale,
  type MessageKey,
} from "./messages";

const STORAGE_KEY = "marketpoly.locale";

type TFn = (
  key: MessageKey,
  vars?: Record<string, string | number>,
) => string;

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TFn;
  locales: Locale[];
  label: (locale: Locale) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readStoredLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === "en" || raw === "vi") return raw;
  const nav = window.navigator.language.toLowerCase();
  if (nav.startsWith("vi")) return "vi";
  return "en";
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  // Always start from "en" so SSR and the first client paint match.
  const [locale, setLocaleState] = useState<Locale>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const next = readStoredLocale();
    document.documentElement.lang = next;
    queueMicrotask(() => {
      setLocaleState(next);
      setReady(true);
    });
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next;
  }, []);

  const t = useCallback<TFn>(
    (key, vars) => {
      const table = MESSAGES[locale] ?? MESSAGES.en;
      const template = table[key] ?? MESSAGES.en[key] ?? key;
      return formatMessage(template, vars);
    },
    [locale],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      locales: LOCALES,
      label: (l) => LOCALE_LABEL[l],
    }),
    [locale, setLocale, t],
  );

  // Avoid flashing wrong language before hydration read
  if (!ready) {
    return (
      <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
    );
  }

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return ctx;
}

export function useT() {
  return useLocale().t;
}
