// Screenshot harness: captures Playground, Classic and New side by side at exact widths, in light, dark and big text.
// It runs local dev servers and uses the installed Edge or Chrome. It only reads the database:
// any write, any edge function and any sign-in call is blocked in the browser.
//
//   node tools/shots.mjs --screen lobby,journey --fixture player
//   node tools/shots.mjs --screen lobby --compare playground,classic,new
//   node tools/shots.mjs --gallery
//   node tools/shots.mjs --screen lobby --account zz_test_account     uses the saved browser profile in .test-profiles/
//
// Options: --widths 390,1440  --modes light,dark,bigtext  --fixture player|guest|admin|visitor|unclaimed  --out folder
//          --click "Menu" (opens something before the picture)
//          --port 5195 (each worktree uses its own; the playground gets the next port)  --playground-dir ../bingo-playground
// The playground runs from its own worktree of reference/design-e-playground, and has one look, so it is captured once per width.
// Pictures and index.html go to .pr-screenshots/compare/. The exit code is 1 if a layout check fails on New.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback = null) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; };
const has = (name) => process.argv.includes(`--${name}`);

const gallery = has("gallery");
const WIDTHS = arg("widths", "360,390,430,1000,1440").split(",").map(Number);
const MODES = arg("modes", "light,dark,bigtext").split(",");
const PORT = Number(arg("port", "5195"));
const PG_PORT = PORT + 1;
const BASE = `http://localhost:${PORT}/`;
const PG_BASE = `http://localhost:${PG_PORT}/design.html`;
const PG_DIR = resolve(ROOT, arg("playground-dir", "../bingo-playground"));
const screens = gallery ? ["gallery"] : arg("screen", "lobby").split(",");
const fixture = arg("fixture");
const account = arg("account");
const compare = gallery ? ["new"] : arg("compare", "playground,new").split(",");
const OUT = resolve(ROOT, arg("out", ".pr-screenshots/compare"));

// the button that opens each screen, same words in Classic and New
const OPENS = { journey: "Journey", collect: "Collect", compete: "Compete", shop: "Shop" };
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
    if (el.scrollWidth > el.clientWidth + 1) out.push(`${el.className} is cut off`);
    if (el.getBoundingClientRect().width < 40) out.push(`${el.className} is squeezed: ${Math.round(el.getBoundingClientRect().width)} px`);
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
  const rail = document.querySelector(".nu-rail");
  if (rail && vis(rail) && !rail.classList.contains("is-tight") && rail.scrollHeight > rail.clientHeight + 1) out.push("side panel overflows with the Today box showing");
  return [...new Set(out)];
};

const size = (width) => ({ width, height: width >= 1000 ? 900 : 844 });

async function openContext(column, width, mode) {
  const options = { viewport: size(width), deviceScaleFactor: 1, isMobile: false, hasTouch: width < 1000, colorScheme: mode === "dark" ? "dark" : "light" };
  if (account && column !== "playground") {
    const dir = join(ROOT, ".test-profiles", account);
    if (!existsSync(dir)) throw new Error(`No saved profile for ${account}. Create it first with tools/test-account.mjs.`);
    return chromium.launchPersistentContext(join(dir, "browser"), { ...options, channel: "msedge", headless: true });
  }
  const b = await chromium.launch({ channel: "msedge", headless: true });
  const context = await b.newContext(options);
  context.once("close", () => { void b.close(); });
  return context;
}

