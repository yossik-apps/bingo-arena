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

const sent = new Set<string>();
/** One call per page load and per account (so logging in links the visit). */
export function trackVisit(userId: string, landing: string) {
  const vid = visitorId();
  const key = vid + "|" + userId;
  if (!configured || !vid || sent.has(key)) return;
  sent.add(key);
  void supabase.rpc("track_visit", { p_vid: vid, p_device: deviceKind(), p_source: trafficSource(), p_landing: landing }).then(() => undefined, () => undefined);
}

export function trackStep(step: "guest_round" | "signup_open") {
  const vid = visitorId();
  if (!configured || !vid) return;
  if (step === "signup_open") { if (sent.has("so")) return; sent.add("so"); }
  void supabase.rpc("track_step", { p_vid: vid, p_step: step }).then(() => undefined, () => undefined);
}
