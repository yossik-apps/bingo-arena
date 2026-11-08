// Local development only: sample data for captures, so they need no account. App.tsx uses this behind import.meta.env.DEV.
import { createElement } from "react";
import { DEFAULT_EQUIPPED, type GameCfg } from "../../lib/supabase";
import type { AdStatus } from "../../lib/ads";
import RewardAd from "../RewardAd";
import type { ScreenCtx, ScreenName } from "./contract";
import { sampleData, visitorData } from "./dataFixture";

const none = () => undefined;
const cfg = {
  levels: {
    beginner: { every: 4000, win: 4, pt: 1, pen: 5, hint: false, xm: 1, fee: 10, gl: 150, gr: 100 },
    medium: { every: 3000, win: 3, pt: 1.5, pen: 8, hint: false, xm: 1.5, fee: 20, gl: 250, gr: 130 },
    hard: { every: 2200, win: 2, pt: 2, pen: 15, hint: false, xm: 2, fee: 40, gl: 380, gr: 200 },
  },
  g: { pay: 1.8, pvp: true, note: "", paid: true, rake: 0.1, login: 10, maint: false, total: 100, welcome: 50, calendar: [20, 30, 40, 50, 75, 100, 200] },
} as unknown as GameCfg;

/** A finished solo round at Beginner, for the result screen: a win (for solo, a new personal best), one achievement (lines3, from ach_defs), 36 XP that stays inside level 12. */
/** Ads on, with three reward videos left today. Captures never tap the button, so no ad script loads. */
const SAMPLE_ADS: AdStatus = { enabled: true, client: "ca-pub-sample", test_mode: true, reward_coins: 25, left_today: 3, interstitial: false, every_n_rounds: 0, club: false };

const sampleResult = (visitor: boolean): NonNullable<ScreenCtx["rounds"]["result"]> => ({
  r: {
    score: 412, daubs: 18, wrong: 1, late: 2, lines: 3, maxMult: 3, accuracy: 0.86, avgReactionMs: 910, win: true, prize: 18, xp: 36, ghost: null, best: 412,
    balance: visitor ? 0 : 12450, level: 12, achievements: ["lines3"], mode: "solo", missed: 3, maxStreak: 7,
  },
  p: { ...cfg.levels.beginner, total: cfg.g.total, pay: cfg.g.pay, ghost: null } as NonNullable<ScreenCtx["rounds"]["result"]>["p"],
  xpBefore: visitor ? null : { xp: 4964, level: 12 },
});

/** The sample player. `screen` and `go` come from App so navigation works. On the result screen, rounds.result holds a sample round. */
export function baseFixture(kind: string, screen: ScreenName, go: (s: ScreenName) => void, openCalendar: () => void): ScreenCtx {
  const visitor = kind === "visitor";
  return {
    profile: visitor ? null : {
      id: "00000000-0000-4000-8000-000000000001", name: "devFixtureLongName20", level: 12, xp: 5000, xpPct: 64, xpText: "310 / 440 XP", xpLeft: 130, title: "Sharp Dabber", equipped: DEFAULT_EQUIPPED,
      streak: 14, shields: 1, dailyDone: 9, played: 120, banned: false, isAdmin: kind === "admin", guest: kind === "guest", saveLabel: "Save", save: none, logOut: none,
    },
    wallet: { coins: visitor ? 0 : 12450, gems: visitor ? null : 128, economy: null, items: [], owned: new Set(), boosters: visitor ? {} : { hint: 2, slow: 1 }, refresh: async () => undefined, openWallet: () => go("wallet"), openStore: () => go("shop") },
    rounds: { cfg, ops: [], error: "", dailyKey: 0, challenge: null, acceptChallenge: none, dismissChallenge: none, start: none, startStage: none, startDaily: none, startDrill: none, startEvent: none, active: null, result: screen === "result" ? sampleResult(visitor) : null, finish: none, fail: none, leave: none, submit: async () => { throw new Error("Sample data: nothing is sent to the server"); }, abandon: async () => undefined, replay: null, afterRound: (f) => f(), achievementNames: { lines3: "3 lines in one round" } },
    navigation: { screen, go, competeTab: "events", setCompeteTab: none },
    notices: { unread: visitor ? 0 : 12, adminUnread: kind === "admin" ? 3 : 0, toast: "", showToast: none, refreshInbox: none, contactUs: none, composing: false },
    social: { arena: null, newCount: 0, newIds: new Set(), invite: true, facebook: "https://www.facebook.com/" },
    daily: { cal: visitor ? null : { rewards: [20, 30, 40, 50, 75, 100, 200], day: 4, claimed_today: kind !== "unclaimed", streak: 14, next: 75, shields: 1 }, openCalendar, drillDone: false, loadChallenge: async () => null, loadLeaderboard: async () => [] },
    dna: { dna: null, rounds: [], coach: "Coach Nova" },
    settings: { settings: { pulse: 45, limit: 0, tips: true, bigText: false, coach: "Coach Nova" }, update: none, minutesToday: 0, replayTour: none },
    // a visitor gets no reward video, as in App
    platform: visitor ? { crazyGames: false, ads: null, rewardAd: () => null } : { crazyGames: false, ads: SAMPLE_ADS, rewardAd: (placement, compact) => createElement(RewardAd, { ads: SAMPLE_ADS, placement, onDone: none, compact }) },
    // on the result screen a visitor has a free round's result, as in App
    visitor: visitor ? { starting: false, playFree: none, logIn: none, askSignUp: none, welcome: 50, freeRounds: true, freeResult: screen === "result" ? { level: "beginner", left: 2, again: none, join: none, back: none } : null } : null,
    // every data group, answered from sample data; a visitor gets what Classic gives a visitor (see dataFixture.ts)
    ...(visitor ? visitorData() : sampleData()),
  };
}
