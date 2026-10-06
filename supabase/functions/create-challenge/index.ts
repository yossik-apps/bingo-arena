import { authed, handler, HttpError, json } from "../_shared/http.ts";

// Turns one of your finished solo or ghost rounds into a link a friend can try to beat.
Deno.serve(handler(async (req) => {
  const { user, db } = await authed(req);
  const { roundId } = (await req.json().catch(() => ({}))) as { roundId?: string };
  if (typeof roundId !== "string") throw new HttpError(400, "bad_request");
  const { data, error } = await db.rpc("create_challenge_tx", { p_user: user.id, p_round: roundId });
  if (error) {
    const m = String(error.message);
    for (const c of ["round_not_found", "not_challengeable", "boosted_round", "too_many_challenges"]) if (m.includes(c)) throw new HttpError(409, c);
    throw error;
  }
  return json({ code: data });
}));
