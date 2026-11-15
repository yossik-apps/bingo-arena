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
  // Balance v2 (reports/balance-spec.md). All absent = version 1 = exactly the rules rounds had before. Set only by buildRound.
  cv?: 2;             // marker: this round plays by version 2 (score may go below zero, XP uses xpDiv)
  calls?: number;     // chance that the next call is a number on the card (absent = the original call order)
  bonus?: number;     // B of the graded speed bonus: round(B x pt) within 1.0 s of the call, round(B x pt / 2) within 2.0 s
  share?: number;     // level config only: the ghost's share of a perfect round on the same board
  xpDiv?: number;     // level config only: version 2 scores are higher, so XP divides the score by this
};
export type Tap = { i: number; t: number }; // cell index 0..24, ms since round start
export type Board = { card: number[]; seq: number[] };
export type ScoreResult = {
  score: number; daubs: number; wrong: number; late: number;
  lines: number; maxMult: number; maxStreak: number; accuracy: number; avgReactionMs: number | null;
  bonus: number; fast1: number; fast2: number; // speed bonus points, correct taps within 1.0 s and within 1.0-2.0 s (0 in version 1)
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

/** One 5x5 card (index 12 is the free space = 0) and the 75-number call order, both from the seed.
 *  `calls` (version 2 only): the card is the same, but each call is a number on the card with that chance. */
export function makeBoard(seed: number, calls?: number): Board {
  const r = mulberry32(seed);
  const card = Array(25).fill(0);
  for (let c = 0; c < 5; c++) {
    const col = shuffle(Array.from({ length: 15 }, (_, i) => c * 15 + i + 1), r).slice(0, 5);
    for (let row = 0; row < 5; row++) card[row * 5 + c] = col[row];
  }
  card[12] = 0;
  const seq = shuffle(Array.from({ length: 75 }, (_, i) => i + 1), r);
  if (calls === undefined) return { card, seq };
  // Version 2: the order of the random draws below is part of the rules. Do not change it.
  const q = mulberry32((seed ^ 0x5bd1e995) >>> 0);
  const onCard = card.filter((v) => v > 0);
  const on = shuffle(onCard, q);
  const off = shuffle(Array.from({ length: 75 }, (_, i) => i + 1).filter((n) => !onCard.includes(n)), q);
  const biased: number[] = [];
  while (on.length || off.length) biased.push(on.length && (!off.length || q() < calls) ? on.pop()! : off.pop()!);
  return { card, seq: biased };
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
  const { card, seq } = makeBoard(seed, p.calls);
  const marked = card.map((v) => v === 0);
  const done = new Set<number>();
  let score = 0, streak = 0, daubs = 0, wrong = 0, late = 0, maxMult = 1, rtSum = 0, maxStreak = 0, bonus = 0, fast1 = 0, fast2 = 0;
  for (const tap of taps) {
    const i = tap.i;
    if (marked[i]) continue;
    const num = card[i];
    const st = status(seq, num, tap.t, p);
    if (st === "live") {
      marked[i] = true; streak++; daubs++; maxStreak = Math.max(maxStreak, streak);
      const mult = multiplier(streak, p.comboStep ?? 4, p.maxMult ?? 3);
      maxMult = Math.max(maxMult, mult);
      score += Math.round(10 * mult * p.pt);
      const delay = tap.t - seq.indexOf(num) * p.every; // ms after the number was called
      rtSum += delay;
      if (p.bonus) { // graded speed bonus: not multiplied by the combo, never negative
        const b = delay <= 1000 ? Math.round(p.bonus * p.pt) : delay <= 2000 ? Math.round((p.bonus * p.pt) / 2) : 0;
        if (b > 0) { score += b; bonus += b; if (delay <= 1000) fast1++; else fast2++; }
      }
      LINES.forEach((ln, k) => {
        if (!done.has(k) && ln.every((x) => marked[x])) { done.add(k); score += Math.round(50 * p.pt * (p.lineMul ?? 1)); }
      });
    } else {
      streak = 0; score = p.cv === 2 ? score - p.pen : Math.max(0, score - p.pen); // version 2: wrong taps may take the score below zero
      if (st === "late") late++; else wrong++;
    }
  }
  const tot = daubs + wrong + late;
  return {
    score, daubs, wrong, late, lines: done.size, maxMult, maxStreak,
    accuracy: tot ? daubs / tot : 0,
    avgReactionMs: daubs ? Math.round(rtSum / daubs) : null,
    bonus, fast1, fast2,
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

/** The score of a flawless, fast reference player (700 ms) on this board. The version 2 ghost is a share of it. */
export const perfectScore = (seed: number, p: Params & { total: number }) => scoreTaps(seed, p, botTaps(seed, p, 700, p.total * 1000)).score;
/** Version 2 ghost: `share` of a perfect round on the same board, from the level's normal rules (no boosters, no modifiers). */
export const ghostFromShare = (seed: number, p: Params & { total: number }, share: number) => Math.round(share * perfectScore(seed, p));

export const levelOf = (xp: number) => Math.floor(Math.sqrt(xp / 40)) + 1;
/** XP of a round. `xpDiv` (version 2 only, default 1) brings the higher version 2 scores back to the version 1 scale; a negative score earns no XP from the score. */
export const xpFor = (score: number, xm: number, modeMult: number, win: boolean, xpDiv = 1) =>
  Math.round((15 + Math.max(0, score) / xpDiv / 8) * xm * modeMult) + (win ? 20 : 0);

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
  const { card, seq } = makeBoard(seed, p.calls);
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

/** Daily Challenge rotation (UTC day of week, Sunday first) and rule twists. */
export const DAILY_LEVELS = ["beginner", "medium", "medium", "hard", "medium", "medium", "hard"];
export const DAILY_MODS: StageMods[] = [
  {}, { line_mul: 2, label: "Line Frenzy" }, { combo_step: 2, max_mult: 4, label: "Combo Rush" }, { every_mul: 0.85, label: "Blitz" },
  { win_add: -1, label: "Tight Window" }, { total_add: 20, label: "Marathon" }, { pen_mul: 2, label: "Steady Hands" },
];

/** Numbers that were on the card, were called, and left the board without being tapped. Used for the Awareness skill. */
export function missedCount(seed: number, p: Pick<Params, "every" | "win" | "calls">, marked: boolean[], totalMs: number): number {
  const { card, seq } = makeBoard(seed, p.calls);
  const lastGone = currentIndex(totalMs, p.every, seq.length) - p.win; // index of the newest number that has already left the board
  let n = 0;
  for (let k = 0; k <= lastGone; k++) {
    const i = card.indexOf(seq[k]);
    if (i >= 0 && i !== 12 && !marked[i]) n++;
  }
  return n;
}

/** 60-second drills, one per Bingo DNA skill. A drill uses a normal level with a rule twist that trains that skill. */
export type Skill = "speed" | "accuracy" | "awareness" | "combo" | "lines" | "pressure";
export const DRILLS: Record<Skill, { name: string; level: string; mods: StageMods; why: string }> = {
  speed: { name: "Fast Calls", level: "medium", mods: { every_mul: 0.75, total_add: -40, label: "Fast Calls" }, why: "Numbers come quicker, so you learn to scan and tap sooner." },
  accuracy: { name: "Steady Hands", level: "medium", mods: { pen_mul: 2, total_add: -40, label: "Steady Hands" }, why: "Wrong taps cost double, so you learn to check before you tap." },
  awareness: { name: "Tight Window", level: "medium", mods: { win_add: -1, total_add: -40, label: "Tight Window" }, why: "Numbers leave the board sooner, so you learn to keep your eyes on the card." },
  combo: { name: "Combo Rush", level: "medium", mods: { combo_step: 2, max_mult: 4, total_add: -40, label: "Combo Rush" }, why: "Combos build twice as fast, so long correct streaks pay off big." },
  lines: { name: "Line Frenzy", level: "medium", mods: { line_mul: 2, total_add: -40, label: "Line Frenzy" }, why: "Lines are worth double, so you learn to finish rows and columns." },
  pressure: { name: "Pressure Cooker", level: "hard", mods: { every_mul: 0.9, total_add: -40, label: "Pressure Cooker" }, why: "Hard pace and even faster calls, so you learn to stay calm when it is busy." },
};

/** Heatmap data for one finished round (admin analytics only; never changes the score).
 *  cells[i] = [hits, wrong, late, missed, reactionMsSum, reactionCount] for board position i (12 is the free space).
 *  slices[s] = [taps, hits, errors] for each tenth of the round. */
export type BoardHeat = { cells: number[][]; slices: number[][] };
export function boardHeat(seed: number, p: Params, taps: Tap[], totalMs: number): BoardHeat {
  const { card, seq } = makeBoard(seed, p.calls);
  const cells = Array.from({ length: 25 }, () => [0, 0, 0, 0, 0, 0]);
  const slices = Array.from({ length: 10 }, () => [0, 0, 0]);
  const marked = card.map((v) => v === 0);
  const slice = (t: number) => Math.min(9, Math.max(0, Math.floor((t / Math.max(1, totalMs)) * 10)));
  for (const tap of taps) {
    const s = slices[slice(tap.t)];
    s[0]++;
    if (marked[tap.i]) continue; // a second tap on a daubed square changes nothing
    const st = status(seq, card[tap.i], tap.t, p);
    const c = cells[tap.i];
    if (st === "live") {
      marked[tap.i] = true; c[0]++; s[1]++;
      c[4] += Math.max(0, tap.t - seq.indexOf(card[tap.i]) * p.every); c[5]++;
    } else { if (st === "late") c[2]++; else c[1]++; s[2]++; }
  }
  // called, gone from the board, never daubed
  const lastGone = currentIndex(totalMs, p.every, seq.length) - p.win;
  for (let k = 0; k <= lastGone; k++) {
    const i = card.indexOf(seq[k]);
    if (i >= 0 && i !== 12 && !marked[i]) cells[i][3]++;
  }
  return { cells, slices };
}
