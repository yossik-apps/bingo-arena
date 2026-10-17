// Bingo DNA: six skills from 0 to 100, worked out from a player's last rounds.
// Pure functions (no React, no database) so they can be tested and used for guests too.

export type Skill = "speed" | "accuracy" | "awareness" | "combo" | "lines" | "pressure";
export const SKILLS: Skill[] = ["speed", "accuracy", "awareness", "combo", "lines", "pressure"];

export const SKILL_INFO: Record<Skill, { name: string; what: string; tip: string }> = {
  speed: { name: "Speed", what: "How fast you tap a number after it is called.", tip: "Look at the column letter first, then find the number in that column only." },
  accuracy: { name: "Accuracy", what: "How few wrong taps you make.", tip: "Take half a second to check the letter and the number before you tap." },
  awareness: { name: "Awareness", what: "How few of your numbers slip away untapped.", tip: "Glance at the whole 'On the board' strip each time a new ball drops." },
  combo: { name: "Combo", what: "How long your runs of correct taps are.", tip: "A wrong tap resets your combo, so only tap when you are sure." },
  lines: { name: "Lines", what: "How often you complete rows, columns and diagonals.", tip: "Tap your numbers quickly so lines fill before they slip away." },
  pressure: { name: "Pressure", what: "How well you hold up on Hard and fast rounds.", tip: "On fast rounds, stay calm and aim for clean taps rather than every number." },
};

export const STYLES: Record<Skill, { name: string; text: string }> = {
  speed: { name: "Speedster", text: "You hit numbers the moment they land." },
  accuracy: { name: "Sniper", text: "You rarely miss. Every tap counts." },
  awareness: { name: "Watcher", text: "Almost nothing slips past you." },
  combo: { name: "Combo Machine", text: "You build long runs of correct taps." },
  lines: { name: "Line Hunter", text: "You complete lines like nobody else." },
  pressure: { name: "Ice Cool", text: "The faster it gets, the calmer you play." },
};

/** One finished round as read from the database (rounds.result and rounds.params). */
export type DnaRound = {
  mode: string; level: string; finished_at: string;
  params: { every?: number; total?: number } | null;
  result: { accuracy?: number; avgReactionMs?: number | null; daubs?: number; missed?: number; maxStreak?: number; maxMult?: number; lines?: number } | null;
};

export type Dna = {
  skills: Record<Skill, number | null>; // null = not enough data yet for that skill
  rounds: number;
  weakest: Skill | null;
  strongest: Skill | null;
  style: { key: Skill; name: string; text: string } | null;
  overall: number;
  trend: number | null; // change in overall score against a week ago (null if we cannot tell)
};

export const MIN_ROUNDS = 3;
const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function skillsOf(rounds: DnaRound[]): Record<Skill, number | null> {
  const speed: number[] = [], acc: number[] = [], aware: number[] = [], combo: number[] = [], lines: number[] = [], press: number[] = [];
  for (const r of rounds) {
    const s = r.result;
    if (!s) continue;
    if (typeof s.avgReactionMs === "number") speed.push(clamp(100 - (s.avgReactionMs - 500) / 25));
    const a = typeof s.accuracy === "number" ? clamp(s.accuracy * 100) : null;
    if (a !== null) acc.push(a);
    let aw: number | null = null;
    if (typeof s.missed === "number" && typeof s.daubs === "number" && s.daubs + s.missed > 0) aw = clamp((s.daubs / (s.daubs + s.missed)) * 100);
    if (aw !== null) aware.push(aw);
    if (typeof s.maxStreak === "number") combo.push(clamp((s.maxStreak / 12) * 100));
    else if (typeof s.maxMult === "number") combo.push(clamp(((s.maxMult - 1) / 3) * 100));
    if (typeof s.lines === "number") lines.push(clamp(s.lines * 34 * (100 / (r.params?.total || 100))));
    const fast = r.level === "hard" || (r.params?.every ?? 99999) <= 2300;
    if (fast && a !== null) press.push(aw !== null ? (a + aw) / 2 : a);
  }
  const out = (xs: number[]) => { const v = avg(xs); return v === null ? null : clamp(v); };
  return { speed: out(speed), accuracy: out(acc), awareness: out(aware), combo: out(combo), lines: out(lines), pressure: out(press) };
}

const overallOf = (s: Record<Skill, number | null>) => {
  const v = SKILLS.map((k) => s[k]).filter((x): x is number => x !== null);
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0;
};

/** Works out the Bingo DNA from rounds (any order). Uses the newest 20; needs at least 3. */
export function computeDna(all: DnaRound[], now = Date.now()): Dna | null {
  const sorted = all.filter((r) => r.result).sort((a, b) => b.finished_at.localeCompare(a.finished_at));
  const recent = sorted.slice(0, 20);
  if (recent.length < MIN_ROUNDS) return null;
  const skills = skillsOf(recent);
  const known = SKILLS.filter((k) => skills[k] !== null);
  const weakest = known.length ? known.reduce((w, k) => ((skills[k] as number) < (skills[w] as number) ? k : w)) : null;
  const strongest = known.length ? known.reduce((w, k) => ((skills[k] as number) > (skills[w] as number) ? k : w)) : null;
  const weekAgo = now - 7 * 864e5;
  const older = sorted.filter((r) => Date.parse(r.finished_at) < weekAgo).slice(0, 20);
  const overall = overallOf(skills);
  const trend = older.length >= MIN_ROUNDS ? overall - overallOf(skillsOf(older)) : null;
  return { skills, rounds: recent.length, weakest, strongest, style: strongest ? { key: strongest, ...STYLES[strongest] } : null, overall, trend };
}

/** The Bingo DNA for a single round (used for a guest's first round, shown blurred). */
export function singleRoundDna(r: DnaRound): Dna {
  const skills = skillsOf([r]);
  const known = SKILLS.filter((k) => skills[k] !== null);
  const strongest = known.length ? known.reduce((w, k) => ((skills[k] as number) > (skills[w] as number) ? k : w)) : null;
  const weakest = known.length ? known.reduce((w, k) => ((skills[k] as number) < (skills[w] as number) ? k : w)) : null;
  return { skills, rounds: 1, weakest, strongest, style: strongest ? { key: strongest, ...STYLES[strongest] } : null, overall: overallOf(skills), trend: null };
}

/** The drill that trains a skill (same names as the server's DRILLS list). */
export const DRILL_NAMES: Record<Skill, string> = {
  speed: "Fast Calls", accuracy: "Steady Hands", awareness: "Tight Window", combo: "Combo Rush", lines: "Line Frenzy", pressure: "Pressure Cooker",
};

/** Today's drill: aimed at the weakest skill; before there is a DNA, a speed drill. */
export const todaysDrill = (dna: Dna | null): Skill => dna?.weakest ?? "speed";

/** True if the player already did a drill today (UTC, the same day the server uses for the coin reward). */
export const drilledToday = (rounds: DnaRound[], now = Date.now()) => {
  const day = new Date(now).toISOString().slice(0, 10);
  return rounds.some((r) => r.mode === "drill" && r.finished_at.slice(0, 10) === day);
};
