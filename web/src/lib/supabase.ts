import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** The signed-in player. Every query on personal data is filtered by this id (admins can otherwise see rows of other players). */
export const me = { id: "" };

export const configured = Boolean(url && key);
export const supabase = createClient(url ?? "http://localhost:54321", key ?? "missing-key", {
  auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
});

export type LevelCfg = { every: number; win: number; pt: number; pen: number; hint: boolean; xm: number; fee: number; gl: number; gr: number };
export type GameCfg = {
  levels: Record<string, LevelCfg>;
  g: { pay: number; login: number; welcome: number; total: number; maint: boolean; paid: boolean; pvp: boolean; note: string };
};

/** Calls a server function and turns failures into readable messages. */
export async function callFn<T>(name: string, body: unknown = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body: body as Record<string, unknown> });
  if (error) {
    let code = "server_error";
    try { code = (await (error as { context: Response }).context.json()).error ?? code; } catch { /* ignore */ }
    throw new Error(code);
  }
  return data as T;
}

export type Equipped = { theme: string; style: string; board: string; ball: string; frame: string; title: string };
export type World = { id: number; name: string; blurb: string; stars_needed: number; reward_item: string | null; reward_coins: number };
export type Stage = { id: string; world: number; idx: number; name: string; level: string; mods: { label?: string }; s1: number; s2: number; s3: number; reward_coins: number };
export type Pack = { stamp_id: string; name: string; rarity: "common" | "rare" | "epic"; world: number; is_new: boolean; dust: number };
export type StageResult = {
  ok?: boolean; stage: string; stage_name: string; stars: number; best_stars: number; new_stars: number; coins: number;
  packs: Pack[]; world: number; world_cleared: boolean; total_stars: number;
};
export type DailyInfo = { day: string; level: string; label: string; goals: number[]; played: { status: string; score: number } | null; rank: number | null; done: number; shields: number };
export type DailyResult = { ok?: boolean; day: string; tier: number; coins: number; pack: Pack | null; shield_earned: boolean; rank: number; done: number };
export type DuelResult = { ok?: boolean; creator: string; creator_score: number; score: number; win: boolean; tie: boolean };
export type ChallengeInfo = { code: string; creator: string; level: string; score: number; expired: boolean; mine: boolean; plays: number; played: boolean; my_score: number | null };
export type MasteryRow = { level: string; best: number; tier: number; name: string; next_name: string | null; next_min: number | null };
export const TERMS_VERSION = "2026-10";
export type LiveOp = { id: string; kind: "xp_boost" | "coin_boost" | "fee_discount" | "banner"; title: string; descr: string; starts_at: string; ends_at: string; mult: number; pct: number; active: boolean };
export type Reward = { coins?: number; pack?: number; item?: string; booster?: { key: string; qty: number } };
export type SeasonTier = { tier: number; free: Reward; premium: Reward; free_claimed: boolean; premium_claimed: boolean };
export type SeasonInfo = {
  active: boolean; next?: { name: string; starts_at: string } | null;
  id?: number; name?: string; blurb?: string; starts_at?: string; ends_at?: string; over?: boolean; grace_ends?: string;
  xp_per_tier?: number; pass_price?: number; xp?: number; tier?: number; pass?: boolean; tiers?: SeasonTier[];
};
export type CrewMember = { user_id: string; name: string; role: "leader" | "member"; points: number };
export type CrewInfo = {
  id: string; name: string; tag: string; descr: string; open: boolean; invite_code: string; members: CrewMember[];
  week_points: number; size: number; goal: number; tier1: number; my_points: number; claimed: number[]; rank: number; is_leader: boolean; min_members: number; min_points: number;
};
export type CrewHit = { id: string; name: string; tag: string; descr: string; members: number; points: number };
export type MatchInfo = {
  status: "none" | "queued" | "ready"; waited?: number; match_id?: string; round_id?: string; seed?: number;
  params?: Record<string, unknown>; start_at?: string; server_now?: string; opponent?: string;
};
export type ShopItem = {
  id: string; slot: "theme" | "style" | "board" | "ball" | "frame" | "title" | "boost" | "bundle"; key: string; grp: string;
  name: string; descr: string; price: number; min_level: number; meta: Record<string, any>; sort: number;
};
export const DEFAULT_EQUIPPED: Equipped = { theme: "rose", style: "", board: "classic", ball: "gold", frame: "", title: "" };

