// Logs in a player who is logged in to CrazyGames, with the token from the CrazyGames SDK.
// The token is checked against CrazyGames' public key, so nobody can pretend to be someone else.
//   * Known CrazyGames user          → their account.
//   * New, and playing as a guest    → the guest account becomes their CrazyGames account (progress is kept).
//   * New, logged in to an account   → that account is linked to CrazyGames.
//   * New, nothing else              → a new account.
// Answers with a normal login (access + refresh token) for the game to use.
import { createClient } from "npm:@supabase/supabase-js@2";
import { importSPKI, jwtVerify } from "npm:jose@5";
import { handler, HttpError, json, serviceClient } from "../_shared/http.ts";

const KEY_URL = "https://sdk.crazygames.com/publicKey.json";
const DOMAIN = Deno.env.get("CG_EMAIL_DOMAIN") ?? "crazygames.invalid"; // never receives mail: only used to identify the account
const TERMS = Deno.env.get("TERMS_VERSION") ?? "";

let key: { k: CryptoKey; at: number } | null = null;
async function publicKey(): Promise<CryptoKey> {
  if (key && Date.now() - key.at < 6 * 3600e3) return key.k;
  const r = await fetch(KEY_URL);
  if (!r.ok) throw new HttpError(503, "cg_unavailable");
  const { publicKey: pem } = await r.json() as { publicKey: string };
  key = { k: await importSPKI(pem, "RS256"), at: Date.now() };
  return key.k;
}

type CgUser = { userId: string; username?: string; gameId?: string };

Deno.serve(handler(async (req) => {
  const body = await req.json().catch(() => ({})) as { token?: string; terms?: string };
  if (typeof body.token !== "string" || body.token.length < 20 || body.token.length > 4000) throw new HttpError(400, "bad_request");
  let cg: CgUser;
  try {
    const { payload } = await jwtVerify(body.token, await publicKey(), { algorithms: ["RS256"] });
    cg = payload as unknown as CgUser;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(401, "cg_token_invalid");
  }
  const gameId = Deno.env.get("CG_GAME_ID");
  if (!cg.userId || !/^[A-Za-z0-9_-]{1,64}$/.test(String(cg.userId))) throw new HttpError(401, "cg_token_invalid");
  if (gameId && cg.gameId && String(cg.gameId) !== gameId) throw new HttpError(401, "cg_token_invalid");
  const cgId = String(cg.userId);
  const name = String(cg.username ?? "").trim().slice(0, 20);

  const db = serviceClient();
  let userId: string | null = null;
  const { data: known } = await db.from("profiles").select("id").eq("cg_user", cgId).maybeSingle();
  if (known) userId = known.id as string;

  if (!userId) {
    // who is calling: a guest or a logged-in player can take this CrazyGames user over
    const bearer = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: caller } = bearer ? await db.auth.getUser(bearer) : { data: { user: null } };
    if (caller?.user) {
      const { data: prof } = await db.from("profiles").select("id,is_guest,cg_user,banned").eq("id", caller.user.id).maybeSingle();
      if (prof && !prof.cg_user) {
        if (prof.is_guest) {
          const { error } = await db.auth.admin.updateUserById(prof.id as string, {
            email: `cg-${cgId.toLowerCase()}@${DOMAIN}`, email_confirm: true, app_metadata: { cg_user: cgId },
          });
          if (error) throw error;
        }
        const { error } = await db.rpc("cg_attach", { p_user: prof.id, p_cg: cgId, p_name: name });
        if (error) throw error;
        userId = prof.id as string;
      }
    }
  }

  if (!userId) {
    const { data, error } = await db.auth.admin.createUser({
      email: `cg-${cgId.toLowerCase()}@${DOMAIN}`, email_confirm: true,
      app_metadata: { cg_user: cgId },
      user_metadata: { name: name || undefined, joined_on: "crazygames", terms: "true", terms_version: body.terms?.slice(0, 20) || TERMS },
    });
    if (error) {
      // two tabs at once: the other one created it a moment ago
      const { data: again } = await db.from("profiles").select("id").eq("cg_user", cgId).maybeSingle();
      if (!again) throw error;
      userId = again.id as string;
    } else userId = data.user.id;
  }

  // a login for that account: a one-time link that is redeemed here, never e-mailed
  const { data: u, error: ue } = await db.auth.admin.getUserById(userId);
  if (ue || !u.user?.email) throw new HttpError(500, "cg_no_email");
  const { data: link, error: le } = await db.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
  if (le) throw le;
  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: s, error: se } = await anon.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
  if (se || !s.session) throw se ?? new HttpError(500, "cg_session");
  return json({ access_token: s.session.access_token, refresh_token: s.session.refresh_token, user_id: userId });
}));
