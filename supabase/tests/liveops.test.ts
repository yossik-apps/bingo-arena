import test from "node:test";
import assert from "node:assert/strict";
import { combine } from "../functions/_shared/liveops.ts";
import { buildRound, type Cfg } from "../functions/_shared/rounds.ts";

test("boosts do not stack: the best of each kind applies", () => {
  assert.deepEqual(combine([]), { xp: 1, coins: 1, feePct: 0 });
  const b = combine([{ kind: "xp_boost", mult: 1.5, pct: 0 }, { kind: "xp_boost", mult: 2, pct: 0 }, { kind: "coin_boost", mult: 1.5, pct: 0 }, { kind: "fee_discount", mult: 1, pct: 25 }, { kind: "fee_discount", mult: 1, pct: 50 }, { kind: "banner", mult: 1, pct: 0 }]);
  assert.deepEqual(b, { xp: 2, coins: 1.5, feePct: 50 });
});
test("absurd values are capped", () => {
  assert.deepEqual(combine([{ kind: "xp_boost", mult: 99, pct: 0 }, { kind: "fee_discount", mult: 1, pct: 100 }]), { xp: 5, coins: 1, feePct: 90 });
});
test("cheaper entries lower the Beat the Ghost fee only", () => {
  const cfg: Cfg = { levels: { medium: { every: 3000, win: 3, pt: 1.5, pen: 8, hint: false, xm: 1.5, fee: 20, gl: 250, gr: 130 } }, g: { total: 100, pay: 1.8 } };
  const base = { level: "medium", cfg, boosters: [] as string[], randomSeed: 1 };
  assert.equal(buildRound({ ...base, mode: "ghost", feePct: 50 }).fee, 10);
  assert.equal(buildRound({ ...base, mode: "ghost" }).fee, 20);
  assert.equal(buildRound({ ...base, mode: "ghost", feePct: 100 }).fee, 2, "never more than 90% off");
  assert.equal(buildRound({ ...base, mode: "tour", eventFee: 20, feePct: 50 }).fee, 20, "events are unaffected");
  assert.equal(buildRound({ ...base, mode: "solo", feePct: 50 }).fee, 0);
});
