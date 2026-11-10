// Sample rounds for captures of Play, Classic and New. Local development only.
// A round's look depends on time and taps, so each state also has a moment: the screenshot tool controls the page clock,
// taps the called numbers at the right times, and takes the picture at `at` ms into the round.
import { makeBoard, type Tap } from "../../../../supabase/functions/_shared/engine.ts";
import type { RoundStart } from "../../views/Play";
import type { ScreenFixture, ScreenMoment } from "./contract";

const EVERY = 3000; // Medium
const V2_CALLS = 0.4;
const TOTAL = 100;

/** Correct taps on every called number that is on the card, 600 ms after it is called, up to `until` ms. */
const tapsUntil = (seed: number, until: number, calls?: number): Tap[] => {
  const { card, seq } = makeBoard(seed, calls);
  const taps: Tap[] = [];
  for (let k = 0; k * EVERY + 600 < until; k++) {
    const i = card.indexOf(seq[k]);
    if (i >= 0 && i !== 12) taps.push({ i, t: k * EVERY + 600 });
  }
  return taps;
};
// a board that gives a combo early: at least 5 of the first 13 numbers are on the card
const SEED = Array.from({ length: 500 }, (_, s) => s + 1).find((s) => tapsUntil(s, 40_000).length >= 5) ?? 1;

export const moments: Record<string, ScreenMoment> = {
  practice: { at: 40_000, taps: tapsUntil(SEED, 40_000) },
  // balance v2 (reports/balance-spec.md): biased calls and the speed bonus; every tap here is 600 ms after its call, so each earns the top bonus
  v2: { at: 40_000, taps: tapsUntil(SEED, 40_000, V2_CALLS) },
  ghost: { at: 30_000, taps: tapsUntil(SEED, 30_000) },
  countdown: { at: -2000 },
  live: { at: 30_000, taps: tapsUntil(SEED, 30_000) },
  last: { at: TOTAL * 1000 - 4000, taps: tapsUntil(SEED, TOTAL * 1000 - 4000) },
  scoring: { at: TOTAL * 1000 + 400, taps: tapsUntil(SEED, TOTAL * 1000) },
  leave: { at: 20_000, taps: tapsUntil(SEED, 20_000), click: "Leave round" },
  free: { at: 20_000, taps: tapsUntil(SEED, 20_000) },
};

/** More states, without a moment (the picture is taken as soon as the round draws): a Journey stage with star goals, Beginner with the hint booster, and no round at all. */
const EXTRA = ["stage", "beginner", "none"];

export const fixture: ScreenFixture = (base, state) => {
  const s = state && (state in moments || EXTRA.includes(state)) ? state : "practice";
  if (s === "none") return { ...base, rounds: { ...base.rounds, active: null } };
  const lv = base.rounds.cfg!.levels.medium;
  const params: RoundStart["params"] = { ...lv, total: TOTAL, pay: 1.8, ghost: null, level: "medium", boosters: [] };
  const round: RoundStart = { roundId: "00000000-0000-4000-8000-0000000000aa", seed: SEED, balance: base.wallet.coins, params };
  const live = { matchId: "00000000-0000-4000-8000-0000000000bb", opponent: "Sample rival" };
  const active: RoundStart =
    s === "ghost" ? { ...round, params: { ...params, ghost: 260 } }
    : s === "countdown" ? { ...round, ...live, startAt: Date.now() + 3000 }
    : s === "live" ? { ...round, ...live, startAt: Date.now() }
    : s === "v2" ? { ...round, params: { ...params, cv: 2, calls: V2_CALLS, bonus: 5, xpDiv: 1.7, ghost: 260 } }
    : s === "free" ? { ...round, roundId: "", balance: 0, local: true }
    : s === "stage" ? { ...round, params: { ...params, fee: 0, goals: [120, 220, 320], label: "World 1 · Stage 3" } }
    : s === "beginner" ? { ...round, params: { ...base.rounds.cfg!.levels.beginner, total: TOTAL, pay: 1.8, ghost: null, level: "beginner", boosters: ["hint"], hint: true } }
    : round;
  const rounds = {
    ...base.rounds, active,
    // scoring: the server never answers, so "Scoring your round…" stays on screen
    submit: s === "scoring" ? () => new Promise<never>(() => undefined) : base.rounds.submit,
  };
  if (s !== "free") return { ...base, rounds };
  return {
    ...base, rounds, profile: null,
    wallet: { ...base.wallet, coins: 0, gems: null, boosters: {} },
    visitor: { starting: false, playFree: () => undefined, logIn: () => undefined, askSignUp: () => undefined, welcome: 50, freeRounds: true },
  };
};
