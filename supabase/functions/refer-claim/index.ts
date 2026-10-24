// A new player opened a friend's invite link: link them to the inviter, with fraud checks in the database
// (same connection, device or browser as the inviter; brand-new account only; daily and lifetime caps).
import { authed, handler, HttpError, json } from "../_shared/http.ts";
import { cleanMarks, clientIp, hashIp } from "../_shared/marks.ts";

Deno.serve(handler(async (req) => {
  const { user, db } = await authed(req);
  const body = await req.json().catch(() => ({})) as { code?: unknown; dev?: unknown; vid?: unknown };
  if (typeof body.code !== "string" || !/^[A-Za-z0-9]{5,10}$/.test(body.code)) throw new HttpError(400, "bad_code");
  const { dev, vid } = cleanMarks(body);
  const { data, error } = await db.rpc("refer_claim_tx", { p_referred: user.id, p_code: body.code, p_ip: await hashIp(clientIp(req)), p_dev: dev, p_vid: vid });
  if (error) throw error;
  return json(data);
}));
