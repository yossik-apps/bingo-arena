// Screen heatmaps (admin analytics, flag "heatmaps", Off by default).
// Records where players tap on each screen and how far they scroll, and sends it in small batches.
// Anonymous: no player id, no browser id. Nothing is recorded during a round (the server keeps the board heatmap),
// on the admin pages, or when the flag is off. If anything fails, it simply stops.
import { configured, supabase } from "./supabase";
import { deviceKind } from "./track";

/** Classic and new navigation labels → screen names. */
const NAV: [string, string][] = [["Play", "lobby"], ["Journey", "journey"], ["Compete", "compete"], ["Collect", "collect"], ["Shop", "shop"],
  ["Bingo DNA", "profile"], ["Profile", "profile"], ["Coins", "wallet"], ["Wallet", "wallet"], ["Inbox", "inbox"], ["Invite friends", "refer"],
  ["Help", "help"], ["Admin", "admin"]];

const visible = (el: Element) => (el as HTMLElement).offsetParent !== null || getComputedStyle(el).position === "fixed";
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 28);

/** The current screen, worked out from the page itself. A data-screen attribute on <html>, if the app sets one, wins. */
export function screenName(doc: Document = document): string {
  let base = doc.documentElement.dataset.screen ?? "";
  if (!base) {
    if (doc.querySelector(".adm-title")) base = "admin";
    else if (doc.querySelector("section#play")) base = "play";
    else if (doc.querySelector("section.rs")) base = "result";
    else if (doc.querySelector("section.mm")) base = "match";
    else {
      const cur = Array.from(doc.querySelectorAll('nav [aria-current="page"]')).map((b) => (b.textContent ?? "").trim()).find(Boolean) ?? "";
      base = NAV.find(([label]) => cur.startsWith(label))?.[1] ?? (cur ? slug(cur) : "other");
    }
    const header = doc.querySelector("header");
    if (header && /Play free|Starting…/.test(header.textContent ?? "")) base = "guest-" + base; // a visitor without an account
  }
  // a pop-up on top (first-visit card, sign-up, calendar…) counts as its own screen
  const dlg = Array.from(doc.querySelectorAll('[role="dialog"][aria-modal="true"]')).find(visible);
  if (dlg) base += ":" + slug(dlg.getAttribute("aria-labelledby") || "dialog");
  return base.slice(0, 60);
}

const INTERACTIVE = 'button, a[href], input, select, textarea, label, summary, [role="button"], [role="tab"], [role="radio"], [role="checkbox"], [role="link"], [tabindex]:not([tabindex="-1"])';
/** A short name for what was tapped. Numbers become #, so scores, coins and names with digits are not stored. */
export function elementName(target: Element): { el: string; dead: boolean } {
  const hit = target.closest(INTERACTIVE);
  const clean = (s: string) => s.replace(/\s+/g, " ").trim().replace(/\d/g, "#").slice(0, 40);
  if (hit) {
    // inside a list of players (rows), use the row's kind instead of its text
    const row = hit.closest("tr, li");
    const text = clean(hit.getAttribute("aria-label") ?? hit.textContent ?? "");
    const tag = hit.tagName.toLowerCase();
    if (row && !(tag === "button" && text.length <= 24)) return { el: `${row.tagName.toLowerCase()}.${(row.className || "row").toString().split(" ")[0]}`.slice(0, 60), dead: false };
    return { el: (text || `${tag}.${(hit.className || "").toString().split(" ")[0]}`).slice(0, 60), dead: false };
  }
  const box = target.closest("[class]") ?? target;
  return { el: `${box.tagName.toLowerCase()}.${(box.className || "").toString().split(" ")[0]}`.slice(0, 60), dead: true };
}

/** The element that scrolls the page (the window, or the content area on computers). */
export function mainScroller(): { top: number; el: Element | null } {
  const se = document.scrollingElement;
  if (se && se.scrollHeight > innerHeight + 1 && window.scrollY > 0) return { top: window.scrollY, el: null };
  for (const sel of [".content", "main", ".nu-main", "[data-scroller]"]) {
    const el = document.querySelector(sel);
    if (el && el.scrollHeight > el.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)) return { top: el.scrollTop, el };
  }
  return { top: window.scrollY, el: null };
}
export const isWide = () => matchMedia("(min-width:900px) and (min-height:400px)").matches;

