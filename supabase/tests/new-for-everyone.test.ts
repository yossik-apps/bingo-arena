import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chooseDesign, DESIGN_MODE, designMode, shellAllowed, visitorScreen, NEW_SCREENS } from "../../web/src/lib/design.ts";
import { asPlayer, NO_ROWS, sessionUser } from "../../web/src/lib/session.ts";

// BA-05: the New design is the only design for everyone, from the first screen. BA-13: a clean load sends no personal call
// without a session (no 401 from daily-info, no "user_id=eq." with an empty id).
const web = new URL("../../web/", import.meta.url);
const src = (path: string) => readFileSync(new URL(path, web), "utf8").replace(/\r\n/g, "\n");

test("every viewer gets New: visitor, player and admin, with nothing read or waited for", () => {
  assert.equal(DESIGN_MODE, "all");
  for (const isAdmin of [false, true]) assert.equal(chooseDesign({ mode: DESIGN_MODE, isAdmin, override: null }), "new");
  // a player's own ?design=classic does nothing
  assert.equal(chooseDesign({ mode: DESIGN_MODE, isAdmin: false, override: "classic" }), "new");
  // a visitor's first screen is the new lobby, and a free round uses the new Play
  const allowed = (screen: string) => shellAllowed({ screen, design: "new", isAdmin: false, override: null, dev: false });
  assert.equal(visitorScreen({ screen: "lobby", playing: false, freeResult: false, allowed }), "lobby");
  assert.equal(visitorScreen({ screen: "lobby", playing: true, freeResult: false, allowed }), "play");
  for (const s of ["lobby", "journey", "compete", "collect", "shop", "help", "profile", "play", "result"]) assert.ok(NEW_SCREENS.has(s), s);
});

test("only a test build of Classic (VITE_DESIGN=classic) gets Classic; anything else is New", () => {
  assert.equal(designMode(undefined), "all");
  assert.equal(designMode({}), "all");
  assert.equal(designMode({ VITE_DESIGN: "new" }), "all");
  assert.equal(designMode({ VITE_DESIGN: "off" }), "all");
  assert.equal(designMode({ VITE_DESIGN: "classic" }), "off");
  assert.match(readFileSync(new URL("../../tools/classic-smoke.mjs", import.meta.url), "utf8"), /VITE_DESIGN: "classic"/);
});

test("the admin panel is its own page in every design, outside both game shells", () => {
  const app = src("src/App.tsx");
  const page = app.indexOf('if (view === "admin" && isAdmin) {');
  assert.ok(page > 0, "admin page");
  assert.ok(page < app.indexOf("if (shellAllowed({ screen: view, design, isAdmin"), "before the new shell");
  assert.match(app, /<div className="shell wide admin-page" data-design="classic">\n\s*<div className="content"><Suspense fallback=\{<div className="skel" \/>\}>\n\s*<Admin onBack=/);
  assert.equal(app.match(/<Admin /g)?.length, 1, "drawn in one place only");
  assert.ok(!NEW_SCREENS.has("admin"), "no new version of the admin panel");
  // the panel keeps its stylesheet: these rules must stay when Classic is removed
  const css = src("src/styles.css");
  for (const r of [".shell.wide{", ".atabs{", ".adm-title", "main:has(> .admin-page)"]) assert.ok(css.includes(r), r);
  // the admin panel does not use Classic's game views
  for (const f of ["Admin.tsx", "Config.tsx"]) assert.doesNotMatch(src(`src/views/admin/${f}`), /from "\.\.\/[A-Z]/, f);
});

const auth = (id: string | null, fail = false) => ({
  getSession: async () => { if (fail) throw new Error("storage blocked"); return { data: { session: id ? { user: { id } } : null } }; },
});

test("personal calls wait for the session and are never sent without one", async () => {
  assert.equal(await sessionUser(auth("u1")), "u1");
  assert.equal(await sessionUser(auth(null)), "");
  assert.equal(await sessionUser(auth("u1", true)), "");
  let sent = 0;
  const call = async () => { sent++; return "info"; };
  assert.equal(await asPlayer(auth(null), call), null, "visitor: nothing");
  assert.equal(sent, 0, "no request for a visitor");
  assert.equal(await asPlayer(auth("guest-1"), call), "info", "guest or player: the call");
  assert.equal(sent, 1);
  // the session is awaited before the call goes out
  const order: string[] = [];
  const slow = { getSession: async () => { await new Promise((r) => setTimeout(r, 20)); order.push("session"); return { data: { session: { user: { id: "g" } } } }; } };
  await asPlayer(slow, async () => { order.push("call"); });
  assert.deepEqual(order, ["session", "call"]);
  assert.deepEqual(await NO_ROWS, { data: null, error: null, count: null });
});

test("daily-info goes through asPlayer everywhere, and no Classic view filters on an empty id", () => {
  assert.ok(src("src/App.tsx").includes('asPlayer(supabase.auth, () => callFn<DailyInfo>("daily-info"))'));
  assert.ok(src("src/views/DailyCard.tsx").includes('asPlayer(supabase.auth, () => callFn<DailyInfo>("daily-info"))'));
  const all = ["src/App.tsx", "src/views/DailyCard.tsx"].map(src).join("\n");
  assert.equal(all.match(/callFn<DailyInfo>\("daily-info"\)/g)?.length, 2, "no other daily-info call");
  // every Classic view's read of the player's own rows is skipped when there is no id
  for (const f of ["Journey", "Album", "Quests", "Events", "Wallet"]) {
    const s = src(`src/views/${f}.tsx`);
    const reads = s.match(/[^\n]*\.eq\("user_id", me\.id\)[^\n]*/g) ?? [];
    assert.ok(reads.length > 0, f);
    for (const r of reads) assert.match(r, /me\.id \? supabase\.from\([^\n]*: NO_ROWS/, `${f}: ${r.trim().slice(0, 80)}`);
  }
});
