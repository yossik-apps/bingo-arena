import type { Reward, ShopItem } from "./supabase";

const BOOSTER: Record<string, string> = { slow: "Slow motion", win: "Extra window", time: "Extra time", hint: "Hint glow" };

/** A reward in plain words: "+23 coins", "2 stamp packs", "Neon Nights ring", "2x Extra time". */
export function rewardText(r: Reward, items: ShopItem[] = []): string {
  if (r.coins) return `+${r.coins} coins`;
  if (r.pack) return `${r.pack} stamp pack${r.pack > 1 ? "s" : ""}`;
  if (r.item) return items.find((i) => i.id === r.item)?.name ?? "Exclusive item";
  if (r.booster) return `${r.booster.qty}x ${BOOSTER[r.booster.key] ?? r.booster.key}`;
  return "–";
}

/** Admin shorthand: coins:50  pack:1  item:fr_neonnights  booster:time:2 */
export function parseReward(t: string): Reward | null {
  const [k, a, b] = t.trim().split(":");
  if (k === "coins" && Number(a) > 0) return { coins: Math.floor(Number(a)) };
  if (k === "pack" && Number(a) > 0) return { pack: Math.floor(Number(a)) };
  if (k === "item" && a) return { item: a };
  if (k === "booster" && a && Number(b) > 0) return { booster: { key: a, qty: Math.floor(Number(b)) } };
  return null;
}
export const rewardShort = (r: Reward) => (r.coins ? `coins:${r.coins}` : r.pack ? `pack:${r.pack}` : r.item ? `item:${r.item}` : r.booster ? `booster:${r.booster.key}:${r.booster.qty}` : "");
