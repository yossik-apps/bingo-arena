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
};

export const adminMsg = (m: string) => {
  const hit = Object.keys(MESSAGES).find((k) => m.includes(k));
  if (hit) return MESSAGES[hit];
  const cfg = m.match(/invalid_config: ?(.*)/);
  if (cfg) return `Invalid setting: ${cfg[1]}. Check the allowed range.`;
  const ev = m.match(/invalid_event: ?(.*)/);
  if (ev) return `Invalid event: ${ev[1]}.`;
  return "That did not work. Please try again.";
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
