import { authed, handler, HttpError, json } from "../_shared/http.ts";
import { ghostTarget } from "../_shared/engine.ts";

Deno.serve(handler(async (req) => {
  const { user, db } = await authed(req);
  const body = await req.json().catch(() => ({}));
  const { mode, level } = body as { mode?: string; level?: string };
  if (mode !== "solo" && mode !== "ghost") throw new HttpError(400, "mode_not_available");

  const { data: cfgRow } = await db.from("game_config").select("data").eq("id", 1).single();
  const cfg = cfgRow!.data;
  const lv = cfg.levels?.[level ?? ""];
  if (!lv) throw new HttpError(400, "bad_level");
  const { data: prof } = await db.from("profiles").select("banned").eq("id", user.id).single();
  if (!prof || prof.banned) throw new HttpError(403, "account_suspended");
  if (cfg.g.maint) throw new HttpError(503, "maintenance");
  if (mode !== "solo" && !cfg.g.paid) throw new HttpError(403, "paid_modes_disabled");

  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  const fee = mode === "solo" ? 0 : lv.fee;
  // Snapshot of the rules for this round, so changing the config mid-round cannot affect it.
  const params = { ...lv, fee, total: cfg.g.total, pay: cfg.g.pay, ghost: mode === "ghost" ? ghostTarget(seed, lv) : null };

  const { data: roundId, error } = await db.rpc("start_round_tx", {
    p_user: user.id, p_mode: mode, p_level: level, p_fee: fee, p_seed: seed, p_params: params,
  });
  if (error) throw error;
  const { data: bal } = await db.from("wallet").select("balance").eq("user_id", user.id).maybeSingle();
  return json({ roundId, seed, params, balance: bal?.balance ?? 0 });
}));
