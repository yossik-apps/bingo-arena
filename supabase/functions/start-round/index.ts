import { authed, handler, HttpError, json } from "../_shared/http.ts";
import { buildRound, type DailyRow, type DuelRow, type StageRow } from "../_shared/rounds.ts";
import { ensureDaily } from "../_shared/daily.ts";
import { activeBoosts } from "../_shared/liveops.ts";
import { DRILLS, type Skill } from "../_shared/engine.ts";

const MODES = ["solo", "ghost", "tour", "stage", "daily", "duel", "drill"];

Deno.serve(handler(async (req) => {
  const { user, db } = await authed(req);
  const body = await req.json().catch(() => ({}));
  const { mode, eventId, stageId, code, skill } = body as { mode?: string; eventId?: string; stageId?: string; code?: string; skill?: string };
  let level = (body as { level?: string }).level;
  if (!mode || !MODES.includes(mode)) throw new HttpError(400, "mode_not_available");

  const { data: cfgRow } = await db.from("game_config").select("data").eq("id", 1).single();
  const cfg = cfgRow!.data;
  const { data: prof } = await db.from("profiles").select("banned,adult_confirmed").eq("id", user.id).single();
  if (!prof || prof.banned) throw new HttpError(403, "account_suspended");
  if (!prof.adult_confirmed) throw new HttpError(403, "age_not_confirmed");
  if (cfg.g.maint) throw new HttpError(503, "maintenance");
  if (mode !== "solo" && mode !== "stage" && mode !== "daily" && mode !== "duel" && mode !== "drill" && !cfg.g.paid) throw new HttpError(403, "paid_modes_disabled");

  // Boosters (solo and vs-ghost only). The database checks you own them and uses one up per round.
  const wanted: unknown = (body as { boosters?: unknown }).boosters;
  const boosters = Array.isArray(wanted) ? [...new Set(wanted.filter((b): b is string => typeof b === "string"))] : [];
  if (boosters.some((b) => !["slow", "win", "time", "hint"].includes(b))) throw new HttpError(400, "bad_booster");
  if (mode !== "solo" && mode !== "ghost" && boosters.length > 0) throw new HttpError(400, "boosters_not_allowed");

  let stage: StageRow | null = null, daily: (DailyRow & { level: string }) | null = null, duel: DuelRow | null = null, eventFee: number | null = null;

  if (mode === "stage") { // a fixed board with its own rules; locked stages cannot be started
    if (typeof stageId !== "string") throw new HttpError(400, "bad_request");
    const { data: st } = await db.from("stages").select("level,seed,mods,s1,s2,s3").eq("id", stageId).maybeSingle();
    if (!st) throw new HttpError(400, "bad_request");
    const { data: open } = await db.rpc("stage_unlocked", { p_user: user.id, p_stage: stageId });
    if (!open) throw new HttpError(403, "stage_locked");
    stage = st as StageRow; level = st.level as string;
  }
  if (mode === "tour") { // the event decides the level and the entry fee
    if (typeof eventId !== "string") throw new HttpError(400, "bad_request");
    const { data: ev } = await db.from("events").select("level,fee,status").eq("id", eventId).maybeSingle();
    if (!ev || ev.status !== "live") throw new HttpError(409, "event_closed");
    level = ev.level as string; eventFee = ev.fee as number;
  }
  if (mode === "daily") { // one shared board per day, one try each
    daily = await ensureDaily(db, cfg);
    level = daily.level;
    const { data: done } = await db.from("rounds").select("id").eq("user_id", user.id).eq("daily_day", daily.day).maybeSingle();
    if (done) throw new HttpError(409, "already_played");
  }
  if (mode === "duel") { // replay a friend's run on their exact board and rules
    if (typeof code !== "string") throw new HttpError(400, "bad_request");
    const { data: ch } = await db.from("challenges").select("code,creator,level,seed,params,expires_at").eq("code", code).maybeSingle();
    if (!ch) throw new HttpError(404, "challenge_not_found");
    if (ch.creator === user.id) throw new HttpError(403, "own_challenge");
    if (new Date(ch.expires_at).getTime() < Date.now()) throw new HttpError(410, "challenge_expired");
    const { data: played } = await db.from("rounds").select("id").eq("user_id", user.id).eq("challenge_code", code).maybeSingle();
    if (played) throw new HttpError(409, "already_played");
    duel = ch as unknown as DuelRow; level = ch.level as string;
  }

  let drill: { skill: string; mods: (typeof DRILLS)[Skill]["mods"] } | null = null;
  if (mode === "drill") { // a free 60-second drill that trains one Bingo DNA skill
    const d = DRILLS[skill as Skill];
    if (!d) throw new HttpError(400, "bad_request");
    drill = { skill: skill as string, mods: d.mods }; level = d.level;
  }

  if (!cfg.levels?.[level ?? ""]) throw new HttpError(400, "bad_level");
  const built = buildRound({ mode, level: level!, cfg, boosters, randomSeed: crypto.getRandomValues(new Uint32Array(1))[0], stage, daily, duel, eventFee, drill, feePct: (await activeBoosts(db)).feePct });

  const { data: roundId, error } = await db.rpc("start_round_tx", {
    p_user: user.id, p_mode: mode, p_level: level, p_fee: built.fee, p_seed: built.seed, p_params: built.params, p_boosters: boosters, p_event: mode === "tour" ? eventId : null,
  });
  if (error) throw error;

  // Tag the round. The database allows one daily round and one duel round per player, so a double start fails here.
  const tag = mode === "stage" ? { stage_id: stageId } : mode === "daily" ? { daily_day: daily!.day } : mode === "duel" ? { challenge_code: code } : null;
  if (tag) {
    const { error: tagErr } = await db.from("rounds").update(tag).eq("id", roundId);
    if (tagErr) {
      await db.from("rounds").update({ status: "rejected", finished_at: new Date().toISOString(), result: { reason: "duplicate" } }).eq("id", roundId);
      throw new HttpError(409, "already_played");
    }
  }
  const { data: bal } = await db.from("wallet").select("balance").eq("user_id", user.id).maybeSingle();
  return json({ roundId, seed: built.seed, params: built.params, balance: bal?.balance ?? 0 });
}));
