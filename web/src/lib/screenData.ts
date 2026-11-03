// The data and actions the new screens use: the same queries, rpcs and edge functions as the Classic screens, call for call.
// The Classic screens keep their own calls; nothing here changes them. Each group names the Classic file it mirrors.
// Loads fail (reject) when a query fails, so a screen can show an error; Classic shows empty lists instead.
// Actions reject with the same readable text Classic shows (rpcError / errorText).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CrewHit, CrewInfo, LiveOp, MasteryRow, SeasonInfo, Stage, World } from "./supabase";
import type { Economy, Product, PurchaseRow, StoreMode } from "./store";

// ---- result types (the same shapes the Classic screens use) ----
export type StageProgress = { stars: number; best_score: number; attempts: number };
export type JourneyData = { worlds: World[]; stages: Stage[]; progress: Record<string, StageProgress> };
export type Mission = { id: string; label: string; counter: string; goal: number; reward: number };
export type QuestsData = { missions: Mission[]; counters: Record<string, number>; claimed: string[]; badges: { id: string; label: string }[]; earned: string[] };
export type Stamp = { id: string; world: number; name: string; rarity: "common" | "rare" | "epic"; sort: number };
export type AlbumData = { worlds: World[]; stamps: Stamp[]; owned: Record<string, number>; collect: { dust: number; packs_since_epic: number; packs_opened: number }; claimed: number[] };
export type Ev = { id: string; name: string; descr: string; level: string; fee: number; attempts: number; starts_at: string; ends_at: string; bonus: number; split: number[]; status: string; auto?: boolean };
export type Race = { id: string; title: string; descr: string; kind: string; mult: number; ends_at: string; prizes: number[]; board: { rank: number; name: string; points: number; me: boolean }[] };
export type EventRow = { rank: number; user_id: string; display_name: string; best: number; attempts: number };
export type LeagueRow = { rank: number; user_id: string; display_name: string; points: number };
export type LeagueInfo = { players: number; prizes: number[]; auto: boolean };
export type Payout = { week: string; prizes: number[]; winners: { rank: number; name: string; points: number; prize: number }[] };
export type CrewBoardRow = { rank: number; crew_id: string; name: string; tag: string; members: number; points: number };
export type NewPlayer = { user_id: string; name: string; level: number; joined_at: string; is_me: boolean; waved: boolean };
export type LedgerRow = { id: number; amount: number; reason: string; created_at: string };
export type Thread = { id: string; subject: string; status: string; origin: string; unread: boolean; updated_at: string; last_message: string | null; last_sender: string | null };
export type Convo = { id: string; subject: string; status: string; origin: string; messages: { sender: "player" | "admin"; body: string; created_at: string }[] };
export type Note = { id: string; kind: string; title: string; body: string; read: boolean; created_at: string; from_name: string | null };
export type ReferralRewards = { friend_coins: number; reg_coins: number; reg_gems: number; play_rounds: number; play_coins: number; play_gems: number; ret_coins: number; ret_gems: number; week_days: number; week_coins: number; week_gems: number; window_days: number };
export type ReferralFriend = { name: string; joined: string; status: string; register: boolean; play: boolean; return: boolean; week: boolean; rounds: number; coins: number; gems: number; saved: boolean; ends: string };
export type Referral = { enabled: boolean; code: string; rewards: ReferralRewards; stats: { invited: number; active: number; registered: number; played: number; returned: number; week: number; coins: number; gems: number }; friends: ReferralFriend[] };
export type OnlinePlayer = { id: string; name: string; level: number; playing: boolean };
export type MatchResult = { status: "waiting" | "settled"; result?: string; my_score?: number; opp_score?: number | null; opponent?: string; prize?: number };
export type MatchState = { status: "none" | "queued" | "ready"; waited?: number; match_id?: string; round_id?: string; seed?: number; params?: Record<string, unknown>; start_at?: string; server_now?: string; opponent?: string };
/** Sign-in calls give back Supabase's own error message, or null; the screen words it, as Classic's Auth does. */
export type AuthReply = { error: string | null };

