// Screenshot harness: captures Playground, Classic and New side by side at exact widths, in light, dark and big text.
// It runs local dev servers and uses the installed Edge or Chrome. It only reads the database:
// any write, any edge function and any sign-in call is blocked in the browser.
//
//   node tools/shots.mjs --screen lobby,journey --fixture player
//   node tools/shots.mjs --screen lobby --compare playground,classic,new
//   node tools/shots.mjs --gallery
//   node tools/shots.mjs --screen lobby --account zz_test_account     uses the saved sign-in in .test-profiles/
//   node tools/shots.mjs --screen play --state practice,ghost --compare playground,classic,new     opens Play straight from sample data
//   node tools/shots.mjs --screen result,inbox,help,refer,wallet,matchmaking --compare playground,classic,new     the menu screens, the
//        same way (Classic only where it can be drawn from sample data; the playground only where it has that screen).
//        --direct opens any other screen this way too, for example --screen profile --direct.
//   node tools/shots.mjs --overlay auth,tour --compare playground,classic,new     opens overlays with sample data (?overlay=, see
//        web/src/newui/DevOverlay.tsx): auth, terms, password, firstVisit, tour, arenaBar. --fixture picks the viewer (each has a
//        default), --state a state from newui/overlays/<Name>.fixture.ts, --pg-click "Sign up" opens the playground's own version.
//
// Options: --state empty (a state from the screen's fixture file; several: --state a,b)  --widths 390,1440  --modes light,dark,bigtext  --fixture player|guest|admin|visitor|unclaimed  --out folder
//          --click "Menu" (opens something before the picture)  --end (also a picture scrolled to the end)
//          --sizes 390x664,360x640 (WIDTHxHEIGHT; the default is the standard set)  --playground-port 5211
//          --port 5195 (each worktree uses its own)  --playground-dir ../bingo-playground
//          Without --port and --playground-port, the harness uses this worktree's own ports from the table in CLAUDE.md
//          (the playground falls back to --port + 10), and it stops if a port belongs to another worktree.
//          --help (or -h) prints this text and starts nothing.
// Before the first picture each dev server is warmed up (one page load, waited for), and a picture whose page times out
// is tried once more with a longer wait, so a busy machine does not fail the run.
// The playground runs from its own worktree of reference/design-e-playground, and has one look, so it is captured once per width.
// Pictures and index.html go to .pr-screenshots/compare/. The exit code is 1 if a layout check fails on New.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback = null) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; };
const has = (name) => process.argv.includes(`--${name}`);

