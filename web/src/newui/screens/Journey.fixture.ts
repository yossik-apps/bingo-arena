// Sample data for the Journey's captures, one state per name. Local development only.
import type { Stage, World } from "../../lib/supabase";
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

const with_ = (base: ScreenCtx, load: () => Promise<JourneyData>) => ({ ...base, journey: { load } }) as ScreenCtx;
const data = (progress: Progress) => async () => ({ worlds: WORLDS, stages: STAGES, progress });

export const fixture: ScreenFixture = (base, state) => {
  if (!base.profile) return with_(base, data({}));
  switch (state) {
    case "new": return with_(base, data({}));
    case "done": return with_(base, data(ALL));
    case "loading": return with_(base, () => new Promise(() => undefined));
    case "error": return with_(base, async () => { throw new Error("offline"); });
    default: return with_(base, data(PLAYER));
  }
};
