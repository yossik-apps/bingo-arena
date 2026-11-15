import { authed, handler, HttpError, json } from "../_shared/http.ts";
import { matchParams } from "../_shared/rounds.ts";
import { readFlag, roundVersion, v2Level } from "../_shared/balance.ts";
import { abandonRound, decideOpen, openRound } from "../_shared/openRound.ts";

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

  // A round the player left open (WP5): an ended one, or one with under 10 seconds left, is closed as abandoned. One that is still
  // running blocks the queue; the answer says for how many seconds (the lobby offers to continue it or start a new one).
  // A live match still on is left to matchmake_tx, as before (it answers "ready" while the match is on).
  const open = await openRound(db, user.id);
  if (open) {
    const d = decideOpen(open, Date.now());
    if (d.action === "close") await abandonRound(db, user.id, open);
    else if (d.action === "resume") return json({ error: "round_in_progress", wait: Math.ceil(d.leftMs / 1000) + 5 }, 409);
  }

  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  // Both players get exactly the same card and number order, and no boosters. The rules are frozen into the match.
  // The match is created by whoever arrives second, and these params are frozen for both players. Version 2 only when the flag is All.
  const flag = await readFlag(db);
  const cv = roundVersion({ mode: "pvp", flag: flag.mode, admin: false, ready: v2Level(cfg, level!) !== null });
  const params = matchParams(cfg, level!, cv === 2);
  const { data, error } = await db.rpc("matchmake_tx", { p_user: user.id, p_level: level, p_params: params, p_seed: seed });
  if (error) throw error;
  return json(data);
}));
