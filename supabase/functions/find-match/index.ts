import { authed, handler, HttpError, json } from "../_shared/http.ts";

// Joins the real-player queue (or starts a match if someone is already waiting).
// The players then poll the database function my_match() to learn when the match is ready.
Deno.serve(handler(async (req) => {
  const { user, db } = await authed(req);
  const { level } = (await req.json().catch(() => ({}))) as { level?: string };

  const { data: cfgRow } = await db.from("game_config").select("data").eq("id", 1).single();
  const cfg = cfgRow!.data;
  const lv = cfg.levels?.[level ?? ""];
  if (!lv) throw new HttpError(400, "bad_level");
  const { data: prof } = await db.from("profiles").select("banned,adult_confirmed").eq("id", user.id).single();
  if (!prof || prof.banned) throw new HttpError(403, "account_suspended");
  if (!prof.adult_confirmed) throw new HttpError(403, "age_not_confirmed");
  if (cfg.g.maint) throw new HttpError(503, "maintenance");
  if (!cfg.g.paid || !cfg.g.pvp) throw new HttpError(403, "pvp_disabled");

  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  // Both players get exactly the same card and number order, and no boosters. The rules are frozen into the match.
  const params = { ...lv, total: cfg.g.total, fee: lv.fee, pay: cfg.g.pay, boosters: [], ghost: null };
  const { data, error } = await db.rpc("matchmake_tx", { p_user: user.id, p_level: level, p_params: params, p_seed: seed });
  if (error) throw error;
  return json(data);
}));
