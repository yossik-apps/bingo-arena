// Sample data for Compete's captures, one state per name. Local development only. Every name is a sample, never a real player.
import type { CrewHit, CrewInfo, LiveOp } from "../../lib/supabase";
import type { ScreenCtx, ScreenFixture } from "./contract";
import type { CompeteApi, CompeteTab, CrewBoardRow, Ev, EventRow, LeagueRow, NewPlayer, Race } from "./Compete.logic";

const ME = "00000000-0000-4000-8000-000000000001";
const at = (ms: number) => new Date(Date.now() + ms).toISOString();
const H = 36e5, D = 24 * H;
const done = async () => undefined;
const never = () => new Promise<never>(() => undefined);
const fail = async (): Promise<never> => { throw new Error("offline"); };

const EVENTS: Ev[] = [
  { id: "ev1", name: "Daily Cup", descr: "", level: "medium", fee: 20, attempts: 3, starts_at: at(-H), ends_at: at(9 * H), bonus: 0, split: [50, 30, 20], status: "live", auto: true },
  { id: "ev2", name: "Weekend Sample Showdown With A Long Name", descr: "Hard boards, bigger prizes.", level: "hard", fee: 40, attempts: 2, starts_at: at(-D), ends_at: at(3 * D), bonus: 0, split: [60, 25, 10, 5], status: "live" },
];
const EV_BOARD: EventRow[] = [
  { rank: 1, user_id: "s1", display_name: "SampleAce", best: 412, attempts: 3 },
  { rank: 2, user_id: ME, display_name: "devFixtureLongName20", best: 388, attempts: 1 },
  { rank: 3, user_id: "s3", display_name: "SampleWithAVeryLongPlayerName", best: 301, attempts: 2 },
];
const RACE: Race = { id: "r1", title: "Double XP race", descr: "", kind: "xp", mult: 2, ends_at: at(5 * H), prizes: [100, 50, 25], board: [
  { rank: 1, name: "SampleAce", points: 940, me: false }, { rank: 2, name: "SampleBee", points: 720, me: false }, { rank: 3, name: "SampleCat", points: 610, me: false },
  { rank: 4, name: "SampleDot", points: 500, me: false }, { rank: 5, name: "SampleElk", points: 480, me: false }, { rank: 9, name: "devFixtureLongName20", points: 210, me: true },
] };
const LEAGUE: LeagueRow[] = Array.from({ length: 24 }, (_, i) => ({ rank: i + 1, user_id: i === 22 ? ME : `l${i}`, display_name: i === 22 ? "devFixtureLongName20" : i === 1 ? "SampleWithAVeryLongPlayerName" : `Sample${i + 1}`, points: 1200 - i * 45 }));
const CREW_BOARD: CrewBoardRow[] = [
  { rank: 1, crew_id: "c1", name: "Sample Dabbers", tag: "DAB", members: 14, points: 5400 }, { rank: 2, crew_id: "c2", name: "Sample Night Owls Club", tag: "OWL", members: 9, points: 3100 },
  { rank: 3, crew_id: "c3", name: "Sample Lucky", tag: "LKY", members: 3, points: 800 },
];
const HITS: CrewHit[] = [{ id: "c2", name: "Sample Night Owls Club", tag: "OWL", descr: "Evening players, friendly and calm.", members: 9, points: 3100 }, { id: "c3", name: "Sample Lucky", tag: "LKY", descr: "", members: 3, points: 800 }];
const CREW: CrewInfo = {
  id: "c1", name: "Sample Dabbers", tag: "DAB", descr: "We play every evening.", open: true, invite_code: "DAB4K2", week_points: 450, size: 4, goal: 600, tier1: 300, my_points: 320, claimed: [], rank: 1, is_leader: true, min_members: 3, min_points: 50,
  members: [
    { user_id: ME, name: "devFixtureLongName20", role: "leader", points: 320 }, { user_id: "m2", name: "SampleWithAVeryLongPlayerName", role: "member", points: 510 },
    { user_id: "m3", name: "SampleCat", role: "member", points: 260 }, { user_id: "m4", name: "SampleDot", role: "member", points: 160 },
  ],
} as unknown as CrewInfo;
const OPS: LiveOp[] = [
  { id: "o1", kind: "xp_boost", title: "Happy Hour: double XP", descr: "", starts_at: at(-H / 6), ends_at: at(H), mult: 2, pct: 0, active: true },
  { id: "o2", kind: "fee_discount", title: "Cheaper Ghost weekend", descr: "Half-price Beat the Ghost for two days.", starts_at: at(2 * D), ends_at: at(4 * D), mult: 1, pct: 50, active: true },
  { id: "o3", kind: "coin_boost", title: "Coin rush", descr: "", starts_at: at(6 * H), ends_at: at(8 * H), mult: 2, pct: 0, active: true },
];
const NEW: NewPlayer[] = [
  { user_id: "n1", name: "SampleNewbie", level: 2, joined_at: at(-H), is_me: false, waved: false },
  { user_id: "n2", name: "SampleWithAVeryLongPlayerName", level: 1, joined_at: at(-D - H), is_me: false, waved: true },
  { user_id: "n3", name: "SampleFresh", level: 3, joined_at: at(-4 * D), is_me: false, waved: false },
];

