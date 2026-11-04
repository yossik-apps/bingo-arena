// The Shop's rules, kept apart from its looks so they can be tested. Conditions and wording are the same as Classic's
// ShopHub, Store ("Coins and gems") and Shop ("Looks and boosters").
import type { Equipped, ShopItem } from "../../lib/supabase";
import type { Economy, Product, StoreMode } from "../../lib/store";

export type ShopTab = "store" | "looks";
export type StoreSection = "offers" | "coins" | "gems";
export type GemSpend = "coins_s" | "coins_l" | "shield";

/** The three gem swaps, with Classic's words. The amounts are the server's; these are only the labels. */
export const GEM_SPENDS: { what: GemSpend; gems: number; get: string; done: string }[] = [
  { what: "coins_s", gems: 10, get: "600 coins", done: "Swapped 10 gems for 600 coins." },
  { what: "coins_l", gems: 50, get: "3,500 coins", done: "Swapped 50 gems for 3,500 coins." },
  { what: "shield", gems: 20, get: "Streak Shield", done: "You got a Streak Shield." },
];
export const CLUB_PERKS = ["150 coins and 5 gems every day", "A Club badge next to your name", "Bingo DNA with your last 50 games"];
export const FOOT = "Coins and gems are play money. They have no cash value and cannot be cashed out, sold or transferred. There are no random packs: you always see exactly what you get. You can set a monthly spending limit in Profile, then Settings.";

/**
 * The calls the Shop needs, named after Classic's. Until a shared change adds them to ScreenCtx they come from fixtures only.
 * Loaders reject when they cannot load. Actions reject with an Error whose message is the player's text and whose `code`
 * is the server's error code (for example "adults_only").
 */
export type ShopApi = {
  store_products: () => Promise<{ products: Product[]; mode: StoreMode }>;
  buy_test: (productId: string) => Promise<{ coins?: number; gems?: number }>;
  gem_spend: (what: GemSpend) => Promise<void>;
  club_claim: () => Promise<void>;
  /** accept_terms with p_age18: true, p_where: "web" */
  accept_terms: () => Promise<void>;
  daily_deals: () => Promise<string[]>;
  buy_item: (itemId: string) => Promise<void>;
  equip_item: (itemId: string, on: boolean) => Promise<void>;
};
export const isAdultsOnly = (e: unknown) => /adults_only/.test(String((e as { code?: string })?.code ?? ""));

export const price = (cents: number) => `$${(cents / 100).toFixed(2)}`;
/** Classic remembers the Shop tab for the session. */
export const firstTab = (saved: string | null): ShopTab => (saved === "looks" ? "looks" : "store");

// ---- Coins and gems ----
export type Who = { visitorOrGuest: boolean; crazyGames: boolean; busy: boolean };
/** The store mode in force: the player's economy wins over the store settings, as in Classic. */
export const storeMode = (econ: Economy | null, loaded: StoreMode) => econ?.mode ?? loaded;
export const storeClosed = (mode: StoreMode, econ: Economy | null) => mode === "off" && !econ?.is_admin;
export const canTest = (mode: StoreMode, econ: Economy | null, visitorOrGuest: boolean) => !visitorOrGuest && mode === "test" && !!econ?.is_admin;

/** The buy button for a real-money product. Preview always says "Coming soon". */
export function buyButton(p: Product, mode: StoreMode, econ: Economy | null, who: Who) {
  if (who.crazyGames) return { label: "Not available here", disabled: true };
  const owned = p.one_time && !!econ?.owned.includes(p.id);
  const test = canTest(mode, econ, who.visitorOrGuest);
  const label = who.visitorOrGuest ? `Sign up · ${price(p.price_cents)}` : owned ? "Owned" : test ? `Test buy · ${price(p.price_cents)}` : `${price(p.price_cents)} · Coming soon`;
  return { label, disabled: !who.visitorOrGuest && (owned || !test || who.busy) };
}
export const storeNote = (mode: StoreMode, econ: Economy | null) =>
  mode === "test" && econ?.is_admin ? "Test mode: purchases are free and only admins can make them. Nothing is charged." : "Purchases open soon. Everything here can also be earned by playing.";