// --help: the comment at the top of this file, and nothing is started
if (has("help") || process.argv.includes("-h")) {
  const text = readFileSync(fileURLToPath(import.meta.url), "utf8").split(/\r?\n/);
  console.log(text.slice(0, text.findIndex((l) => !l.startsWith("//"))).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
  process.exit(0);
}

// Page loads wait this long; a picture that times out is tried once more with RETRY_MS.
const LOAD_MS = 30000, RETRY_MS = 90000, WARM_MS = 180000;
let loadMs = LOAD_MS;

const gallery = has("gallery");
// The standard set: five widths at full height, plus three real phone browsers (address bar and toolbar take the rest).
// "390" means 390x844 (900 tall from 1000 px up). --widths keeps the full-height sizes only.
const STANDARD = "360,390,430,1000,1440,390x664,390x750,360x640";
const SIZES = (arg("sizes") ?? arg("widths") ?? STANDARD).split(",").map((s) => {
  const [w, h] = s.split("x").map(Number);
  return { w, h: h || (w >= 1000 ? 900 : 844), key: h ? `${w}x${h}` : String(w) };
});
const MODES = arg("modes", "light,dark,bigtext").split(",");
// The ports table in CLAUDE.md (Parallel work): folder, branch, dev server port, playground port.
const PORTS = (() => {
  try {
    return [...readFileSync(join(ROOT, "CLAUDE.md"), "utf8").matchAll(/^\s*\|\s*([A-Za-z]:\\[^|]+?)\s*\|[^|]*\|\s*(\d*)\s*\|\s*(\d*)\s*\|/gm)]
      .map((m) => ({ dir: resolve(m[1]).toLowerCase(), dev: Number(m[2]) || null, pg: Number(m[3]) || null }));
  } catch { return []; }
})();
const own = PORTS.find((r) => r.dir === ROOT.toLowerCase());
const PORT = Number(arg("port", String(own?.dev ?? 5195)));
const PG_PORT = Number(arg("playground-port", String(own?.pg ?? PORT + 10)));
const taken = PORTS.find((r) => r !== own && (r.dev === PG_PORT || r.pg === PG_PORT || r.dev === PORT || r.pg === PORT));
if (taken) throw new Error(`Port ${taken.dev === PORT || taken.pg === PORT ? PORT : PG_PORT} belongs to ${taken.dir} in CLAUDE.md. Use this worktree's own ports${own ? ` (${own.dev} and ${own.pg})` : ""}.`);
const BASE = `http://localhost:${PORT}/`;
const PG_BASE = `http://localhost:${PG_PORT}/design.html`;
const PG_DIR = resolve(ROOT, arg("playground-dir", "../bingo-playground"));
// --overlay captures overlays instead of screens
const overlays = gallery ? null : arg("overlay")?.split(",") ?? null;
// the names players and the playground use, for the contract's ScreenName
const ALIAS = { matchmaking: "match", results: "result" };
const screens = gallery ? ["gallery"] : overlays ?? arg("screen", "lobby").split(",").map((s) => ALIAS[s] ?? s);
const fixture = arg("fixture");
// several states make several pictures; null is the fixture's default
const STATES = (arg("state") ?? "").split(",").filter(Boolean);
let state = null;
const account = arg("account");
const compare = gallery ? ["new"] : arg("compare", "playground,new").split(",");
const OUT = resolve(ROOT, arg("out", ".pr-screenshots/compare"));

// the button that opens each screen, same words in Classic and New
const OPENS = { journey: "Journey", collect: "Collect", compete: "Compete", shop: "Shop" };
// Screens no tab button reaches are opened by name with sample data (?screen=, see web/src/newui/DevScreen.tsx), Classic too where
// it can be drawn from sample data. --direct opens any screen that way.
const DIRECT = new Set(["play", "result", "inbox", "help", "refer", "wallet", "match", "admin"]);
const isDirect = (screen) => !gallery && !overlays && (has("direct") || DIRECT.has(screen));
// The playground's matching screen: a tab, a hidden jump button in its side panel, or a few steps. Missing: it has none.
//   result: one real round at the page clock's pace, then its results screen. match: the Person mode, then Play.
const PG_TAB = (screen) => OPENS[screen] ?? null;
const PG_BUTTON = { profile: /Open your profile/ };
const PG_JUMP = { profile: "Profile" };
const PG_NONE = new Set(["inbox", "help", "refer", "wallet", "admin"]);
const PG_ROUND_MAX_MS = 3000 + 180000; // "get ready", then far more than its longest round (60 to 100 seconds)
// how to find card cell i: data-cell on New, the cell buttons on Classic
const CELL = (i) => `[data-cell="${i}"], #play .pl-cells > button:nth-child(${i + 1})`;
const moments = {};
/** The screen's `moments` from its fixture file, read in the browser through the dev server. */
async function loadMoments(screen) {
  if (screen in moments) return moments[screen];
  const b = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await guardedPage(b);
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: WARM_MS });
    const name = screen[0].toUpperCase() + screen.slice(1);
    moments[screen] = await page.evaluate(async (n) => { try { return (await import(`/src/newui/screens/${n}.fixture.ts`)).moments ?? null; } catch { return null; } }, name);
  } finally { await b.close(); }
  return moments[screen];
}
/** Moves the page clock to the moment: each tap at its time, then the click, then the picture's time. */
async function drive(page, moment) {
  const elapsed = () => page.evaluate(() => performance.now() - (window.__nuT0 ?? performance.now()));
  const problems = [];
  for (const tap of moment.taps ?? []) {
    const wait = tap.t - (await elapsed());
    if (wait > 0) await page.clock.runFor(Math.round(wait));
    const ok = await page.evaluate((sel) => { const el = document.querySelector(sel); el?.click(); return !!el; }, CELL(tap.i));
    if (!ok) { problems.push(`WARN no card cell ${tap.i} to tap (New Play cells need data-cell)`); break; }
  }
  const rest = moment.at - (await elapsed());
  if (rest > 0) await page.clock.runFor(Math.round(rest));
  if (moment.click) await page.getByRole("button", { name: moment.click }).filter({ visible: true }).first().click({ timeout: 4000 }).catch(() => problems.push(`WARN no "${moment.click}" button`));
  await page.waitForTimeout(400);
  return problems;
}
// the playground's seed: a mid-game player with everything unlocked and no prompts open
const PG_SEED = { xp: 40 * 7 * 7 + 5, coins: 320, gems: 15, rounds: 40, streak: 3, season: 450, daily: { claimed: 3, ready: true }, prompts: { saveRounds: true, saveStreak: true, saveLeague: true, notify: true, league: true, starter: true } };
// shows the playground's phone stage at true size, without its tools button, for captures only
const PG_CSS = ".pg{padding:0!important;display:block!important;min-height:0!important}.pg-toggle,.pg-side{display:none!important}.pg-stage{width:100vw!important;height:100vh!important;margin:0!important;border-radius:0!important}.pg-stage>div{transform:none!important;width:100vw!important;height:100vh!important}.pg-stage .e-root{width:100vw!important;height:100vh!important;border-radius:0!important}";

