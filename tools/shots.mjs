// Screenshot harness: captures Classic and New side by side at exact widths, in light, dark and big text.
// It runs a local dev server against the project in web/.env.local and uses the installed Edge or Chrome.
// It only reads: any write to the database, any edge function and any sign-in call is blocked in the browser.
//
//   node tools/shots.mjs --screen lobby,shop
//   node tools/shots.mjs --screen lobby --fixture player      New shell only, with sample signed-in data (local builds only)
//   node tools/shots.mjs --screen lobby --account zz_test_account     uses the saved browser profile in .test-profiles/
//
// Pictures and index.html go to .pr-screenshots/compare/. The exit code is 1 if a layout check fails on New.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WIDTHS = [360, 390, 430, 1000, 1440];
const MODES = ["light", "dark", "bigtext"];
const PORT = 5195;
const BASE = `http://localhost:${PORT}/`;

const arg = (name, fallback = null) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; };
const screens = (arg("screen", "lobby")).split(",");
const fixture = arg("fixture");
const account = arg("account");
const designs = fixture ? ["new"] : (arg("design", "classic,new")).split(",");
const OUT = resolve(ROOT, arg("out", ".pr-screenshots/compare"));

// the button that opens each screen, same words in both designs
const OPENS = { journey: "Journey", compete: "Compete", collect: "Collect", shop: "Shop", help: "Help and guide", profile: "See a demo profile" };

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

/** Layout checks on the new shell: nothing scrolls sideways, and the name and level are neither cut off nor covered. */
const CHECKS = () => {
  const out = [];
  const shell = document.querySelector(".nu-root")?.getBoundingClientRect();
  if (shell && (Math.round(shell.left) !== 0 || Math.round(shell.top) !== 0 || Math.round(shell.width) !== window.innerWidth)) out.push(`shell does not fill the page: left ${shell.left}, top ${shell.top}, width ${shell.width}`);
  if (getComputedStyle(document.body).zoom !== "1") out.push("Classic's big-text zoom is still on");
  const top = document.querySelector(".nu-top")?.getBoundingClientRect(), main = document.querySelector(".nu-main")?.getBoundingClientRect();
  if (top && main && Math.round(top.left) !== Math.round(main.left)) out.push(`top bar and page are not aligned: ${top.left} and ${main.left}`);
  if (document.documentElement.scrollWidth > window.innerWidth) out.push(`page scrolls sideways: ${document.documentElement.scrollWidth} > ${window.innerWidth}`);
  const name = document.querySelector(".nu-name"), level = document.querySelector(".nu-level");
  if (name && name.scrollWidth > name.clientWidth + 1) out.push("name is cut off");
  if (name && name.getBoundingClientRect().width < 60) out.push(`name is squeezed: ${Math.round(name.getBoundingClientRect().width)} px`);
  if (level && level.scrollWidth > level.clientWidth + 1) out.push("level is cut off");
  const hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  const parts = [...document.querySelectorAll(".nu-top .nu-chip, .nu-top .nu-icon, .nu-top .nu-btn")];
  for (const el of [name, level].filter(Boolean)) for (const other of parts) if (hit(el.getBoundingClientRect(), other.getBoundingClientRect())) out.push(`${el.className} overlaps ${other.getAttribute("aria-label") ?? other.textContent}`);
  for (const el of document.querySelectorAll(".nu-root button:not(.nu-popback), .nu-root a")) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && (r.height < 43.5 || r.width < 43.5) && !el.closest(".tour")) out.push(`small tap target ${Math.round(r.width)}x${Math.round(r.height)}: ${el.getAttribute("aria-label") ?? el.textContent}`);
  }
  for (const el of document.querySelectorAll(".nu-nb > span, .nu-chip, .nu-btn")) if (el.scrollWidth > el.clientWidth + 1) out.push(`text cut off: ${el.textContent}`);
  return [...new Set(out)];
};

