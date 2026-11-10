// Balance v2 on the screens: the speed bonus row, the bonus pop, "Unranked", and scores below zero (reports/balance-spec.md section 12).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { scoreText } from "../../web/src/lib/score.ts";
import { freeText, scoreTag, speedBonus } from "../../web/src/newui/screens/Result.logic.ts";
import { bonusText, scoreSub } from "../../web/src/newui/screens/Play.logic.ts";
import { isUnranked, masteryNext, masteryPct, masteryScore } from "../../web/src/newui/screens/Profile.logic.ts";
import type { RoundResult, RoundStart } from "../../web/src/views/Play.tsx";

const src = (p: string) => readFileSync(new URL(`../../web/src/${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const P = (extra: object = {}) => ({ every: 3000, win: 3, pt: 1.5, pen: 8, hint: false, xm: 1.5, fee: 0, gl: 250, gr: 130, total: 100, pay: 1.8, ghost: null, boosters: [], level: "medium", ...extra }) as unknown as RoundStart["params"];
const R = (extra: object = {}) => ({ score: 305, daubs: 17, wrong: 1, late: 1, lines: 2, maxMult: 4, accuracy: 0.89, avgReactionMs: 1640, win: false, prize: 0, xp: 38, ghost: null, best: 468, balance: 0, level: 12, achievements: [], mode: "solo", ...extra }) as RoundResult;

test("a negative score is written with a true minus sign, a positive one as it is", () => {
  assert.equal(scoreText(-24), "−24");
  assert.equal(scoreText(0), "0");
  assert.equal(scoreText(305), "305");
  assert.equal(scoreSub({ params: P(), seed: 1, roundId: "r", balance: 0 } as RoundStart, 1000, 100000, -8), "-8 last tap", "the per-tap line keeps Classic wording");
  assert.equal(scoreSub({ params: P(), seed: 1, roundId: "r", balance: 0 } as RoundStart, 1000, 100000, 15), "+15 last tap");
});

test("the Result screen's speed bonus row: version 2 rounds only", () => {
  assert.equal(speedBonus(R(), P()), null, "a version 1 round has no bonus row");
  assert.equal(speedBonus(R({ bonus: 49, fast1: 6, fast2: 1 }), P({ cv: 2, bonus: 5 }))?.points, "+49");
  assert.deepEqual(speedBonus(R({ bonus: 49, fast1: 6, fast2: 1 }), P({ cv: 2, bonus: 5 })), { points: "+49", detail: "6 taps under 1 s · 1 under 2 s", hint: null });
  assert.equal(speedBonus(R({ bonus: 5, fast1: 1, fast2: 0 }), P({ cv: 2, bonus: 5 }))?.detail, "1 tap under 1 s · 0 under 2 s", "one tap is singular");
  const none = speedBonus(R({ bonus: 0, fast1: 0, fast2: 0 }), P({ cv: 2, bonus: 5 }));
  assert.equal(none?.points, "+0");
  assert.equal(none?.hint, "Tap within 1 s of a call for +8", "the hint names this level's top points (Medium, pt 1.5)");
  assert.equal(speedBonus(R({ bonus: 0 }), P({ cv: 2, bonus: 5, pt: 1 }))?.hint, "Tap within 1 s of a call for +5", "Beginner");
  assert.equal(speedBonus(R({ bonus: 0 }), P({ cv: 2, bonus: 5, pt: 2 }))?.hint, "Tap within 1 s of a call for +10", "Hard");
  assert.equal(speedBonus(R({}), P({ cv: 2, bonus: 5 }))?.points, "+0", "an answer without bonus fields reads as no bonus");
});

test("the bonus pop's message", () => {
  assert.equal(bonusText(8), "Speed bonus +8.");
});

test("a free round that ends below zero says so", () => {
  assert.equal(freeText(-16, 1, 50).title, "Round over: −16 points. Try again!");
  assert.equal(freeText(0, 1, 50).title, "Round over: 0 points. Try again!");
  assert.equal(freeText(120, 1, 50).title, "Nice! You scored 120 points");
});

test("the score tag still reads for a negative score", () => {
  assert.deepEqual(scoreTag(R({ score: -24, mode: "ghost", ghost: 276 })), { text: "Ghost 276", best: false });
});

test("Unranked: no bar, plain words; a best score below zero fills nothing", () => {
  const un = { level: "beginner", best: 0, tier: 0, name: "Unranked", ranked: false, next_name: "Bronze", next_min: 0 };
  assert.equal(isUnranked(un), true);
  assert.deepEqual([masteryPct(un), masteryScore(un), masteryNext(un)], [0, "No rank yet", "Play a round"]);
  const bronze = { level: "beginner", best: -20, tier: 0, name: "Bronze", ranked: true, next_name: "Silver", next_min: 320 };
  assert.equal(isUnranked(bronze), false);
  assert.deepEqual([masteryPct(bronze), masteryScore(bronze), masteryNext(bronze)], [0, "−20 / 320", "Silver next"]);
  const old = { level: "medium", best: 120, tier: 1, name: "Silver", next_name: "Gold", next_min: 150 };
  assert.equal(isUnranked(old), false, "version 1 answers have no ranked field and read as ranked");
  assert.deepEqual([masteryPct(old), masteryScore(old), masteryNext(old)], [80, "120 / 150", "Gold next"]);
  assert.equal(masteryScore({ ...old, next_min: null, next_name: null, best: 1700 }), "Best 1700");
  assert.equal(masteryNext({ ...old, next_name: null, next_min: null }), "Top rank");
});

test("the screens use the version 2 rules: calls in the board, the bonus pop, the bonus row", () => {
  const play = src("newui/screens/Play.tsx"), classic = src("views/Play.tsx"), result = src("newui/screens/Result.tsx");
  assert.ok(play.includes("makeBoard(round.seed, p.calls)"), "New Play draws the version 2 call order");
  assert.ok(classic.includes("makeBoard(round.seed, round.params.calls)"), "Classic Play too, until it is removed");
  assert.ok(play.includes("after.bonus - live.bonus") && play.includes("nu-pl-bonus"), "a tap that earns a bonus shows a +N pop");
  assert.ok(play.includes("scoreText(live.score)"), "the live score can be negative");
  assert.ok(result.includes("const bonus = speedBonus(r, p);") && result.includes("Speed bonus {bonus.points}"), "the Result row");
  assert.ok(!result.includes("<b>{r.score}</b>"), "no score is written without scoreText");
  const roundCalls = src("lib/roundCalls.ts");
  assert.ok(roundCalls.includes("missedCount(round.seed, p, s.marked, p.total * 1000)"), "a visitor's round counts misses on the same call order");
});