// ---- groups ----
/** Classic Journey.tsx. Playing a stage stays rounds.startStage. */
export type JourneyGroup = { load: () => Promise<JourneyData> };
/** Classic Season.tsx (the Journey hub's Season tab). */
export type SeasonGroup = { load: () => Promise<SeasonInfo>; buyPass: () => Promise<void>; claimTier: (tier: number, track: "free" | "premium") => Promise<void> };
/** Classic Quests.tsx. claim gives the coin reward and refreshes the wallet. */
export type QuestsGroup = { load: () => Promise<QuestsData>; claim: (id: string) => Promise<{ reward: number }> };
/** Classic Album.tsx. claim refreshes the wallet; craft does not, as in Classic. */
export type AlbumGroup = { load: () => Promise<AlbumData>; craft: (stampId: string) => Promise<void>; claim: (worldId: number) => Promise<{ coins: number; item: string | null }> };
/** Classic Profile.tsx. None of these is ever run against live from tests or captures. */
export type AccountGroup = {
  load: () => Promise<{ mastery: MasteryRow[]; email: string }>;
  /** null: no limit. Refreshes the economy afterwards. */
  setSpendLimit: (cents: number | null) => Promise<void>;
  changePassword: (password: string) => Promise<void>;
  /** `confirm` is what the player typed (DELETE). Signs out afterwards. */
  deleteAccount: (confirm: string) => Promise<void>;
};
/** Classic Events.tsx, League.tsx, Crew.tsx, Calendar.tsx and NewPlayers.tsx. The names are chat C's CompeteApi. Every crew action refreshes the wallet; the screen reloads its own lists. */
export type CompeteGroup = {
  events: () => Promise<Ev[]>; live_races: () => Promise<Race[]>; attempts_used: (eventId: string) => Promise<number>; event_leaderboard: (eventId: string) => Promise<EventRow[]>;
  league_info: () => Promise<LeagueInfo | null>; league_board: () => Promise<LeagueRow[]>; league_payouts: () => Promise<Payout | null>;
  crew_info: () => Promise<CrewInfo | null>; crew_board: () => Promise<CrewBoardRow[]>; search_crews: (q: string) => Promise<CrewHit[]>;
  /** a crew by id, or (crewId null) by its invite code */
  join_crew: (crewId: string | null, code?: string) => Promise<void>;
  create_crew: (f: { name: string; tag: string; descr: string; open: boolean }) => Promise<void>;
  claim_crew_chest: (tier: 1 | 2) => Promise<void>; leave_crew: () => Promise<void>; update_crew: (descr: string, open: boolean) => Promise<void>; kick_crew_member: (userId: string) => Promise<void>;
  /** the whole schedule still to come: live now and upcoming */
  liveops: () => Promise<LiveOp[]>;
  new_players: (limit: number) => Promise<NewPlayer[]>; wave_hello: (userId: string) => Promise<void>;
};
/** Classic Store.tsx and lib/store.ts. Real money is never taken: buyTest is the admin-only test purchase. Each action refreshes the wallet and economy. */
export type StoreGroup = {
  load: () => Promise<{ products: Product[]; mode: StoreMode }>;
  buyTest: (productId: string) => Promise<{ coins?: number; gems?: number }>;
  gemSpend: (what: "coins_s" | "coins_l" | "shield") => Promise<void>;
  clubClaim: () => Promise<void>;
  /** the 18+ confirmation Store asks for after an adults_only error */
  confirmAdult: () => Promise<void>;
  /** true when the error came from the server's age check, so the screen offers confirmAdult */
  isAdultsOnly: (e: unknown) => boolean;
};
/** Classic Shop.tsx (looks and boosters, paid with coins). Each action refreshes the wallet. */
export type ShopGroup = { dailyDeals: () => Promise<string[]>; buy: (itemId: string) => Promise<void>; equip: (itemId: string, on: boolean) => Promise<void> };
/** Classic Wallet.tsx. */
export type HistoryGroup = { ledger: () => Promise<LedgerRow[]>; purchases: () => Promise<PurchaseRow[]> };
/** Classic Inbox.tsx. Opening a thread and marking notes read also refresh the unread count. */
export type InboxGroup = {
  load: () => Promise<{ threads: Thread[]; notes: Note[] }>; open: (threadId: string) => Promise<Convo>;
  contact: (subject: string, body: string) => Promise<string>; reply: (threadId: string, body: string) => Promise<void>; markRead: () => Promise<Note[]>;
};
/** Classic Refer.tsx. "old" when the database has no referrals yet; a good load also refreshes the wallet, as in Classic. */
export type ReferGroup = { load: () => Promise<Referral | "old"> };
/** Classic Matchmaking.tsx and Result.tsx (live matches and friend challenges). */
export type MatchGroup = {
  find: (level: string) => Promise<void>; state: () => Promise<MatchState>; cancel: () => Promise<unknown>; online: () => Promise<OnlinePlayer[]>;
  invite: (userId: string, level: string) => Promise<void>; result: (matchId: string) => Promise<MatchResult | null>; challenge: (roundId: string) => Promise<string>;
};
/** Classic Auth.tsx, SetPassword.tsx, AgeGate.tsx and lib/guest.ts. */
export type AuthGroup = {
  signUp: (a: { email: string; password: string; name: string; crazyGames: boolean }) => Promise<AuthReply & { session: boolean }>;
  signIn: (email: string, password: string) => Promise<AuthReply>;
  google: () => Promise<AuthReply>; linkGoogle: () => Promise<AuthReply>;
  /** a guest adds an email: true when it still has to be confirmed */
  addEmail: (email: string) => Promise<AuthReply & { confirm: boolean }>;
  setPassword: (password: string) => Promise<AuthReply>;
  resend: (email: string) => Promise<AuthReply>; resetPassword: (email: string) => Promise<AuthReply>;
  /** after Google or an email was added to a guest */
  markSaved: () => Promise<void>;
  acceptTerms: (crazyGames: boolean) => Promise<AuthReply>;
  signOut: () => Promise<void>;
};

