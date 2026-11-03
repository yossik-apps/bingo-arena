import test from "node:test";
import assert from "node:assert/strict";
import { claimMessage, questState, TEASER } from "../../web/src/newui/screens/Collect.logic.ts";

const m = { id: "m1", label: "Play 3 rounds", counter: "rounds", goal: 3, reward: 30 };

test("progress is capped at the goal, as in Classic", () => {
  assert.equal(questState(m, { rounds: 7 }, []).have, 3);
  assert.equal(questState(m, { rounds: 7 }, []).pct, 100);
  assert.equal(questState(m, {}, []).have, 0, "a missing counter counts as zero");
  assert.equal(Math.round(questState(m, { rounds: 1 }, []).pct), 33);
});

test("a quest can be claimed only when done and not yet claimed", () => {
  assert.deepEqual(pick(questState(m, { rounds: 2 }, [])), { canClaim: false, button: "In progress" });
  assert.deepEqual(pick(questState(m, { rounds: 3 }, [])), { canClaim: true, button: "Claim" });
  assert.deepEqual(pick(questState(m, { rounds: 3 }, ["m1"])), { canClaim: false, button: "Claimed" });
  assert.deepEqual(pick(questState(m, { rounds: 0 }, ["m1"])), { canClaim: false, button: "Claimed" }, "claimed wins over progress");
});
const pick = (q: ReturnType<typeof questState>) => ({ canClaim: q.canClaim, button: q.button });

test("the claim message words the reward the server returned", () => {
  assert.equal(claimMessage(45), "Reward claimed: +45 coins and 15 XP.");
});

test("the visitor teaser keeps Classic's words", () => {
  assert.equal(TEASER.title, "Collect and complete");
  assert.equal(TEASER.button, "Play free to unlock");
  assert.equal(TEASER.points.length, 3);
});
