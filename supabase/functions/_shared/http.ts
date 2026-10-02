import { createClient } from "npm:@supabase/supabase-js@2";

export const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
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
  return async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    try {
      return await fn(req);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      const msg = String((e as { message?: string })?.message ?? e);
      if (msg.includes("insufficient_funds")) return json({ error: "insufficient_funds" }, 402);
      for (const code of ["round_in_progress", "no_booster", "boosters_not_allowed"]) {
        if (msg.includes(code)) return json({ error: code }, 409);
      }
      console.error(e);
      return json({ error: "server_error" }, 500);
    }
  };
}
