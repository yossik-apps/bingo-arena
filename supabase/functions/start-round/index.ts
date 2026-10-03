import { authed, handler, HttpError, json } from "../_shared/http.ts";
import { ghostTarget } from "../_shared/engine.ts";

Deno.serve(handler(async (req) => {
  const { user, db } = await authed(req);
  const body = await req.json().catch(() => ({}));
  const { mode, eventId } = body as { mode?: string; eventId?: string };
  let level = (body as { level?: string }).level;
  if (mode !== "solo" && mode !== "ghost" && mode !== "tour") throw new HttpError(400, "mode_not_available");

  // Events (tournaments): the event decides the level and the entry fee.
  let eventFee: number | null = null;
  if (mode === "tour") {
    if (typeof eventId !== "string") throw new HttpError(400, "bad_request");
    const { data: ev } = await db.from("events").select("level,fee,status").eq("id", eventId).maybeSingle();
    if (!ev || ev.status !== "live") throw new HttpError(409, "event_closed");
    level = ev.level as string;
    eventFee = ev.fee as number;
  }

  const { data: cfgRow } = await db.from("game_config").select("data").eq("id", 1).single();
  const cfg = cfgRow!.data;
  const lv = cfg.levels?.[level ?? ""];
  if (!lv) throw new HttpError(400, "bad_level");
  const { data: prof } = await db.from("profiles").select("banned,adult_confirmed").eq("id", user.id).single();
  if (!prof || prof.banned) throw new HttpError(403, "account_suspended");
  if (!prof.adult_confirmed) throw new HttpError(403, "age_not_confirmed");
  if (cfg.g.maint) throw new HttpError(503, "maintenance");
  if (mode !== "solo" && !cfg.g.paid) throw new HttpError(403, "paid_modes_disabled");

  // Boosters (solo and vs-ghost only). The database checks you own them and uses one up per round.
  const wanted: unknown = (body as { boosters?: unknown }).boosters;
  const boosters = Array.isArray(wanted) ? [...new Set(wanted.filter((b): b is string => typeof b === "string"))] : [];
  if (boosters.some((b) => !["slow", "win", "time", "hint"].includes(b))) throw new HttpError(400, "bad_booster");

  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  if (mode === "tour" && boosters.length > 0) throw new HttpError(400, "boosters_not_allowed");
  const fee = mode === "solo" ? 0 : mode === "tour" ? (eventFee ?? 0) : lv.fee;
  const rules = { ...lv, total: cfg.g.total };
  if (boosters.includes("slow")) rules.every = Math.round(rules.every * 1.3);
  if (boosters.includes("win")) rules.win += 1;
  if (boosters.includes("time")) rules.total += 15;
  if (boosters.includes("hint")) rules.hint = true;
  // Snapshot of the rules for this round, so changing the config mid-round cannot affect it.
  const params = { ...rules, fee, pay: cfg.g.pay, boosters, ghost: mode === "ghost" ? ghostTarget(seed, lv) : null };

  const { data: roundId, error } = await db.rpc("start_round_tx", {
    p_user: user.id, p_mode: mode, p_level: level, p_fee: fee, p_seed: seed, p_params: params, p_boosters: boosters, p_event: mode === "tour" ? eventId : null,
  });
  if (error) throw error;
  const { data: bal } = await db.from("wallet").select("balance").eq("user_id", user.id).maybeSingle();
  return json({ roundId, seed, params, balance: bal?.balance ?? 0 });
}));
