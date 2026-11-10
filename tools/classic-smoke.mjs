// Smoke test: opens every Classic screen in a production build and checks each one draws without errors.
//
//   node tools/classic-smoke.mjs                      builds web into a temporary folder, serves it on port 5195, runs, cleans up
//   node tools/classic-smoke.mjs --port 5196 --dist <folder>   serves an existing build instead (it must have been built with
//                                                     VITE_SUPABASE_URL=https://smoke.supabase.test and VITE_DESIGN=classic, as this script does)
//
// Every player gets the New design (BA-05), so this build sets VITE_DESIGN=classic (web/src/lib/design.ts) to keep Classic
// testable until its code is removed.
// The build is made with a made-up Supabase address, and the browser answers every request to it from sample data here,
// so no request reaches the live database or any other server (anything not on localhost is blocked and listed).
// It goes through App's own buttons, as a visitor and as a signed-in player, on a desktop and a phone:
// the lobby, Journey, Compete, Collect, Shop (looks and store), Bingo DNA / Profile, Wallet, Inbox, Invite friends, Help,
// Admin, a live-match search (Matchmaking), and a full round: Play, then Result (a visitor's free round: Play, then its result).
// It also checks that Play and Result are fetched once the lobby shows, so starting a round needs no download.
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");
const argv = process.argv.slice(2);
const arg = (name, d) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : d; };
if (argv.includes("--help") || argv.includes("-h")) { console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").filter((l) => l.startsWith("//")).map((l) => l.slice(3)).join("\n")); process.exit(0); }
const PORT = Number(arg("port", "5195"));
const WEB = fileURLToPath(new URL("../web/", import.meta.url));
const FAKE = "https://smoke.supabase.test";
const BASE = `http://localhost:${PORT}/`;
const USER = "00000000-0000-4000-8000-00000000c1a5";
const TERMS = /TERMS_VERSION = "([^"]+)"/.exec(readFileSync(join(WEB, "src/lib/supabase.ts"), "utf8"))[1];

