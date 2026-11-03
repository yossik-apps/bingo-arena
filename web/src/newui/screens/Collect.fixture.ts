// Sample data for Collect's captures, one state per name. Local development only.
import type { ScreenCtx, ScreenFixture } from "./contract";
import type { QuestsData } from "./Collect.logic";

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

const with_ = (base: ScreenCtx, load: () => Promise<QuestsData>) =>
  ({ ...base, quests: { load, claim: async (id: string) => ({ reward: MISSIONS.find((m) => m.id === id)?.reward ?? 0 }) } }) as ScreenCtx;

export const fixture: ScreenFixture = (base, state) => {
  switch (state) {
    case "new": return with_(base, async () => ({ ...PLAYER, counters: {}, claimed: [], earned: [] }));
    case "done": return with_(base, async () => ({ ...PLAYER, counters: { rounds: 3, best: 250, wins: 2 }, claimed: ["m1", "m2", "m3"], earned: BADGES.map((b) => b.id) }));
    case "empty": return with_(base, async () => ({ missions: [], counters: {}, claimed: [], badges: [], earned: [] }));
    case "loading": return with_(base, () => new Promise(() => undefined));
    case "error": return with_(base, async () => { throw new Error("offline"); });
    default: return with_(base, async () => PLAYER);
  }
};
