// Local development only: sample answers for every data group in lib/screenData.ts, so captures need no account and send nothing.
// sampleData() is a player a few weeks in; emptyData() is a new player with nothing yet (most features have zero rows on live);
// visitorData() is someone with no account, following the visitor rules in lib/screenData.ts.
// A screen's fixture uses them like this:  { ...base, ...emptyData() }  or  { ...base, quests: emptyData().quests }.
// The names are placeholders ("Sample player 3"), never shown to players.
import type { CrewInfo, LiveOp, MasteryRow, SeasonInfo, Stage, World } from "../../lib/supabase";
import { NEED_ACCOUNT, type AlbumData, type Convo, type CrewBoardRow, type Ev, type EventRow, type JourneyData, type LeagueRow, type LedgerRow, type NewPlayer, type Note, type Payout, type QuestsData, type Race, type Referral, type ScreenData, type Stamp, type Thread } from "../../lib/screenData";
import type { Product } from "../../lib/store";

// Everything is built inside data(), so importing this file runs nothing and adds nothing to the production bundle.
function data(empty: boolean): ScreenData {
  const ME = "00000000-0000-4000-8000-000000000001";
  const DAY = 864e5;
  const iso = (ms: number) => new Date(Date.now() + ms).toISOString();
  const ok = async () => undefined;

  const WORLDS: World[] = [
    { id: 1, name: "Sunny Square", blurb: "Easy calls to warm up.", stars_needed: 0, reward_item: null, reward_coins: 150 },
    { id: 2, name: "Neon Boulevard", blurb: "Faster calls and tighter windows.", stars_needed: 12, reward_item: null, reward_coins: 300 },
    { id: 3, name: "Starlight Pier", blurb: "Hard calls for sharp eyes.", stars_needed: 30, reward_item: null, reward_coins: 500 },
  ];
  const STAGES: Stage[] = WORLDS.flatMap((w) => Array.from({ length: 6 }, (_, i) => ({
    id: `w${w.id}s${i + 1}`, world: w.id, idx: i + 1, name: `Stage ${i + 1}`, level: w.id === 1 ? "beginner" : w.id === 2 ? "medium" : "hard",
    mods: i === 5 ? { label: "Boss round" } : {}, s1: 200 + 60 * i, s2: 320 + 70 * i, s3: 450 + 80 * i, reward_coins: 20 + 5 * i,
  })));
  const RARITY = ["common", "common", "common", "common", "rare", "rare", "common", "rare", "epic"] as const;
  const STAMPS: Stamp[] = WORLDS.flatMap((w) => RARITY.map((rarity, i) => ({ id: `st${w.id}-${i + 1}`, world: w.id, name: `${w.name.split(" ")[0]} stamp ${i + 1}`, rarity, sort: w.id * 10 + i })));
  const player = (n: number) => `Sample player ${n}`;

  const journey = (empty: boolean): JourneyData => ({
    worlds: WORLDS, stages: STAGES,
    progress: empty ? {} : Object.fromEntries(STAGES.slice(0, 8).map((s, i) => [s.id, { stars: i < 5 ? 3 : i < 7 ? 2 : 1, best_score: s.s1 + 40 * i, attempts: 1 + (i % 3) }])),
  });
  const quests = (empty: boolean): QuestsData => ({
    missions: [
      { id: "play3", label: "Play 3 rounds", counter: "rounds", goal: 3, reward: 30 },
      { id: "lines2", label: "Make 2 lines", counter: "lines", goal: 2, reward: 40 },
      { id: "combo", label: "Reach a x3 combo", counter: "combo3", goal: 1, reward: 50 },
    ],
    counters: empty ? {} : { rounds: 3, lines: 1, combo3: 0 }, claimed: empty ? [] : [],
    badges: [{ id: "first_win", label: "First win" }, { id: "line5", label: "Five lines in a round" }, { id: "streak7", label: "Seven-day streak" }, { id: "ghost", label: "Beat the Ghost" }, { id: "daily", label: "Daily Challenge" }, { id: "crew", label: "Crew member" }],
    earned: empty ? [] : ["first_win", "streak7"],
  });
  const album = (empty: boolean): AlbumData => ({
    worlds: WORLDS, stamps: STAMPS,
    owned: empty ? {} : { "st1-1": 2, "st1-2": 1, "st1-3": 1, "st1-4": 3, "st1-5": 1, "st1-7": 1, "st2-1": 1, "st2-5": 1 },
    collect: empty ? { dust: 0, packs_since_epic: 0, packs_opened: 0 } : { dust: 75, packs_since_epic: 6, packs_opened: 9 },
    claimed: [],
  });
  const MASTERY: MasteryRow[] = [
    { level: "beginner", best: 640, tier: 3, name: "Gold", next_name: "Platinum", next_min: 700 },
    { level: "medium", best: 410, tier: 2, name: "Silver", next_name: "Gold", next_min: 500 },
    { level: "hard", best: 0, tier: 0, name: "Unranked", next_name: "Bronze", next_min: 200 },
  ];
  const EVENTS: Ev[] = [
    { id: "ev1", name: "Weekend Cup", descr: "Best score wins. Three attempts.", level: "medium", fee: 20, attempts: 3, starts_at: iso(-DAY), ends_at: iso(2 * DAY), bonus: 200, split: [50, 30, 20], status: "live" },
    { id: "ev2", name: "Night Sprint", descr: "One attempt, hard calls.", level: "hard", fee: 40, attempts: 1, starts_at: iso(-3 * 36e5), ends_at: iso(5 * 36e5), bonus: 0, split: [60, 40], status: "live", auto: true },
  ];
  const RACES: Race[] = [{ id: "r1", title: "Line Rush", descr: "Most lines this hour.", kind: "lines", mult: 1, ends_at: iso(40 * 6e4), prizes: [100, 50, 25], board: [1, 2, 3].map((n) => ({ rank: n, name: n === 2 ? "You" : player(n), points: 12 - n * 2, me: n === 2 })) }];
  const EVENT_ROWS: EventRow[] = [1, 2, 3, 4, 5].map((n) => ({ rank: n, user_id: n === 4 ? ME : `u${n}`, display_name: player(n), best: 900 - n * 60, attempts: 1 + (n % 3) }));
  const LEAGUE: LeagueRow[] = Array.from({ length: 10 }, (_, i) => ({ rank: i + 1, user_id: i === 6 ? ME : `u${i}`, display_name: player(i + 1), points: 4200 - i * 310 }));
  const PAYOUT: Payout = { week: iso(-7 * DAY).slice(0, 10), prizes: [500, 300, 200], winners: [1, 2, 3].map((n) => ({ rank: n, name: player(n + 10), points: 5000 - n * 400, prize: [500, 300, 200][n - 1] })) };
  const CREW: CrewInfo = {
    id: "c1", name: "Sample Crew", tag: "SMPL", descr: "Friendly daily players.", open: true, invite_code: "AB12CD",
    members: [{ user_id: ME, name: "You", role: "leader", points: 820 }, ...[2, 3, 4].map((n) => ({ user_id: `u${n}`, name: player(n), role: "member" as const, points: 600 - n * 80 }))],
    week_points: 1980, size: 4, goal: 5000, tier1: 2500, my_points: 820, claimed: [], rank: 7, is_leader: true, min_members: 3, min_points: 500,
  };
  const CREW_BOARD: CrewBoardRow[] = [1, 2, 3, 4, 5].map((n) => ({ rank: n, crew_id: n === 5 ? "c1" : `c${n + 1}`, name: n === 5 ? "Sample Crew" : `Sample crew ${n}`, tag: `SC${n}`, members: 20 - n * 2, points: 9000 - n * 1200 }));
  const LIVEOPS: LiveOp[] = [
    { id: "o1", kind: "xp_boost", title: "Double XP hour", descr: "Every round gives twice the XP.", starts_at: iso(-30 * 6e4), ends_at: iso(30 * 6e4), mult: 2, pct: 0, active: true },
    { id: "o2", kind: "coin_boost", title: "Coin rush", descr: "+50% coins from rounds.", starts_at: iso(DAY), ends_at: iso(DAY + 2 * 36e5), mult: 1.5, pct: 0, active: true },
    { id: "o3", kind: "fee_discount", title: "Cheaper entries", descr: "Event fees cut by a quarter.", starts_at: iso(3 * DAY), ends_at: iso(4 * DAY), mult: 1, pct: 25, active: true },
  ];
  const NEW_PLAYERS: NewPlayer[] = [1, 2, 3, 4].map((n) => ({ user_id: `n${n}`, name: player(n + 20), level: 1 + (n % 3), joined_at: iso(-n * 36e5), is_me: false, waved: n === 2 }));
  const PRODUCTS: Product[] = [
    { id: "starter", kind: "starter", name: "Starter pack", descr: "Coins, gems and a booster bundle.", price_cents: 199, coins: 2000, gems: 20, days: 0, one_time: true, badge: "Best value", active: true, sort: 1 },
    { id: "club", kind: "club", name: "Bingo Club", descr: "A daily gift for 30 days.", price_cents: 499, coins: 0, gems: 0, days: 30, one_time: false, badge: "", active: true, sort: 2 },
    { id: "vault", kind: "vault", name: "Coin Vault", descr: "Open the coins your rounds saved up.", price_cents: 299, coins: 0, gems: 0, days: 0, one_time: false, badge: "", active: true, sort: 3 },
    { id: "pass", kind: "pass", name: "Season Pass Premium", descr: "The premium reward track.", price_cents: 599, coins: 0, gems: 0, days: 0, one_time: false, badge: "", active: true, sort: 4 },
    { id: "treat", kind: "crew_treat", name: "Crew Treat", descr: "Coins for your whole crew.", price_cents: 299, coins: 500, gems: 0, days: 0, one_time: false, badge: "", active: true, sort: 5 },
    { id: "c1", kind: "coins", name: "Pile of coins", descr: "", price_cents: 99, coins: 1200, gems: 0, days: 0, one_time: false, badge: "", active: true, sort: 6 },
    { id: "g1", kind: "gems", name: "Handful of gems", descr: "", price_cents: 199, coins: 0, gems: 60, days: 0, one_time: false, badge: "", active: true, sort: 7 },
  ];
  const LEDGER: LedgerRow[] = [
    { id: 6, amount: 45, reason: "round_prize", created_at: iso(-2 * 36e5) },
    { id: 5, amount: -20, reason: "entry_fee", created_at: iso(-2.1 * 36e5) },
    { id: 4, amount: 40, reason: "mission", created_at: iso(-5 * 36e5) },
    { id: 3, amount: 50, reason: "login_bonus", created_at: iso(-DAY) },
    { id: 2, amount: -300, reason: "shop_purchase", created_at: iso(-3 * DAY) },
    { id: 1, amount: 50, reason: "welcome", created_at: iso(-20 * DAY) },
  ];
  const THREADS: Thread[] = [{ id: "t1", subject: "My coins after a round", status: "answered", origin: "player", unread: true, updated_at: iso(-36e5), last_message: "Thanks, the prize is now in your wallet.", last_sender: "admin" }];
  const NOTES: Note[] = [
    { id: "n1", kind: "reward", title: "League prize", body: "You finished 7th last week: +40 coins.", read: false, created_at: iso(-DAY), from_name: null },
    { id: "n2", kind: "news", title: "New stages", body: "Starlight Pier has two new stages.", read: true, created_at: iso(-4 * DAY), from_name: "Bingo Arena" },
  ];
  const CONVO: Convo = { id: "t1", subject: "My coins after a round", status: "answered", origin: "player", messages: [
    { sender: "player", body: "My prize did not show up after the last round.", created_at: iso(-3 * 36e5) },
    { sender: "admin", body: "Thanks, the prize is now in your wallet.", created_at: iso(-36e5) },
  ] };
  const REFERRAL: Referral = {
    enabled: true, code: "SAMPLE7",
    rewards: { friend_coins: 100, reg_coins: 200, reg_gems: 5, play_rounds: 5, play_coins: 300, play_gems: 10, ret_coins: 200, ret_gems: 5, week_days: 7, week_coins: 500, week_gems: 20, window_days: 30 },
    stats: { invited: 2, active: 1, registered: 1, played: 1, returned: 0, week: 0, coins: 500, gems: 15 },
    friends: [{ name: player(30), joined: iso(-6 * DAY), status: "active", register: true, play: true, return: false, week: false, rounds: 8, coins: 500, gems: 15, saved: true, ends: iso(24 * DAY) }],
  };
  const SEASON: SeasonInfo = {
    active: true, id: 3, name: "Season 3", blurb: "Thirty tiers of rewards.", starts_at: iso(-10 * DAY), ends_at: iso(19 * DAY), over: false,
    xp_per_tier: 100, pass_price: 900, xp: 1240, tier: 12, pass: false,
    tiers: Array.from({ length: 30 }, (_, i) => ({ tier: i + 1, free: i % 5 === 4 ? { pack: 1 } : { coins: 20 + i * 5 }, premium: { coins: 60 + i * 10 }, free_claimed: i < 10, premium_claimed: false })),
  };

  const v = <T,>(full: T, none: T) => async () => (empty ? none : full);
  return {
    journey: { load: async () => journey(empty) },
    season: { load: v(SEASON, { active: false, next: { name: "Season 3", starts_at: iso(2 * DAY) } }), buyPass: ok, claimTier: ok },
    quests: { load: async () => quests(empty), claim: async () => ({ reward: 30 }) },
    album: { load: async () => album(empty), craft: ok, claim: async () => ({ coins: 150, item: null }) },
    account: { load: v({ mastery: MASTERY, email: "sample@example.com" }, { mastery: [], email: "sample@example.com" }), setSpendLimit: ok, changePassword: ok, deleteAccount: ok },
    compete: {
      events: v(EVENTS, []), live_races: v(RACES, []), attempts_used: async () => (empty ? 0 : 1), event_leaderboard: v(EVENT_ROWS, []),
      league_info: v({ players: 214, prizes: [500, 300, 200], auto: true }, null), league_board: v(LEAGUE, []), league_payouts: v(PAYOUT, null),
      crew_info: v(CREW, null), crew_board: v(CREW_BOARD, []), search_crews: async () => (empty ? [] : CREW_BOARD.slice(0, 3).map((c) => ({ id: c.crew_id, name: c.name, tag: c.tag, descr: "Open to everyone.", members: c.members, points: c.points }))),
      join_crew: ok, create_crew: ok, claim_crew_chest: ok, leave_crew: ok, update_crew: ok, kick_crew_member: ok,
      liveops: v(LIVEOPS, []), new_players: v(NEW_PLAYERS, []), wave_hello: ok,
    },
    store: { loadProducts: async () => ({ products: PRODUCTS, mode: "preview" }), buyTest: async () => ({}), gemSpend: ok, clubClaim: ok, confirmAge: ok, isAdultsOnly: () => false },
    shop: { dailyDeals: v([], []), buy: ok, equip: ok },
    history: { ledger: v(LEDGER, []), purchases: v([], []) },
    inbox: { load: v({ threads: THREADS, notes: NOTES }, { threads: [], notes: [] }), open: async () => CONVO, contact: async () => "t2", reply: ok, markRead: async () => NOTES.map((n) => ({ ...n, read: true })) },
    refer: { load: v(REFERRAL, { ...REFERRAL, stats: { invited: 0, active: 0, registered: 0, played: 0, returned: 0, week: 0, coins: 0, gems: 0 }, friends: [] }) },
    match: {
      find: ok, state: async () => ({ status: "none" }), cancel: ok, online: v([1, 2, 3].map((n) => ({ id: `o${n}`, name: player(n + 40), level: 2 + n, playing: n === 3 })), []),
      invite: ok, result: async () => ({ status: "settled", result: "win", my_score: 612, opp_score: 540, opponent: "Sample rival", prize: 36 }), challenge: async () => "SAMPLE",
    },
    auth: {
      signUp: async () => ({ error: null, session: true }), signIn: async () => ({ error: null }), google: async () => ({ error: null }), linkGoogle: async () => ({ error: null }),
      addEmail: async () => ({ error: null, confirm: true }), setPassword: async () => ({ error: null }), resend: async () => ({ error: null }), resetPassword: async () => ({ error: null }),
      markSaved: ok, acceptTerms: async () => ({ error: null }), signOut: ok,
    },
  };
}

