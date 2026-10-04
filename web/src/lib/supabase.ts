import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

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
export type MatchInfo = {
  status: "none" | "queued" | "ready"; waited?: number; match_id?: string; round_id?: string; seed?: number;
  params?: Record<string, unknown>; start_at?: string; server_now?: string; opponent?: string;
};
export type ShopItem = {
  id: string; slot: "theme" | "style" | "board" | "ball" | "frame" | "title" | "boost" | "bundle"; key: string; grp: string;
  name: string; descr: string; price: number; min_level: number; meta: Record<string, any>; sort: number;
};
export const DEFAULT_EQUIPPED: Equipped = { theme: "rose", style: "", board: "classic", ball: "gold", frame: "", title: "" };

export const errorText = (code: string) =>
  ({
    insufficient_funds: "Not enough coins for this entry fee. Play solo to earn more.",
    round_in_progress: "A round is already in progress. Wait a minute and try again.",
    account_suspended: "Your account is suspended. Please contact support.",
    maintenance: "The game is under maintenance. Try again soon.",
    round_rejected: "That round could not be verified, so it was not scored.",
    not_signed_in: "Please sign in again.",
    age_not_confirmed: "Please confirm you are 18 or older first.",
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
  const code = Object.keys({ insufficient_funds: 1, level_too_low: 1, already_owned: 1, not_owned: 1, item_not_found: 1, not_complete: 1, already_claimed: 1, not_todays_mission: 1, account_suspended: 1 }).find((c) => m.includes(c));
  return errorText(code ?? "server_error");
};

/** The database stores config keys in its own order (hard, medium, beginner). Always show levels easiest first. */
const LEVEL_ORDER = ["beginner", "medium", "hard"];
export const levelKeys = (levels: Record<string, unknown>) =>
  Object.keys(levels).sort((a, b) => (LEVEL_ORDER.indexOf(a) + 99 * Number(!LEVEL_ORDER.includes(a))) - (LEVEL_ORDER.indexOf(b) + 99 * Number(!LEVEL_ORDER.includes(b))));