export const boughtText = (p: Product, d: { coins?: number; gems?: number }) =>
  `Test purchase done: ${p.name}.${d.coins ? ` +${d.coins} coins.` : ""}${d.gems ? ` +${d.gems} gems.` : ""} No money was charged.`;
export const vaultPct = (econ: Economy | null) => (econ && econ.vault_cap ? Math.min(100, (econ.vault / econ.vault_cap) * 100) : 0);
export const vaultLine = (econ: Economy | null) => `of ${(econ?.vault_cap ?? 3000).toLocaleString("en-US")} · fills with ${econ?.vault_pct ?? 10}% of your wins`;
export const clubLine = (p: Product) => `${price(p.price_cents)} for ${p.days} days. It does not renew by itself.`;
export const byKind = (products: Product[], k: Product["kind"]) => products.filter((p) => p.kind === k);

// ---- Looks and boosters ----
export const CATS: [string, string][] = [["deals", "Deals"], ["dauber", "Daubers"], ["board", "Boards"], ["ball", "Balls"], ["frame", "Frames"], ["title", "Titles"], ["boost", "Boosters"], ["world", "Rewards"]];
const OPTIONAL = ["style", "frame", "title"];
export const rarity = (p: number) => (p >= 200 ? "Epic" : p >= 100 ? "Rare" : "Common");
export const dealPrice = (it: ShopItem, deals: string[]) => (deals.includes(it.id) ? Math.round(it.price * 0.75) : it.price);
export const catNote = (cat: string) =>
  cat === "deals" ? "Three items are 25% off today. They change every day."
    : cat === "boost" ? "Boosters work in solo and vs-ghost rounds only, never against real players or in events. Arm them on the Play tab."
      : cat === "frame" || cat === "title" ? "Some items unlock at higher levels."
        : cat === "world" ? "Exclusive looks you earn by completing albums or climbing the season track. They cannot be bought." : "";
export const itemsFor = (cat: string, items: ShopItem[], deals: string[]) =>
  cat === "deals" ? deals.map((id) => items.find((i) => i.id === id)).filter((i): i is ShopItem => !!i) : items.filter((i) => i.grp === cat);
export const itemTag = (it: ShopItem, deals: string[], owned: boolean) => `${it.grp === "boost" ? "Booster" : rarity(it.price)}${deals.includes(it.id) && !owned ? " · 25% off" : ""}`;

export type ItemAction = "buy" | "equip" | "unequip" | null;
/** The button on a look or booster card, in Classic's order of checks. */
export function itemButton(it: ShopItem, o: { owned: Set<string>; equipped: Equipped; deals: string[]; coins: number; level: number; visitor: boolean; busy: boolean }) {
  const own = it.price === 0 || o.owned.has(it.id);
  const eq = own && it.grp !== "boost" && (o.equipped as Record<string, string>)[it.slot] === it.key;
  const pr = dealPrice(it, o.deals), poor = !o.visitor && o.coins < pr, lock = !own && o.level < it.min_level;
  const buy = { label: "Buy", price: pr, action: "buy" as ItemAction, disabled: poor || o.busy };
  if (it.slot === "boost") return { ...buy, own, eq };
  if (it.slot === "bundle") return own ? { label: "Purchased", action: null, disabled: true, own, eq } : { ...buy, own, eq };
  if (it.meta?.reward === true && !own) return { label: "Earned as a reward", action: null, disabled: true, own, eq };
  if (lock) return { label: `Reach level ${it.min_level}`, action: null, disabled: true, own, eq };
  if (!own) return { ...buy, own, eq };
  if (eq) return OPTIONAL.includes(it.slot) ? { label: "Unequip", action: "unequip" as ItemAction, disabled: o.busy, own, eq } : { label: "Equipped", action: null, disabled: true, own, eq };
  return { label: "Equip", action: "equip" as ItemAction, disabled: o.busy, own, eq };
}
