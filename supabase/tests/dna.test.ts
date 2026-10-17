import test from "node:test";
import assert from "node:assert/strict";
import { computeDna, singleRoundDna, drilledToday, todaysDrill, SKILLS, type DnaRound } from "../../web/src/lib/dna.ts";

const NOW = Date.parse("2026-10-16T12:00:00Z");
const round = (daysAgo: number, r: Partial<NonNullable<DnaRound["result"]>> = {}, level = "medium", mode = "solo"): DnaRound => ({
  mode, level, finished_at: new Date(NOW - daysAgo * 864e5).toISOString(), params: { every: 3000, total: 100 },
  result: { accuracy: 0.9, avgReactionMs: 1000, daubs: 18, missed: 2, maxStreak: 6, maxMult: 3, lines: 1, ...r },
});

test("Bingo DNA needs at least 3 rounds", () => {
  assert.equal(computeDna([round(0), round(0)], NOW), null);
  assert.ok(computeDna([round(0), round(0), round(0)], NOW));
});

test("Bingo DNA scores each skill from 0 to 100 and finds the weakest", () => {
  const d = computeDna([round(0, { accuracy: 0.5 }), round(0, { accuracy: 0.5 }), round(1, { accuracy: 0.5 })], NOW)!;
  assert.equal(d.skills.speed, 80);
  assert.equal(d.skills.accuracy, 50);
  assert.equal(d.skills.awareness, 90);
  assert.equal(d.skills.combo, 50);
  assert.equal(d.skills.lines, 34);
  assert.equal(d.skills.pressure, null, "no hard or fast rounds yet");
  assert.equal(d.weakest, "lines");
  assert.equal(d.style?.name, "Watcher");
  for (const k of SKILLS) { const v = d.skills[k]; assert.ok(v === null || (v >= 0 && v <= 100)); }
  assert.equal(todaysDrill(d), "lines");
  assert.equal(todaysDrill(null), "speed");
});

test("older rounds without the new fields still work, and the trend compares with last week", () => {
  const old = [round(10, { missed: undefined, maxStreak: undefined, avgReactionMs: 2000 }), round(11, { missed: undefined, maxStreak: undefined, avgReactionMs: 2000 }), round(12, { missed: undefined, maxStreak: undefined, avgReactionMs: 2000 })];
  const d0 = computeDna(old, NOW)!;
  assert.equal(d0.skills.awareness, null);
  assert.equal(d0.skills.combo, 67, "falls back to the best combo multiplier");
  const d = computeDna([...old, round(0, {}, "hard"), round(0, {}, "hard"), round(1, {}, "hard")], NOW)!;
  assert.ok(d.skills.pressure !== null && d.skills.pressure > 80);
  assert.ok(d.trend !== null && d.trend > 0, "faster than last week");
  assert.equal(computeDna([round(0), round(0), round(0)], NOW)!.trend, null);
});

test("a single round gives a preview DNA, and today's drill is detected", () => {
  assert.ok(singleRoundDna(round(0)).style);
  assert.equal(drilledToday([round(0, {}, "medium", "drill")], NOW), true);
  assert.equal(drilledToday([round(1, {}, "medium", "drill"), round(0)], NOW), false);
});
