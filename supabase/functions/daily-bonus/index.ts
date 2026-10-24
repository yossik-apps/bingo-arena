import { authed, handler, json } from "../_shared/http.ts";
import { cleanMarks, clientIp, hashIp } from "../_shared/marks.ts";

Deno.serve(handler(async (req) => {
  const { user, db } = await authed(req);
  // remember this player's connection/device/browser fingerprints (hashes) for the invite fraud checks
  const body = await req.json().catch(() => ({})) as { dev?: unknown; vid?: unknown };
  const { dev, vid } = cleanMarks(body);
  await db.rpc("note_marks", { p_user: user.id, p_ip: await hashIp(clientIp(req)), p_dev: dev, p_vid: vid }).then(() => undefined, () => undefined); // optional before update 020
  const { data, error } = await db.rpc("claim_daily", { p_user: user.id });
  if (error) throw error;
  return json(data);
}));
