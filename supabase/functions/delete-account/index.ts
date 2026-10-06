import { authed, handler, HttpError, json } from "../_shared/http.ts";

// Permanently deletes the signed-in player's account and personal data. Needs {"confirm":"DELETE"}.
Deno.serve(handler(async (req) => {
  const { user, db } = await authed(req);
  const { confirm } = (await req.json().catch(() => ({}))) as { confirm?: string };
  if (confirm !== "DELETE") throw new HttpError(400, "confirm_required");
  const { error } = await db.auth.admin.deleteUser(user.id); // profile, wallet, rounds, items... are removed with it
  if (error) throw error;
  return json({ deleted: true });
}));
