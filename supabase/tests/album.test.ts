import test from "node:test";
import assert from "node:assert/strict";
import { canCraft, claimMessage, COST, craftedMessage, epicToGo, howOdds, initials, pageState, stampTag, type Stamp } from "../../web/src/newui/screens/Album.logic.ts";
import type { ShopItem, World } from "../../web/src/lib/supabase.ts";

const w = (id: number, item: string | null = null) => ({ id, name: `W${id}`, blurb: "", stars_needed: 0, reward_item: item, reward_coins: 100 }) as World;
const s = (world: number, n: number, rarity: Stamp["rarity"] = "common"): Stamp => ({ id: `w${world}s${n}`, world, name: `Stamp ${n}`, rarity, sort: n });
const STAMPS = [s(1, 1), s(1, 2), s(1, 3, "epic"), s(2, 1)];
const ITEMS = [{ id: "b1", name: "Gold board" }] as unknown as ShopItem[];

test("craft costs are Classic's, and crafting needs enough dust", () => {
  assert.deepEqual(COST, { common: 30, rare: 90, epic: 240 });
  assert.equal(canCraft(s(1, 1), 29), false);
  assert.equal(canCraft(s(1, 1), 30), true);
  assert.equal(canCraft(s(1, 3, "epic"), 239), false);
});

test("a page counts owned stamps of its own world only", () => {
  const p = pageState(w(1), STAMPS, { w1s1: 2, w2s1: 1 }, []);
  assert.equal(p.list.length, 3);
  assert.equal(p.have, 1);
  assert.equal(p.button, "2 stamps to go");
  assert.equal(p.canClaim, false);
});

test("a page reward can be claimed once, when every stamp is owned", () => {
  const all = { w1s1: 1, w1s2: 1, w1s3: 1 };
  assert.deepEqual([pageState(w(1), STAMPS, all, []).canClaim, pageState(w(1), STAMPS, all, []).button], [true, "Claim reward"]);
  assert.deepEqual([pageState(w(1), STAMPS, all, [1]).canClaim, pageState(w(1), STAMPS, all, [1]).button], [false, "Claimed"]);
  assert.equal(pageState(w(9), STAMPS, all, []).canClaim, false, "an empty page is never complete");
});

test("duplicates show as a count on the tag", () => {
  assert.equal(stampTag(s(1, 1), 1), "common");
  assert.equal(stampTag(s(1, 1), 3), "common · x3");
  assert.equal(stampTag(s(1, 3, "epic"), undefined), "epic");
});

test("the epic guarantee counts down from 10, never below 1", () => {
  assert.equal(epicToGo({ dust: 0, packs_since_epic: 0, packs_opened: 0 }), 10);
  assert.equal(epicToGo({ dust: 0, packs_since_epic: 6, packs_opened: 0 }), 4);
  assert.equal(epicToGo({ dust: 0, packs_since_epic: 12, packs_opened: 0 }), 1);
  assert.match(howOdds({ dust: 0, packs_since_epic: 6, packs_opened: 0 }), /common 70%, rare 25%, epic 5%.*\(4 to go\).*\(5, 15 or 40\).*\(30 \/ 90 \/ 240\)/);
});

test("Classic's messages, worded from what the server returned", () => {
  assert.equal(craftedMessage(s(1, 2)), "Stamp 2 crafted.");
  assert.equal(claimMessage({ coins: 200, item: "b1" }, ITEMS), "Album complete! +200 coins and the Gold board.");
  assert.equal(claimMessage({ coins: 200, item: "zz" }, ITEMS), "Album complete! +200 coins and the reward.");
  assert.equal(claimMessage({ coins: 200, item: null }, ITEMS), "Album complete! +200 coins.");
  assert.equal(initials("Sample Gold Ace"), "SG");
});