// Calls that only read, which a signed-in capture needs. Every other non-GET call is blocked.
const READ_RPCS = new Set(["my_economy", "my_ad_status", "inbox_summary", "login_calendar", "new_players", "arena_status", "online_players", "live_races", "league_info", "league_board", "season_info", "todays_missions", "my_referral", "my_notifications", "my_threads", "my_purchases", "mastery", "crew_info", "crew_board", "search_crews", "daily_leaderboard", "event_leaderboard", "daily_deals", "liveop_board", "ref_lookup"]);
const blocked = new Set();

async function guard(context) {
  await context.route(/\.supabase\.co\//, async (route) => {
    const req = route.request(), url = new URL(req.url()), method = req.method();
    if (method === "GET" || method === "OPTIONS" || method === "HEAD") return route.continue();
    const rpc = url.pathname.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/)?.[1];
    if (rpc && READ_RPCS.has(rpc)) return route.continue();
    if (account && url.pathname === "/auth/v1/token") return route.continue(); // keeps the saved test account signed in
    blocked.add(`${method} ${url.pathname.replace(/^\/(rest|functions|auth)\/v1\//, "")}`);
    return route.abort("blockedbyclient");
  });
}
/** A page of its own whose writes are blocked like every picture's (the warm-up and the moments loader open the app too). */
async function guardedPage(b) { const context = await b.newContext(); await guard(context); return context.newPage(); }