const api = (over: Partial<CompeteApi> = {}): CompeteApi => ({
  events: async () => EVENTS, live_races: async () => [RACE], attempts_used: async (id) => (id === "ev2" ? 2 : 1), event_leaderboard: async () => EV_BOARD,
  league_info: async () => ({ players: 24, prizes: [500, 300, 200, 100, 50], auto: true }), league_board: async () => LEAGUE,
  league_payouts: async () => ({ week: "2026-10-26", prizes: [500, 300, 200], winners: [{ rank: 1, name: "SampleAce", points: 1400, prize: 500 }, { rank: 2, name: "SampleBee", points: 1210, prize: 300 }, { rank: 3, name: "SampleCat", points: 990, prize: 200 }] }),
  crew_info: async () => CREW, crew_board: async () => CREW_BOARD, search_crews: async () => HITS,
  join_crew: done, create_crew: done, claim_crew_chest: done, leave_crew: done, update_crew: done, kick_crew_member: done,
  liveops: async () => OPS, new_players: async () => NEW, wave_hello: done,
  ...over,
});
const EMPTY = api({
  events: async () => [], live_races: async () => [], league_info: async () => null, league_board: async () => [], league_payouts: async () => null,
  crew_info: async () => null, crew_board: async () => [], search_crews: async () => [], liveops: async () => [], new_players: async () => [],
});
const ALL_FAIL = api({ events: fail, league_board: fail, crew_info: fail, liveops: fail, new_players: fail });
const LOADING = api({ events: never, league_board: never, crew_info: never, liveops: never, new_players: never });

const TAB_STATES: CompeteTab[] = ["events", "league", "crew", "calendar", "new"];

/** States: a tab name opens that tab (events, league, crew, calendar, new). Also: empty, loading, error, nocrew, member, poor, banned, maintenance, visitor. Combine with "-": crew-empty. */
export const fixture: ScreenFixture = (base, state) => {
  const parts = (state ?? "").split("-");
  const tab = TAB_STATES.find((t) => parts.includes(t)) ?? "events";
  const has = (s: string) => parts.includes(s);
  const g = (over: object) => ({ ...base.rounds.cfg!, g: { ...base.rounds.cfg!.g, ...over } });
  let calls = api();
  if (has("empty")) calls = EMPTY;
  if (has("error")) calls = ALL_FAIL;
  if (has("loading")) calls = LOADING;
  if (has("nocrew")) calls = { ...calls, crew_info: async () => null };
  if (has("member")) calls = { ...calls, crew_info: async () => ({ ...CREW, is_leader: false, size: 2, claimed: [1], members: CREW.members.slice(0, 2).map((m, i) => ({ ...m, role: i === 1 ? "leader" : "member" })) }) as CrewInfo };
  let ctx: ScreenCtx = { ...base, navigation: { ...base.navigation, competeTab: tab }, social: { ...base.social, newIds: new Set(["s3", "n1", "m3", "l1"]) } };
  if (has("poor")) ctx = { ...ctx, wallet: { ...ctx.wallet, coins: 5 } };
  if (has("banned")) ctx = { ...ctx, profile: ctx.profile && { ...ctx.profile, banned: true } };
  if (has("maintenance")) ctx = { ...ctx, rounds: { ...ctx.rounds, cfg: g({ maint: true }) } };
  if (has("visitor")) ctx = { ...ctx, profile: null, visitor: { starting: false, playFree: () => undefined, askSignUp: () => undefined, welcome: 50, freeRounds: true } };
  return { ...ctx, compete: calls } as ScreenCtx;
};
