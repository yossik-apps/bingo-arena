import test from "node:test";
import assert from "node:assert/strict";
import { buildRound, type Cfg } from "../functions/_shared/rounds.ts";
import { applyMods, makeBoard, scoreTaps, botTaps } from "../functions/_shared/engine.ts";

const cfg: Cfg = {
  levels: {
    beginner: { every: 4000, win: 4, pt: 1, pen: 5, hint: false, xm: 1, fee: 10, gl: 150, gr: 100 },
    medium: { every: 3000, win: 3, pt: 1.5, pen: 8, hint: false, xm: 1.5, fee: 20, gl: 250, gr: 130 },
  },
  g: { total: 100, pay: 1.8 },
};
const base = { mode: "solo", level: "medium", cfg, boosters: [] as string[], randomSeed: 999 };

test("solo is free, uses the random seed, no ghost", () => {
  const r = buildRound(base);
  assert.equal(r.fee, 0); assert.equal(r.seed, 999); assert.equal(r.params.ghost, null); assert.equal(r.params.total, 100);
});
test("ghost costs the level fee and has a ghost target", () => {
  const r = buildRound({ ...base, mode: "ghost" });
  assert.equal(r.fee, 20); assert.ok(typeof r.params.ghost === "number");
});
test("stage rounds are FREE, use the stage's own seed and rules, and carry the star goals", () => {
  const mods = { every_mul: 0.5, line_mul: 2, label: "Blitz" };
  const r = buildRound({ ...base, mode: "stage", randomSeed: 111, stage: { seed: 4321, mods, s1: 50, s2: 90, s3: 140 } });
  assert.equal(r.fee, 0, "stages never charge coins");
  assert.equal(r.seed, 4321, "stages use their fixed board");
  assert.equal(r.params.every, 1500); assert.equal(r.params.lineMul, 2);
  assert.deepEqual(r.params.goals, [50, 90, 140]); assert.equal(r.params.label, "Blitz"); assert.equal(r.params.ghost, null);
});
test("daily rounds are free, shared and carry tier goals", () => {
  const r = buildRound({ ...base, mode: "daily", randomSeed: 5, daily: { day: "2026-10-05", seed: 777, mods: { win_add: -1, label: "Tight Window" }, g1: 40, g2: 80, g3: 120 } });
  assert.equal(r.fee, 0); assert.equal(r.seed, 777); assert.equal(r.params.win, 2); assert.deepEqual(r.params.goals, [40, 80, 120]);
});
test("a duel replays the creator's exact board and rules, with no boosters and no fee", () => {
  const frozen = { every: 1900, win: 2, pt: 2, pen: 15, total: 100, hint: false, xm: 2, fee: 40, gl: 1, gr: 1, boosters: ["slow"], ghost: 77, lineMul: 2 };
  const r = buildRound({ ...base, mode: "duel", randomSeed: 1, duel: { code: "abc12345", seed: 31337, params: frozen } });
  assert.equal(r.seed, 31337); assert.equal(r.fee, 0); assert.deepEqual(r.params.boosters, []); assert.equal(r.params.ghost, null);
  assert.equal(r.params.every, 1900); assert.equal(r.params.lineMul, 2);
});
test("event rounds charge the event's fee", () => {
  assert.equal(buildRound({ ...base, mode: "tour", eventFee: 33 }).fee, 33);
});
test("boosters change rules in solo and ghost only", () => {
  const b = buildRound({ ...base, boosters: ["slow", "win", "time", "hint"] });
  assert.equal(b.params.every, 3900); assert.equal(b.params.win, 4); assert.equal(b.params.total, 115); assert.equal(b.params.hint, true);
  const t = buildRound({ ...base, mode: "tour", eventFee: 1, boosters: ["slow"] });
  assert.equal(t.params.every, 3000); assert.deepEqual(t.params.boosters, []);
});
test("a stage round scores exactly the way the server will score it", () => {
  const stage = { seed: 8080, mods: { combo_step: 2, max_mult: 4, label: "Combo Rush" }, s1: 1, s2: 2, s3: 3 };
  const r = buildRound({ ...base, mode: "stage", stage });
  const p = r.params as never;
  const taps = botTaps(r.seed, p, 800, 100000);
  const viaBuilder = scoreTaps(r.seed, p, taps).score;
  const direct = scoreTaps(8080, applyMods({ ...cfg.levels.medium, total: 100 }, stage.mods), taps).score;
  assert.equal(viaBuilder, direct);
  assert.deepEqual(makeBoard(r.seed), makeBoard(8080));
});