// ---------- sample data for the stand-in server ----------
const levels = {
  beginner: { every: 4000, win: 4, pt: 1, pen: 5, hint: false, xm: 1, fee: 10, gl: 150, gr: 100 },
  medium: { every: 3000, win: 3, pt: 1.5, pen: 8, hint: false, xm: 1.5, fee: 20, gl: 250, gr: 130 },
  hard: { every: 2200, win: 2, pt: 2, pen: 15, hint: false, xm: 2, fee: 40, gl: 380, gr: 200 },
};
// rounds last 4 seconds here, so a whole round fits in the test
const cfg = { levels, g: { pay: 1.8, pvp: true, note: "", paid: true, rake: 0.1, login: 10, maint: false, total: 4, welcome: 50, calendar: [20, 30, 40, 50, 75, 100, 200] } };
const profile = { id: USER, display_name: "Smoke Test", xp: 520, streak: 3, banned: false, role: "admin", played: 12, adult_confirmed: true, terms_version: TERMS, shields: 1, daily_done: 2, equipped: {}, is_guest: false, cg_user: null, guide_seen: 999 };
const TABLES = { profiles: profile, game_config: { data: cfg }, wallet: { balance: 1000 }, feature_flags: { mode: "off" } };
const RPC = { inbox_summary: { unread: 0, admin_unread: 0 }, my_match: { status: "queued", waited: 0 }, online_players: [] };
const roundResult = { score: 120, daubs: 9, wrong: 1, late: 0, lines: 1, maxMult: 2, accuracy: 0.9, avgReactionMs: 800, win: true, prize: 18, xp: 30, ghost: null, best: 120, balance: 1008, level: 4, achievements: [], mode: "solo", missed: 2, maxStreak: 4 };
const FN = {
  "daily-bonus": { claimed: false, bonus: 0, streak: 3 },
  "start-round": { roundId: "smoke-round", seed: 12345, balance: 990, params: { ...levels.beginner, total: 4, pay: 1.8, ghost: null, level: "beginner" } },
  "submit-round": roundResult,
  "daily-info": { day: "2026-11-08", level: "beginner", label: "Beginner", goals: [80, 160, 240], played: null, rank: null, done: 0, shields: 1 },
};
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const now = () => Math.floor(Date.now() / 1000);
const token = () => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: USER, role: "authenticated", aud: "authenticated", iat: now(), exp: now() + 86400 })}.smoke`;
const user = { id: USER, aud: "authenticated", role: "authenticated", email: "smoke@example.test", app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
const session = () => ({ access_token: token(), refresh_token: "smoke-refresh", token_type: "bearer", expires_in: 86400, expires_at: now() + 86400, user });

/** Answers one request to the made-up Supabase address. */
function answer(req) {
  const u = new URL(req.url());
  const json = (body, status = 200, headers = {}) => ({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*", "content-range": "*/0", ...headers }, body: JSON.stringify(body) });
  if (req.method() === "OPTIONS") return { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" }, body: "" };
  const p = u.pathname;
  if (p === "/auth/v1/user") return json(user);
  if (p === "/auth/v1/token") return json(session());
  if (p === "/auth/v1/logout") return { status: 204, headers: { "access-control-allow-origin": "*" }, body: "" };
  if (p === "/auth/v1/settings") return json({ external: { email: true }, mailer_autoconfirm: false, disable_signup: false });
  if (p.startsWith("/rest/v1/rpc/")) return json(RPC[p.slice(13)] ?? null);
  if (p.startsWith("/rest/v1/")) {
    const d = TABLES[p.slice(9)];
    if ((req.headers().accept ?? "").includes("vnd.pgrst.object")) {
      const one = Array.isArray(d) ? d[0] : d;
      return one ? json(one) : json({ code: "PGRST116", message: "no rows", details: null, hint: null }, 406);
    }
    return json(Array.isArray(d) ? d : d ? [d] : []);
  }
  if (p.startsWith("/functions/v1/")) return json(FN[p.slice(14)] ?? {});
  return json({ message: "not found" }, 404);
}

// ---------- build and serve ----------
const portFree = (port) => new Promise((done) => { const s = createServer().once("error", () => done(false)).once("listening", () => s.close(() => done(true))).listen(port, "127.0.0.1"); });
let dist = arg("dist");
let tmp = null;
let server = null;
const stopServer = () => {
  if (!server || server.exitCode !== null) return;
  // only this script's own server and its children
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  else server.kill();
};

const results = [];
const blocked = new Set();
let failed = false;
try {
  if (!(await portFree(PORT))) throw new Error(`port ${PORT} is busy: stop what runs there, or pass --port`);
  if (!dist) {
    tmp = mkdtempSync(join(tmpdir(), "ba-smoke-"));
    dist = join(tmp, "dist");
    console.log("building web with a made-up Supabase address…");
    const b = spawnSync("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir", "--logLevel", "error"], {
      cwd: WEB, shell: true, stdio: "inherit",
      // set here, these win over web/.env.local, so the build never points at the live database
      env: { ...process.env, VITE_SUPABASE_URL: FAKE, VITE_SUPABASE_ANON_KEY: "smoke-anon-key", VITE_DESIGN: "classic" },
    });
    if (b.status !== 0) throw new Error("the build failed");
  }
  const built = spawnSync(process.platform === "win32" ? "findstr" : "grep", process.platform === "win32" ? ["/M", "/S", "smoke.supabase.test", join(dist, "assets", "*.js")] : ["-rl", "smoke.supabase.test", join(dist, "assets")], { encoding: "utf8" });
  if (!built.stdout.trim()) throw new Error("this build does not use the made-up Supabase address; build it with VITE_SUPABASE_URL=" + FAKE);
  server = spawn("npx", ["vite", "preview", "--outDir", dist, "--port", String(PORT), "--strictPort"], { cwd: WEB, shell: true, stdio: "ignore" });
  for (let i = 0; i < 60 && await portFree(PORT); i++) await new Promise((r) => setTimeout(r, 500));

  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const [device, viewport] of [["desktop", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844 }]].slice(0, Number(process.env.SMOKE_DEVICES ?? 2))) {
      for (const who of ["visitor", "player"].filter((w) => !process.env.SMOKE_WHO || w === process.env.SMOKE_WHO)) await runAs(browser, device, viewport, who);
    }
  } finally { await browser.close(); }
} catch (e) {
  failed = true;
  console.error(`smoke test stopped: ${e.message}`);
} finally {
  stopServer();
  if (tmp) rmSync(tmp, { recursive: true, force: true });
}

// ---------- the walk through the screens ----------
async function runAs(browser, device, viewport, who) {
  const context = await browser.newContext({ viewport, hasTouch: device === "phone", isMobile: device === "phone" });
  await context.route("**/*", (route) => {
    const req = route.request();
    const u = new URL(req.url());
    if (u.origin === FAKE) return route.fulfill(answer(req));
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return route.continue();
    blocked.add(u.hostname);
    return route.abort();
  });
  await context.addInitScript(([signedIn, s, id]) => {
    try {
      if (sessionStorage.getItem("smoke_seeded")) return; // seed once, then let the game keep its own storage
      sessionStorage.setItem("smoke_seeded", "1");
      localStorage.clear();
      localStorage.setItem("ba_first_visit", "1");
      localStorage.setItem("ba_mode", "solo");
      localStorage.setItem("ba_guide_" + id, "999");
      if (signedIn) localStorage.setItem("sb-smoke-auth-token", JSON.stringify(s));
    } catch { /* ignore */ }
  }, [who === "player", session(), USER]);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.stack ?? e.message ?? e).split("\n").slice(0, 3).map((l) => l.trim()).join(" < ")));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::/.test(m.text())) errors.push(m.text().split("\n")[0]); });
  const chunks = [];
  page.on("response", (r) => { const m = /\/assets\/([^/]+\.js)$/.exec(r.url()); if (m) chunks.push(m[1]); });

  const settle = async () => {
    await page.waitForFunction(() => !document.querySelector(".boot") && !document.querySelector('.skel[role="status"]'), undefined, { timeout: 20000 });
    await page.waitForTimeout(300);
  };
  const step = async (name, open, drawn) => {
    const e0 = errors.length;
    const c0 = chunks.length;
    const t0 = Date.now();
    let problem = "";
    try {
      const went = await open();
      if (went === "skip") { results.push({ device, who, name, ok: true, note: "not on this device (no button)" }); return; }
      await settle();
      await page.waitForFunction(drawn, undefined, { timeout: 20000 });
      if (await page.getByRole("button", { name: "Reload the game" }).isVisible().catch(() => false)) problem = "the error screen showed";
    } catch (e) {
      const seen = await page.evaluate(() => ({ boot: !!document.querySelector(".boot"), skel: document.querySelectorAll(".skel").length, loading: document.querySelectorAll('.skel[role="status"]').length, text: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 160) })).catch(() => null);
      problem = `${String(e.message).split("\n")[0]}${seen ? ` (page: boot ${seen.boot}, skel ${seen.skel}, loading ${seen.loading}, "${seen.text}")` : ""}`;
    }
    if (errors.length > e0) problem = `${problem ? problem + "; " : ""}page error: ${errors.slice(e0).join(" | ").slice(0, 400)}`;
    results.push({ device, who, name, ok: !problem, ms: Date.now() - t0, files: chunks.slice(c0), note: problem });
  };
  const has = (sel) => new Function(`return !!document.querySelector(${JSON.stringify(sel)})`);
  const text = (t) => new Function(`return document.querySelector(".content")?.innerText.includes(${JSON.stringify(t)})`);
  const click = async (locator) => { if (!(await locator.isVisible().catch(() => false))) return "skip"; await locator.click(); };
  const nav = (label) => click(page.locator("nav.nav button", { hasText: new RegExp(`^${label}`) }).first());

  // a screen has drawn when the loading placeholder is gone and the page holds more than its intro line and notices
  // (a screen's own loading cards count: the sample data has no worlds or stamps, so Journey and Collect show those)
  const screen = (extra = "") => new Function(`
    const c = document.querySelector(".content");
    if (!c || document.querySelector('.skel[role="status"]')) return false;
    if (![...c.children].some((el) => !el.matches("p.intro, p.toast"))) return false;
    return ${extra || "true"};`);
  const notLobby = '!document.querySelector(".cta .btn.big")';

  // the lobby; Play and Result arrive by themselves once it shows
  const l0 = chunks.length;
  await step("lobby", () => page.goto(BASE, { waitUntil: "load" }), has(".cta .btn.big"));
  await page.waitForTimeout(4000);
  const early = chunks.slice(l0).filter((f) => /^(Play|Result)-/.test(f));
  results.push({ device, who, name: "Play and Result fetched once the lobby shows", ok: early.length >= 2, files: early, note: early.length >= 2 ? "" : "not fetched" });
  // a visitor's welcome card covers the page until it is closed
  const lookAround = page.getByRole("button", { name: "Look around first" });
  if (await lookAround.isVisible().catch(() => false)) { await lookAround.click(); await page.waitForTimeout(300); }

  await step("Journey", () => nav("Journey"), screen(notLobby));
  await step("Compete", () => nav("Compete"), screen(notLobby));
  await step("Collect", () => nav("Collect"), screen(notLobby));
  await step("Shop", () => nav("Shop"), screen(notLobby));
  await step("Shop: the other tab", () => click(page.locator(".content [role=tab]").nth(1)), screen(notLobby));
  await step(who === "visitor" ? "Bingo DNA (demo)" : "Profile", () => (who === "visitor" ? nav("Bingo DNA") : click(page.locator(".appbar .who"))), screen(notLobby));
  await step("Help", () => click(page.getByRole("button", { name: "Help and guide" }).first()), screen(notLobby));
  if (who === "player") {
    await step("Wallet", () => click(page.locator(".appbar button[aria-label^='Open wallet']")), screen(notLobby));
    await step("Inbox", () => click(page.locator(".appbar button[aria-label^='Inbox']")), screen(notLobby));
    await step("Invite friends", () => nav("Invite friends"), screen(notLobby));
    await step("Admin", () => click(page.locator(".appbar button[aria-label^='Admin area']")), has(".shell.wide"));
    // a live-match search: the Matchmaking screen stays up while it waits for an opponent
    await step("lobby (live match chosen)", async () => { await page.evaluate(() => localStorage.setItem("ba_mode", "pvp")); await page.reload({ waitUntil: "load" }); }, has(".cta .btn.big"));
    await step("Matchmaking", async () => { await page.locator(".cta .btn.big").click(); await page.waitForTimeout(2500); }, screen(notLobby));
    await step("lobby (practice chosen)", async () => { await page.evaluate(() => localStorage.setItem("ba_mode", "solo")); await page.reload({ waitUntil: "load" }); }, has(".cta .btn.big"));
    await page.waitForTimeout(4000); // let the prefetch run again after the reload
    const r0 = chunks.length;
    await step("Play (a solo round)", () => page.locator(".cta .btn.big").click(), has(".countdown, .pl-tile"));
    await step("Result (the round's end)", () => page.waitForFunction(() => !document.querySelector(".countdown, .pl-tile"), undefined, { timeout: 30000 }), screen(`${notLobby} && c.innerText.includes("120")`));
    const late = chunks.slice(r0).filter((f) => /^(Play|Result)-/.test(f));
    results.push({ device, who, name: "the round needed no download", ok: late.length === 0, files: late, note: late.length ? "Play or Result was downloaded when the round started" : "" });
  } else {
    await step("lobby again", () => nav("Play"), has(".cta .btn.big"));
    await step("Play (a free round)", () => click(page.getByRole("button", { name: "Play free" }).first()), has(".countdown, .pl-tile"));
    await step("the free round's result", () => page.waitForFunction(() => !document.querySelector(".countdown, .pl-tile"), undefined, { timeout: 30000 }), screen(notLobby));
  }
  await context.close();
}

// ---------- report ----------
const pad = (s, n) => String(s).padEnd(n);
for (const r of results) console.log(`${r.ok ? "ok  " : "FAIL"} ${pad(r.device, 8)}${pad(r.who, 8)}${pad(r.name, 42)}${r.ms !== undefined ? pad(`${r.ms} ms`, 9) : pad("", 9)}${r.files?.length ? r.files.join(" ") : ""}${r.note ? `  ${r.note}` : ""}`);
console.log(`blocked hosts (nothing left this machine except to them, and those were aborted): ${[...blocked].join(", ") || "none"}`);
const bad = results.filter((r) => !r.ok);
console.log(bad.length || failed ? `${bad.length} of ${results.length} checks failed` : `all ${results.length} checks passed`);
process.exit(bad.length || failed ? 1 : 0);