/** Layout checks on New: nothing scrolls sideways, nothing is cut off or covered, and every control can be tapped. */
const CHECKS = () => {
  const out = [];
  const vis = (el) => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden"; };
  const shell = document.querySelector(".nu-root")?.getBoundingClientRect();
  if (shell && (Math.round(shell.left) !== 0 || Math.round(shell.top + window.scrollY) !== 0 || Math.round(shell.width) !== window.innerWidth)) out.push(`shell does not fill the page: left ${shell.left}, top ${shell.top}, width ${shell.width}`);
  if (getComputedStyle(document.body).zoom !== "1") out.push("Classic's big-text zoom is still on");
  const head = document.querySelector(".nu-head")?.getBoundingClientRect(), main = document.querySelector(".nu-main")?.getBoundingClientRect();
  if (head && main && Math.round(head.left) !== Math.round(main.left)) out.push(`header and page are not aligned: ${head.left} and ${main.left}`);
  if (document.documentElement.scrollWidth > window.innerWidth) out.push(`page scrolls sideways: ${document.documentElement.scrollWidth} > ${window.innerWidth}`);
  const texts = [...document.querySelectorAll(".nu-name, .nu-level, .nu-title")].filter(vis);
  for (const el of texts) {
    // a long name may end in an ellipsis, if the full name is still available; anything else being cut off is a fault
    const named = el.classList.contains("nu-name") && !!el.closest("[title], [aria-label]");
    const cut = el.scrollWidth > el.clientWidth + 1;
    if (cut && el.classList.contains("nu-title")) {
      // a page title is cut only as the last step: the streak chip is gone, the title is at its smallest, it ends in an ellipsis,
      // and the heading still holds the whole title for screen readers
      const streak = [...(el.closest(".nu-head")?.querySelectorAll(".nu-daily") ?? [])].some(vis);
      const why = [streak && "the streak chip is still shown", !el.classList.contains("is-smaller") && "the title is not at its smallest size",
        getComputedStyle(el).textOverflow !== "ellipsis" && "it has no ellipsis", el.textContent !== el.getAttribute("title") && "the heading does not hold the full title"].filter(Boolean);
      // from 390 px in standard text, every page title (the longest is "Invite friends") fits without an ellipsis
      if (window.innerWidth >= 390 && !document.documentElement.classList.contains("big-text")) why.push(`at ${window.innerWidth} px in standard text it must fit in full`);
      if (why.length) out.push(`page title "${el.getAttribute("title") ?? el.textContent}" is cut off before every step was used: ${why.join(", ")}`);
    } else if (cut && !named) out.push(`${el.className} is cut off`);
    if (!el.classList.contains("nu-level") && el.getBoundingClientRect().width < 40) out.push(`${el.className} is squeezed: ${Math.round(el.getBoundingClientRect().width)} px`);
    if (el.classList.contains("nu-name") && el.getBoundingClientRect().height > parseFloat(getComputedStyle(el).lineHeight) * 1.5) out.push("name is on more than one line");
  }
  // the header is one row: everything in it sits on the same line, and nothing runs past its edge
  const headEl = document.querySelector(".nu-head");
  if (headEl && vis(headEl)) {
    const rowParts = [...headEl.children, ...headEl.querySelectorAll(".nu-wallet > *")].filter((k) => vis(k) && !k.classList.contains("nu-wallet"));
    const mids = rowParts.map((k) => { const r = k.getBoundingClientRect(); return (r.top + r.bottom) / 2; });
    if (mids.length && Math.max(...mids) - Math.min(...mids) > 6) out.push(`header wraps: parts are on different rows (${Math.round(Math.max(...mids) - Math.min(...mids))} px apart)`);
    if (headEl.scrollWidth > headEl.clientWidth + 1) out.push(`header runs past its edge: ${headEl.scrollWidth} > ${headEl.clientWidth}`);
    const right = Math.max(...rowParts.map((k) => k.getBoundingClientRect().right));
    if (right > window.innerWidth) out.push(`header part past the screen edge: ${Math.round(right)}`);
  }
  const hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  const parts = [...document.querySelectorAll(".nu-head .nu-pill, .nu-head .nu-daily > span, .nu-head .nu-menu, .nu-head .nu-back, .nu-head .nu-btn")].filter(vis);
  for (const el of texts.filter((t) => t.closest(".nu-head"))) for (const other of parts) if (hit(el.getBoundingClientRect(), other.getBoundingClientRect())) out.push(`${el.className} overlaps ${other.textContent || other.className}`);
  for (const el of document.querySelectorAll(".nu-root button, .nu-root a, .nu-root [role=radio]")) {
    if (!vis(el) || el.closest(".tour")) continue;
    const r = el.getBoundingClientRect();
    if (r.height < 43.5 || r.width < 43.5) { if (!(el.tagName === "A" && el.closest("p"))) out.push(`small tap target ${Math.round(r.width)}x${Math.round(r.height)}: ${el.getAttribute("aria-label") ?? el.textContent}`); }
    if (!el.textContent.trim() && !el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby")) out.push(`control with no label: ${el.className}`);
  }
  for (const el of [...document.querySelectorAll(".nu-nb, .nu-pill, .nu-ni, .nu-btn")].filter(vis)) if (el.scrollWidth > el.clientWidth + 1) out.push(`text cut off: ${el.textContent}`);
  // anything marked data-must-see is on screen without scrolling, and not under the bottom bar
  const barTop = (() => { const b = document.querySelector(".nu-tabsbar"); return b && vis(b) ? b.getBoundingClientRect().top : window.innerHeight; })();
  // data-should-see: should be on screen, but a screen may decide it can scroll there (a warning)
  for (const el of document.querySelectorAll("[data-should-see]")) {
    const r = el.getBoundingClientRect();
    if (r.bottom + window.scrollY > barTop) out.push(`WARN ${el.getAttribute("data-should-see")} needs scrolling: bottom at ${Math.round(r.bottom + window.scrollY)}, bar at ${Math.round(barTop)}`);
  }
  for (const el of document.querySelectorAll("[data-must-see]")) {
    const r = el.getBoundingClientRect();
    if (r.bottom + window.scrollY > barTop) out.push(`${el.getAttribute("data-must-see")} needs scrolling: bottom at ${Math.round(r.bottom + window.scrollY)}, bar at ${Math.round(barTop)}`);
  }
  // anything with a minimum size keeps it, on a full-height phone
  if (window.innerHeight >= 844) for (const el of document.querySelectorAll("[data-min-width]")) {
    const w = el.getBoundingClientRect().width, min = Number(el.getAttribute("data-min-width"));
    if (vis(el) && w < min - 0.5) out.push(`${el.className} is ${Math.round(w)} px wide, minimum ${min}`);
  }
  // the next section shows above the bottom bar if there is room, so players can see there is more. A warning, not a failure.
  for (const el of document.querySelectorAll("[data-must-peek]")) {
    const barShown = document.querySelector(".nu-tabsbar");
    if (!barShown || !vis(barShown) || !el.children.length || document.querySelector(".nu-main [role=alert]")) continue; // phones only; an error on screen comes first
    if (el.getBoundingClientRect().top + window.scrollY > barTop - 12) out.push(`WARN ${el.getAttribute("data-must-peek")} does not show above the bar: top at ${Math.round(el.getBoundingClientRect().top + window.scrollY)}, bar at ${Math.round(barTop)}`);
  }
  // after scrolling to the end, nothing ends behind the bottom bar
  const barEl = document.querySelector(".nu-tabsbar");
  if (barEl && vis(barEl) && !document.querySelector(".nu-gallery")) {
    const before = window.scrollY;
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
    const endBar = barEl.getBoundingClientRect().top;
    // an open Sheet or Modal (its backdrop .nu-scrim is fixed over the whole page) is not page content
    const parts = [...document.querySelectorAll(".nu-main *")].filter((k) => vis(k) && !k.closest(".nu-scrim"));
    const low = parts.reduce((m, k) => Math.max(m, k.getBoundingClientRect().bottom), 0);
    if (low > endBar + 1) { const who = parts.find((k) => k.getBoundingClientRect().bottom === low); out.push(`behind the bottom bar after scrolling to the end: ${who?.className || who?.tagName} ends at ${Math.round(low)}, bar at ${Math.round(endBar)}`); }
    window.scrollTo({ top: before, behavior: "instant" });
  }
  const rail = document.querySelector(".nu-rail");
  if (rail && vis(rail) && !rail.classList.contains("is-tight") && rail.scrollHeight > rail.clientHeight + 1) out.push("side panel overflows with the Today box showing");
  return [...new Set(out)];
};


const sessionFile = () => join(ROOT, ".test-profiles", account, "session.json");
async function openContext(column, sz, mode) {
  const width = sz.w;
  const options = { viewport: { width: sz.w, height: sz.h }, deviceScaleFactor: 1, isMobile: false, hasTouch: width < 1000, colorScheme: mode === "dark" ? "dark" : "light" };
  const b = await chromium.launch({ channel: "msedge", headless: true });
  const context = await b.newContext(options);
  context.once("close", () => { void b.close(); });
  context.setDefaultNavigationTimeout(loadMs);
  if (account && column !== "playground") {
    if (!existsSync(sessionFile())) throw new Error(`No saved session for ${account}. Create it first: node tools/test-account.mjs ${account}`);
    const { key, session } = JSON.parse(readFileSync(sessionFile(), "utf8"));
    // the saved sign-in, on whichever port this worktree uses
    await context.addInitScript(([k, s]) => { try { if (!localStorage.getItem(k)) localStorage.setItem(k, s); } catch { /* ignore */ } }, [key, JSON.stringify(session)]);
  }
  return context;
}
/** Supabase replaces the login token as it refreshes, so the newest one is saved after each capture. */
async function keepSession(page) {
  if (!account) return;
  const { key } = JSON.parse(readFileSync(sessionFile(), "utf8"));
  const now = await page.evaluate((k) => localStorage.getItem(k), key);
  if (now) writeFileSync(sessionFile(), JSON.stringify({ key, session: JSON.parse(now) }, null, 2));
}

async function capture(screen, column, sz, mode) {
  const width = sz.w;
  const context = await openContext(column, sz, mode);
  try {
    const dir = join(OUT, overlays ? `overlay-${screen}` : screen);
    mkdirSync(dir, { recursive: true });
    const name = column === "playground" ? `playground${state ? `-${state}` : ""}-${sz.key}.png` : `${column}${fixture ? `-${fixture}` : ""}${account ? `-${account}` : ""}${state ? `-${state}` : ""}-${sz.key}-${mode}.png`;
    const direct = isDirect(screen);
    const all = direct ? await loadMoments(screen) : null;
    const moment = all ? all[state ?? Object.keys(all)[0]] ?? null : null;
    const pgRound = column === "playground" && !overlays && screen === "result";
    if (moment || pgRound) await context.clock.install();
    if (column === "playground") {
      if (!overlays && PG_NONE.has(screen)) return { name: null, problems: [`WARN the playground has no ${screen} screen`] };
      await context.addInitScript((seed) => { localStorage.setItem("design_e_playground_v2", JSON.stringify(seed)); }, PG_SEED);
      const page = await context.newPage();
      await page.goto(PG_BASE, { waitUntil: "load" });
      await page.addStyleTag({ content: PG_CSS });
      await page.waitForTimeout(1200);
      const problems = [];
      const tab = overlays ? null : PG_TAB(screen);
      if (tab) { await page.getByRole("button", { name: tab, exact: true }).first().click({ timeout: 4000 }).catch(() => undefined); await page.waitForTimeout(600); }
      // a jump button in the side panel, which the capture hides: clicked in the page
      // (its own button first, as on desktop; the panel exists only while the phone layout's tools toggle is open, so it is opened,
      // used and closed again)
      const own = overlays ? null : PG_BUTTON[screen];
      const ownOk = own ? await page.getByRole("button", { name: own }).filter({ visible: true }).first().click({ timeout: 2000 }).then(() => true, () => false) : false;
      const jump = overlays || ownOk ? null : PG_JUMP[screen];
      const toggle = () => page.evaluate(() => document.querySelector(".pg-toggle")?.click());
      if (ownOk) await page.waitForTimeout(600);
      if (jump) {
        await toggle(); await page.waitForTimeout(300);
        if (!(await page.evaluate((t) => { const b = [...document.querySelectorAll(".pg-side button")].find((x) => x.textContent?.trim() === t); b?.click(); return !!b; }, jump))) problems.push(`WARN no "${jump}" jump button in the playground`);
        await page.waitForTimeout(300); await toggle(); await page.waitForTimeout(600);
      }
      // its matchmaking: the Person mode, then the globe
      if (!overlays && screen === "match") await page.getByRole("radio", { name: /Person|Play a person/ }).or(page.getByRole("button", { name: /^Person/ })).filter({ visible: true }).first().click({ timeout: 4000, force: true }).catch(() => problems.push('WARN no "Person" mode in the playground'));
      // its round starts after three seconds of "get ready"; the globe says "Play: …" on phones and "Start: …" on desktop
      if (!overlays && (screen === "play" || screen === "result" || screen === "match")) {
        await page.getByRole("button", { name: /^(Play|Start)(:| your first round)/ }).first().click({ timeout: 4000, force: true }).catch(() => problems.push("WARN no Play button in the playground"));
        await page.waitForTimeout(500);
        if (screen !== "match") await page.getByRole("button", { name: "Start", exact: true }).first().click({ timeout: 4000, force: true }).catch(() => undefined);
        if (screen === "play" && moment) await page.clock.runFor(Math.max(0, 3000 + moment.at));
        // one whole round at the page clock's pace: no taps, so it ends on time and shows its results
        if (pgRound) {
          const over = () => page.getByRole("button", { name: "Play again" }).first().isVisible().catch(() => false);
          for (let ms = 0; ms < PG_ROUND_MAX_MS && !(await over()); ms += 5000) await page.clock.runFor(5000);
          if (!(await over())) problems.push("WARN the playground round did not reach its results");
          await page.clock.runFor(3000); // its counting-up animations
        }
        await page.waitForTimeout(400);
      }
      // the playground's own version of something, such as its sign-up pop-up
      const pgOpen = arg("pg-click");
      if (pgOpen) { await page.getByRole("button", { name: new RegExp(pgOpen) }).filter({ visible: true }).first().click({ timeout: 4000 }).catch(() => undefined); await page.waitForTimeout(500); }
      await page.evaluate(() => document.fonts?.ready);
      await page.screenshot({ path: join(dir, name) });
      return { name, problems };
    }
    await guard(context);
    await context.addInitScript((big) => { try { localStorage.setItem("ba_settings", JSON.stringify({ bigText: big })); localStorage.setItem("ba_first_visit", "1"); } catch { /* ignore */ } if (big) document.documentElement?.classList.add("big-text"); }, mode === "bigtext");
    const page = context.pages()[0] ?? await context.newPage();
    const query = gallery ? "?gallery" : overlays ? `?design=${column === "classic" ? "classic" : "new"}&overlay=${screen}${fixture ? `&fixture=${fixture}` : ""}${state ? `&state=${state}` : ""}` : direct ? `?design=${column === "classic" ? "classic" : "new"}&screen=${screen}&fixture=${fixture ?? "player"}${state ? `&state=${state}` : ""}` : column === "classic" ? "?design=classic" : fixture ? `?design=new&fixture=${fixture}${state ? `&state=${state}` : ""}` : "?design=new";
    await page.goto(BASE + query, { waitUntil: "load" });
    await page.waitForFunction(() => !document.querySelector(".boot") && !document.querySelector(".skel"), undefined, { timeout: 15000 }).catch(() => undefined);
    await page.waitForTimeout(1200);
    if (gallery && mode === "bigtext") await page.evaluate(() => document.documentElement.classList.add("big-text"));
    const driven = direct ? await page.waitForFunction(() => window.__nuT0 !== undefined, undefined, { timeout: 8000, polling: 100 }).then(() => moment ? drive(page, moment) : [], () => ["WARN the screen did not draw"]) : [];
    const skip = page.getByRole("button", { name: "Look around first" });
    if (!overlays && await skip.isVisible().catch(() => false)) { await skip.click(); await page.waitForTimeout(250); } // an overlay picture keeps the welcome card
    const tab = direct || overlays ? null : OPENS[screen];
    if (tab) { await page.getByRole("button", { name: tab, exact: true }).first().click({ timeout: 4000 }).catch(() => undefined); await page.waitForTimeout(600); }
    const open = arg("click");
    if (open) { await page.getByRole("button", { name: new RegExp(open) }).or(page.getByRole("radio", { name: new RegExp(open) })).filter({ visible: true }).first().click({ timeout: 4000 }); await page.waitForTimeout(500); }
    await page.evaluate(() => document.fonts?.ready);
    await page.screenshot({ path: join(dir, name), fullPage: gallery });
    await keepSession(page);
    if (has("end")) { await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" })); await page.waitForTimeout(150); await page.screenshot({ path: join(dir, name.replace(".png", "-end.png")) }); await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" })); }
    const seen = await page.evaluate(() => ({ shell: !!document.querySelector(".nu-root"), iw: window.innerWidth }));
    if (seen.iw !== width) throw new Error(`viewport is ${seen.iw}, asked for ${width}`);
    if (column === "new" && !seen.shell) return { name, problems: ["new shell did not render"] };
    if (column === "classic" && seen.shell) return { name, problems: ["Classic showed the new shell"] };
    return { name, problems: [...driven, ...(column === "new" ? await page.evaluate(CHECKS) : [])] };
  } finally { await context.close(); }
}

