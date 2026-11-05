import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, parseOrigins } from "./cors.ts";

/** ALLOWED_ORIGIN: unset means any origin, as before; otherwise a comma-separated list (see cors.ts). */
const ORIGINS = parseOrigins(Deno.env.get("ALLOWED_ORIGIN"));
/** The headers when no request is at hand; handler() then sets the caller's own origin on every reply. */
export const cors = corsHeaders(null, ORIGINS);
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

/** Service-role client: bypasses row security. Only ever used inside these server functions. */
export const serviceClient = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

export async function authed(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const db = serviceClient();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "not_signed_in");
  return { user: data.user, db };
}

export function handler(fn: (req: Request) => Promise<Response>) {
  const run = async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response("ok");
    try {
      return await fn(req);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      const msg = String((e as { message?: string })?.message ?? e);
      if (msg.includes("insufficient_funds")) return json({ error: "insufficient_funds" }, 402);
      for (const code of ["round_in_progress", "no_booster", "boosters_not_allowed", "no_attempts", "event_closed", "age_not_confirmed", "stage_locked", "already_played", "challenge_expired", "not_challengeable", "boosted_round", "too_many_challenges"]) {
        if (msg.includes(code)) return json({ error: code }, 409);
      }
      console.error(e);
      return json({ error: "server_error" }, 500);
    }
  };
  return async (req: Request) => {
    const got = await run(req);
    const res = new Response(got.body, { status: got.status, statusText: got.statusText, headers: got.headers }); // headers we may change
    res.headers.delete("Access-Control-Allow-Origin");
    for (const [k, v] of Object.entries(corsHeaders(req.headers.get("Origin"), ORIGINS))) res.headers.set(k, v);
    return res;
  };
}
