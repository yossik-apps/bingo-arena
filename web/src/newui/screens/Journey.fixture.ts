// Sample data for the Journey's captures, one state per name. Local development only.
import type { Reward, SeasonInfo, ShopItem, Stage, World } from "../../lib/supabase";
import type { ScreenCtx, ScreenFixture } from "./contract";
import type { JourneyData, Progress } from "./Journey.logic";

const WORLDS: World[] = [
  { id: 1, name: "Sample Street", blurb: "Sample blurb: slow calls and friendly boards to learn the ropes.", stars_needed: 0, reward_item: null, reward_coins: 0 },
  { id: 2, name: "Sample Harbour", blurb: "Sample blurb: a little faster, with a few twists.", stars_needed: 12, reward_item: null, reward_coins: 0 },
  { id: 3, name: "Sample Summit With A Very Long World Name", blurb: "Sample blurb: the fastest boards of all.", stars_needed: 40, reward_item: null, reward_coins: 0 },
];
const LEVELS = ["beginner", "beginner", "medium", "medium", "medium", "hard", "hard", "hard"];
const STAGES: Stage[] = WORLDS.flatMap((w) => LEVELS.map((level, i) => ({
  id: `w${w.id}s${i + 1}`, world: w.id, idx: i + 1, name: i === 4 ? "Sample Stage With A Long Name" : `Sample stage ${i + 1}`, level,
  mods: i % 3 === 2 ? { label: "Double points on G" } : {}, s1: 100 + i * 20, s2: 180 + i * 25, s3: 260 + i * 30, reward_coins: 20 + w.id * 10,
})));

const prog = (stars: Record<string, number>): Progress =>
  Object.fromEntries(Object.entries(stars).map(([id, n]) => [id, { stars: n, best_score: n === 3 ? 400 : n === 2 ? 230 : n === 1 ? 150 : 40, attempts: n + 1 }]));
// a mid-game player: world 1 done but for two stages, world 2 started
const PLAYER = prog({ w1s1: 3, w1s2: 3, w1s3: 2, w1s4: 3, w1s5: 1, w1s6: 2, w2s1: 2, w2s2: 1 });
const ALL = prog(Object.fromEntries(STAGES.map((s) => [s.id, 3])));

const with_ = (base: ScreenCtx, load: () => Promise<JourneyData>): ScreenCtx => ({ ...base, journey: { load } });
const data = (progress: Progress) => async () => ({ worlds: WORLDS, stages: STAGES, progress });


// ---- the Season track tab (open it with --click "Season") ----
const DAY = 864e5;
const at = (days: number) => new Date(Date.now() + days * DAY).toISOString();
const ITEMS = [{ id: "fr_sample", name: "Sample Frame With A Very Long Name" }, { id: "th_sample", name: "Sample theme" }] as ShopItem[];
const reward = (i: number): Reward => (i % 10 === 9 ? { item: "fr_sample" } : i % 5 === 4 ? { pack: 1 } : i % 7 === 6 ? { booster: { key: "hint", qty: 2 } } : { coins: 20 + i * 5 });
const premium = (i: number): Reward => (i % 6 === 5 ? { item: i === 29 ? "th_sample" : "fr_sample" } : i % 4 === 3 ? { pack: 2 } : { coins: 60 + i * 10 });
const SEASON: SeasonInfo = {
  active: true, id: 1, name: "Sample Season", blurb: "Sample blurb: thirty tiers of rewards while the season runs.", starts_at: at(-25), ends_at: at(17), over: false,
  xp_per_tier: 100, pass_price: 900, xp: 1240, tier: 12, pass: false,
  tiers: Array.from({ length: 30 }, (_, i) => ({ tier: i + 1, free: reward(i), premium: premium(i), free_claimed: i < 9, premium_claimed: false })),
};
const passOn = (s: SeasonInfo): SeasonInfo => ({ ...s, pass: true, tiers: s.tiers!.map((t) => ({ ...t, premium_claimed: t.tier <= 4 })) });
const seasonWith = (base: ScreenCtx, load: () => Promise<SeasonInfo>, coins?: number): ScreenCtx => ({
  ...base, wallet: { ...base.wallet, items: ITEMS, coins: coins ?? base.wallet.coins },
  season: { load, buyPass: async () => undefined, claimTier: async () => undefined },
});
const seasonState = (base: ScreenCtx, state: string | null): ScreenCtx | null => {
  switch (state) {
    case "season-pass": return seasonWith(base, async () => passOn(SEASON));
    case "season-short": return seasonWith(base, async () => SEASON, 340);
    case "season-over": return seasonWith(base, async () => ({ ...passOn(SEASON), over: true, ends_at: at(-1) }));
    case "season-top": return seasonWith(base, async () => ({ ...SEASON, xp: 3240, tier: 30 }));
    case "season-new": return seasonWith(base, async () => ({ ...SEASON, xp: 40, tier: 0, tiers: SEASON.tiers!.map((t) => ({ ...t, free_claimed: false })) }));
    case "season-none": return seasonWith(base, async () => ({ active: false, next: { name: "Sample Season 2", starts_at: at(4) } }));
    case "season-soon": return seasonWith(base, async () => ({ active: false, next: null }));
    case "season-loading": return seasonWith(base, () => new Promise(() => undefined));
    case "season-error": return seasonWith(base, async () => { throw new Error("offline"); });
    case "season-buyfail": return { ...seasonWith(base, async () => SEASON), season: { load: async () => SEASON, buyPass: async () => { throw new Error("Sample server error: the pass could not be bought."); }, claimTier: async () => { throw new Error("Sample server error: that reward could not be claimed."); } } };
    default: return state?.startsWith("season") ? seasonWith(base, async () => SEASON) : null;
  }
};

export const fixture: ScreenFixture = (base, state) => {
  // a visitor sees the season teaser; the worlds load as Classic shows them to visitors
  if (!base.profile) return with_(base, data({}));
  const season = seasonState(base, state);
  if (season) return with_(season, data(PLAYER));
  switch (state) {
    case "new": return with_(base, data({}));
    case "done": return with_(base, data(ALL));
    case "loading": return with_(base, () => new Promise(() => undefined));
    case "error": return with_(base, async () => { throw new Error("offline"); });
    default: return with_(seasonWith(base, async () => SEASON), data(PLAYER));
  }
};
