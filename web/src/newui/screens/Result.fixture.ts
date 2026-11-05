// Sample results for captures of the Result screen. Local development only.
// Each state is an answer submit-round could give; the screen shows it as it is.
import { createElement } from "react";
import type { RoundResult, RoundStart } from "../../views/Play";
import type { ScreenFixture } from "./contract";

const P = { every: 3000, win: 3, pt: 1.5, pen: 8, hint: false, xm: 1.5, fee: 0, gl: 250, gr: 130, total: 100, pay: 1.8, ghost: null, boosters: [], level: "medium" } as unknown as RoundStart["params"];
const R: RoundResult = {
  score: 412, daubs: 17, wrong: 1, late: 1, lines: 2, maxMult: 4, accuracy: 0.89, avgReactionMs: 1640, win: false, prize: 12, xp: 38, ghost: null, best: 468,
  balance: 12450, level: 12, achievements: [], mode: "solo", roundId: "00000000-0000-4000-8000-0000000000aa", missed: 1, maxStreak: 9,
};
const pack = (name: string, rarity: "common" | "rare" | "epic", is_new: boolean) => ({ stamp_id: name, name, rarity, world: 1, is_new, dust: is_new ? 0 : 5 });

const STATES: Record<string, { r?: Partial<RoundResult>; p?: Partial<RoundStart["params"]> }> = {
  best: { r: { win: true, score: 520, best: 468, achievements: ["perfect"] } },
  plain: {},
  ghostwin: { r: { mode: "ghost", ghost: 380, win: true, prize: 18 } },
  ghostlose: { r: { mode: "ghost", ghost: 455, late: 4, wrong: 2, accuracy: 0.71 } },
  stage0: { r: { mode: "stage", score: 180, stage: { stage: "w1s3", stage_name: "World 1 · Stage 3", stars: 0, best_stars: 0, new_stars: 0, coins: 0, packs: [], world: 1, world_cleared: false, total_stars: 7 } }, p: { goals: [220, 320, 420], label: "World 1 · Stage 3" } },
  stage3: { r: { mode: "stage", score: 460, stage: { stage: "w1s9", stage_name: "World 1 · Stage 9", stars: 3, best_stars: 3, new_stars: 2, coins: 60, packs: [pack("Golden Daub", "epic", true), pack("Lucky Seven", "common", false)], world: 1, world_cleared: true, total_stars: 27 } }, p: { goals: [220, 320, 420] } },
  daily: { r: { mode: "daily", daily: { day: "2026-11-05", tier: 3, coins: 40, pack: pack("Morning Star", "rare", true), shield_earned: true, rank: 14, done: 230 } } },
  duel: { r: { mode: "duel", duel: { creator: "Sample friend", creator_score: 390, score: 412, win: true, tie: false } } },
  pvpwait: { r: { mode: "pvp", matchId: "m-wait" } },
  pvp: { r: { mode: "pvp", matchId: "m-done" } },
  tour: { r: { mode: "tour", eventId: "e1" } },
  drill: { r: { mode: "drill", drill: { ok: true, first_today: true, coins: 15, skill: "speed" } }, p: { label: "Fast Calls" } },
  boost: { r: { boost: { xp: 2, coins: 2 }, achievements: ["first", "perfect"] } },
  guest: {},
  ad: {},
  none: {},
};

export const fixture: ScreenFixture = (base, state) => {
  const s = state ?? "best";
  const pick = STATES[s] ?? STATES.best;
  const r = { ...R, ...pick.r };
  const p = { ...P, ...pick.p };
  return {
    ...base,
    profile: base.profile && (s === "guest" ? { ...base.profile, guest: true, played: 4, level: 3 } : base.profile),
    wallet: s === "guest" ? { ...base.wallet, coins: 180 } : base.wallet,
    rounds: {
      ...base.rounds,
      result: s === "none" ? null : { r, p },
      replay: r.mode === "duel" || r.mode === "daily" ? null : () => undefined,
      achievementNames: { first: "First win", perfect: "Perfect round (no misses, no wrong taps)" },
    },
    dna: { ...base.dna, dna: null },
    match: { ...base.match, result: async () => (s === "pvpwait" ? { status: "waiting", opponent: "Sample rival" } : { status: "settled", result: "win", my_score: 412, opp_score: 380, opponent: "Sample rival", prize: 36 }) },
    // where the reward ad sits; the real one is App's RewardAd
    platform: s === "ad" ? { ...base.platform, rewardAd: () => createElement("div", { className: "nu-card nu-card-white", role: "note" }, "Reward ad (sample): watch a short video for +20 coins") } : base.platform,
  };
};
