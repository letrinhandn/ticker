/**
 * Lightweight SFX bus — soft Kenney / casino CC0 assets.
 * See /public/sfx/ATTRIBUTION.txt
 */

export type SfxId =
  | "diceShake"
  | "diceThrow"
  | "diceRoll"
  | "land"
  | "cardDraw"
  | "cardFlip"
  | "cardShuffle"
  | "cashIn"
  | "cashOut"
  | "cashToneUp"
  | "cashToneDown"
  | "stampWhoosh"
  | "stampHit"
  | "trade"
  | "pegUp"
  | "pegDown"
  | "turn"
  | "click"
  | "error"
  | "win"
  | "bankrupt"
  | "open";

/** Organic casino only — cards / dice / chips. No digital UI chirps. */
const SFX_FILES: Record<SfxId, string[]> = {
  diceShake: [
    "/sfx/dice-shake-1.ogg",
    "/sfx/dice-shake-2.ogg",
    "/sfx/dice-shake-3.ogg",
  ],
  diceThrow: [
    "/sfx/dice-throw-1.ogg",
    "/sfx/dice-throw-2.ogg",
    "/sfx/dice-throw-3.ogg",
    "/sfx/die-throw-1.ogg",
    "/sfx/die-throw-2.ogg",
  ],
  /** Extra shake layer under the roll (not a synth hit). */
  diceRoll: ["/sfx/dice-shake-2.ogg", "/sfx/dice-shake-3.ogg"],
  /** Token lands on a tile — same family as deed flip. */
  land: [
    "/sfx/card-place-2.ogg",
    "/sfx/card-place-3.ogg",
    "/sfx/card-place-4.ogg",
    "/sfx/card-shove-1.ogg",
  ],
  cardDraw: [
    "/sfx/card-slide-1.ogg",
    "/sfx/card-slide-2.ogg",
    "/sfx/card-slide-3.ogg",
    "/sfx/card-slide-4.ogg",
  ],
  cardFlip: [
    "/sfx/card-place-1.ogg",
    "/sfx/card-place-2.ogg",
    "/sfx/card-shove-1.ogg",
  ],
  /** Only the real 2-pile shuffle clip — never fan/slide substitutes. */
  cardShuffle: ["/sfx/card-shuffle.ogg"],
  /** One warmed bill-counter clip (Freesound CC0) — shared for +/-. */
  cashIn: ["/sfx/cash/bill-counter.mp3"],
  cashOut: ["/sfx/cash/bill-counter.mp3"],
  /** API compat — muted / unused. */
  cashToneUp: ["/sfx/cash/bill-counter.mp3"],
  cashToneDown: ["/sfx/cash/bill-counter.mp3"],
  /** Gavel / rubber-stamp arc before ink hits the ticket. */
  stampWhoosh: [
    "/sfx/stamp/swish-2.mp3",
    "/sfx/stamp/swish-5.mp3",
    "/sfx/stamp/swish-12.mp3",
  ],
  /** Ink stamp on ticket — soft paper/wood only (no heavy door thud). */
  stampHit: [
    "/sfx/stamp/thud-card.ogg",
    "/sfx/stamp/thud-die.ogg",
    "/sfx/stamp/thud-shove.ogg",
  ],
  trade: ["/sfx/cash/bill-counter.mp3"],
  pegUp: [
    "/sfx/card-slide-2.ogg",
    "/sfx/card-slide-5.ogg",
    "/sfx/card-place-2.ogg",
  ],
  pegDown: [
    "/sfx/card-slide-3.ogg",
    "/sfx/card-place-3.ogg",
    "/sfx/card-shove-1.ogg",
  ],
  turn: [
    "/sfx/card-place-1.ogg",
    "/sfx/card-place-4.ogg",
    "/sfx/chip-lay-2.ogg",
  ],
  click: [
    "/sfx/chip-lay-1.ogg",
    "/sfx/chip-lay-2.ogg",
    "/sfx/card-place-1.ogg",
  ],
  error: ["/sfx/chips-collide-3.ogg", "/sfx/card-shove-1.ogg"],
  win: [
    "/sfx/chips-stack-1.ogg",
    "/sfx/card-place-1.ogg",
    "/sfx/card-fan-1.ogg",
  ],
  bankrupt: ["/sfx/card-shove-1.ogg", "/sfx/chips-handle-5.ogg"],
  open: ["/sfx/card-slide-5.ogg", "/sfx/card-place-2.ogg"],
};

