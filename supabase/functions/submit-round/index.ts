import { authed, handler, HttpError, json } from "../_shared/http.ts";
import { levelOf, scoreTaps, validateTaps, xpFor, type Params } from "../_shared/engine.ts";

type RoundParams = Params & { total: number; pay: number; ghost: number | null };

Deno.serve(handler(async (req) => {
  const { user, db } = await authed(req);
  const { roundId, taps, abandon } = await req.json().catch(() => ({}));
  if (typeof roundId !== "string") throw new HttpError(400, "bad_request");

  const { data: r } = await db.from("rounds").select("*").eq("id", roundId).eq("user_id", user.id).maybeSingle();
  if (!r) throw new HttpError(404, "round_not_found");
  if (r.status !== "active") throw new HttpError(409, "round_already_finished");

  if (abandon === true) {
    // The player left the round. The entry fee is not refunded, but a new round can start straight away.
    await db.from("rounds").update({ status: "rejected", finished_at: new Date().toISOString(), result: { reason: "abandoned" } })
      .eq("id", r.id).eq("status", "active");
    return json({ abandoned: true });
  }

  const reject = async (reason: string) => {
    await db.from("rounds").update({ status: "rejected", finished_at: new Date().toISOString(), result: { reason } })
      .eq("id", r.id).eq("status", "active");
    throw new HttpError(422, "round_rejected");
  };

  const p = r.params as RoundParams;
  const totalMs = p.total * 1000;
  const elapsed = Date.now() - new Date(r.started_at).getTime();
  if (elapsed < totalMs - 2500) await reject("submitted_too_early");

  const v = validateTaps(taps, totalMs);
  if (!v.ok) { await reject(v.reason); return json({}); }
  if (v.taps.some((t) => t.t > elapsed + 1500)) await reject("time_mismatch");

  const res = scoreTaps(Number(r.seed), p, v.taps);

  let win = false, prize = 0, best: number | null = null;
  if (r.mode === "solo") {
    const { data: b } = await db.from("rounds").select("score").eq("user_id", user.id).eq("mode", "solo")
      .eq("level", r.level).eq("status", "scored").order("score", { ascending: false }).limit(1).maybeSingle();
    const prev: number = b?.score ?? 0;
    best = prev;
    win = res.score > prev;
    prize = win ? 7 : 2;
  } else if (r.mode === "tour" || r.mode === "pvp") {
    win = false; prize = 0; // event prizes are paid by the admin; match prizes are paid when the match is settled
  } else {
    win = res.score > (p.ghost ?? 0);
    prize = win ? Math.round(r.fee * p.pay) : 0;
  }
  const xp = xpFor(res.score, p.xm, r.mode === "solo" ? 0.6 : r.mode === "pvp" ? 1.3 : 1, win);

  const { data: ok, error } = await db.rpc("finish_round", {
    p_round: r.id, p_score: res.score, p_prize: prize, p_xp: xp,
    p_result: { ...res, marked: undefined, win, ghost: p.ghost, best },
  });
  if (error) throw error;
  if (!ok?.ok) throw new HttpError(409, "round_already_finished");

  let matchId: string | null = null;
  if (r.mode === "pvp") {
    const { data: mp } = await db.from("match_players").select("match_id").eq("round_id", r.id).maybeSingle();
    matchId = (mp?.match_id ?? null) as string | null;
    if (matchId) await db.rpc("settle_match_tx", { p_match: matchId }); // pays out at once if the opponent already finished
  }

  const [{ data: bal }, { data: prof }] = await Promise.all([
    db.from("wallet").select("balance").eq("user_id", user.id).maybeSingle(),
    db.from("profiles").select("xp").eq("id", user.id).single(),
  ]);
  return json({
    score: res.score, daubs: res.daubs, wrong: res.wrong, late: res.late, lines: res.lines, maxMult: res.maxMult,
    accuracy: res.accuracy, avgReactionMs: res.avgReactionMs, win, prize, xp, ghost: p.ghost, best,
    mode: r.mode as string, matchId, eventId: (r.event_id ?? null) as string | null,
    balance: bal?.balance ?? 0, level: levelOf(prof?.xp ?? 0), achievements: (ok.ach ?? []) as string[],
  });
}));