export type ScreenData = {
  journey: JourneyGroup; season: SeasonGroup; quests: QuestsGroup; album: AlbumGroup; account: AccountGroup; compete: CompeteGroup;
  store: StoreGroup; shop: ShopGroup; history: HistoryGroup; inbox: InboxGroup; refer: ReferGroup; match: MatchGroup; auth: AuthGroup;
};

type Deps = {
  db: SupabaseClient;
  call: <T>(name: string, body?: unknown) => Promise<T>;
  rpcError: (e: { message?: string } | null | undefined) => string;
  errorText: (code: string) => string;
  /** the signed-in player's id, or null for a visitor */
  userId: string | null;
  /** App's refresh: wallet, economy and profile */
  refresh: () => Promise<void>;
  refreshInbox: () => void;
  termsVersion: string;
  origin: string;
  /** lib/guest.ts markSaved (the guest_saved rpc and its tracking step) */
  markSaved: () => Promise<void>;
  /** today in UTC, YYYY-MM-DD, as Quests computes it */
  today?: () => string;
  now?: () => string;
};

const NEED_ACCOUNT = "Create your free account first.";

/** Builds every group. A visitor's loads that need an account give empty data without a query; their actions fail without a call. */
export function screenData(d: Deps): ScreenData {
  const { db, call, rpcError, userId } = d;
  const today = d.today ?? (() => new Date().toISOString().slice(0, 10));
  const now = d.now ?? (() => new Date().toISOString());
  type Res = { data: unknown; error: { message: string } | null; count?: number | null };
  const read = <T>(r: Res, empty: T): T => { if (r.error) throw new Error(rpcError(r.error)); return (r.data as T) ?? empty; };
  const act = async (r: PromiseLike<Res>): Promise<unknown> => { const res = await r; if (res.error) throw new Error(rpcError(res.error)); return res.data; };
  const signedIn = () => { if (!userId) throw new Error(NEED_ACCOUNT); return userId; };
  const after = async <T>(p: Promise<T>) => { const v = await p; await d.refresh(); return v; };
  const reply = (r: { error: { message: string } | null }): AuthReply => ({ error: r.error?.message ?? null });

  const journey: JourneyGroup = {
    load: async () => {
      const [w, s, u] = await Promise.all([
        db.from("worlds").select("*").order("sort"),
        db.from("stages").select("id,world,idx,name,level,mods,s1,s2,s3,reward_coins").order("world").order("idx"),
        userId ? db.from("user_stages").select("stage_id,stars,best_score,attempts").eq("user_id", userId) : Promise.resolve({ data: [], error: null }),
      ]);
      const rows = read<{ stage_id: string; stars: number; best_score: number; attempts: number }[]>(u as Res, []);
      return { worlds: read(w, []), stages: read(s, []), progress: Object.fromEntries(rows.map((r) => [r.stage_id, { stars: r.stars, best_score: r.best_score, attempts: r.attempts }])) };
    },
  };

  const season: SeasonGroup = {
    load: async () => read<SeasonInfo>(await db.rpc("season_info"), { active: false }),
    buyPass: async () => { signedIn(); await after(act(db.rpc("buy_season_pass"))); },
    claimTier: async (tier, track) => { signedIn(); await after(act(db.rpc("claim_season_tier", { p_tier: tier, p_track: track }))); },
  };

  const quests: QuestsGroup = {
    load: async () => {
      if (!userId) return { missions: [], counters: {}, claimed: [], badges: [], earned: [] };
      const [m, p, a, u] = await Promise.all([
        db.rpc("todays_missions"),
        db.from("daily_progress").select("counters,claimed").eq("user_id", userId).eq("day", today()).maybeSingle(),
        db.from("ach_defs").select("id,label"),
        db.from("user_achievements").select("ach_id").eq("user_id", userId),
      ]);
      const prog = read<{ counters?: Record<string, number>; claimed?: string[] } | null>(p, null);
      return { missions: read(m, []), counters: prog?.counters ?? {}, claimed: prog?.claimed ?? [], badges: read(a, []), earned: read<{ ach_id: string }[]>(u, []).map((x) => x.ach_id) };
    },
    claim: async (id) => { signedIn(); return (await after(act(db.rpc("claim_mission", { p_id: id })))) as { reward: number }; },
  };

  const album: AlbumGroup = {
    load: async () => {
      const id = signedIn();
      const [w, s, o, c, a] = await Promise.all([
        db.from("worlds").select("*").order("sort"),
        db.from("stamps").select("*").order("sort"),
        db.from("user_stamps").select("stamp_id,qty").eq("user_id", id),
        db.from("user_collect").select("dust,packs_since_epic,packs_opened").eq("user_id", id).maybeSingle(),
        db.from("album_claims").select("world").eq("user_id", id),
      ]);
      return {
        worlds: read(w, []), stamps: read(s, []),
        owned: Object.fromEntries(read<{ stamp_id: string; qty: number }[]>(o, []).map((x) => [x.stamp_id, x.qty])),
        collect: read(c, null) ?? { dust: 0, packs_since_epic: 0, packs_opened: 0 },
        claimed: read<{ world: number }[]>(a, []).map((x) => x.world),
      };
    },
    craft: async (stampId) => { signedIn(); await act(db.rpc("craft_stamp", { p_stamp: stampId })); },
    claim: async (worldId) => { signedIn(); return (await after(act(db.rpc("claim_album", { p_world: worldId })))) as { coins: number; item: string | null }; },
  };

  const account: AccountGroup = {
    load: async () => {
      signedIn();
      const [m, s] = await Promise.all([db.rpc("mastery"), db.auth.getSession()]);
      return { mastery: read<MasteryRow[]>(m, []), email: s.data.session?.user.email ?? "" };
    },
    setSpendLimit: async (cents) => { signedIn(); await db.rpc("set_spend_limit", { p_cents: cents }); await d.refresh(); }, // Classic does not check the reply
    changePassword: async (password) => { signedIn(); const { error } = await db.auth.updateUser({ password }); if (error) throw new Error(error.message); },
    deleteAccount: async (confirm) => {
      signedIn();
      try { await call("delete-account", { confirm }); } catch (e) { throw new Error(d.errorText((e as Error).message)); }
      await db.auth.signOut();
    },
  };

  const crew = (r: PromiseLike<Res>) => after(act(r)).then(() => undefined);
  const compete: CompeteGroup = {
    events: async () => read<Ev[]>(await db.from("events").select("*").eq("status", "live").lte("starts_at", now()).gte("ends_at", now()).order("ends_at"), []),
    live_races: async () => read<Race[]>(await db.rpc("live_races"), []),
    attempts_used: async (eventId) => {
      if (!userId) return 0;
      const r = await db.from("rounds").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("event_id", eventId);
      if (r.error) throw new Error(rpcError(r.error));
      return r.count ?? 0;
    },
    event_leaderboard: async (eventId) => read<EventRow[]>(await db.rpc("event_leaderboard", { p_event: eventId }), []),
    league_info: async () => read<LeagueInfo | null>(await db.rpc("league_info"), null),
    league_board: async () => read<LeagueRow[]>(await db.rpc("league_board"), []),
    league_payouts: async () => read<Payout | null>(await db.from("league_payouts").select("week,prizes,winners").order("week", { ascending: false }).limit(1).maybeSingle(), null),
    crew_info: async () => read<CrewInfo | null>(await db.rpc("crew_info"), null),
    crew_board: async () => read<CrewBoardRow[]>(await db.rpc("crew_board"), []),
    search_crews: async (q) => read<CrewHit[]>(await db.rpc("search_crews", { p_q: q }), []),
    join_crew: async (crewId, code) => { signedIn(); await crew(crewId === null ? db.rpc("join_crew", { p_crew: null, p_code: code }) : db.rpc("join_crew", { p_crew: crewId })); },
    create_crew: async (f) => { signedIn(); await crew(db.rpc("create_crew", { p_name: f.name, p_tag: f.tag, p_descr: f.descr, p_open: f.open })); },
    claim_crew_chest: async (tier) => { signedIn(); await crew(db.rpc("claim_crew_chest", { p_tier: tier })); },
    leave_crew: async () => { signedIn(); await crew(db.rpc("leave_crew")); },
    update_crew: async (descr, open) => { signedIn(); await crew(db.rpc("update_crew", { p_descr: descr, p_open: open })); },
    kick_crew_member: async (id) => { signedIn(); await crew(db.rpc("kick_crew_member", { p_user: id })); },
    liveops: async () => read<LiveOp[]>(await db.from("liveops").select("*").eq("active", true).gt("ends_at", now()).order("starts_at"), []),
    new_players: async (limit) => read<NewPlayer[]>(await db.rpc("new_players", { p_limit: limit }), []),
    wave_hello: async (id) => { signedIn(); await act(db.rpc("wave_hello", { p_user: id })); },
  };

  // keeps the server message next to the readable one, so isAdultsOnly can see adults_only
  const storeAct = async (r: PromiseLike<Res>) => { const res = await r; if (res.error) throw Object.assign(new Error(rpcError(res.error)), { raw: res.error.message }); await d.refresh(); return res.data; };
  const store: StoreGroup = {
    load: async () => {
      const [p, s] = await Promise.all([
        db.from("store_products").select("*").eq("active", true).order("sort"),
        db.from("store_settings").select("mode").eq("id", 1).maybeSingle(),
      ]);
      return { products: read<Product[]>(p, []), mode: read<{ mode: StoreMode } | null>(s, null)?.mode ?? "off" };
    },
    buyTest: async (productId) => { signedIn(); return ((await storeAct(db.rpc("buy_test", { p_product: productId }))) ?? {}) as { coins?: number; gems?: number }; },
    gemSpend: async (what) => { signedIn(); await storeAct(db.rpc("gem_spend", { p_what: what })); },
    clubClaim: async () => { signedIn(); await storeAct(db.rpc("club_claim", {})); },
    confirmAdult: async () => { signedIn(); await act(db.rpc("accept_terms", { p_version: d.termsVersion, p_age18: true, p_where: "web" })); },
    isAdultsOnly: (e) => /adults_only/.test((e as { raw?: string } | null)?.raw ?? ""),
  };

  const shop: ShopGroup = {
    dailyDeals: async () => read<string[]>(await db.rpc("daily_deals"), []),
    buy: async (itemId) => { signedIn(); await after(act(db.rpc("buy_item", { p_item: itemId }))); },
    equip: async (itemId, on) => { signedIn(); await after(act(db.rpc("equip_item", { p_item: itemId, p_on: on }))); },
  };

  const history: HistoryGroup = {
    ledger: async () => { if (!userId) return []; return read<LedgerRow[]>(await db.from("ledger").select("id,amount,reason,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(300), []); },
    purchases: async () => { if (!userId) return []; return read<PurchaseRow[]>(await db.rpc("my_purchases"), []); },
  };

  const inbox: InboxGroup = {
    load: async () => { signedIn(); const [t, n] = await Promise.all([db.rpc("my_threads"), db.rpc("my_notifications")]); return { threads: read(t, []), notes: read(n, []) }; },
    open: async (threadId) => { signedIn(); const c = (await act(db.rpc("thread_messages", { p_thread: threadId }))) as Convo; d.refreshInbox(); return c; },
    contact: async (subject, body) => { signedIn(); return (await act(db.rpc("contact_support", { p_subject: subject, p_body: body }))) as string; },
    reply: async (threadId, body) => { signedIn(); await act(db.rpc("reply_support", { p_thread: threadId, p_body: body })); },
    markRead: async () => { signedIn(); await db.rpc("mark_notifications_read"); d.refreshInbox(); return ((await db.rpc("my_notifications")).data as Note[]) ?? []; },
  };

  const refer: ReferGroup = {
    load: async () => {
      signedIn();
      const { data, error } = await db.rpc("my_referral");
      if (!error) void d.refresh();
      return error || !data ? "old" : (data as Referral);
    },
  };

  const match: MatchGroup = {
    find: async (level) => { signedIn(); try { await call("find-match", { level }); } catch (e) { throw new Error(d.errorText((e as Error).message)); } },
    state: async () => read<MatchState>(await db.rpc("my_match"), { status: "none" }),
    cancel: async () => (await db.rpc("cancel_queue")).data,
    online: async () => read<OnlinePlayer[]>(await db.rpc("online_players"), []),
    invite: async (id, level) => { signedIn(); await act(db.rpc("send_invite", { p_user: id, p_level: level })); },
    result: async (matchId) => read<MatchResult | null>(await db.rpc("match_result", { p_match: matchId }), null),
    challenge: async (roundId) => (await call<{ code: string }>("create-challenge", { roundId })).code,
  };

  const back = { redirectTo: d.origin };
  const auth: AuthGroup = {
    signUp: async ({ email, password, name, crazyGames }) => {
      const meta = crazyGames ? { name: name.trim(), terms: "true", joined_on: "crazygames", terms_version: d.termsVersion } : { name: name.trim(), adult: "true", terms_version: d.termsVersion };
      const { data, error } = await db.auth.signUp({ email: email.trim(), password, options: { data: meta, emailRedirectTo: d.origin } });
      return { ...reply({ error }), session: !!data.session };
    },
    signIn: async (email, password) => reply(await db.auth.signInWithPassword({ email: email.trim(), password })),
    google: async () => reply(await db.auth.signInWithOAuth({ provider: "google", options: back })),
    linkGoogle: async () => reply(await db.auth.linkIdentity({ provider: "google", options: back })),
    addEmail: async (email) => { const { data, error } = await db.auth.updateUser({ email: email.trim() }); return { ...reply({ error }), confirm: !error && !data.user?.email }; },
    setPassword: async (password) => reply(await db.auth.updateUser({ password })),
    resend: async (email) => reply(await db.auth.resend({ type: "signup", email, options: { emailRedirectTo: d.origin } })),
    resetPassword: async (email) => reply(await db.auth.resetPasswordForEmail(email.trim(), back)),
    markSaved: () => d.markSaved(),
    acceptTerms: async (crazyGames) => {
      let { error } = await db.rpc("accept_terms", { p_version: d.termsVersion, p_age18: !crazyGames, p_where: crazyGames ? "crazygames" : "web" });
      if (error && /could not find|PGRST20/i.test(error.message)) ({ error } = await db.rpc("accept_terms", { p_version: d.termsVersion })); // before update 017
      return reply({ error });
    },
    signOut: async () => { await db.auth.signOut(); },
  };

  return { journey, season, quests, album, account, compete, store, shop, history, inbox, refer, match, auth };
}

export type { Economy };
