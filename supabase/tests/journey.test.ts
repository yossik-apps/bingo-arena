import test from "node:test";
import assert from "node:assert/strict";
import { goalsGot, lockedHint, playLabel, rulesText, stageLabel, stageOpen, startPoint, totalStars, worldLockText, worldOpen, worldStars } from "../../web/src/newui/screens/Journey.logic.ts";
import type { Stage, World } from "../../web/src/lib/supabase.ts";

const world = (id: number, need: number) => ({ id, name: `W${id}`, blurb: "", stars_needed: need, reward_item: null, reward_coins: 0 }) as World;
const stage = (w: number, idx: number, over: Partial<Stage> = {}) =>
  ({ id: `w${w}s${idx}`, world: w, idx, name: `S${idx}`, level: "beginner", mods: {}, s1: 100, s2: 200, s3: 300, reward_coins: 30, ...over }) as Stage;
const WORLDS = [world(1, 0), world(2, 5), world(3, 20)];
const STAGES = [1, 2, 3].flatMap((w) => [1, 2, 3].map((i) => stage(w, i)));
const p = (stars: Record<string, number>) => Object.fromEntries(Object.entries(stars).map(([k, n]) => [k, { stars: n, best_score: n * 100, attempts: 1 }]));

test("stars add up across every stage and per world", () => {
  const pr = p({ w1s1: 3, w1s2: 2, w2s1: 1 });
  assert.equal(totalStars(pr), 6);
  assert.equal(totalStars({}), 0);
  assert.equal(worldStars(STAGES, 1, pr), 5);
  assert.equal(worldStars(STAGES, 3, pr), 0);
});

test("a world opens when total stars reach its need, as in Classic", () => {
  assert.equal(worldOpen(WORLDS[0], 0), true);
  assert.equal(worldOpen(WORLDS[1], 4), false);
  assert.equal(worldOpen(WORLDS[1], 5), true);
});

test("a stage opens after one star on the stage before, inside an open world", () => {
  const pr = p({ w1s1: 1 });
  assert.equal(stageOpen(STAGES[0], WORLDS[0], STAGES, {}), true, "the first stage is always open");
  assert.equal(stageOpen(STAGES[1], WORLDS[0], STAGES, {}), false);
  assert.equal(stageOpen(STAGES[1], WORLDS[0], STAGES, pr), true);
  assert.equal(stageOpen(STAGES[2], WORLDS[0], STAGES, pr), false);
  assert.equal(stageOpen(STAGES[3], WORLDS[1], STAGES, pr), false, "the first stage of a locked world is locked");
  assert.equal(stageOpen(STAGES[1], WORLDS[0], STAGES, p({ w1s1: 0 })), false, "zero stars do not count");
});

test("the screen starts on the last open world, at its first stage without stars", () => {
  assert.deepEqual(startPoint(WORLDS, STAGES, {}), { world: 1, stage: "w1s1" });
  assert.deepEqual(startPoint(WORLDS, STAGES, p({ w1s1: 3, w1s2: 2 })), { world: 2, stage: "w2s1" });
  assert.deepEqual(startPoint(WORLDS, STAGES, p({ w1s1: 3, w1s2: 1 })), { world: 1, stage: "w1s3" });
  assert.deepEqual(startPoint(WORLDS, STAGES, p({ w1s1: 3, w1s2: 3, w1s3: 3 })), { world: 2, stage: "w2s1" });
  const all = p(Object.fromEntries(STAGES.map((s) => [s.id, 3])));
  assert.deepEqual(startPoint(WORLDS, STAGES, all), { world: 3, stage: "w3s1" }, "with everything cleared, the first stage of the last world");
  assert.equal(startPoint([], STAGES, {}), null);
});

test("goals are reached from the best score", () => {
  const st = stage(1, 1);
  assert.deepEqual(goalsGot(st, undefined), [false, false, false]);
  assert.deepEqual(goalsGot(st, { stars: 2, best_score: 200, attempts: 3 }), [true, true, false]);
});

test("Classic's words, unchanged", () => {
  assert.equal(worldLockText(WORLDS[1], 4), "Collect 1 more star in earlier worlds.");
  assert.equal(worldLockText(WORLDS[2], 6), "Collect 14 more stars in earlier worlds.");
  assert.equal(playLabel(true, 0), "Play stage");
  assert.equal(playLabel(true, 2), "Play again");
  assert.equal(playLabel(false, 0), "Locked");
  assert.equal(lockedHint(true), "Clear the previous stage first.");
  assert.equal(lockedHint(false), "Collect more stars to open this world.");
  assert.equal(rulesText(stage(1, 1, { level: "hard" })), "Hard · standard rules");
  assert.equal(rulesText(stage(1, 1, { level: "medium", mods: { label: "Double G" } })), "Medium · Double G");
  assert.equal(stageLabel(stage(1, 2), true, 2, true), "Stage 2, S2, 2 of 3 stars, up next");
  assert.equal(stageLabel(stage(1, 2), false, 0, false), "Stage 2, S2, locked");
});
