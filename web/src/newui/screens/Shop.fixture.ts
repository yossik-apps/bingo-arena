// Sample data for the Shop's captures, one state per name. Local development only.
// Products and items are copied from the database seeds (migrations 002, 005, 008 and 012), so prices match the live store.
import type { Economy, Product, StoreMode } from "../../lib/store";
import type { ShopItem } from "../../lib/supabase";
import type { ScreenCtx, ScreenFixture } from "./contract";
import type { ShopGroup, StoreGroup } from "../../lib/screenData";

const P = (id: string, kind: Product["kind"], name: string, descr: string, price_cents: number, coins: number, gems: number, days: number, one_time: boolean, badge: string, sort: number): Product =>
  ({ id, kind, name, descr, price_cents, coins, gems, days, one_time, badge, active: true, sort });
const PRODUCTS: Product[] = [
  P("starter", "starter", "Starter pack", "3,000 coins and 30 gems. Three times the usual value, once per player.", 199, 3000, 30, 0, true, "Best value · once", 1),
  P("coins_s", "coins", "1,000 coins", "", 199, 1000, 0, 0, false, "", 10), P("coins_m", "coins", "2,800 coins", "", 499, 2800, 0, 0, false, "+12%", 11),
  P("coins_l", "coins", "6,000 coins", "", 999, 6000, 0, 0, false, "+20%", 12), P("coins_xl", "coins", "13,000 coins", "", 1999, 13000, 0, 0, false, "+30%", 13),
  P("coins_xxl", "coins", "35,000 coins", "", 4999, 35000, 0, 0, false, "+40%", 14),
  P("gems_s", "gems", "50 gems", "", 199, 0, 50, 0, false, "", 20), P("gems_m", "gems", "140 gems", "", 499, 0, 140, 0, false, "+12%", 21), P("gems_l", "gems", "300 gems", "", 999, 0, 300, 0, false, "+20%", 22),
  P("club", "club", "Bingo Club · 30 days", "150 coins and 5 gems every day, a Club badge, and your last 50 games in Bingo DNA.", 499, 0, 0, 30, false, "Members", 30),
  P("vault", "vault", "Open the Coin Vault", "Every win puts extra coins in your vault. Open it to take them all.", 299, 0, 0, 0, false, "", 40),
  P("pass", "pass", "Season Pass Premium", "A second reward on every tier of the current season.", 499, 0, 0, 0, false, "", 50),
  P("crew_treat", "crew_treat", "Crew Treat", "Everyone in your crew gets 200 coins, with your name on it.", 299, 200, 0, 0, false, "Social", 60),
];
const I = (id: string, slot: ShopItem["slot"], key: string, grp: string, name: string, descr: string, price: number, min_level: number, meta: Record<string, unknown>, sort: number): ShopItem =>
  ({ id, slot, key, grp, name, descr, price, min_level, meta, sort });
const ITEMS: ShopItem[] = [
  I("th_rose", "theme", "rose", "dauber", "Rose", "Dauber color", 0, 0, { color: "#d6336c" }, 1), I("th_violet", "theme", "violet", "dauber", "Violet", "Dauber color", 80, 0, { color: "#6d28d9" }, 2),
  I("th_gold", "theme", "gold", "dauber", "Gold", "Dauber color", 220, 0, { color: "#a16207" }, 8),
  I("ds_round", "style", "round", "dauber", "Round stamp", "Circular daubs", 90, 0, { style: { borderRadius: "50%" } }, 10),
  I("ds_ring", "style", "ring", "dauber", "Ring stamp", "Daubs with an inner ring", 110, 0, { style: { boxShadow: "inset 0 0 0 5px rgba(255,255,255,.55)" } }, 11),
  I("bd_classic", "board", "classic", "board", "Classic", "Default board", 0, 0, { card: "var(--panel)", cell: "var(--cell)", ink: "var(--ink)" }, 20),
  I("bd_midnight", "board", "midnight", "board", "Midnight", "Deep indigo board", 120, 0, { card: "#1e1b4b", cell: "#312e81", ink: "#ffffff" }, 21),
  I("bd_paper", "board", "paper", "board", "Paper hall", "Warm bingo-hall paper", 100, 0, { card: "#fef9c3", cell: "#fef3c7", ink: "#422006" }, 22),
  I("bd_neon", "board", "neon", "board", "Neon night", "Glowing cyan on black", 220, 6, { card: "#020617", cell: "#0f172a", ink: "#67e8f9" }, 24),
  I("ball_gold", "ball", "gold", "ball", "Gold", "Default ball", 0, 0, { bg: "#f5b50a", ink: "#221800" }, 30), I("ball_ruby", "ball", "ruby", "ball", "Ruby", "Deep red ball", 80, 0, { bg: "#be123c", ink: "#ffffff" }, 31),
  I("ball_pearl", "ball", "pearl", "ball", "Pearl", "Pale ball", 120, 0, { bg: "#f1f5f9", ink: "#1e1b3a" }, 34),
  I("fr_gold", "frame", "gold", "frame", "Gold ring", "Avatar frame", 100, 0, {}, 40), I("fr_rainbow", "frame", "rainbow", "frame", "Rainbow ring", "Avatar frame", 250, 5, {}, 42),
  I("fr_ember", "frame", "ember", "frame", "Ember ring", "Avatar frame", 400, 8, {}, 43),
  I("t_eye", "title", "eye", "title", "Sharp Eye", "Title under your name", 60, 0, {}, 50), I("t_grand", "title", "grand", "title", "Grand Dauber", "Title under your name", 300, 8, {}, 53),
  I("b_slow", "boost", "slow", "boost", "Slow motion", "Numbers 30% slower for one round", 30, 0, { ic: "clock" }, 60), I("b_win", "boost", "win", "boost", "Extra window", "One more number stays daubable", 30, 0, { ic: "quest" }, 61),
  I("b_time", "boost", "time", "boost", "Extra time", "+15 seconds", 25, 0, { ic: "zap" }, 62), I("b_hint", "boost", "hint", "boost", "Hint glow", "Highlights matching squares", 20, 0, { ic: "eye" }, 63),
  I("bundle_starter", "bundle", "starter", "boost", "Starter pack", "Midnight board, Ocean dauber, 2 of each booster", 220, 0, { ic: "gift" }, 70),
  I("bd_harbor", "board", "harbor", "world", "Harbor board", "Reward: complete the Neon Harbor album", 9999, 0, { reward: true, card: "#082f49", cell: "#0c4a6e", ink: "#e0f2fe" }, 80),
  I("fr_neonnights", "frame", "neonnights", "world", "Neon Nights ring", "Season 1 reward", 9999, 0, { reward: true }, 90),
  I("ball_nightpulse", "ball", "nightpulse", "world", "Night Pulse ball", "Season 1 reward", 9999, 0, { reward: true, bg: "#7c3aed", ink: "#ffffff" }, 91),
];
const ECON: Economy = { mode: "preview", is_admin: false, gems: 128, vault: 750, vault_cap: 3000, vault_pct: 10, club_until: null, club_claimed: false, limit_cents: null, month_cents: 0, owned: [], in_crew: true, has_pass: false };