type Tap = { s: string; w: boolean; vw: number; x: number; y: number; el: string; d: boolean; r: boolean };
let queue: Tap[] = [];
let scrolls: { s: string; b: number }[] = [];
let sent = 0, on = false, timer: ReturnType<typeof setInterval> | null = null;
const recent: { x: number; y: number; t: number }[] = [];
const MAX_PER_LOAD = 300; // a page load never sends more than this

const skip = (s: string) => s.startsWith("admin") || s === "play" || s === "guest-play" || s.startsWith("play:");

async function flush() {
  if (!on || (!queue.length && !scrolls.length)) return;
  const taps = queue.splice(0, 60), sc = scrolls.splice(0, 20);
  const { data, error } = await supabase.rpc("hm_ui", { p_device: deviceKind(), p_taps: taps, p_scroll: sc });
  if (error || data === -1) stop(); // switched off, or the database update is not installed
}

// scroll depth: the deepest tenth seen on each screen view
let view = { s: "", deepest: 0 };
function closeView() {
  if (!view.s || skip(view.s)) return;
  scrolls.push({ s: view.s, b: Math.min(10, Math.max(0, Math.floor(view.deepest * 10))) });
}
function trackScroll() {
  const s = screenName();
  if (s !== view.s) { closeView(); view = { s, deepest: 0 }; }
  const { el } = mainScroller();
  const h = el ? el.scrollHeight : document.documentElement.scrollHeight, top = el ? el.scrollTop : window.scrollY, vh = el ? el.clientHeight : innerHeight;
  view.deepest = Math.max(view.deepest, h <= vh + 2 ? 1 : (top + vh) / h);
}

function onTap(e: PointerEvent) {
  if (!on || sent >= MAX_PER_LOAD || !(e.target instanceof Element) || e.target.closest("[data-heat-ignore]")) return;
  const s = screenName();
  if (skip(s)) return;
  const dialog = s.includes(":");
  const { top } = dialog ? { top: 0 } : mainScroller();
  const now = performance.now();
  const near = recent.filter((r) => now - r.t < 900 && Math.hypot(r.x - e.clientX, r.y - e.clientY) < 40).length;
  recent.push({ x: e.clientX, y: e.clientY, t: now });
  if (recent.length > 8) recent.shift();
  const { el, dead } = elementName(e.target);
  queue.push({ s, w: isWide(), vw: Math.round(innerWidth), x: Math.round((e.clientX / Math.max(1, innerWidth)) * 1000), y: Math.round(e.clientY + top), el, d: dead, r: near >= 2 });
  sent++;
  trackScroll();
  if (queue.length >= 30) void flush();
}

function stop() {
  on = false;
  if (timer) clearInterval(timer);
  timer = null;
  window.removeEventListener("pointerdown", onTap, true);
}

/** Starts recording if the Heatmaps flag allows it for this viewer. Called once per page load. */
let asking = false;
export async function startHeat() {
  if (!configured || on || asking) return;
  asking = true;
  try {
    const { data, error } = await supabase.rpc("hm_collect");
    if (error || data !== true) return;
  } catch { return; } finally { asking = false; }
  if (on) return;
  on = true;
  window.addEventListener("pointerdown", onTap, { capture: true, passive: true });
  if (!listening) {
    listening = true;
    document.addEventListener("scroll", () => { if (on) trackScroll(); }, { capture: true, passive: true });
    document.addEventListener("visibilitychange", () => { if (on && document.visibilityState === "hidden") { closeView(); view = { s: "", deepest: 0 }; void flush(); } });
  }
  timer = setInterval(() => { trackScroll(); void flush(); }, 15000);
}
let listening = false;

/** Called once from main.tsx. Signing in can change the answer ("Admins only"), so it asks again after a login. */
export function initHeat() {
  if (!configured) return;
  void startHeat();
  supabase.auth.onAuthStateChange((e) => { if (!on && (e === "SIGNED_IN" || e === "TOKEN_REFRESHED")) void startHeat(); });
}
