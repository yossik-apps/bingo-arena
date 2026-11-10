import test from "node:test";
import assert from "node:assert/strict";
import { PASS_COINS, boughtText, buyButton, clubLine, dealPrice, firstTab, itemButton, itemsFor, itemTag, storeClosed, showsPrices, storeMode, vaultLine, vaultPct } from "../../web/src/newui/screens/Shop.logic.ts";
import type { Economy, Product } from "../../web/src/lib/store.ts";
import type { Equipped, ShopItem } from "../../web/src/lib/supabase.ts";

const DEFAULT_EQUIPPED: Equipped = { theme: "rose", style: "", board: "classic", ball: "gold", frame: "", title: "" };

const econ = (o: Partial<Economy> = {}) => ({ mode: "preview", is_admin: false, gems: 5, vault: 750, vault_cap: 3000, vault_pct: 10, club_until: null, club_claimed: false, limit_cents: null, month_cents: 0, owned: [], in_crew: false, has_pass: false, ...o }) as Economy;
const club = { id: "club", kind: "club", name: "Bingo Club", descr: "", price_cents: 499, coins: 0, gems: 0, days: 30, one_time: false, badge: "", active: true, sort: 1 } as Product;
const starter = { ...club, id: "starter", kind: "starter", one_time: true, price_cents: 199 } as Product;
const who = { visitorOrGuest: false, crazyGames: false, busy: false };

test("preview mode always says Coming soon and cannot be bought", () => {
  assert.deepEqual(buyButton(club, "preview", econ(), who), { label: "Coming soon", disabled: true });
  assert.deepEqual(buyButton(club, "preview", econ({ is_admin: true }), who), { label: "Coming soon", disabled: true }, "admins too");
  assert.deepEqual(buyButton(club, "off", null, { ...who, visitorOrGuest: true }), { label: "Coming soon", disabled: true }, "guests and visitors too: no price, no Sign up button");
});

test("store modes work as in Classic", () => {
  assert.deepEqual(buyButton(club, "test", econ({ is_admin: true }), who), { label: "Test buy · $4.99", disabled: false });
  assert.equal(buyButton(club, "test", econ(), who).disabled, true, "test mode is for admins only");
  assert.deepEqual(buyButton(club, "preview", null, { ...who, visitorOrGuest: true }), { label: "Coming soon", disabled: true }, "while payments are off");
  assert.deepEqual(buyButton(club, "live", null, { ...who, visitorOrGuest: true }), { label: "Sign up · $4.99", disabled: false }, "once payments are live");
  assert.deepEqual(buyButton(club, "test", econ({ is_admin: true }), { ...who, crazyGames: true }), { label: "Not available here", disabled: true });
  assert.equal(storeMode(econ({ mode: "test" }), "off"), "test", "the economy's mode wins");
  assert.equal(storeMode(null, "off"), "off");
  assert.equal(storeClosed("off", econ()), true);
  assert.equal(storeClosed("off", econ({ is_admin: true })), false, "admins still see a closed store");
});

test("a one-time product cannot be bought twice, and nothing while a purchase runs", () => {
  assert.deepEqual(buyButton(starter, "test", econ({ is_admin: true, owned: ["starter"] }), who), { label: "Owned", disabled: true });
  assert.equal(buyButton(club, "test", econ({ is_admin: true, owned: ["club"] }), who).label, "Test buy · $4.99", "the Club can be bought again");
  assert.equal(buyButton(club, "test", econ({ is_admin: true }), { ...who, busy: true }).disabled, true);
});


test("store wording", () => {
  assert.equal(boughtText(club, { coins: 150, gems: 5 }), "Test purchase done: Bingo Club. +150 coins. +5 gems. No money was charged.");
  assert.equal(vaultPct(econ()), 25);
  assert.equal(vaultLine(econ()), "of 3,000 · fills with 10% of your wins");
  assert.equal(firstTab("looks"), "looks");
  assert.equal(firstTab(null), "store");
});

const item = (o: Partial<ShopItem>) => ({ id: "i", slot: "style", key: "k", grp: "dauber", name: "Ink", descr: "", price: 120, min_level: 1, meta: {}, sort: 1, ...o }) as ShopItem;
const base = { owned: new Set<string>(), equipped: DEFAULT_EQUIPPED, deals: [] as string[], coins: 500, level: 10, visitor: false, busy: false };

test("look and booster buttons follow Classic's order", () => {
  assert.equal(itemButton(item({}), base).label, "Buy");
  assert.equal(itemButton(item({}), { ...base, coins: 10 }).disabled, true);
  assert.equal(itemButton(item({}), { ...base, coins: 10, visitor: true }).disabled, false, "a visitor taps and is asked to sign up");
  assert.equal(itemButton(item({ min_level: 20 }), base).label, "Reach level 20");
  assert.equal(itemButton(item({ meta: { reward: true } }), base).label, "Earned as a reward");
  assert.equal(itemButton(item({}), { ...base, owned: new Set(["i"]) }).label, "Equip");
  assert.equal(itemButton(item({ key: "neon" }), { ...base, owned: new Set(["i"]), equipped: { ...DEFAULT_EQUIPPED, style: "neon" } }).label, "Unequip");
  assert.equal(itemButton(item({ slot: "board", key: "classic", price: 0 }), base).label, "Equipped", "a free board that is in use cannot be removed");
  assert.equal(itemButton(item({ slot: "bundle", grp: "deals" }), { ...base, owned: new Set(["i"]) }).label, "Purchased");
  assert.equal(itemButton(item({ slot: "boost", grp: "boost" }), { ...base, owned: new Set(["i"]) }).label, "Buy", "boosters can always be bought again");
});

test("daily deals are 25% off and listed in order", () => {
  const a = item({ id: "a", price: 100 }), b = item({ id: "b", price: 210 });
  assert.equal(dealPrice(a, ["a"]), 75);
  assert.equal(dealPrice(b, ["a"]), 210);
  assert.deepEqual(itemsFor("deals", [a, b], ["b", "a", "gone"]).map((i) => i.id), ["b", "a"]);
  assert.equal(itemTag(b, ["b"], false), "Epic · 25% off");
  assert.equal(itemTag(b, ["b"], true), "Epic");
});

test("no dollar price is shown while payments are off, and the Season Pass is bought with coins", () => {
  assert.equal(showsPrices("preview", econ(), false), false);
  assert.equal(showsPrices("off", econ({ is_admin: true }), false), false);
  assert.equal(showsPrices("test", econ({ is_admin: true }), true), false, "a guest never sees the admin test price");
  assert.equal(showsPrices("test", econ({ is_admin: true }), false), true, "an admin in test mode does");
  assert.equal(showsPrices("live", econ(), false), true);
  assert.equal(clubLine(club, false), "30 days. It does not renew by itself.");
  assert.match(clubLine(club, true), /^\$4\.99 for 30 days/);
  assert.match(PASS_COINS, /coins/);
});