const CREW_SEASON_ERRORS: Record<string, string> = {
  crew_name_taken: "That crew name is taken. Try another.",
  invalid_crew_name: "Crew names are 3 to 20 letters, numbers or spaces. The tag is 2 to 4 letters or numbers.",
  already_in_crew: "You are already in a crew. Leave it first to join another.",
  crew_not_found: "That crew was not found, or it is closed. Closed crews need an invite code.",
  crew_full: "That crew is full (20 players).",
  not_in_crew: "You are not in a crew.",
  not_crew_leader: "Only the crew leader can do that.",
  cannot_kick_self: "You cannot remove yourself. Use Leave crew instead.",
  goal_not_reached: "Your crew has not reached that goal yet.",
  crew_too_small: "The crew chest needs a crew of at least 3 players.",
  contribute_more: "Earn at least 40 XP yourself this week to share the chest.",
  invalid_tier: "That reward does not exist.",
  tier_not_reached: "You have not reached that tier yet. Keep playing to earn season XP.",
  pass_required: "That reward is on the season pass track. Get the pass to claim it.",
  no_season: "There is no season running right now.",
  tier_not_found: "That reward is not available.",
  invalid_subject: "Please add a short subject (2 to 80 characters).",
  invalid_message: "Please write a message (5 to 2000 characters).",
  too_many_messages: "That is a lot of messages for one day. We will reply as soon as we can.",
  thread_not_found: "That conversation was not found.",
  cannot_wave_self: "You cannot wave at yourself.",
  not_a_new_player: "You can only welcome players who joined this week.",
  too_many_waves: "You can send 5 welcomes a day. Try again tomorrow.",
  already_waved: "You already welcomed this player.",
  weak_password: "The password must be 8 to 72 characters.",
  forbidden: "You are not allowed to do that.",
  player_not_found: "That player was not found.",
  store_not_open: "Purchases are not open yet. Everything in the game can also be earned by playing.",
  unknown_product: "That offer is not available any more.",
  vault_empty: "Your Coin Vault is empty. Win rounds to fill it.",
  no_crew: "Join a crew first, then you can send it a treat.",
  spend_limit: "This would go over your monthly spending limit. You can change the limit in Profile, then Settings.",
  not_member: "This is for Bingo Club members.",
  insufficient_gems: "Not enough gems for that.",
  shields_full: "You already have 2 Streak Shields, the most you can hold.",
  live_needs_payments: "Live payments need the payment provider update first.",
  bad_request: "That request was not valid.",
};
export const errorText = (code: string) =>
  ({
    ...CREW_SEASON_ERRORS,
    insufficient_funds: "Not enough coins for this entry fee. Play solo to earn more.",
    round_in_progress: "A round is already in progress. Wait a minute and try again.",
    account_suspended: "Your account is suspended. Please contact support.",
    maintenance: "The game is under maintenance. Try again soon.",
    round_rejected: "That round could not be verified, so it was not scored.",
    not_signed_in: "Please sign in again.",
    age_not_confirmed: "Please confirm you are 18 or older first.",
    already_played: "You already played that one.",
    own_challenge: "That is your own challenge. Send the link to a friend instead.",
    challenge_expired: "That challenge has expired (they last 7 days).",
    challenge_not_found: "That challenge link is not valid.",
    too_many_challenges: "You can create 10 challenges a day. Try again tomorrow.",
    not_challengeable: "Only finished solo and ghost rounds can be shared as a challenge.",
    boosted_round: "Rounds played with boosters cannot be shared, because the rules would not be fair.",
    confirm_required: "Please type DELETE to confirm.",
    stage_locked: "That stage is still locked. Clear the one before it first.",
    not_enough_dust: "You do not have enough dust to craft that stamp yet.",
    album_incomplete: "Collect every stamp on the page first.",
    not_for_sale: "That item is a reward. You earn it by completing an album.",
    pvp_disabled: "Real-player matches are switched off right now.",
    no_attempts: "You have used all your attempts in this event.",
    event_closed: "This event is not open right now.",
    level_too_low: "Reach a higher level to unlock this.",
    already_owned: "You already own this.",
    not_owned: "You do not own this yet.",
    item_not_found: "That item is not available.",
    no_booster: "You do not have that booster.",
    boosters_not_allowed: "Boosters can only be used in solo and vs-ghost rounds.",
    not_complete: "That quest is not finished yet.",
    already_claimed: "You already claimed that reward.",
    not_todays_mission: "That quest is not available today.",
  } as Record<string, string>)[code] ?? "Something went wrong. Please try again.";

/** Turns a database function error (message contains a code) into readable text. */
export const rpcError = (e: { message?: string } | null | undefined) => {
  const m = e?.message ?? "";
  const code = [...Object.keys(CREW_SEASON_ERRORS), ...Object.keys({ insufficient_funds: 1, level_too_low: 1, not_enough_dust: 1, album_incomplete: 1, not_for_sale: 1, already_owned: 1, not_owned: 1, item_not_found: 1, not_complete: 1, already_claimed: 1, not_todays_mission: 1, account_suspended: 1 })].find((c) => m.includes(c));
  return errorText(code ?? "server_error");
};

/** The database stores config keys in its own order (hard, medium, beginner). Always show levels easiest first. */
const LEVEL_ORDER = ["beginner", "medium", "hard"];
export const levelKeys = (levels: Record<string, unknown>) =>
  Object.keys(levels).sort((a, b) => (LEVEL_ORDER.indexOf(a) + 99 * Number(!LEVEL_ORDER.includes(a))) - (LEVEL_ORDER.indexOf(b) + 99 * Number(!LEVEL_ORDER.includes(b))));
