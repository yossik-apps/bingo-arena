// Invite links (?r=CODE): remembered for 30 days so the visitor can look around first, then used once
// when their account exists. The server checks for self-referrals (same connection, device or browser).
import { callFn, supabase } from "./supabase";
import { visitorId } from "./track";
import { onCrazyGames } from "./platform";

const KEY = "ba_ref";
{
  const q = new URLSearchParams(location.search);
  const c = q.get("r");
  if (c && /^[A-Za-z0-9]{5,10}$/.test(c)) {
    try { if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, JSON.stringify({ code: c.toUpperCase(), at: Date.now() })); } catch { /* ignore */ }
    q.delete("r");
    const rest = q.toString();
    history.replaceState({}, "", location.pathname + (rest ? "?" + rest : "") + location.hash);
  }
}

export function pendingRef(): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as { code: string; at: number } | null;
    if (!v || Date.now() - v.at > 30 * 864e5) return null;
    return v.code;
  } catch { return null; }
}
const clearRef = () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } };

/** A one-way fingerprint of this device (screen, system, language, time zone). Only the hash leaves the browser. */
let devP: Promise<string | null> | null = null;
export function deviceHash(): Promise<string | null> {
  if (devP) return devP;
  devP = (async () => {
    try {
      const n = navigator as Navigator & { deviceMemory?: number };
      const raw = [n.userAgent, n.language, (n.languages ?? []).join(","), Intl.DateTimeFormat().resolvedOptions().timeZone,
        screen.width + "x" + screen.height + "x" + screen.colorDepth, devicePixelRatio, n.hardwareConcurrency ?? "", n.deviceMemory ?? "", n.maxTouchPoints ?? ""].join("|");
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch { return null; }
  })();
  return devP;
}
export async function marks() { return { dev: await deviceHash(), vid: visitorId() || null }; }

export type ClaimRes = { ok: boolean; status?: string; inviter?: string; friend_coins?: number; error?: string };
/** Uses the remembered invite link for this (new) account. Resolves null when there is nothing to do. */
export async function claimRef(): Promise<ClaimRes | null> {
  const code = pendingRef();
  if (!code) return null;
  try {
    const r = await callFn<ClaimRes>("refer-claim", { code, ...(await marks()) });
    clearRef();
    return r;
  } catch (e) {
    const m = (e as Error).message;
    if (m !== "server_error") clearRef(); // a clear "no" (bad code, function missing…) is final; a server hiccup tries again next time
    return null;
  }
}

export const refLookup = async (code: string): Promise<string | null> => {
  const { data, error } = await supabase.rpc("ref_lookup", { p_code: code });
  return error ? null : (data as string | null);
};
export const refLink = (code: string) => `${location.origin}/?r=${code}`;
/** Invites need links to our own website, which CrazyGames does not allow inside their site. */
export const refAvailable = !onCrazyGames;
