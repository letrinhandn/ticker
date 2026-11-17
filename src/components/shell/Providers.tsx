"use client";

import type { ReactNode } from "react";
import { LocaleProvider } from "@/lib/i18n";
import { GamePrefsProvider } from "@/lib/prefs/GamePrefsProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <LocaleProvider>
      <GamePrefsProvider>{children}</GamePrefsProvider>
    </LocaleProvider>
  );
}
