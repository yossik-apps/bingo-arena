// Google sign-in when the game runs inside another site's frame (CrazyGames).
// Google refuses to open inside a frame, and browsers keep a frame's storage apart from a normal window's.
// So: the game opens a small window on our own site; that window signs in with Google, leaves the login under a
// one-time code in the database, and closes. The game in the frame collects the login with the same code.
import { supabase } from "./supabase";

const randomCode = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");

/** In the frame: open the sign-in window (must run inside the click) and wait for the login. */
export function startPopupSignIn(onState: (s: "waiting" | "blocked" | "done" | "timeout" | "error", msg?: string) => void) {
  const code = randomCode();
  const w = window.open(`${location.origin}/?ba_auth=${code}`, "ba_auth", "width=480,height=680,menubar=no,toolbar=no");
  if (!w) { onState("blocked"); return () => undefined; }
  onState("waiting");
  let stop = false;
  const started = Date.now();
  const tick = async () => {
    if (stop) return;
    if (Date.now() - started > 5 * 60e3) { onState("timeout"); return; }
    const { data, error } = await supabase.rpc("relay_take", { p_code: code });
    if (!error && typeof data === "string" && data) {
      const { error: e2 } = await supabase.auth.refreshSession({ refresh_token: data });
      onState(e2 ? "error" : "done", e2?.message);
      return;
    }
    setTimeout(() => void tick(), 1500);
  };
  setTimeout(() => void tick(), 2000);
  return () => { stop = true; };
}

/** In the small window: the code from the address, kept (10 minutes) across the trip to Google and back.
 *  Only counts on our own pages that are part of that trip, so a normal visit later is never mistaken for it. */
export function popupCode(): string | null {
  const p = new URLSearchParams(location.search);
  const q = p.get("ba_auth");
  try {
    if (q && /^[a-f0-9]{32,128}$/.test(q)) { localStorage.setItem("ba_auth_code", JSON.stringify({ code: q, at: Date.now() })); return q; }
    const returning = p.has("code") || p.has("error") || p.has("error_description") || location.hash.includes("error");
    const saved = JSON.parse(localStorage.getItem("ba_auth_code") ?? "null") as { code: string; at: number } | null;
    if (!saved || Date.now() - saved.at > 10 * 60e3) { localStorage.removeItem("ba_auth_code"); return null; }
    return returning || window.name === "ba_auth" ? saved.code : null;
  } catch { return q; }
}

/** In the small window, once logged in: hand the login to the game and forget it here (it must not be used twice). */
export async function finishPopup(code: string): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  const s = data.session;
  if (!s) return false;
  supabase.auth.stopAutoRefresh();
  const { error } = await supabase.rpc("relay_put", { p_code: code, p_refresh: s.refresh_token });
  try {
    localStorage.removeItem("ba_auth_code");
    Object.keys(localStorage).filter((k) => k.startsWith("sb-") && k.endsWith("-auth-token")).forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
  return !error;
}
