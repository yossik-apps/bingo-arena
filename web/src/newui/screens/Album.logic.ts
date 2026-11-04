// The Album's rules, kept apart from its looks so they can be tested. The wording, conditions and numbers are the same as Classic's Album.
// Packs are opened and dust is granted by the server; crafting and page rewards go through server functions.
import type { AlbumData, Stamp } from "../../lib/screenData";
import type { ShopItem, World } from "../../lib/supabase";

/** What album.load() gives: Classic's five reads (worlds, stamps, user_stamps, user_collect, album_claims). */
export type { AlbumData, Stamp };
export type Rarity = Stamp["rarity"];
export type CollectStats = AlbumData["collect"];

/** Dust needed to craft a missing stamp. Shown only: the server charges it. */
export const COST: Record<Rarity, number> = { common: 30, rare: 90, epic: 240 };
export const NO_STATS: CollectStats = { dust: 0, packs_since_epic: 0, packs_opened: 0 };

export const initials = (n: string) => n.split(/\s+/).map((x) => x[0]).join("").slice(0, 2).toUpperCase();
export const canCraft = (s: Stamp, dust: number) => dust >= COST[s.rarity];

/** One world's page: how many stamps are owned, and the reward button. */
export function pageState(w: World, stamps: Stamp[], owned: Record<string, number>, claimed: number[]) {
  const list = stamps.filter((s) => s.world === w.id);
  const have = list.filter((s) => owned[s.id]).length;
  const done = have === list.length && list.length > 0;
  const isClaimed = claimed.includes(w.id);
  return { list, have, done, claimed: isClaimed, canClaim: done && !isClaimed, button: isClaimed ? "Claimed" : done ? "Claim reward" : `${list.length - have} stamps to go` };
}

/** "common · x3" for a duplicate, as on Classic's tag. */
export const stampTag = (s: Stamp, qty: number | undefined) => `${s.rarity}${qty && qty > 1 ? ` · x${qty}` : ""}`;

export const rewardItem = (w: World, items: ShopItem[]) => items.find((i) => i.id === w.reward_item);

export const craftedMessage = (s: Stamp) => `${s.name} crafted.`;
export const claimMessage = (r: { coins: number; item: string | null }, items: ShopItem[]) =>
  `Album complete! +${r.coins} coins${r.item ? ` and the ${items.find((i) => i.id === r.item)?.name ?? "reward"}` : ""}.`;

export const epicToGo = (c: CollectStats) => Math.max(1, 10 - c.packs_since_epic);
export const HOW_PACKS = "You earn a stamp pack the first time you clear a stage, the first time you earn 3 stars on it, and on every 7th day of your login streak. Packs cannot be bought.";
export const howOdds = (c: CollectStats) =>
  `common 70%, rare 25%, epic 5%. An epic is guaranteed within 10 packs (${epicToGo(c)} to go). A duplicate turns into dust (5, 15 or 40), and dust crafts any stamp you are missing (${COST.common} / ${COST.rare} / ${COST.epic}).`;
