// Sample data for the Lobby's captures, one state per name. Local development only.
import type { DailyInfo, LiveOp } from "../../lib/supabase";
import type { ScreenFixture } from "./contract";

const HAPPY: LiveOp = { id: "fixture-op", kind: "xp_boost", title: "Happy Hour: double XP", descr: "", starts_at: new Date(Date.now() - 600000).toISOString(), ends_at: new Date(Date.now() + 3780000).toISOString(), mult: 2, pct: 0, active: true };
const DAILY = { day: "2026-11-02", level: "medium", label: "", goals: [120, 220, 320], played: null, rank: null, shields: 1, done: 9 } as unknown as DailyInfo;
const ROWS = [{ rank: 1, user_id: "a", display_name: "SampleAce", score: 410 }, { rank: 2, user_id: "b", display_name: "SampleLongPlayerName", score: 355 }];
const on = <T,>(v: T) => async () => v;

export const fixture: ScreenFixture = (base, state) => {
  const ctx = { ...base, rounds: { ...base.rounds, ops: [HAPPY] }, daily: { ...base.daily, loadChallenge: on<DailyInfo | null>(DAILY), loadLeaderboard: on(ROWS) }, social: { ...base.social, newCount: 3 } };
  const g = (over: object) => ({ ...base.rounds.cfg!, g: { ...base.rounds.cfg!.g, ...over } });
  switch (state) {
    case "new": return { ...ctx, profile: base.profile && { ...base.profile, played: 0 } };
    case "empty": return { ...base, wallet: { ...base.wallet, boosters: {} }, daily: { ...base.daily, cal: null }, social: { ...base.social, newCount: 0, invite: false } };
    case "loading": return { ...ctx, rounds: { ...ctx.rounds, cfg: null } };
    case "error": return { ...ctx, rounds: { ...ctx.rounds, error: "You reached your daily time limit of 30 minutes, so new rounds are paused until tomorrow. You can change this in your profile." } };
    case "poor": return { ...ctx, wallet: { ...ctx.wallet, coins: 3 } };
    case "banned": return { ...ctx, profile: base.profile && { ...base.profile, banned: true } };
    case "maintenance": return { ...ctx, rounds: { ...ctx.rounds, cfg: g({ maint: true, note: "We are updating the game. Back soon." }) } };
    case "challenge": return { ...ctx, rounds: { ...ctx.rounds, challenge: { code: "sample123", creator: "SampleFriend", level: "medium", score: 240, expired: false, mine: false, plays: 0, played: false, my_score: null } } };
    case "played": return { ...ctx, daily: { ...ctx.daily, loadChallenge: on<DailyInfo | null>({ ...DAILY, played: { status: "scored", score: 250 }, rank: 4 } as unknown as DailyInfo) } };
    case "guestnew": return { ...ctx, profile: base.profile && { ...base.profile, guest: true, played: 0 } };
    case "noboard": return { ...ctx, daily: { ...ctx.daily, loadChallenge: on<DailyInfo | null>({ ...DAILY, done: 0 } as unknown as DailyInfo), loadLeaderboard: on([]) } };
    case "guest": return { ...ctx, profile: base.profile && { ...base.profile, guest: true, played: 4 } };
    default: return ctx;
  }
};
