import { supabase } from "./supabase";

const MESSAGES: Record<string, string> = {
  forbidden: "You are not an admin.",
  invalid_amount: "Amount must be between 1 and 100,000 (use a minus sign to deduct).",
  invalid_reason: "Enter a short reason (2 to 60 characters).",
  insufficient_funds: "The player does not have that many coins.",
  cannot_ban_self: "You cannot suspend your own account.",
  invalid_item: "Check the item: name needed, price 0 to 100,000, level 0 to 100.",
  invalid_mission: "Check the quest: label needed, goal 1 to 1,000, reward 0 to 10,000.",
  event_has_entries: "This event already has entries, so its level and fee cannot change and it cannot be deleted.",
  event_ended: "This event has already ended.",
  already_finalized: "This event was already finalized and paid.",
  event_not_found: "Event not found.",
  invalid_status: "Invalid status.",
  week_not_finished: "That week is not finished yet. You can pay a week after it ends (Monday UTC).",
  already_paid: "That week was already paid.",
  invalid_prizes: "Enter 1 to 10 prize amounts between 0 and 100,000, separated by commas.",
  invalid_week: "Invalid week.",
  invalid_subject: "Add a subject of 2 to 80 characters.",
  invalid_message: "Write a message of 1 to 2000 characters.",
  thread_not_found: "That conversation was not found.",
  player_not_found: "That player was not found.",
  weak_password: "The password must be 8 to 72 characters.",
  invalid_reward: "A reward looks like coins:50, pack:1, item:ITEM_ID or booster:time:2. Coins up to 5000, packs up to 5, one reward per box, and the item must exist.",
  season_overlap: "Seasons cannot overlap. Move the dates so this one starts after the other ends.",
  season_not_found: "Season not found.",
  liveop_not_found: "That event was not found.",
  crew_name_taken: "That crew name is taken.",
  invalid_crew_name: "Crew names are 3 to 20 letters, numbers or spaces.",
  crew_not_found: "Crew not found.",
  invalid_link: "That is not a Facebook page link. It should start with https://www.facebook.com/",
  invalid_referral_settings: "Check the numbers: each one must be inside its allowed range (active days 3 to 30, reward window 7 to 90 days).",
  invalid_auto: "Check the numbers: splits add up to 100 or less, hours are 0 to 23.",
  invalid_stage: "Goals must rise from one star to three (for example 60, 110, 160) and coins must be 0 to 10,000.",
  invalid_flag_mode: "The setting must be Off, Admins only or All.",
  unknown_flag: "That flag was not found.",
};

export const adminMsg = (m: string) => {
  const hit = Object.keys(MESSAGES).find((k) => m.includes(k));
  if (hit) return MESSAGES[hit];
  const cfg = m.match(/invalid_config: ?(.*)/);
  if (cfg) return `Invalid setting: ${cfg[1]}. Check the allowed range.`;
  const lo = m.match(/invalid_(?:liveop|season): ?(.*)/);
  if (lo) return `Check the details: ${lo[1]}.`;
  const ev = m.match(/invalid_event: ?(.*)/);
  if (ev) return `Invalid event: ${ev[1]}.`;
  if (/could not find the function|PGRST202|does not exist/i.test(m)) return "This admin feature needs a database update. Open the Health tab to see which update to run (see docs/UPDATE_GUIDE.md).";
  if (/permission denied|not authorized|JWT/i.test(m)) return "You are not allowed to do that. Log out and in again, and check that your account is an admin (Health tab).";
  return `That did not work${m ? ": " + m.slice(0, 160) : ""}.`;
};

export async function adminRpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(adminMsg(error.message));
  return data as T;
}

/** Quote a CSV cell and neutralise spreadsheet formulas. */
export const csvCell = (v: unknown) => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
};
export const dt = (t?: string | null) => (t ? new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "–");
export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) + "%" : "–");