const servers = [];
const serve = (cwd, port) => { const p = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--port", String(port), "--strictPort"], { cwd, stdio: "ignore" }); servers.push(p); return p; };
const waitFor = async (url) => { for (let i = 0; i < 80; i++) { try { if ((await fetch(url)).ok) return true; } catch { /* not yet */ } await new Promise((r) => setTimeout(r, 250)); } return false; };
const portFree = async (port) => { try { await fetch(`http://localhost:${port}/`); return false; } catch { return true; } };
/** The dev server prepares its files on the first page load, which can take a minute on a busy machine: do it before any picture. */
async function warmUp(url, ready) {
  const started = Date.now();
  const b = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await guardedPage(b);
    await page.goto(url, { waitUntil: "load", timeout: WARM_MS });
    await page.waitForFunction(ready, undefined, { timeout: WARM_MS }).catch(() => undefined);
    console.log(`warm ${url} in ${Math.round((Date.now() - started) / 1000)} s`);
  } catch (e) {
    console.log(`warn warming ${url} did not finish: ${String(e?.message ?? e).split("\n")[0]}`);
  } finally { await b.close(); }
}
const isTimeout = (e) => e?.name === "TimeoutError" || /Timeout \d+ms exceeded/.test(String(e?.message ?? e));
/** One picture. If its page times out, it is tried once more with a longer wait; a second failure is reported, not fatal. */
async function captureOrRetry(screen, column, sz, mode) {
  try { return await capture(screen, column, sz, mode); } catch (e) {
    if (!isTimeout(e)) throw e;
    console.log(`retry ${screen} ${column} ${sz.key} ${mode}: the page timed out after ${loadMs / 1000} s`);
  }
  loadMs = RETRY_MS;
  try { return await capture(screen, column, sz, mode); } catch (e) {
    if (!isTimeout(e)) throw e;
    return { name: null, problems: [`the page did not load in ${RETRY_MS / 1000} s, twice`] };
  } finally { loadMs = LOAD_MS; }
}

