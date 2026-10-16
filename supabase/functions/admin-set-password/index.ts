import { authed, handler, HttpError, json } from "../_shared/http.ts";

// Lets an admin set a new password for a player (for example after "I forgot my password").
// Checked twice: the caller must be a signed-in admin, and the change is written to the audit log.
Deno.serve(handler(async (req) => {
  const { user, db } = await authed(req);
  const { data: me } = await db.from("profiles").select("role,banned").eq("id", user.id).single();
  if (!me || me.role !== "admin" || me.banned) throw new HttpError(403, "forbidden");

  const { userId, password } = (await req.json().catch(() => ({}))) as { userId?: string; password?: string };
  if (typeof userId !== "string" || typeof password !== "string") throw new HttpError(400, "bad_request");
  if (password.length < 8 || password.length > 72) throw new HttpError(400, "weak_password");
  const { data: target } = await db.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (!target) throw new HttpError(404, "player_not_found");

  const { error } = await db.auth.admin.updateUserById(userId, { password });
  if (error) throw error;
  await db.from("audit_log").insert({ actor: user.id, action: "set_password", detail: { user: userId } }); // the password itself is never stored
  return json({ ok: true });
}));
