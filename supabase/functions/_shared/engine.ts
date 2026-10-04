// Shared game engine. Pure TypeScript: runs in the browser (web) and in Supabase Edge Functions (Deno).
// The SERVER re-runs this to decide the real score. Never trust a score sent by a client.

export type Params = {
  every: number; // ms between called numbers
  win: number;   // how many recent numbers can still be daubed
  pt: number;    // score multiplier
  pen: number;   // wrong-tap penalty
  hint: boolean; // highlight matching squares
  xm: number;    // XP multiplier
  fee: number;   // entry fee in coins
  gl: number;    // ghost base score
  gr: number;    // ghost random range
  // Optional stage modifiers (Journey). Missing = normal rules, so older rounds score exactly as before.
  lineMul?: number;   // multiplies the line bonus
  comboStep?: number; // correct daubs per combo level (default 4)
  maxMult?: number;   // highest combo multiplier (default 3)
};
export type Tap = { i: number; t: number }; // cell index 0..24, ms since round start
export type Board = { card: number[]; seq: number[] };
export type ScoreResult = {
  score: number; daubs: number; wrong: number; late: number;
  lines: number; maxMult: number; accuracy: number; avgReactionMs: number | null;
  marked: boolean[];
};

export function mulberry32(a: number): () => number {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle<T>(arr: T[], r: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const LINES: number[][] = (() => {
  const l: number[][] = [];
  for (let i = 0; i < 5; i++) {
    l.push([0, 1, 2, 3, 4].map((c) => i * 5 + c), [0, 1, 2, 3, 4].map((r) => r * 5 + i));
  }
  l.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);
  return l;
})();

/** One 5x5 card (index 12 is the free space = 0) and the 75-number call order, both from the seed. */
export function makeBoard(seed: number): Board {
  const r = mulberry32(seed);
  const card = Array(25).fill(0);
  for (let c = 0; c < 5; c++) {
    const col = shuffle(Array.from({ length: 15 }, (_, i) => c * 15 + i + 1), r).slice(0, 5);
    for (let row = 0; row < 5; row++) card[row * 5 + c] = col[row];
  }
  card[12] = 0;
  const seq = shuffle(Array.from({ length: 75 }, (_, i) => i + 1), r);
  return { card, seq };
}

export const currentIndex = (t: number, every: number, len = 75) =>
  Math.min(Math.max(0, Math.floor(t / every)), len - 1);

/** Where is this number relative to the board at time t: live (can daub), late (called, expired) or notYet. */
export function status(seq: number[], num: number, t: number, p: Pick<Params, "every" | "win">): "live" | "late" | "notYet" {
  const cur = currentIndex(t, p.every, seq.length);
  const idx = seq.indexOf(num);
  if (idx < 0 || idx > cur) return "notYet";
  return idx > cur - p.win ? "live" : "late";
}

export const multiplier = (streak: number, step = 4, max = 3) => Math.min(max, 1 + Math.floor(streak / step));

/** Replays taps against the deterministic board and returns the score. Used by client (preview) and server (truth). */
export function scoreTaps(seed: number, p: Params, taps: Tap[]): ScoreResult {
  const { card, seq } = makeBoard(seed);
  const marked = card.map((v) => v === 0);
  const done = new Set<number>();
  let score = 0, streak = 0, daubs = 0, wrong = 0, late = 0, maxMult = 1, rtSum = 0;
  for (const tap of taps) {
    const i = tap.i;
    if (marked[i]) continue;
    const num = card[i];
    const st = status(seq, num, tap.t, p);
    if (st === "live") {
      marked[i] = true; streak++; daubs++;
      const mult = multiplier(streak, p.comboStep ?? 4, p.maxMult ?? 3);
      maxMult = Math.max(maxMult, mult);
      score += Math.round(10 * mult * p.pt);
      rtSum += tap.t - seq.indexOf(num) * p.every;
      LINES.forEach((ln, k) => {
        if (!done.has(k) && ln.every((x) => marked[x])) { done.add(k); score += Math.round(50 * p.pt * (p.lineMul ?? 1)); }
      });
    } else {
      streak = 0; score = Math.max(0, score - p.pen);
      if (st === "late") late++; else wrong++;
    }
  }
  const tot = daubs + wrong + late;
  return {
    score, daubs, wrong, late, lines: done.size, maxMult,
    accuracy: tot ? daubs / tot : 0,
    avgReactionMs: daubs ? Math.round(rtSum / daubs) : null,
    marked,
  };
}

/** Anti-cheat checks on the raw tap list. */
export function validateTaps(taps: unknown, totalMs: number): { ok: true; taps: Tap[] } | { ok: false; reason: string } {
  if (!Array.isArray(taps)) return { ok: false, reason: "taps must be a list" };
  if (taps.length > 120) return { ok: false, reason: "too many taps" };
  const out: Tap[] = [];
  let prev = -1;
  for (const x of taps) {
    if (!x || typeof x !== "object") return { ok: false, reason: "bad tap" };
    const { i, t } = x as Tap;
    if (!Number.isInteger(i) || i < 0 || i > 24) return { ok: false, reason: "bad cell" };
    if (typeof t !== "number" || !Number.isFinite(t) || t < 0 || t > totalMs + 500) return { ok: false, reason: "bad time" };
    if (prev >= 0 && t - prev < 90) return { ok: false, reason: "taps faster than human speed" };
    if (t < prev) return { ok: false, reason: "taps out of order" };
    prev = t;
    out.push({ i, t: Math.round(t) });
  }
  return { ok: true, taps: out };
}

export const ghostTarget = (seed: number, p: Pick<Params, "gl" | "gr">) =>
  p.gl + Math.floor(mulberry32((seed ^ 0x9e3779b9) >>> 0)() * p.gr);

export const levelOf = (xp: number) => Math.floor(Math.sqrt(xp / 40)) + 1;
export const xpFor = (score: number, xm: number, modeMult: number, win: boolean) =>
  Math.round((15 + score / 8) * xm * modeMult) + (win ? 20 : 0);

/** Stage modifiers as stored in the database, applied to a level's normal rules. */
export type StageMods = { every_mul?: number; win_add?: number; pen_mul?: number; line_mul?: number; combo_step?: number; max_mult?: number; total_add?: number; label?: string };
export function applyMods(base: Params & { total: number }, m: StageMods): Params & { total: number } {
  return {
    ...base,
    every: Math.round(base.every * (m.every_mul ?? 1)),
    win: Math.max(1, base.win + (m.win_add ?? 0)),
    pen: Math.round(base.pen * (m.pen_mul ?? 1)),
    total: base.total + (m.total_add ?? 0),
    ...(m.line_mul ? { lineMul: m.line_mul } : {}),
    ...(m.combo_step ? { comboStep: m.combo_step } : {}),
    ...(m.max_mult ? { maxMult: m.max_mult } : {}),
  };
}

/** A tireless reference player. Used to check that a stage's star goals are reachable. */
export function botTaps(seed: number, p: Params, reactionMs: number, totalMs = 100000): Tap[] {
  const { card, seq } = makeBoard(seed);
  const taps: Tap[] = [];
  let last = -1000;
  seq.forEach((n, k) => {
    const i = card.indexOf(n);
    if (i < 0 || i === 12) return;
    const t = Math.max(k * p.every + reactionMs, last + 100);
    if (t > totalMs) return; // the round is over
    taps.push({ i, t }); last = t;
  });
  return taps;
}
