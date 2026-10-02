import { authed, handler, json } from "../_shared/http.ts";

Deno.serve(handler(async (req) => {
  const { user, db } = await authed(req);
  const { data, error } = await db.rpc("claim_daily", { p_user: user.id });
  if (error) throw error;
  return json(data);
}));
