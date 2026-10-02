import test from "node:test";
import assert from "node:assert/strict";
import { makeBoard, scoreTaps, validateTaps, status, ghostTarget, LINES, type Params, type Tap } from "../functions/_shared/engine.ts";

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
