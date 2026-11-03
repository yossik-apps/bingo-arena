// Sample data for Collect's captures, one state per name. Local development only.
import type { ShopItem, World } from "../../lib/supabase";
import type { ScreenCtx, ScreenFixture } from "./contract";
import type { QuestsData } from "./Collect.logic";
import type { AlbumData, Rarity, Stamp } from "./Album.logic";

const MISSIONS = [
  { id: "m1", label: "Play 3 rounds", counter: "rounds", goal: 3, reward: 30 },
  { id: "m2", label: "Score 250 points in one round on any level of your choice", counter: "best", goal: 250, reward: 50 },
  { id: "m3", label: "Win 2 contests", counter: "wins", goal: 2, reward: 40 },
];
const BADGES = [
  { id: "a1", label: "First bingo" }, { id: "a2", label: "Full house" }, { id: "a3", label: "Speed demon" },
  { id: "a4", label: "Sample badge with a very long name" }, { id: "a5", label: "Ghost buster" }, { id: "a6", label: "Week streak" },
];
const PLAYER: QuestsData = { missions: MISSIONS, counters: { rounds: 3, best: 180, wins: 2 }, claimed: ["m3"], badges: BADGES, earned: ["a1", "a3", "a5"] };

// ---- album: three worlds of nine stamps ----
const WORLDS: World[] = [
  { id: 1, name: "Sample Street", blurb: "", stars_needed: 0, reward_item: "fx-board", reward_coins: 200 },
  { id: 2, name: "Sample Harbour", blurb: "", stars_needed: 12, reward_item: null, reward_coins: 300 },
  { id: 3, name: "Sample Summit", blurb: "", stars_needed: 40, reward_item: null, reward_coins: 500 },
];
const RARITY: Rarity[] = ["common", "common", "common", "common", "common", "rare", "rare", "rare", "epic"];
const STAMPS: Stamp[] = WORLDS.flatMap((w) => RARITY.map((rarity, i) => ({
  id: `w${w.id}t${i + 1}`, world: w.id, rarity, sort: w.id * 10 + i, name: i === 4 ? "Sample Stamp With A Very Long Name" : `Sample ${["Ace", "Bell", "Card", "Dot", "Echo", "Fox", "Gem", "Halo", "Ivy"][i]}`,
})));
const ITEMS = [{ id: "fx-board", name: "Sample Street board", slot: "board" }] as unknown as ShopItem[];
const own = (ids: string[], dup: Record<string, number> = {}) => Object.fromEntries(ids.map((id) => [id, dup[id] ?? 1]));
// world 1 complete and ready to claim, world 2 half done with duplicates, world 3 empty
const W1 = STAMPS.filter((s) => s.world === 1).map((s) => s.id);
const ALBUM: AlbumData = {
  worlds: WORLDS, stamps: STAMPS, claimed: [],
  owned: own([...W1, "w2t1", "w2t2", "w2t3", "w2t6"], { w1t1: 3, w2t2: 2 }),
  collect: { dust: 95, packs_since_epic: 6, packs_opened: 14 },
};

const with_ = (base: ScreenCtx, load: () => Promise<QuestsData>, album: () => Promise<AlbumData>): ScreenCtx => ({
  ...base,
  wallet: { ...base.wallet, items: ITEMS },
  quests: { load, claim: async (id: string) => ({ reward: MISSIONS.find((m) => m.id === id)?.reward ?? 0 }) },
  album: { load: album, craft: async () => undefined, claim: async (w: number) => ({ coins: WORLDS.find((x) => x.id === w)?.reward_coins ?? 0, item: WORLDS.find((x) => x.id === w)?.reward_item ?? null }) },
});
const never = () => new Promise<never>(() => undefined);
const fail = async (): Promise<never> => { throw new Error("offline"); };

export const fixture: ScreenFixture = (base, state) => {
  switch (state) {
    case "new": return with_(base, async () => ({ ...PLAYER, counters: {}, claimed: [], earned: [] }), async () => ({ ...ALBUM, owned: {}, collect: { dust: 0, packs_since_epic: 0, packs_opened: 0 } }));
    case "done": return with_(base, async () => ({ ...PLAYER, counters: { rounds: 3, best: 250, wins: 2 }, claimed: ["m1", "m2", "m3"], earned: BADGES.map((b) => b.id) }),
      async () => ({ ...ALBUM, owned: own(STAMPS.map((s) => s.id)), claimed: [1, 2, 3] }));
    case "empty": return with_(base, async () => ({ missions: [], counters: {}, claimed: [], badges: [], earned: [] }), async () => ({ ...ALBUM, worlds: [], stamps: [] }));
    case "loading": return with_(base, never, never);
    case "error": return with_(base, fail, fail);
    default: return with_(base, async () => PLAYER, async () => ALBUM);
  }
};
