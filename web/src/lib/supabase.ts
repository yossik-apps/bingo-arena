import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const configured = Boolean(url && key);
export const supabase = createClient(url ?? "http://localhost:54321", key ?? "missing-key");

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

export const errorText = (code: string) =>
  ({
    insufficient_funds: "Not enough coins for this entry fee. Play solo to earn more.",
    round_in_progress: "A round is already in progress. Wait a minute and try again.",
    account_suspended: "Your account is suspended. Please contact support.",
    maintenance: "The game is under maintenance. Try again soon.",
    round_rejected: "That round could not be verified, so it was not scored.",
    not_signed_in: "Please sign in again.",
  } as Record<string, string>)[code] ?? "Something went wrong. Please try again.";
