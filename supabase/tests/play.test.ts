import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { makeBoard } from "../functions/_shared/engine.ts";
import { almostLines, combo, goodText, ignoresTap, leaveText, lineText, lookFor, missText, modeName, newLines, onBoard, roundLevel, scoreSub, showsLineHints, showsTip } from "../../web/src/newui/screens/Play.logic.ts";
import type { RoundStart } from "../../web/src/views/Play.tsx";
import type { ShopItem } from "../../web/src/lib/supabase.ts";

const params = (over: object = {}) => ({ every: 3000, win: 3, pt: 1.5, pen: 8, hint: false, xm: 1, fee: 20, gl: 0, gr: 0, total: 100, pay: 1.8, ghost: null, level: "medium", ...over }) as RoundStart["params"];
const round = (over: Partial<RoundStart> = {}, p: object = {}): RoundStart => ({ roundId: "r1", seed: 42, balance: 100, params: params(p), ...over });

test("the mode name follows Classic's order", () => {
  assert.equal(modeName(round({ local: true }, { ghost: 300 })), "Free round");
  assert.equal(modeName(round({ opponent: "Sam" }, { ghost: 300 })), "Live match");
  assert.equal(modeName(round({}, { ghost: 300 })), "Beat the Ghost");
  assert.equal(modeName(round({}, { goals: [1, 2, 3] })), "Stage");
  assert.equal(modeName(round({}, { goals: [1, 2, 3], label: "World 1-3" })), "World 1-3");
  assert.equal(modeName(round({}, { label: "Daily Challenge" })), "Daily Challenge");
  assert.equal(modeName(round()), "Practice");
});

test("a round without a level is Beginner only at the slowest pace", () => {
  assert.equal(roundLevel(params({ level: undefined, every: 4000, win: 4 })), "beginner");
  assert.equal(roundLevel(params({ level: undefined, every: 3000, win: 4 })), "");
  assert.equal(roundLevel(params({ level: "hard" })), "hard");
  assert.equal(showsLineHints("beginner"), true);
  assert.equal(showsLineHints("medium"), true);
  assert.equal(showsLineHints("hard"), false);
});

test("the line under the score: opponent, then ghost, then last tap", () => {
  assert.equal(scoreSub(round({ opponent: "Sam" }, { ghost: 300 }), 50000, 100000, 5), "vs Sam");
  assert.equal(scoreSub(round({}, { ghost: 300 }), 50000, 100000, 5), "Ghost 150");
  assert.equal(scoreSub(round(), 0, 100000, 12), "+12 last tap");
  assert.equal(scoreSub(round(), 0, 100000, -8), "-8 last tap");
  assert.equal(scoreSub(round(), 0, 100000, null), "");
});

test("leaving warns about the fee only when there is one", () => {
  assert.match(leaveText(round()), /not refunded/);
  assert.match(leaveText(round({}, { fee: 0 })), /will not count/);
  assert.match(leaveText(round({ local: true })), /will not count/);
});

test("the combo counts the same way as Classic", () => {
  assert.deepEqual({ ...combo(0, 4, 3), label: undefined }, { mult: 1, toNext: 4, pips: 0, label: undefined });
  assert.equal(combo(5, 4, 3).mult, 2);
  assert.equal(combo(5, 4, 3).toNext, 3);
  assert.equal(combo(5, 4, 3).pips, 1);
  assert.equal(combo(8, 4, 3).mult, 3);
  assert.equal(combo(8, 4, 3).pips, 4, "all pips lit at the top combo");
  assert.equal(combo(8, 4, 3).label, "Top combo");
  assert.equal(combo(1, 4, 3).label, "3 more correct taps for x2");
});

test("tap messages keep Classic's words", () => {
  assert.equal(goodText(1, 4, 3), "Good tap!");
  assert.equal(goodText(2, 4, 3), "Nice! 2 in a row. 2 more for x2.");
  assert.equal(goodText(9, 4, 3), "9 in a row. Top combo x3!");
  assert.equal(lineText(params({ pt: 1.5 }), 1), "LINE! +75 bonus points");
  assert.equal(lineText(params({ pt: 1, lineMul: 2 }), 2), "LINE! +200 bonus points");
  assert.match(missText("late"), /already left/);
  assert.match(missText("notYet"), /Not called yet/);
});

