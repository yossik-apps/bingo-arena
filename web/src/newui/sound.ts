// Sound and vibration, made with the browser's own audio (no sound files).
// The settings stay on this device. Nothing plays until the player has touched the screen once.
const KEY = "ba_sound_v1";
type Prefs = { sound: boolean; haptics: boolean; volume: number; voice: boolean; voiceName: string };
const DEFAULTS: Prefs = { sound: true, haptics: true, volume: 0.7, voice: true, voiceName: "" };
let prefs: Prefs = (() => {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { return { ...DEFAULTS }; }
})();

export const fx = {
  get sound() { return prefs.sound; },
  get haptics() { return prefs.haptics; },
  /** 0 to 1. The master switch `sound` is separate, so un-muting brings back the same level. */
  get volume() { return prefs.volume; },
  /** read the called number out loud ("B, twelve") */
  get voice() { return prefs.voice; },
  /** the chosen speech voice, or "" for the best one the device has */
  get voiceName() { return prefs.voiceName; },
  /** true when nothing will be heard */
  get muted() { return !prefs.sound || prefs.volume <= 0.01; },
  set(p: Partial<Prefs>) {
    prefs = { ...prefs, ...p };
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* private mode */ }
    if (!prefs.sound || !prefs.voice) stopSpeech();
    listeners.forEach((f) => f());
  },
  /** called after every change, so a screen can redraw its sound icon */
  subscribe(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; },
};
const listeners = new Set<() => void>();

let ctx: AudioContext | null = null;
const audio = (): AudioContext | null => {
  if (!prefs.sound || prefs.volume <= 0.01) return null;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = ctx ?? new AC();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch { return null; }
};

/** [frequency Hz, start s, length s] */
type Note = [number, number, number];
const TUNES: Record<string, { notes: Note[]; type: OscillatorType; gain: number }> = {
  good: { notes: [[660, 0, 0.07], [880, 0.06, 0.09]], type: "sine", gain: 0.12 },
  wrong: { notes: [[180, 0, 0.14]], type: "square", gain: 0.06 },
  drop: { notes: [[420, 0, 0.05]], type: "triangle", gain: 0.05 },
  line: { notes: [[523, 0, 0.09], [659, 0.08, 0.09], [784, 0.16, 0.09], [1047, 0.24, 0.18]], type: "triangle", gain: 0.14 },
  level: { notes: [[523, 0, 0.12], [659, 0.1, 0.12], [784, 0.2, 0.12], [1047, 0.3, 0.12], [1319, 0.42, 0.3]], type: "triangle", gain: 0.15 },
  claim: { notes: [[784, 0, 0.08], [1047, 0.07, 0.16]], type: "sine", gain: 0.12 },
};

export function sfx(kind: keyof typeof TUNES) {
  const a = audio();
  const tune = TUNES[kind];
  if (!a || !tune) return;
  const t0 = a.currentTime;
  for (const [f, at, len] of tune.notes) {
    const o = a.createOscillator(), g = a.createGain();
    o.type = tune.type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t0 + at);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, tune.gain * (prefs.volume / 0.7)), t0 + at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len);
    o.connect(g); g.connect(a.destination);
    o.start(t0 + at); o.stop(t0 + at + len + 0.02);
  }
}

export function buzz(pattern: number | number[]) {
  if (!prefs.haptics) return;
  try { navigator.vibrate?.(pattern); } catch { /* not supported */ }
}

// ---- the caller's voice ----
// 1. If a recording exists (web/public/calls/B12.mp3 ...), play it. This is the most human option.
// 2. Otherwise use the browser's own speech, with the most natural voice the device has.
let clipsMissing = false;
let player: HTMLAudioElement | null = null;

/** American English voices on this device, best first. If the device has none, any English voice is used instead. */
export function voiceList(): SpeechSynthesisVoice[] {
  try {
    const all = window.speechSynthesis.getVoices();
    const us = all.filter((v) => /^en[-_]US/i.test(v.lang));
    return (us.length ? us : all.filter((v) => /^en/i.test(v.lang))).sort((a, b) => score(b) - score(a));
  } catch { return []; }
}
/** How natural a voice usually sounds. Neural and "Natural" voices (Edge, Windows 11), Siri and enhanced Apple voices, and Google network voices beat the old built-in ones. */
const score = (v: SpeechSynthesisVoice) => {
  const n = v.name;
  let s = 0;
  if (/natural/i.test(n)) s += 100;
  if (/neural/i.test(n)) s += 90;
  if (/online/i.test(n)) s += 60;
  if (/siri|premium|enhanced/i.test(n)) s += 70;
  if (/google/i.test(n)) s += 40;
  if (/samantha|ava|allison|aria|jenny|ana|emma|michelle|guy|andrew|brian|evelyn/i.test(n)) s += 25;
  if (/^en[-_]US/i.test(v.lang)) s += 10;
  if (!v.localService) s += 5;
  if (/compact|espeak|desktop|david|mark|fred|albert|bad|whisper|zarvox|trinoids|bells|organ|bubbles|cellos|jester|boing/i.test(n)) s -= 80;
  return s;
};
const pickVoice = (): SpeechSynthesisVoice | null => {
  const all = voiceList();
  if (!all.length) return null; // the list loads late on some browsers; try again next call
  return (prefs.voiceName && all.find((v) => v.name === prefs.voiceName)) || all[0];
};
try { window.speechSynthesis?.addEventListener?.("voiceschanged", () => listeners.forEach((f) => f())); } catch { /* not supported */ }

const PACE: Record<string, number> = { chill: 0.92, normal: 1, fast: 1.12 };

function say(text: string, speed: string) {
  try {
    const ss = window.speechSynthesis;
    if (!ss) return;
    ss.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = PACE[speed] ?? 1;
    u.pitch = 1;
    u.volume = Math.min(1, prefs.volume);
    const v = pickVoice();
    if (v) { u.voice = v; u.lang = v.lang; }
    ss.speak(u);
  } catch { /* speech not supported */ }
}

/** Say a called number, for example speak("B", 12) says "B, twelve". A new call cuts off the old one. */
export function speak(letter: string, n: number, speed = "chill") {
  if (!prefs.sound || !prefs.voice || prefs.volume <= 0.01) return;
  const text = `${letter}, ${n}`;
  if (!clipsMissing) {
    try {
      try { window.speechSynthesis?.cancel(); } catch { /* not supported */ }
      player?.pause();
      const a = new Audio(`/calls/${letter}${n}.mp3`);
      a.volume = Math.min(1, prefs.volume);
      a.onerror = () => { clipsMissing = true; say(text, speed); }; // no recordings on this site: use speech from now on
      player = a;
      void a.play().catch(() => { if (!clipsMissing) { clipsMissing = true; say(text, speed); } });
      return;
    } catch { clipsMissing = true; }
  }
  say(text, speed);
}

/** Say the sample line so the player can judge a voice. */
export function sampleVoice() { say("B, twelve", "normal"); }

export function stopSpeech() {
  try { player?.pause(); window.speechSynthesis?.cancel(); } catch { /* not supported */ }
}