let failed = false;
try {
  if (!(await portFree(PORT))) throw new Error(`Port ${PORT} is already in use, and an old server would give wrong pictures. Stop it, or pass --port.`);
  serve(join(ROOT, "web"), PORT);
  if (!(await waitFor(BASE))) throw new Error(`The dev server did not start on port ${PORT}.`);
  if (compare.includes("playground")) {
    if (!existsSync(join(PG_DIR, "web", "design.html"))) throw new Error(`No playground at ${PG_DIR}. Run: git worktree add ../bingo-playground reference/design-e-playground, then npm ci in its web folder.`);
    if (!(await portFree(PG_PORT))) throw new Error(`Port ${PG_PORT} is already in use. Stop it, or pass --port.`);
    serve(join(PG_DIR, "web"), PG_PORT);
    if (!(await waitFor(PG_BASE))) throw new Error(`The playground did not start on port ${PG_PORT}.`);
  }
  await warmUp(BASE, () => !document.querySelector(".boot") && !!document.querySelector("#root > *"));
  if (compare.includes("playground")) await warmUp(PG_BASE, () => document.body.children.length > 0);
  const rows = [];
  for (const screen of screens) for (const st of STATES.length ? STATES : [null]) {
    state = st;
    const label = st ? `${screen} ${st}` : screen;
    for (const sz of SIZES) {
      for (const column of compare) {
        for (const mode of column === "playground" ? ["light"] : MODES) {
          const r = await captureOrRetry(screen, column, sz, mode);
          rows.push({ screen: overlays ? `overlay-${screen}` : screen, label, column, mode, width: sz.key, ...r });
          const faults = r.problems.filter((p) => !p.startsWith("WARN ")), warns = r.problems.filter((p) => p.startsWith("WARN "));
          const ok = faults.length === 0;
          if (!ok) failed = true;
          console.log(`${ok ? "ok  " : "FAIL"} ${label} ${column} ${sz.key} ${column === "playground" ? "" : mode}${ok ? "" : ": " + faults.join("; ")}`);
          for (const w of warns) console.log(`warn ${label} ${column} ${sz.key} ${mode}: ${w.slice(5)}`);
        }
      }
    }
  }
  const cell = (r) => !r.name ? `<div><b>${r.column}</b><p>${r.problems.map((p) => p.replace(/^WARN /, "")).join("; ")}</p></div>` : `<div><b>${r.column}${r.column === "playground" ? "" : ` · ${r.mode}`}</b><a href="${r.screen}/${r.name}"><img loading="lazy" src="${r.screen}/${r.name}" alt="${r.screen} ${r.column} ${r.width}" width="${r.width}"></a></div>`;
  const html = [...new Set(rows.map((r) => r.label))].map((s) => `<h2>${s}</h2>` + SIZES.map(({ key: w }) => `<h3>${w} px</h3><div class="row">${rows.filter((r) => r.label === s && r.width === w).map(cell).join("")}</div>`).join("")).join("");
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "index.html"), `<!doctype html><meta charset="utf-8"><title>${compare.join(" | ")}</title><style>body{font:14px system-ui;margin:16px;background:#eee}.row{display:flex;gap:16px;overflow-x:auto;padding-bottom:12px;align-items:flex-start}b{display:block;margin-bottom:4px}img{display:block;zoom:.6;border:1px solid #999;max-width:none}</style><h1>${compare.join(" | ")}</h1>${html}`);
  console.log(`Blocked calls: ${[...blocked].join(", ") || "none"}`);
  console.log(`Pictures: ${OUT}`);
} catch (e) {
  console.error(String(e?.message ?? e));
  failed = true;
} finally {
  for (const p of servers) { try { if (process.platform === "win32") spawn("taskkill", ["/pid", String(p.pid), "/t", "/f"], { stdio: "ignore" }); else p.kill(); } catch { /* already gone */ } }
}
await new Promise((r) => setTimeout(r, 400));
process.exit(failed ? 1 : 0);
