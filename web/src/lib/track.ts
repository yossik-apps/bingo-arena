// Counts visits for the admin Analytics tab with a random browser ID (no name, email or IP address).
// Everything here is best-effort: if storage is blocked or the database is not updated yet, nothing breaks.
import { configured, supabase } from "./supabase";

let memVid = "";
export function visitorId(): string {
  try {
    let v = localStorage.getItem("ba_vid");
    if (!v || !/^[0-9a-f-]{36}$/.test(v)) { v = crypto.randomUUID(); localStorage.setItem("ba_vid", v); }
    return v;
  } catch {
    if (!memVid) memVid = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : "";
    return memVid;
  }
}

export const deviceKind = (): "phone" | "tablet" | "desktop" => {
  const w = Math.min(window.screen?.width || window.innerWidth, window.screen?.height || window.innerHeight);
  const touch = matchMedia("(pointer: coarse)").matches;
  if (touch && w < 600) return "phone";
  if (touch && w < 1100) return "tablet";
  return "desktop";
};

/** Where the visitor came from: ?utm_source=… wins, then the referring site, otherwise "direct". */
export function trafficSource(): string {
  try {
    const utm = new URLSearchParams(location.search).get("utm_source");
    if (utm) return utm.toLowerCase().slice(0, 40);
    if (!document.referrer) return "direct";
    const host = new URL(document.referrer).hostname.replace(/^www\./, "");
    if (host === location.hostname) return "direct";
    if (/google\./.test(host)) return "google";
    if (/bing\.com|duckduckgo|yahoo\./.test(host)) return "search";
    if (/facebook|fb\.com|instagram/.test(host)) return "facebook";
    if (/t\.co$|twitter|x\.com/.test(host)) return "x";
    if (/whatsapp|wa\.me/.test(host)) return "whatsapp";
    if (/tiktok/.test(host)) return "tiktok";
    return host.slice(0, 40);
  } catch { return "direct"; }
}

/** The visitor's country, guessed from the browser's time zone (no IP lookup). Falls back to the language region, e.g. en-GB → GB. */
export async function guessCountry(): Promise<string | null> {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const { TZ_COUNTRY } = await import("./tzCountry");
    if (tz && TZ_COUNTRY[tz]) return TZ_COUNTRY[tz];
    const m = (navigator.language || "").match(/-([A-Z]{2})$/i);
    return m ? m[1].toUpperCase() : null;
  } catch { return null; }
}

const sent = new Set<string>();
/** One call per page load and per account (so logging in links the visit). */
export function trackVisit(userId: string, landing: string) {
  const vid = visitorId();
  const key = vid + "|" + userId;
  if (!configured || !vid || sent.has(key)) return;
  sent.add(key);
  void guessCountry().then((cc) => {
    const base = { p_vid: vid, p_device: deviceKind(), p_source: trafficSource(), p_landing: landing };
    return supabase.rpc("track_visit", { ...base, p_country: cc }).then(({ error }) => {
      // database not updated to 015 yet: send without the country
      if (error && /function|PGRST20/i.test(error.message)) return supabase.rpc("track_visit", base);
    });
  }).then(() => undefined, () => undefined);
}

export function trackStep(step: "guest_round" | "signup_open" | "signup_google" | "signup_email" | "confirm_needed" | "guest_start" | "save_open" | "save_done" | "cg_login") {
  const vid = visitorId();
  if (!configured || !vid) return;
  if (step === "signup_open" || step === "save_open") { if (sent.has(step)) return; sent.add(step); }
  void supabase.rpc("track_step", { p_vid: vid, p_step: step }).then(() => undefined, () => undefined);
}

/** "Still here" every 2 minutes while the game is visible (admin sees who is online), and a nudge for the
 *  automation engine once per page load (it runs at most every 5 minutes, whoever nudges). */
let presenceTimer: ReturnType<typeof setInterval> | null = null;
export function startPresence() {
  if (!configured || presenceTimer) return;
  const ping = () => { if (document.visibilityState === "visible") void supabase.rpc("presence_ping", { p_vid: visitorId() || null }).then(() => undefined, () => undefined); };
  setTimeout(() => { ping(); void supabase.rpc("auto_tick").then(() => undefined, () => undefined); }, 4000);
  presenceTimer = setInterval(ping, 120e3);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") ping(); });
}
/** call right after logging in, so the admin sees the player at once */
export const pingNow = () => { if (configured) void supabase.rpc("presence_ping", { p_vid: visitorId() || null }).then(() => undefined, () => undefined); };