/** Per-cue mix — keep UI quiet; dice a bit more present. */
const SFX_GAIN: Partial<Record<SfxId, number>> = {
  diceShake: 0.55,
  diceThrow: 0.72,
  diceRoll: 0.4,
  land: 0.62,
  cardDraw: 0.4,
  cardFlip: 0.38,
  cardShuffle: 0.42,
  cashIn: 0.38,
  cashOut: 0.34,
  cashToneUp: 0,
  cashToneDown: 0,
  stampWhoosh: 0.3,
  stampHit: 0.58,
  trade: 0.36,
  pegUp: 0.3,
  pegDown: 0.28,
  turn: 0.26,
  click: 0.24,
  error: 0.32,
  win: 0.4,
  bankrupt: 0.36,
  open: 0.32,
};

/** Live mix — GamePrefsProvider pushes here; fallbacks match DEFAULT_GAME_PREFS. */
let liveMuted = false;
let liveVolume = 0.72;
let unlocked = false;
const pools = new Map<string, HTMLAudioElement[]>();

/** Sync mute/volume from prefs (or HUD) into the audio bus. */
export function applySfxPrefs(prefs: { sfxMuted: boolean; sfxVolume: number }) {
  liveMuted = Boolean(prefs.sfxMuted);
  liveVolume = Math.max(0, Math.min(1, prefs.sfxVolume));
}

function isMuted(): boolean {
  return liveMuted;
}

function masterVolume(): number {
  return liveVolume;
}

export function setSfxMuted(muted: boolean) {
  liveMuted = muted;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("plotparty.sfxMuted", muted ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function getSfxMuted(): boolean {
  return isMuted();
}

export function setSfxVolume(v: number) {
  liveVolume = Math.max(0, Math.min(1, v));
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("plotparty.sfxVolume", String(liveVolume));
  } catch {
    /* ignore */
  }
}

export function getSfxVolume(): number {
  return masterVolume();
}

/** Call from a user gesture so autoplay policies allow later plays. */
export function unlockSfx() {
  if (unlocked) return;
  unlocked = true;
  try {
    const a = new Audio("/sfx/chip-lay-1.ogg");
    a.volume = 0.01;
    void a.play().catch(() => {});
  } catch {
    /* ignore */
  }
}

function pickSrc(id: SfxId): string {
  const list = SFX_FILES[id];
  if (!list?.length) return "";
  return list[Math.floor(Math.random() * list.length)]!;
}

function acquire(src: string): HTMLAudioElement {
  const pool = pools.get(src) ?? [];
  pools.set(src, pool);
  const idle = pool.find((a) => a.paused || a.ended);
  if (idle) return idle;
  const audio = new Audio(src);
  audio.preload = "auto";
  pool.push(audio);
  return audio;
}

export function playSfx(
  id: SfxId,
  opts?: { volume?: number; playbackRate?: number },
): void {
  if (typeof window === "undefined") return;
  if (!unlocked && id !== "click") return;
  if (isMuted()) return;
  const src = pickSrc(id);
  if (!src) return;
  try {
    const audio = acquire(src);
    const gain = SFX_GAIN[id] ?? 0.4;
    audio.volume = Math.max(
      0,
      Math.min(1, (opts?.volume ?? 1) * gain * masterVolume()),
    );
    // Slight rate jitter softens repetition without sounding broken.
    const base = opts?.playbackRate ?? 1;
    audio.playbackRate = base * (0.97 + Math.random() * 0.06);
    audio.currentTime = 0;
    void audio.play().catch(() => {});
  } catch {
    /* ignore */
  }
}

/** Shake → throw dice sequence (used on roll). */
export function playDiceRoll(): void {
  playSfx("diceShake", { volume: 1 });
  window.setTimeout(() => playSfx("diceThrow", { volume: 1 }), 280);
  // Soft underlay of a continuous roll (doesn't replace throw).
  window.setTimeout(() => playSfx("diceRoll", { volume: 0.7 }), 40);
}

/** Settle ticket stamp: soft whoosh then paper thud (no counter / door). */
export function playStamp(opts?: { volume?: number }): void {
  const vol = opts?.volume ?? 1;
  playSfx("stampWhoosh", { volume: vol * 0.7, playbackRate: 0.98 });
  window.setTimeout(() => {
    playSfx("stampHit", { volume: vol * 0.95, playbackRate: 0.88 });
  }, 120);
}

/**
 * Money +/- — single warm bill-counter clip (quieter; spend slightly slower).
 */
export function playCashDelta(
  delta: number,
  opts?: { amount?: number; volume?: number },
): void {
  if (delta === 0) return;
  const gain = delta > 0;
  const abs = Math.abs(opts?.amount ?? delta);
  const size = Math.max(0.65, Math.min(1.0, 0.55 + Math.log10(abs + 10) * 0.22));
  const vol = (opts?.volume ?? 1) * size;
  playSfx(gain ? "cashIn" : "cashOut", {
    volume: vol,
    playbackRate: gain ? 0.98 : 0.92,
  });
}