async function capture(screen, column, width, mode) {
  const context = await openContext(column, width, mode);
  try {
    const dir = join(OUT, screen);
    mkdirSync(dir, { recursive: true });
    const name = column === "playground" ? `playground-${width}.png` : `${column}${fixture ? `-${fixture}` : ""}-${width}-${mode}.png`;
    if (column === "playground") {
      await context.addInitScript((seed) => { localStorage.setItem("design_e_playground_v2", JSON.stringify(seed)); }, PG_SEED);
      const page = await context.newPage();
      await page.goto(PG_BASE, { waitUntil: "load" });
      await page.addStyleTag({ content: PG_CSS });
      await page.waitForTimeout(1200);
      const tab = OPENS[screen];
      if (tab) { await page.getByRole("button", { name: tab, exact: true }).first().click({ timeout: 4000 }).catch(() => undefined); await page.waitForTimeout(600); }
      await page.evaluate(() => document.fonts?.ready);
      await page.screenshot({ path: join(dir, name) });
      return { name, problems: [] };
    }
    await guard(context);
    await context.addInitScript((big) => { try { localStorage.setItem("ba_settings", JSON.stringify({ bigText: big })); localStorage.setItem("ba_first_visit", "1"); } catch { /* ignore */ } if (big) document.documentElement?.classList.add("big-text"); }, mode === "bigtext");
    const page = context.pages()[0] ?? await context.newPage();
    const query = gallery ? "?gallery" : column === "classic" ? "?design=classic" : fixture ? `?design=new&fixture=${fixture}` : "?design=new";
    await page.goto(BASE + query, { waitUntil: "load" });
    await page.waitForFunction(() => !document.querySelector(".boot") && !document.querySelector(".skel"), undefined, { timeout: 15000 }).catch(() => undefined);
    await page.waitForTimeout(1200);
    if (gallery && mode === "bigtext") await page.evaluate(() => document.documentElement.classList.add("big-text"));
    const skip = page.getByRole("button", { name: "Look around first" });
    if (await skip.isVisible().catch(() => false)) { await skip.click(); await page.waitForTimeout(250); }
    const tab = OPENS[screen];
    if (tab) { await page.getByRole("button", { name: tab, exact: true }).first().click({ timeout: 4000 }).catch(() => undefined); await page.waitForTimeout(600); }
    const open = arg("click");
    if (open) { await page.getByRole("button", { name: new RegExp(open) }).filter({ visible: true }).first().click({ timeout: 4000 }); await page.waitForTimeout(500); }
    await page.evaluate(() => document.fonts?.ready);
    await page.screenshot({ path: join(dir, name), fullPage: gallery });
    const state = await page.evaluate(() => ({ shell: !!document.querySelector(".nu-root"), iw: window.innerWidth }));
    if (state.iw !== width) throw new Error(`viewport is ${state.iw}, asked for ${width}`);
    if (column === "new" && !state.shell) return { name, problems: ["new shell did not render"] };
    if (column === "classic" && state.shell) return { name, problems: ["Classic showed the new shell"] };
    return { name, problems: column === "new" ? await page.evaluate(CHECKS) : [] };
  } finally { await context.close(); }
}

const servers = [];
const serve = (cwd, port) => { const p = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--port", String(port), "--strictPort"], { cwd, stdio: "ignore" }); servers.push(p); return p; };
const waitFor = async (url) => { for (let i = 0; i < 80; i++) { try { if ((await fetch(url)).ok) return true; } catch { /* not yet */ } await new Promise((r) => setTimeout(r, 250)); } return false; };
const portFree = async (port) => { try { await fetch(`http://localhost:${port}/`); return false; } catch { return true; } };

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
  const rows = [];
  for (const screen of screens) {
    for (const width of WIDTHS) {
      for (const column of compare) {
        for (const mode of column === "playground" ? ["light"] : MODES) {
          const r = await capture(screen, column, width, mode);
          rows.push({ screen, column, mode, width, ...r });
          const ok = r.problems.length === 0;
          if (!ok) failed = true;
          console.log(`${ok ? "ok  " : "FAIL"} ${screen} ${column} ${width} ${column === "playground" ? "" : mode}${ok ? "" : ": " + r.problems.join("; ")}`);
        }
      }
    }
  }
  const cell = (r) => `<div><b>${r.column}${r.column === "playground" ? "" : ` · ${r.mode}`}</b><a href="${r.screen}/${r.name}"><img loading="lazy" src="${r.screen}/${r.name}" alt="${r.screen} ${r.column} ${r.width}" width="${r.width}"></a></div>`;
  const html = screens.map((s) => `<h2>${s}</h2>` + WIDTHS.map((w) => `<h3>${w} px</h3><div class="row">${rows.filter((r) => r.screen === s && r.width === w).map(cell).join("")}</div>`).join("")).join("");
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