export const sampleData = (): ScreenData => data(false);
export const emptyData = (): ScreenData => data(true);

/** No account: shared data Classic shows visitors, the player's own data empty, the rest refused with NEED_ACCOUNT (the sign-up teaser). */
export function visitorData(): ScreenData {
  const s = data(false), e = data(true);
  const no = async (): Promise<never> => { throw new Error(NEED_ACCOUNT); };
  return {
    journey: e.journey,
    season: { load: no, buyPass: no, claimTier: no },
    quests: { load: async () => ({ missions: [], counters: {}, claimed: [], badges: [], earned: [] }), claim: no },
    album: { load: e.album.load, craft: no, claim: no },
    account: { load: async () => ({ mastery: [], email: "" }), setSpendLimit: no, changePassword: no, deleteAccount: no },
    compete: {
      events: no, live_races: no, attempts_used: async () => 0, event_leaderboard: no, league_info: no, league_board: no, league_payouts: no,
      crew_info: async () => null, crew_board: no, search_crews: no, join_crew: no, create_crew: no, claim_crew_chest: no, leave_crew: no, update_crew: no, kick_crew_member: no,
      liveops: s.compete.liveops, new_players: no, wave_hello: no,
    },
    store: { ...s.store, buyTest: no, gemSpend: no, clubClaim: no, confirmAge: no },
    shop: { dailyDeals: s.shop.dailyDeals, buy: no, equip: no },
    history: { ledger: async () => [], purchases: async () => [] },
    inbox: { load: async () => ({ threads: [], notes: [] }), open: no, contact: no, reply: no, markRead: no },
    refer: { load: async () => null },
    match: { find: no, state: async () => ({ status: "none" }), cancel: async () => null, online: no, invite: no, result: async () => null, challenge: no },
    auth: s.auth,
  };
}
