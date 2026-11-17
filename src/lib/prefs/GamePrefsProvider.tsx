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
  DEFAULT_GAME_PREFS,
  loadGamePrefs,
  prefsFxScale,
  saveGamePrefs,
  setLiveFxScale,
  type FxSpeed,
  type GamePrefs,
} from "./gamePrefs";
import { applySfxPrefs } from "@/lib/sfx/sounds";

type GamePrefsContextValue = {
  prefs: GamePrefs;
  /** Kept for API compatibility — speed is locked to normal. */
  setFxSpeed: (speed: FxSpeed) => void;
  setReduceMotion: (on: boolean) => void;
  setSfxMuted: (muted: boolean) => void;
  setSfxVolume: (volume: number) => void;
  fxScale: number;
};

const GamePrefsContext = createContext<GamePrefsContextValue | null>(null);

function pushSfx(prefs: GamePrefs) {
  applySfxPrefs({ sfxMuted: prefs.sfxMuted, sfxVolume: prefs.sfxVolume });
}

function withLockedPace(prefs: GamePrefs): GamePrefs {
  return { ...prefs, fxSpeed: "normal", reduceMotion: false };
}

export function GamePrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<GamePrefs>(DEFAULT_GAME_PREFS);

  useEffect(() => {
    const loaded = withLockedPace(loadGamePrefs());
    setPrefs(loaded);
    setLiveFxScale(prefsFxScale(loaded));
    pushSfx(loaded);
    // Persist v2 prefs so SFX-on migration sticks after first load.
    saveGamePrefs(loaded);
  }, []);

  const commit = useCallback((next: GamePrefs) => {
    const locked = withLockedPace(next);
    setPrefs(locked);
    saveGamePrefs(locked);
    pushSfx(locked);
  }, []);

  const setFxSpeed = useCallback((_fxSpeed: FxSpeed) => {
    /* speed locked — ignore */
  }, []);

  const setReduceMotion = useCallback((_on: boolean) => {
    /* reduce-motion locked off — ignore */
  }, []);

  const setSfxMuted = useCallback(
    (sfxMuted: boolean) => {
      commit({ ...prefs, sfxMuted });
    },
    [commit, prefs],
  );

  const setSfxVolume = useCallback(
    (sfxVolume: number) => {
      commit({
        ...prefs,
        sfxVolume: Math.max(0, Math.min(1, sfxVolume)),
        sfxMuted: false,
      });
    },
    [commit, prefs],
  );

  const value = useMemo<GamePrefsContextValue>(
    () => ({
      prefs,
      setFxSpeed,
      setReduceMotion,
      setSfxMuted,
      setSfxVolume,
      fxScale: prefsFxScale(prefs),
    }),
    [prefs, setFxSpeed, setReduceMotion, setSfxMuted, setSfxVolume],
  );

  return (
    <GamePrefsContext.Provider value={value}>
      {children}
    </GamePrefsContext.Provider>
  );
}

export function useGamePrefs(): GamePrefsContextValue {
  const ctx = useContext(GamePrefsContext);
  if (!ctx) {
    return {
      prefs: DEFAULT_GAME_PREFS,
      setFxSpeed: () => undefined,
      setReduceMotion: () => undefined,
      setSfxMuted: () => undefined,
      setSfxVolume: () => undefined,
      fxScale: 1,
    };
  }
  return ctx;
}
