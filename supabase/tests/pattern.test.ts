import test from "node:test";
import assert from "node:assert/strict";
import { computePattern, scoreBand, toGame } from "../../web/src/lib/pattern.ts";
import type { DnaRound } from "../../web/src/lib/dna.ts";

const NOW = Date.parse("2026-10-17T12:00:00Z");
let n = 0;
const g = (mode: string, acc: number, extra: Record<string, unknown> = {}, level = "medium"): DnaRound => ({
  mode, level, finished_at: new Date(NOW - (n++) * 3600e3).toISOString(), params: { every: 3000, total: 100 },
  result: { score: 200, accuracy: acc, avgReactionMs: 1200, daubs: 15, ...extra } as DnaRound["result"],
});

test("a pattern needs 3 scored games and uses the newest 10", () => {
  n = 0;
  assert.equal(computePattern([g("solo", 0.9), g("solo", 0.9)]), null);
  n = 0;
  const p = computePattern(Array.from({ length: 14 }, () => g("solo", 0.9)))!;
  assert.equal(p.games.length, 10);
  assert.equal(p.games[0].modeName, "Practice");
  assert.ok(p.insights.length >= 1 && p.insights.length <= 4);
});

test("spots improvement, pressure against people and contest results", () => {
  n = 0;
  // newest first: recent games are more accurate; live matches are weaker; ghosts are mostly won
  const rounds = [g("ghost", 0.95, { win: true }), g("ghost", 0.94, { win: true }), g("pvp", 0.7), g("ghost", 0.93, { win: true }), g("pvp", 0.72),
    g("solo", 0.74), g("solo", 0.74), g("ghost", 0.75, { win: false }), g("solo", 0.74), g("solo", 0.74)];
  const p = computePattern(rounds)!;
  const titles = p.insights.map((i) => i.title).join(" | ");
  assert.match(titles, /sharper/);
  assert.match(titles, /Pressure shows against people/);
  assert.match(titles, /3 wins out of 4/);
  assert.equal(p.headline, "On the way up");
  assert.equal(p.wins, 3); assert.equal(p.contests, 4);
});

test("results are labelled per mode, and score bands explain the DNA score", () => {
  n = 0;
  assert.equal(toGame(g("solo", 0.9, { win: true }))!.result, "best");
  assert.equal(toGame(g("ghost", 0.9, { win: false }))!.result, "loss");
  assert.equal(toGame(g("pvp", 0.9, { win: true }))!.result, null, "live match results are settled later");
  assert.equal(toGame({ ...g("solo", 0.9), result: { accuracy: 0.9 } }), null, "rounds without a score are skipped");
  assert.equal(scoreBand(85).name, "Expert"); assert.equal(scoreBand(66).name, "Strong"); assert.equal(scoreBand(40).name, "Getting there"); assert.equal(scoreBand(3).name, "Learning");
});

test("beginners with high accuracy are nudged to Medium, all-practice players to the ghost", () => {
  n = 0;
  const p = computePattern(Array.from({ length: 6 }, () => g("solo", 0.93, {}, "beginner")))!;
  const titles = p.insights.map((i) => i.title).join(" | ");
  assert.match(titles, /Ready for Medium/);
  assert.match(titles, /All Practice/);
});
