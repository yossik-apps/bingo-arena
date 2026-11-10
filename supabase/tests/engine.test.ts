import test from "node:test";
import assert from "node:assert/strict";
import { makeBoard, scoreTaps, validateTaps, status, ghostTarget, applyMods, botTaps, multiplier, LINES, type Params, type Tap } from "../functions/_shared/engine.ts";

const P: Params = { every: 3000, win: 3, pt: 1, pen: 8, hint: false, xm: 1, fee: 10, gl: 150, gr: 100 };

test("same seed gives the same board and call order", () => {
  assert.deepEqual(makeBoard(42), makeBoard(42));
  assert.notDeepEqual(makeBoard(42).seq, makeBoard(43).seq);
  const { card, seq } = makeBoard(7);
  assert.equal(card[12], 0);
  assert.equal(new Set(seq).size, 75);
  assert.ok(card.every((v, i) => i === 12 || (v >= 1 && v <= 75)));
});

test("perfect play scores and a bad tap is penalised", () => {
  const seed = 99, { card, seq } = makeBoard(seed);
  const taps: Tap[] = [];
  seq.slice(0, 20).forEach((n, k) => { const i = card.indexOf(n); if (i >= 0 && i !== 12) taps.push({ i, t: k * P.every + 800 }); });
  const r = scoreTaps(seed, P, taps);
  assert.equal(r.wrong + r.late, 0);
  assert.equal(r.daubs, taps.length);
  assert.ok(r.score >= taps.length * 10);
  const missed = card.findIndex((v, i) => v && !taps.some((t) => t.i === i));
  const bad = scoreTaps(seed, P, [...taps, { i: missed, t: 100 }].sort((a, b) => a.t - b.t));
  assert.ok(bad.wrong + bad.late >= 1);
});

test("a number expires after the window", () => {
  const { seq } = makeBoard(5);
  assert.equal(status(seq, seq[0], 0, P), "live");
  assert.equal(status(seq, seq[0], 3 * P.every, P), "late");
  assert.equal(status(seq, seq[10], 0, P), "notYet");
});

test("cheat attempts are rejected", () => {
  assert.equal(validateTaps([{ i: 1, t: 100 }, { i: 2, t: 120 }], 100000).ok, false); // superhuman speed
  assert.equal(validateTaps([{ i: 99, t: 100 }], 100000).ok, false);
  assert.equal(validateTaps([{ i: 1, t: 999999 }], 100000).ok, false);
  assert.equal(validateTaps(Array.from({ length: 500 }, (_, k) => ({ i: 1, t: k * 200 })), 1e6).ok, false);
  assert.equal(validateTaps([{ i: 1, t: 100 }, { i: 2, t: 900 }], 100000).ok, true);
});

test("ghost target is deterministic and within range", () => {
  const g = ghostTarget(123, P);
  assert.equal(g, ghostTarget(123, P));
  assert.ok(g >= 150 && g < 250);
  assert.equal(LINES.length, 12);
});

test("stage modifiers change the rules and never the normal scoring", () => {
  const seed = 31, base = { ...P, total: 100 };
  const taps = botTaps(seed, P, 800, 100000);
  const normal = scoreTaps(seed, P, taps).score;
  assert.equal(scoreTaps(seed, applyMods(base, {}), taps).score, normal, "no modifiers = identical score");
  const frenzy = applyMods(base, { line_mul: 2 });
  assert.ok(scoreTaps(seed, frenzy, taps).score >= normal, "Line Frenzy never pays less");
  assert.equal(applyMods(base, { every_mul: 0.5 }).every, 1500);
  assert.equal(applyMods(base, { win_add: -9 }).win, 1, "window never drops below 1");
  assert.equal(applyMods(base, { total_add: 20 }).total, 120);
  assert.equal(multiplier(4), 2); assert.equal(multiplier(40), 3); assert.equal(multiplier(4, 2, 4), 3); assert.equal(multiplier(99, 2, 4), 4);
});

test("the reference player can always reach a decent score", () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const r = scoreTaps(seed, P, botTaps(seed, P, 800, 100000));
    assert.equal(r.wrong + r.late, 0);
    assert.ok(r.score > 60);
  }
});

test("Bingo DNA: longest streak and missed numbers are counted", async () => {
  const { missedCount, DRILLS } = await import("../functions/_shared/engine.ts");
  const seed = 99, { card, seq } = makeBoard(seed);
  const taps: Tap[] = [];
  seq.slice(0, 20).forEach((n, k) => { const i = card.indexOf(n); if (i >= 0 && i !== 12) taps.push({ i, t: k * P.every + 800 }); });
  const all = scoreTaps(seed, P, taps);
  assert.equal(all.maxStreak, taps.length, "every good tap in a row builds the streak");
  assert.equal(missedCount(seed, P, all.marked, (19 + P.win) * P.every), 0, "nothing missed when every called number was tapped");
  // skip every other tap: the streak still counts, but the skipped numbers are missed
  const half = taps.filter((_, k) => k % 2 === 0);
  const r = scoreTaps(seed, P, half);
  assert.ok(r.maxStreak >= 1 && r.maxStreak <= half.length);
  assert.equal(missedCount(seed, P, r.marked, (19 + P.win) * P.every), taps.length - half.length);
  assert.equal(missedCount(seed, P, scoreTaps(seed, P, []).marked, 0), 0, "no numbers gone at the start");
  assert.deepEqual(Object.keys(DRILLS).sort(), ["accuracy", "awareness", "combo", "lines", "pressure", "speed"]);
  for (const d of Object.values(DRILLS)) assert.equal(d.mods.total_add, -40, `${d.name} lasts 60 seconds`);
});

test("board heatmap counts hits, wrong, late and missed per square", async () => {
  const { boardHeat } = await import("../functions/_shared/engine.ts");
  const seed = 99, { card, seq } = makeBoard(seed), total = 100000;
  const first = seq.findIndex((n) => card.includes(n) && card.indexOf(n) !== 12);
  const i = card.indexOf(seq[first]);
  const notCalledYet = card.findIndex((v, k) => k !== 12 && seq.indexOf(v) > 30);
  const taps: Tap[] = [{ i: notCalledYet, t: 100 }, { i, t: first * P.every + 700 }, { i, t: first * P.every + 900 }];
  const h = boardHeat(seed, P, taps, total);
  assert.deepEqual(h.cells[i].slice(0, 2), [1, 0], "a correct daub");
  assert.equal(h.cells[i][4], 700, "reaction time from the call");
  assert.equal(h.cells[notCalledYet][1], 1, "a tap before the number was called is wrong");
  assert.equal(h.slices.reduce((a, s) => a + s[0], 0), 3, "every tap lands in a tenth of the round");
  const missed = h.cells.reduce((a, c) => a + c[3], 0);
  const r = scoreTaps(seed, P, taps);
  assert.ok(missed > 0 && h.cells[12].every((x) => x === 0), "untapped numbers are missed; the free space never counts");
  assert.equal(r.score, scoreTaps(seed, P, taps).score, "the score is unchanged");
});