test("the numbers on the board: newest first, tagged, with time left", () => {
  const { card, seq } = makeBoard(42);
  const marked = card.map((v) => v === 0);
  const p = { every: 1000, win: 3 };
  assert.equal(onBoard(seq, card, marked, 0, p).length, 1);
  const b = onBoard(seq, card, marked, 5500, p);
  assert.equal(b.length, 3);
  assert.deepEqual(b.map((c) => c.n), [seq[5], seq[4], seq[3]]);
  assert.deepEqual(b.map((c) => c.tag), ["new", "", "leaving"]);
  assert.ok(b[0].rest > b[2].rest, "the newest has the most time");
  const i = card.indexOf(seq[4]);
  if (i >= 0) {
    const m = [...marked]; m[i] = true;
    assert.equal(onBoard(seq, card, m, 5500, p)[1].tag, "done");
  }
});

test("line hints: rows and columns one short, never the diagonals", () => {
  const m = Array(25).fill(false);
  [0, 1, 2, 3].forEach((x) => (m[x] = true)); // top row, one short
  assert.deepEqual(almostLines(m, true), [0]);
  assert.deepEqual(almostLines(m, false), []);
  const d = Array(25).fill(false);
  [0, 6, 12, 18].forEach((x) => (d[x] = true)); // a diagonal, one short
  assert.deepEqual(almostLines(d, true), []);
  const full = Array(25).fill(false);
  [0, 1, 2, 3, 4].forEach((x) => (full[x] = true));
  assert.deepEqual(newLines(full, new Set()).map((l) => l.k), [0]);
  assert.deepEqual(newLines(full, new Set([0])), []);
});

test("taps are ignored when the round is over, the cell is daubed, before the start, or too fast", () => {
  const ok = { over: false, marked: false, t: 500, prevT: 100 };
  assert.equal(ignoresTap(ok), false);
  assert.equal(ignoresTap({ ...ok, over: true }), true);
  assert.equal(ignoresTap({ ...ok, marked: true }), true);
  assert.equal(ignoresTap({ ...ok, t: -1 }), true);
  assert.equal(ignoresTap({ ...ok, prevT: 450 }), true);
  assert.equal(ignoresTap({ ...ok, prevT: null }), false);
});

test("the tip shows for the first two rounds, while tips are on", () => {
  assert.equal(showsTip(true, 0), true);
  assert.equal(showsTip(true, 1), true);
  assert.equal(showsTip(true, 2), false);
  assert.equal(showsTip(false, 0), false);
});

test("the player's equipped looks carry over; missing items keep the design's colours", () => {
  const items = [
    { slot: "theme", key: "mint", meta: { color: "#10b981" } },
    { slot: "board", key: "night", meta: { card: "#111", cell: "#222", ink: "#fff" } },
    { slot: "ball", key: "gold", meta: { bg: "#f5b50a", ink: "#221800" } },
  ] as unknown as ShopItem[];
  const eq = { theme: "mint", style: "ring", board: "night", ball: "gold", frame: "", title: "" };
  assert.deepEqual(lookFor(eq, items), { daub: "#10b981", style: "ring", board: { card: "#111", cell: "#222", ink: "#fff" }, ball: { bg: "#f5b50a", ink: "#221800" } });
  assert.deepEqual(lookFor({ ...eq, theme: "none", board: "", ball: "" }, items), { daub: null, style: "ring", board: null, ball: null });
  assert.deepEqual(lookFor(undefined, items), { daub: null, style: "", board: null, ball: null });
});

test("the screen ends rounds through ctx only and never scores them itself", () => {
  const src = readFileSync(new URL("../../web/src/newui/screens/Play.tsx", import.meta.url), "utf8");
  assert.ok(!/from "[^"]*lib\/supabase"/.test(src.replace(/import type[^;]+;/g, "")), "no supabase import");
  assert.ok(!/callFn/.test(src), "no callFn");
  assert.match(src, /\.submit\(round\.roundId, taps\.current\)/);
  assert.match(src, /\.abandon\(round\.roundId\)/);
  assert.match(src, /\.finish\(/);
  assert.match(src, /\.fail\(/);
  assert.match(src, /\.leave\(\)/);
});
