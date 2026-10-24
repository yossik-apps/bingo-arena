// Instant accounts: a visitor who presses Play gets a real (guest) account at once, and can save it later.
import { callFn, supabase, TERMS_VERSION } from "./supabase";
import { onCrazyGames } from "./platform";
import { cgToken } from "./crazy";
import { trackStep } from "./track";

const A = ["Lucky", "Swift", "Golden", "Happy", "Sunny", "Clever", "Brave", "Cosmic", "Jolly", "Magic"];
const B = ["Star", "Ace", "Fox", "Comet", "Panda", "Tiger", "Pearl", "Rocket", "Ruby", "Owl"];
export const funName = () => A[Math.floor(Math.random() * A.length)] + B[Math.floor(Math.random() * B.length)] + Math.floor(10 + Math.random() * 90);

let off = false; // anonymous sign-ins are switched off in Supabase: fall back to the old free rounds
export const guestAccountsOff = () => off;

/** Creates the guest account. Resolves false if that is not possible (then the visitor plays the local free rounds). */
export async function startGuestAccount(): Promise<boolean> {
  if (off) return false;
  const { error } = await supabase.auth.signInAnonymously({
    options: { data: { name: funName(), guest: "true", terms: "true", terms_version: TERMS_VERSION, ...(onCrazyGames ? { joined_on: "crazygames" } : {}) } },
  });
  if (error) { if (/disabled|not enabled|anonymous/i.test(error.message)) off = true; console.warn("guest sign-in:", error.message); return false; }
  trackStep("guest_start");
  return true;
}

/** Logs in with the CrazyGames account if the player is logged in there. The current guest (if any) becomes that account. */
export async function cgSignIn(): Promise<"ok" | "none" | "error"> {
  const token = await cgToken();
  if (!token) return "none";
  try {
    const s = await callFn<{ access_token: string; refresh_token: string }>("cg-login", { token, terms: TERMS_VERSION });
    const { error } = await supabase.auth.setSession({ access_token: s.access_token, refresh_token: s.refresh_token });
    if (error) return "error";
    trackStep("cg_login");
    return "ok";
  } catch (e) { console.warn("cg-login:", (e as Error).message); return "error"; }
}

/** After Google or email was added to a guest account. */
export async function markSaved() {
  await supabase.rpc("guest_saved").then(() => undefined, () => undefined);
  trackStep("save_done");
}