async function capture(browser, screen, design, width, mode) {
  const size = { width, height: width >= 1000 ? 900 : 844 };
  const options = { viewport: size, deviceScaleFactor: 1, isMobile: false, hasTouch: width < 1000, colorScheme: mode === "dark" ? "dark" : "light" };
  let context, profile = null;
  if (account) {
    const dir = join(ROOT, ".test-profiles", account);
    if (!existsSync(dir)) throw new Error(`No saved profile for ${account}. Create it first with tools/test-account.mjs.`);
    profile = join(dir, "browser");
    context = await chromium.launchPersistentContext(profile, { ...options, channel: browser, headless: true });
  } else {
    const b = await chromium.launch({ channel: browser, headless: true });
    context = await b.newContext(options);
    context.once("close", () => { void b.close(); });
  }
  try {
    await guard(context);
    await context.addInitScript((big) => { try { localStorage.setItem("ba_settings", JSON.stringify({ bigText: big })); localStorage.setItem("ba_first_visit", "1"); } catch { /* ignore */ } }, mode === "bigtext");
    const page = context.pages()[0] ?? await context.newPage();
    const query = fixture ? `?design=new&fixture=${fixture}` : `?design=${design}`;
    await page.goto(BASE + query, { waitUntil: "load" });
    await page.waitForFunction(() => !document.querySelector(".boot") && !document.querySelector(".skel"), undefined, { timeout: 15000 }).catch(() => undefined);
    await page.waitForTimeout(1500);
    const skip = page.getByRole("button", { name: "Look around first" });
    if (await skip.isVisible().catch(() => false)) { await skip.click(); await page.waitForTimeout(250); }
    if (OPENS[screen]) {
      const btn = page.getByRole("button", { name: OPENS[screen], exact: true }).first();
      if (await btn.isVisible().catch(() => false)) { await btn.click(); await page.waitForTimeout(900); }
      else if (screen === "profile" && design === "new") { await page.locator(".nu-nav").getByRole("button", { name: "Bingo DNA" }).click().catch(() => undefined); await page.waitForTimeout(400); }
    }
    await page.evaluate(() => document.fonts?.ready);
    const dir = join(OUT, screen);
    mkdirSync(dir, { recursive: true });
    const name = `${design}${fixture ? `-${fixture}` : ""}-${width}-${mode}.png`;
    await page.screenshot({ path: join(dir, name) });
    const state = await page.evaluate(() => ({ shell: !!document.querySelector(".nu-root"), classic: !!document.querySelector(".shell"), iw: window.innerWidth }));
    if (state.iw !== width) throw new Error(`viewport is ${state.iw}, asked for ${width}`);
    if (design === "new" && !state.shell) return { name, problems: ["new shell did not render"] };
    if (design === "classic" && state.shell) return { name, problems: ["Classic showed the new shell"] };
    return { name, problems: design === "new" ? await page.evaluate(CHECKS) : [] };
  } finally { await context.close(); }
}

const browserChannel = existsSync("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe") || process.platform !== "win32" ? "msedge" : "chrome";
const vite = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { cwd: join(ROOT, "web"), stdio: "ignore" });
const stop = () => { try { vite.kill(); } catch { /* already gone */ } };

let failed = false;
try {
  let up = false;
  for (let i = 0; i < 60 && !up; i++) { try { up = (await fetch(BASE)).ok; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  if (!up) throw new Error(`The dev server did not start on port ${PORT}. Is another copy running?`);
  const rows = [];
  for (const screen of screens) {
    for (const design of designs) {
      for (const mode of MODES) {
        for (const width of WIDTHS) {
          const r = await capture(browserChannel, screen, design, width, mode);
          rows.push({ screen, design, mode, width, ...r });
          const ok = r.problems.length === 0;
          if (!ok) failed = true;
          console.log(`${ok ? "ok  " : "FAIL"} ${screen} ${design} ${width} ${mode}${ok ? "" : ": " + r.problems.join("; ")}`);
        }
      }
    }
  }
  mkdirSync(OUT, { recursive: true });
  const cols = [...new Set(rows.map((r) => r.design + (fixture ? `-${fixture}` : "")))];
  const html = screens.map((s) => `<h2>${s}</h2>` + MODES.map((m) => `<h3>${m}</h3><div class="row">` + WIDTHS.map((w) => `<figure><figcaption>${w} px</figcaption><div class="pair">${rows.filter((r) => r.screen === s && r.mode === m && r.width === w).map((r) => `<div><b>${r.design}</b><a href="${s}/${r.name}"><img loading="lazy" src="${s}/${r.name}" alt="${s} ${r.design} ${w} ${m}" width="${w}"></a></div>`).join("")}</div></figure>`).join("") + "</div>").join("")).join("");
  writeFileSync(join(OUT, "index.html"), `<!doctype html><meta charset="utf-8"><title>Classic and New</title><style>body{font:14px system-ui;margin:16px;background:#eee}.row{display:flex;gap:16px;overflow-x:auto;padding-bottom:12px}.pair{display:flex;gap:8px}figure{margin:0}img{display:block;zoom:.4;border:1px solid #999}</style><h1>${cols.join(" and ")}</h1>${html}`);
  console.log(`Blocked calls: ${[...blocked].join(", ") || "none"}`);
  console.log(`Pictures: ${OUT}`);
} catch (e) {
  console.error(String(e?.message ?? e));
  failed = true;
} finally { stop(); }
process.exit(failed ? 1 : 0);
