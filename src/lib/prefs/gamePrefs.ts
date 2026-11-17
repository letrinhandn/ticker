export type FxSpeed = "normal" | "fast" | "blitz";

export type GamePrefs = {
  fxSpeed: FxSpeed;
  reduceMotion: boolean;
  /** Master SFX mute. */
  sfxMuted: boolean;
  /** Master SFX volume 0–1. */
  sfxVolume: number;
};

export const DEFAULT_GAME_PREFS: GamePrefs = {
  fxSpeed: "normal",
  reduceMotion: false,
  sfxMuted: false,
  sfxVolume: 0.72,
};

/** v2: reset mute so SFX stays on by default for everyone. */
const STORAGE_KEY = "marketpoly.gamePrefs.v2";
/** Legacy keys from early SFX wiring. */
const LEGACY_MUTE_KEY = "plotparty.sfxMuted";
const LEGACY_VOL_KEY = "plotparty.sfxVolume";
const LEGACY_PREFS_KEY = "marketpoly.gamePrefs";

const FX_SPEED_SCALE: Record<FxSpeed, number> = {
  normal: 1,
  fast: 0.62,
  blitz: 0.38,
};

let liveScale = 1;

/** Single fixed pace — settings no longer expose speed / reduce-motion. */
export function prefsFxScale(): number {
  return FX_SPEED_SCALE.normal;
}

/** Module live scale — timers call fxMs() without React. */
export function setLiveFxScale(scale: number) {
  liveScale = Math.max(0.15, Math.min(1.25, scale));
  if (typeof document !== "undefined") {
    document.documentElement.style.setProperty(
      "--fx-scale",
      String(liveScale),
    );
    document.documentElement.dataset.fxSpeed = String(liveScale);
    document.documentElement.dataset.reduceMotion = liveScale <= 0.25
      ? "1"
      : "0";
  }
}

export function fxMs(ms: number): number {
  return Math.max(48, Math.round(ms * liveScale));
}

function clampVolume(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function readLegacySfx(): { muted?: boolean; volume?: number } {
  if (typeof window === "undefined") return {};
  const out: { muted?: boolean; volume?: number } = {};
  try {
    const m = window.localStorage.getItem(LEGACY_MUTE_KEY);
    if (m === "1" || m === "0") out.muted = m === "1";
    const vol = Number(window.localStorage.getItem(LEGACY_VOL_KEY));
    if (Number.isFinite(vol)) out.volume = clampVolume(vol);
  } catch {
    /* ignore */
  }
  return out;
}

export function loadGamePrefs(): GamePrefs {
  if (typeof window === "undefined") return { ...DEFAULT_GAME_PREFS };
  const legacy = readLegacySfx();
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ??
      localStorage.getItem(LEGACY_PREFS_KEY);
    if (!raw) {
      // Fresh install: SFX on. Ignore legacy mute flags that often defaulted off.
      return {
        ...DEFAULT_GAME_PREFS,
        sfxVolume: legacy.volume ?? DEFAULT_GAME_PREFS.sfxVolume,
        sfxMuted: false,
      };
    }
    const parsed = JSON.parse(raw) as Partial<GamePrefs>;
    const sfxVolume =
      typeof parsed.sfxVolume === "number" && Number.isFinite(parsed.sfxVolume)
        ? clampVolume(parsed.sfxVolume)
        : (legacy.volume ?? DEFAULT_GAME_PREFS.sfxVolume);
    // v2 migrate from old prefs: always start unmuted once.
    const fromV1 = !localStorage.getItem(STORAGE_KEY);
    const sfxMuted = fromV1
      ? false
      : typeof parsed.sfxMuted === "boolean"
        ? parsed.sfxMuted
        : false;
    return {
      fxSpeed: "normal",
      reduceMotion: false,
      sfxMuted,
      sfxVolume,
    };
  } catch {
    return { ...DEFAULT_GAME_PREFS };
  }
}

export function saveGamePrefs(prefs: GamePrefs) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  setLiveFxScale(prefsFxScale());
  // Keep legacy keys in sync for any leftover readers.
  try {
    localStorage.setItem(LEGACY_MUTE_KEY, prefs.sfxMuted ? "1" : "0");
    localStorage.setItem(LEGACY_VOL_KEY, String(clampVolume(prefs.sfxVolume)));
  } catch {
    /* ignore */
  }
}