const done = async () => undefined;
const never = () => new Promise<never>(() => undefined);
const storeApi = (mode: StoreMode): StoreGroup => ({
  loadProducts: async () => ({ products: PRODUCTS, mode }), buyTest: async () => ({}), gemSpend: done, clubClaim: done, confirmAge: done,
  isAdultsOnly: (e) => /adults_only/.test((e as { raw?: string } | null)?.raw ?? ""),
});
const SHOP: ShopGroup = { dailyDeals: async () => ["th_gold", "bd_midnight", "fr_gold"], buy: done, equip: done };

/**
 * States: store (default) or looks picks the tab; add a word with "-": looks-boost, looks-frame, looks-world (a category),
 * test (admin test mode), member, claimed, owned, off, crazy, guest, visitor, poor, loading, error, empty, age.
 */
export const fixture: ScreenFixture = (base, state) => {
  const parts = (state ?? "").split("-");
  const has = (s: string) => parts.includes(s);
  try { sessionStorage.setItem("ba_shoptab", has("looks") ? "looks" : "store"); } catch { /* ignore */ }
  let econ: Economy = { ...ECON };
  if (has("test")) econ = { ...econ, mode: "test", is_admin: true };
  if (has("off")) econ = { ...econ, mode: "off" };
  if (has("member")) econ = { ...econ, club_until: new Date(Date.now() + 12 * 864e5).toISOString() };
  if (has("claimed")) econ = { ...econ, club_until: new Date(Date.now() + 12 * 864e5).toISOString(), club_claimed: true };
  if (has("owned")) econ = { ...econ, owned: ["starter"], has_pass: true, in_crew: false };
  let store = storeApi(econ.mode), shop = SHOP;
  if (has("loading")) store = { ...store, loadProducts: never };
  if (has("error")) store = { ...store, loadProducts: async () => { throw new Error("offline"); } };
  if (has("empty")) { store = { ...store, loadProducts: async () => ({ products: [], mode: econ.mode }) }; shop = { ...shop, dailyDeals: async () => [] }; }
  if (has("age")) store = { ...store, buyTest: async () => { throw Object.assign(new Error("Purchases are only for players aged 18+ on our website."), { raw: "adults_only" }); } };
  const owned = new Set(["th_rose", "bd_classic", "ball_gold", "th_violet", "fr_gold", "t_eye"]);
  let ctx: ScreenCtx = {
    ...base,
    wallet: { ...base.wallet, economy: base.profile ? econ : null, gems: base.profile ? econ.gems : null, items: ITEMS, owned, boosters: { slow: 2, hint: 1 } },
    profile: base.profile && { ...base.profile, equipped: { theme: "violet", style: "", board: "classic", ball: "gold", frame: "gold", title: "eye" } },
  };
  if (has("poor")) ctx = { ...ctx, wallet: { ...ctx.wallet, coins: 40 } };
  if (has("crazy")) ctx = { ...ctx, platform: { ...ctx.platform, crazyGames: true } };
  if (has("guest")) ctx = { ...ctx, profile: ctx.profile && { ...ctx.profile, guest: true } };
  if (has("visitor")) ctx = { ...ctx, profile: null, wallet: { ...ctx.wallet, coins: 0, gems: null, economy: null, owned: new Set(), boosters: {} }, visitor: { starting: false, playFree: () => undefined, askSignUp: () => undefined, welcome: 50, freeRounds: true } };
  return { ...ctx, store, shop };
};
