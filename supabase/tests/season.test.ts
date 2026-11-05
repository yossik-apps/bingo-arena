import test from "node:test";
import assert from "node:assert/strict";
import {
  canBuyPass, eyebrow, HAS_PASS, MSG, noSeasonText, PASS_TEXT, progress, shortHint, showPassCard, TEASER, tierButton, tierName, TIP_TEXT, TOP_TIER,
} from "../../web/src/newui/screens/JourneySeason.logic.ts";
import type { SeasonInfo, SeasonTier, ShopItem } from "../../web/src/lib/supabase.ts";

const DAY = 864e5, NOW = Date.UTC(2026, 10, 5, 12);
const season = (over: Partial<SeasonInfo> = {}): SeasonInfo => ({
  active: true, name: "S", blurb: "", ends_at: new Date(NOW + 17 * DAY).toISOString(), over: false, xp_per_tier: 100, pass_price: 900, xp: 1240, tier: 12, pass: false, tiers: [], ...over,
});
const tier = (n: number, over: Partial<SeasonTier> = {}): SeasonTier => ({ tier: n, free: { coins: 25 }, premium: { item: "fr_x" }, free_claimed: false, premium_claimed: false, ...over });
const ITEMS = [{ id: "fr_x", name: "Neon frame" }] as ShopItem[];

test("progress uses the season's tier size, and 200 when it has none", () => {
  const p = progress(season());
  assert.deepEqual([p.per, p.tier, p.into, p.pct, p.top], [100, 12, 40, 40, false]);
  assert.equal(p.text, "60 XP to tier 13. You earn season XP from every round you play.");
  const d = progress(season({ xp_per_tier: undefined, xp: 450, tier: 2 }));
  assert.deepEqual([d.per, d.into, d.pct], [200, 50, 25]);
  const none = progress({ active: true });
  assert.deepEqual([none.tier, none.into, none.pct], [0, 0, 0]);
});

test("the top tier is full and says so", () => {
  const p = progress(season({ tier: TOP_TIER, xp: 3100 }));
  assert.equal(p.pct, 100);
  assert.equal(p.text, "You reached the top tier!");
});

test("the label shows the time left, or that the season ended", () => {
  assert.equal(eyebrow(season(), NOW), "Season track · 17 days left");
  assert.equal(eyebrow(season({ ends_at: new Date(NOW + 3 * 36e5 + 5 * 6e4).toISOString() }), NOW), "Season track · 3 h 5 min left");
  assert.equal(eyebrow(season({ over: true }), NOW), "Season track · ended, claim your rewards");
});

test("no season: the next one, or soon", () => {
  assert.equal(noSeasonText({ active: false, next: null }), "The next season will be announced soon.");
  assert.match(noSeasonText({ active: false, next: { name: "Season 2", starts_at: new Date(NOW).toISOString() } }), /^The next season, Season 2, starts .+\.$/);
});

test("the pass card shows only without a pass while the season runs", () => {
  assert.equal(showPassCard(season()), true);
  assert.equal(showPassCard(season({ pass: true })), false);
  assert.equal(showPassCard(season({ over: true })), false);
});

test("the pass is bought only with enough coins, as in Classic", () => {
  assert.equal(canBuyPass(season(), 899), false);
  assert.equal(canBuyPass(season(), 900), true);
  assert.equal(canBuyPass(season({ pass_price: undefined }), 0), true);
  assert.equal(shortHint(season()), "You need 900 coins. Keep playing to earn them.");
});

test("a tier's free button: claimable once reached, then Claimed", () => {
  const ready = tierButton(tier(5), "free", 12, false, ITEMS);
  assert.deepEqual([ready.disabled, ready.text], [false, "Claim · +25 coins"]);
  assert.equal(ready.label, "Claim tier 5 free reward: +25 coins");
  const later = tierButton(tier(13), "free", 12, false, ITEMS);
  assert.deepEqual([later.disabled, later.reached, later.label], [true, false, "Tier 13 free reward: +25 coins, not reached yet"]);
  const done = tierButton(tier(5, { free_claimed: true }), "free", 12, false, ITEMS);
  assert.deepEqual([done.disabled, done.text], [true, "Claimed"]);
});

test("a tier's pass button needs the pass, and every reached tier claims on its own", () => {
  const locked = tierButton(tier(3), "premium", 12, false, ITEMS);
  assert.deepEqual([locked.disabled, locked.locked, locked.text], [true, true, "Neon frame"]);
  assert.equal(locked.label, "Tier 3 pass reward: Neon frame, needs the pass");
  // Classic lets any reached tier be claimed, in any order
  for (const n of [1, 7, 12]) assert.equal(tierButton(tier(n), "premium", 12, true, ITEMS).disabled, false);
  assert.equal(tierButton(tier(3, { premium_claimed: true }), "premium", 12, true, ITEMS).text, "Claimed");
  assert.equal(tierButton(tier(3, { premium: { item: "gone" } }), "premium", 12, true, ITEMS).text, "Claim · Exclusive item");
});

test("tier numbers read as Classic's", () => {
  assert.equal(tierName(tier(4), 12), "Tier 4, reached");
  assert.equal(tierName(tier(13), 12), "Tier 13");
});

test("Classic's words are kept exactly", () => {
  assert.deepEqual(MSG, { passBought: "Season pass unlocked!", claimed: "Reward claimed!" });
  assert.equal(HAS_PASS, "You have the season pass. Both tracks are open.");
  assert.match(PASS_TEXT, /Bought with coins, never with real money\.$/);
  assert.match(TIP_TEXT, /^Season XP is the XP you earn/);
  assert.equal(TEASER.button, "Play free to unlock");
  assert.equal(TEASER.points.length, 3);
});

test("a claimable pass reward reads as a Claim button too; claimed and locked cells do not", () => {
  const gold = tierButton(tier(7), "premium", 12, true, ITEMS);
  assert.deepEqual([gold.text, gold.label], ["Claim · Neon frame", "Claim tier 7 pass reward: Neon frame"]);
  assert.ok(!tierButton(tier(7, { premium_claimed: true }), "premium", 12, true, ITEMS).text.startsWith("Claim ·"));
  assert.ok(!tierButton(tier(7), "premium", 12, false, ITEMS).text.startsWith("Claim"));
  assert.ok(!tierButton(tier(13), "free", 12, true, ITEMS).text.startsWith("Claim"));
});
