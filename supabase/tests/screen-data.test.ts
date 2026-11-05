import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { NEED_ACCOUNT, needsAccount, screenData, type ScreenData } from "../../web/src/lib/screenData.ts";
import { emptyData, sampleData, visitorData } from "../../web/src/newui/screens/dataFixture.ts";

// The new screens' data groups make the same calls as the Classic screens. A fake client records every call as code text,
// for example  from("worlds").select("*").order("sort"), and each one must appear word for word in the Classic file it mirrors.
const web = new URL("../../web/src/", import.meta.url);
const src = (path: string) => readFileSync(new URL(path, web), "utf8").replace(/\r\n/g, "\n");

// formats a value the way the Classic code writes it: { p_id: "x", p_open: true }
const fmt = (v: unknown): string =>
  v === null ? "null" : typeof v === "string" ? JSON.stringify(v) : typeof v !== "object" ? String(v)
    : `{${Object.entries(v as Record<string, unknown>).map(([k, x]) => ` ${k}: ${fmt(x)}`).join(",")}${Object.keys(v as object).length ? " " : ""}}`;
const callText = (name: string, args: unknown[]) => `${name}(${args.map(fmt).join(", ")})`;

type Answer = { data?: unknown; error?: { message: string } | null; count?: number };
function fakeDb(answer: (text: string) => Answer = () => ({})) {
  const log: string[] = [];
  const reply = (text: string) => { const a = answer(text); return { data: a.data ?? null, error: a.error ?? null, count: a.count ?? null }; };
  const chain = (text: string): unknown => new Proxy({}, {
    get: (_, k) => k === "then" ? (ok: (v: unknown) => void, bad: (e: unknown) => void) => { log.push(text); return Promise.resolve(reply(text)).then(ok, bad); }
      : (...args: unknown[]) => chain(`${text}.${callText(String(k), args)}`),
  });
  const db = {
    from: (t: string) => chain(callText("from", [t])),
    rpc: (n: string, a?: unknown) => { const t = callText("rpc", a === undefined ? [n] : [n, a]); log.push(t); return Promise.resolve(reply(t)); },
    auth: new Proxy({}, { get: (_, k) => (...args: unknown[]) => { const t = `auth.${callText(String(k), args)}`; log.push(t); return Promise.resolve({ ...reply(t), data: reply(t).data ?? { session: null, user: null } }); } }),
  };
  return { db, log };
}

const ME = "ME-ID", TODAY = "2026-11-03", NOW = "NOW-ISO";
function make(answer?: (text: string) => Answer, userId: string | null = ME) {
  const { db, log } = fakeDb(answer);
  const calls: string[] = [];
  let refreshed = 0, inboxRefreshed = 0;
  const sd = screenData({
    db: db as never, userId, termsVersion: "2026-10", origin: "ORIGIN",
    call: async (name, body) => { calls.push(callText("callFn", [name, body])); return { code: "C0DE" } as never; },
    rpcError: (e) => `readable: ${e?.message}`, errorText: (c) => `text: ${c}`,
    refresh: async () => { refreshed++; }, refreshInbox: () => { inboxRefreshed++; }, markSaved: async () => { calls.push("markSaved"); },
    today: () => TODAY, now: () => NOW,
  });
  return { sd, log, calls, refreshed: () => refreshed, inboxRefreshed: () => inboxRefreshed };
}

/** Runs `run`, then checks every recorded call appears in the Classic file, after naming the sample values as Classic does. */
async function mirrors(file: string, run: (sd: ScreenData) => Promise<unknown>, names: [string, string][] = []) {
  const m = make();
  await run(m.sd);
  const classic = src(file);
  const all = [...m.log, ...m.calls.filter((c) => c !== "markSaved")];
  assert.ok(all.length > 0, "made a call");
  for (let text of all) {
    for (const [value, name] of [[JSON.stringify(ME), "me.id"], [JSON.stringify(TODAY), "day"], [JSON.stringify(NOW), "new Date().toISOString()"], ["\"2026-10\"", "TERMS_VERSION"], ...names] as [string, string][]) text = text.split(value).join(name);
    assert.ok(classic.includes(text), `${file} has  ${text}`);
  }
  return m;
}

test("journey: the same three reads as Classic Journey", async () => {
  const m = await mirrors("views/Journey.tsx", (sd) => sd.journey.load());
  assert.equal(m.log.length, 3);
});
test("journey: a visitor gets the worlds and stages and no progress", async () => {
  const m = make((t) => t.startsWith("from(\"stages\")") ? { data: [{ id: "s1" }] } : t.startsWith("from(\"user_stages\")") ? { data: [{ stage_id: "s1", stars: 2, best_score: 300, attempts: 1 }] } : { data: [] }, null);
  const j = await m.sd.journey.load();
  assert.deepEqual(j.progress, {});
  assert.ok(!m.log.some((t) => t.includes("user_stages")), "no player query for a visitor");
  const p = await make((t) => t.startsWith("from(\"user_stages\")") ? { data: [{ stage_id: "s1", stars: 2, best_score: 300, attempts: 1 }] } : { data: [] }).sd.journey.load();
  assert.deepEqual(p.progress, { s1: { stars: 2, best_score: 300, attempts: 1 } });
});
test("season: Classic Season's calls", async () => {
  await mirrors("views/Season.tsx", async (sd) => { await sd.season.load(); await sd.season.buyPass(); await sd.season.claimTier(4, "free"); }, [["4", "t.tier"], ["\"free\"", "track"]]);
});
test("quests: Classic Quests' four reads and the claim", async () => {
  await mirrors("views/Quests.tsx", (sd) => sd.quests.load());
  const m = await mirrors("views/Quests.tsx", (sd) => sd.quests.claim("Q1"), [["\"Q1\"", "id"]]);
  assert.equal(m.refreshed(), 1, "the wallet is refreshed after a claim");
});
test("album: Classic Album's five reads, craft and claim", async () => {
  await mirrors("views/Album.tsx", (sd) => sd.album.load());
  const c = await mirrors("views/Album.tsx", (sd) => sd.album.craft("S1"), [["\"S1\"", "s.id"]]);
  assert.equal(c.refreshed(), 0, "Classic does not refresh after crafting");
  const a = await mirrors("views/Album.tsx", (sd) => sd.album.claim(7777), [["7777", "w.id"]]);
  assert.equal(a.refreshed(), 1);
});
test("account: Classic Profile's calls, never run against live", async () => {
  await mirrors("views/Profile.tsx", (sd) => sd.account.load());
  await mirrors("views/Profile.tsx", (sd) => sd.account.changePassword("NEWPASS1"), [["\"NEWPASS1\"", "pw"]]);
  // Classic: supabase.rpc("set_spend_limit", { p_cents: v === "" ? null : Number(v) }), then a refresh
  for (const cents of [2500, null]) {
    const m = make();
    await m.sd.account.setSpendLimit(cents);
    assert.deepEqual(m.log, [`rpc("set_spend_limit", { p_cents: ${cents} })`]);
    assert.equal(m.refreshed(), 1);
  }
  assert.ok(src("views/Profile.tsx").includes('supabase.rpc("set_spend_limit", { p_cents: v === "" ? null : Number(v) })'));
  // Classic: try { await callFn("delete-account", { confirm }); await supabase.auth.signOut(); }
  const d = make();
  await d.sd.account.deleteAccount("DELETE");
  assert.deepEqual(d.calls, ['callFn("delete-account", { confirm: "DELETE" })']);
  assert.deepEqual(d.log, ["auth.signOut()"]);
  assert.ok(src("views/Profile.tsx").includes('try { await callFn("delete-account", { confirm }); await supabase.auth.signOut(); }'));
  const bad = make((t) => t.startsWith("auth.updateUser") ? { error: { message: "Password is too weak" } } : {});
  await assert.rejects(bad.sd.account.changePassword("x"), { message: "Password is too weak" });
});
test("compete: Classic Events, League, Calendar and New players", async () => {
  await mirrors("views/Events.tsx", async (sd) => { await sd.compete.events(); await sd.compete.live_races(); await sd.compete.attempts_used("E1"); await sd.compete.event_leaderboard("E1"); }, [["\"E1\"", "e.id"]]);
  await mirrors("views/League.tsx", async (sd) => { await sd.compete.league_info(); await sd.compete.league_board(); await sd.compete.league_payouts(); });
  await mirrors("views/Calendar.tsx", (sd) => sd.compete.liveops());
  await mirrors("views/NewPlayers.tsx", async (sd) => { await sd.compete.new_players(30); await sd.compete.wave_hello("U1"); }, [["\"U1\"", "p.user_id"]]);
  const n = make(() => ({ count: 2 }));
  assert.equal(await n.sd.compete.attempts_used("E1"), 2);
});
test("compete: Classic Crew's reads and all its actions, each refreshing the wallet", async () => {
  await mirrors("views/Crew.tsx", async (sd) => { await sd.compete.crew_info(); await sd.compete.crew_board(); await sd.compete.search_crews(""); });
  const cases: [(sd: ScreenData) => Promise<unknown>, [string, string][]][] = [
    [(sd) => sd.compete.search_crews("Q"), [["\"Q\"", "q"]]],
    [(sd) => sd.compete.join_crew("C1"), [["\"C1\"", "h.id"]]],
    [(sd) => sd.compete.join_crew(null, "CODE"), [["\"CODE\"", "code"]]],
    [(sd) => sd.compete.create_crew({ name: "N", tag: "T", descr: "D", open: true }), [["\"N\"", "f.name"], ["\"T\"", "f.tag"], ["\"D\"", "f.descr"], ["true", "f.open"]]],
    [(sd) => sd.compete.claim_crew_chest(2), [["2", "t"]]],
    [(sd) => sd.compete.leave_crew(), []],
    [(sd) => sd.compete.update_crew("D", true), [["\"D\"", "descr"], ["true", "crew.open"]]],
    [(sd) => sd.compete.kick_crew_member("U1"), [["\"U1\"", "m.user_id"]]],
  ];
  for (const [run, names] of cases) {
    const m = await mirrors("views/Crew.tsx", run, names);
    if (run.toString().includes("search_crews")) continue;
    assert.equal(m.refreshed(), 1, "a crew action refreshes the wallet");
  }
  const bad = make((t) => t.startsWith("rpc(\"join_crew\"") ? { error: { message: "crew_full" } } : {});
  await assert.rejects(bad.sd.compete.join_crew("C1"), { message: "readable: crew_full" });
  assert.equal(bad.refreshed(), 0);
});
test("store: Classic Store and lib/store's calls; test purchases only", async () => {
  await mirrors("lib/store.ts", (sd) => sd.store.loadProducts());
  await mirrors("views/Store.tsx", (sd) => sd.store.confirmAge());
  // Store.tsx passes the rpc name to its act() helper: act(p.id, "buy_test", { p_product: p.id }, …)
  const store = src("views/Store.tsx");
  for (const [run, text] of [
    [(sd: ScreenData) => sd.store.buyTest("P1"), ['"buy_test", { p_product: "P1" }', '"buy_test", { p_product: p.id }']],
    [(sd: ScreenData) => sd.store.gemSpend("coins_s"), ['"gem_spend", { p_what: "coins_s" }', '"gem_spend", { p_what: "coins_s" }']],
    [(sd: ScreenData) => sd.store.gemSpend("shield"), ['"gem_spend", { p_what: "shield" }', '"gem_spend", { p_what: "shield" }']],
    [(sd: ScreenData) => sd.store.clubClaim(), ['"club_claim", {}', '"club_claim", {}']],
  ] as const) {
    const m = make();
    await run(m.sd);
    assert.equal(m.log[0], `rpc(${text[0]})`);
    assert.ok(store.includes(`act(`) && store.includes(text[1]), `Store.tsx has ${text[1]}`);
    assert.equal(m.refreshed(), 1);
  }
  const adult = make((t) => t.startsWith("rpc(\"buy_test\"") ? { error: { message: "adults_only" } } : {});
  const e = await adult.sd.store.buyTest("P1").catch((x) => x);
  assert.equal(e.message, "readable: adults_only");
  assert.ok(adult.sd.store.isAdultsOnly(e), "the screen can offer the 18+ confirmation, as Classic does");
  assert.ok(!src("lib/screenData.ts").match(/"buy_(live|real)"|stripe|checkout/i), "no real payment call");
});
test("shop, history, inbox and refer: Classic Shop, Wallet, Inbox and Refer", async () => {
  await mirrors("views/Shop.tsx", async (sd) => { await sd.shop.dailyDeals(); await sd.shop.buy("I1"); await sd.shop.equip("I1", true); }, [["\"I1\"", "it.id"], ["true", "on"]]);
  await mirrors("views/Wallet.tsx", async (sd) => { await sd.history.ledger(); await sd.history.purchases(); });
  const i = await mirrors("views/Inbox.tsx", async (sd) => { await sd.inbox.load(); await sd.inbox.open("T1"); await sd.inbox.contact("TOPIC", "BODY"); await sd.inbox.markRead(); }, [["\"T1\"", "id"], ["\"TOPIC\"", "topic"], ["\"BODY\"", "body"]]);
  assert.equal(i.inboxRefreshed(), 2, "opening a thread and marking notes read refresh the count");
  await mirrors("views/Inbox.tsx", (sd) => sd.inbox.reply("T1", "R"), [["\"T1\"", "open.id"], ["\"R\"", "reply"]]);
  await mirrors("views/Refer.tsx", (sd) => sd.refer.load());
  assert.equal(await make(() => ({ error: { message: "missing" } })).sd.refer.load(), "old");
});
test("match: Classic Matchmaking and Result", async () => {
  await mirrors("views/Matchmaking.tsx", async (sd) => { await sd.match.state(); await sd.match.cancel(); await sd.match.online(); await sd.match.invite("U1", "medium"); }, [["\"U1\"", "p.id"], ["\"medium\"", "level"]]);
  await mirrors("views/Result.tsx", (sd) => sd.match.result("M1"), [["\"M1\"", "r.matchId"]]);
  const f = make(); await f.sd.match.find("hard");
  assert.deepEqual(f.calls, ['callFn("find-match", { level: "hard" })']);
  assert.ok(src("views/Matchmaking.tsx").includes('callFn("find-match", { level })'));
  const c = make(); assert.equal(await c.sd.match.challenge("R1"), "C0DE");
  assert.deepEqual(c.calls, ['callFn("create-challenge", { roundId: "R1" })']);
  assert.ok(src("views/Result.tsx").includes('callFn<{ code: string }>("create-challenge", { roundId: r.roundId })'));
});
test("auth: Classic Auth, AgeGate and guest calls", async () => {
  const a = make();
  await a.sd.auth.signUp({ email: " a@b.co ", password: "pw123456", name: " Sam ", crazyGames: false });
  await a.sd.auth.signUp({ email: "a@b.co", password: "pw123456", name: "Sam", crazyGames: true });
  await a.sd.auth.signIn(" a@b.co ", "pw123456");
  await a.sd.auth.google(); await a.sd.auth.linkGoogle(); await a.sd.auth.addEmail(" a@b.co "); await a.sd.auth.setPassword("pw123456");
  await a.sd.auth.resend("a@b.co"); await a.sd.auth.resetPassword(" a@b.co "); await a.sd.auth.signOut(); await a.sd.auth.markSaved();
  assert.deepEqual(a.log, [
    'auth.signUp({ email: "a@b.co", password: "pw123456", options: { data: { name: "Sam", adult: "true", terms_version: "2026-10" }, emailRedirectTo: "ORIGIN" } })',
    'auth.signUp({ email: "a@b.co", password: "pw123456", options: { data: { name: "Sam", terms: "true", joined_on: "crazygames", terms_version: "2026-10" }, emailRedirectTo: "ORIGIN" } })',
    'auth.signInWithPassword({ email: "a@b.co", password: "pw123456" })',
    'auth.signInWithOAuth({ provider: "google", options: { redirectTo: "ORIGIN" } })',
    'auth.linkIdentity({ provider: "google", options: { redirectTo: "ORIGIN" } })',
    'auth.updateUser({ email: "a@b.co" })',
    'auth.updateUser({ password: "pw123456" })',
    'auth.resend({ type: "signup", email: "a@b.co", options: { emailRedirectTo: "ORIGIN" } })',
    'auth.resetPasswordForEmail("a@b.co", { redirectTo: "ORIGIN" })',
    "auth.signOut()",
  ]);
  assert.deepEqual(a.calls, ["markSaved"]);
  const auth = src("views/Auth.tsx");
  for (const t of ['{ name: name.trim(), adult: "true", terms_version: TERMS_VERSION }', '{ name: name.trim(), terms: "true", joined_on: "crazygames", terms_version: TERMS_VERSION }', "emailRedirectTo: window.location.origin } });",
    "signInWithPassword({ email: email.trim(), password: pw })", 'signInWithOAuth({ provider, options: { redirectTo: window.location.origin } })', 'linkIdentity({ provider: "google", options: { redirectTo: window.location.origin } })',
    "updateUser({ email: email.trim() })", "updateUser({ password: pw })", 'resend({ type: "signup", email: sent, options: { emailRedirectTo: window.location.origin } })', "resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin })"]) assert.ok(auth.includes(t), `Auth.tsx has ${t}`);
  // AgeGate: the 18+ answer, and the older call when the database is not updated yet
  const g = make((t) => t.includes("p_age18") ? { error: { message: "Could not find the function" } } : {});
  await g.sd.auth.acceptTerms(true);
  assert.deepEqual(g.log, ['rpc("accept_terms", { p_version: "2026-10", p_age18: false, p_where: "crazygames" })', 'rpc("accept_terms", { p_version: "2026-10" })']);
  const age = src("views/AgeGate.tsx");
  assert.ok(age.includes('supabase.rpc("accept_terms", { p_version: TERMS_VERSION, p_age18: !crazy, p_where: crazy ? "crazygames" : "web" })'));
  assert.ok(age.includes('supabase.rpc("accept_terms", { p_version: TERMS_VERSION })'));
});
// What the anon role (a visitor) may read or run, from the grants in the migrations.
const migrations = readdirSync(new URL("../migrations/", import.meta.url)).filter((n) => /^\d{3}_.*\.sql$/.test(n)).sort().map((n) => readFileSync(new URL(`../migrations/${n}`, import.meta.url), "utf8")).join("\n");
const anonMay = new Set<string>();
for (const m of migrations.matchAll(/grant\s+(select|execute)[^;]*?\bon\s+(?:function\s+)?([^;]*?)\s+to\s+([^;]*);/gi))
  if (/\banon\b/.test(m[3])) for (const t of m[2].matchAll(/public\.(\w+)/g)) anonMay.add(t[1]);
const target = (text: string) => /^(?:from|rpc)\("(\w+)"/.exec(text)?.[1] ?? text;

/** Calls every function of every group with sample arguments, as a visitor. */
async function asVisitor(sd: ScreenData) {
  const out: Record<string, "ok" | "teaser" | string> = {};
  for (const [g, fns] of Object.entries(sd)) {
    if (g === "auth") continue; // signing in is what a visitor does
    for (const [k, fn] of Object.entries(fns as Record<string, (...a: unknown[]) => unknown>)) {
      if (k === "isAdultsOnly") continue;
      try { await fn("X1", "X2"); out[`${g}.${k}`] = "ok"; } catch (e) { out[`${g}.${k}`] = needsAccount(e) ? "teaser" : (e as Error).message; }
    }
  }
  return out;
}

test("a visitor gets what Classic gives a visitor, and only asks for what anon may read", async () => {
  assert.ok(anonMay.has("worlds") && anonMay.has("store_products") && anonMay.has("daily_deals") && !anonMay.has("league_info"), "the grant list was read");
  const m = make(undefined, null);
  const out = await asVisitor(m.sd);
  // every query a visitor makes is one the anon role is granted, so none of them fails with "permission denied"
  for (const t of m.log) assert.ok(anonMay.has(target(t)), `a visitor may not read ${t}`);
  assert.deepEqual(m.calls, [], "no edge function");
  // the shared data Classic shows visitors (Journey, the album pages, the store, the daily deals, the live-ops calendar) loads with Classic's query
  const asked = new Set(m.log.map(target));
  for (const t of ["worlds", "stages", "stamps", "store_products", "store_settings", "daily_deals", "liveops"]) assert.ok(asked.has(t), `a visitor loads ${t}`);
  for (const t of ["user_stages", "user_stamps", "user_collect", "album_claims", "daily_progress", "user_achievements", "ledger", "rounds", "crew_info", "my_threads", "my_referral", "my_match", "mastery"]) assert.ok(!asked.has(t), `no query for the visitor's own ${t}`);
  // the player's own data is empty
  assert.deepEqual(await m.sd.journey.load().then((j) => j.progress), {});
  assert.deepEqual(await m.sd.quests.load(), { missions: [], counters: {}, claimed: [], badges: [], earned: [] });
  const album = make((t) => t.startsWith('from("stamps")') ? { data: [{ id: "s1" }] } : t.startsWith('from("worlds")') ? { data: [{ id: 1 }] } : {}, null);
  assert.deepEqual(await album.sd.album.load(), { worlds: [{ id: 1 }], stamps: [{ id: "s1" }], owned: {}, collect: { dust: 0, packs_since_epic: 0, packs_opened: 0 }, claimed: [] });
  assert.equal(await m.sd.compete.crew_info(), null);
  assert.deepEqual(await m.sd.inbox.load(), { threads: [], notes: [] });
  assert.deepEqual(await m.sd.history.ledger(), []);
  assert.deepEqual(await m.sd.account.load(), { mastery: [], email: "" });
  assert.equal(await m.sd.refer.load(), null);
  assert.deepEqual(await m.sd.match.state(), { status: "none" });
  // Classic shows a sign-up teaser instead of these, so they are refused without a call; so is every action
  for (const k of ["season.load", "compete.events", "compete.live_races", "compete.event_leaderboard", "compete.league_info", "compete.league_board", "compete.league_payouts", "compete.crew_board", "compete.search_crews", "compete.new_players", "match.online"])
    assert.equal(out[k], "teaser", k);
  for (const k of ["quests.claim", "album.craft", "album.claim", "compete.join_crew", "compete.create_crew", "compete.wave_hello", "store.buyTest", "store.gemSpend", "store.clubClaim", "store.confirmAge", "shop.buy", "shop.equip", "account.deleteAccount", "account.setSpendLimit", "inbox.contact", "match.find", "match.invite", "match.challenge"])
    assert.equal(out[k], "teaser", k);
  assert.ok(Object.values(out).every((v) => v === "ok" || v === "teaser"), JSON.stringify(out));
  assert.equal(new Error(NEED_ACCOUNT).message, "Create your free account first.");
});
test("Classic's visitor screens load the same shared data", () => {
  const app = src("App.tsx");
  assert.ok(app.includes('{gview === "journey" && <JourneyHub guest'), "Journey for visitors");
  assert.ok(app.includes('{gview === "shop" && <ShopHub store={<Store econ={null}'), "the store and shop for visitors");
  assert.ok(app.includes('<GuestTeaser title="Compete for prizes"') && app.includes('<GuestTeaser title="Collect and complete"'), "teasers for Compete and Collect");
  assert.ok(src("views/JourneyHub.tsx").includes('t === "worlds" ? <Journey onPlay={onPlay} /> : guest ? ('), "a teaser for the season track");
  assert.ok(src("views/Shop.tsx").includes('supabase.rpc("daily_deals")'));
});
test("the visitor fixture behaves like the real groups for a visitor", async () => {
  const real = await asVisitor(make(undefined, null).sd);
  const fixture = await asVisitor(visitorData());
  assert.deepEqual(fixture, real);
});
test("loads fail on a query error, so a screen can show its error state", async () => {
  const m = make((t) => t.startsWith("from(\"stamps\")") ? { error: { message: "boom" } } : {});
  await assert.rejects(m.sd.album.load(), { message: "readable: boom" });
});
test("every group has sample and empty fixtures that answer without a server", async () => {
  for (const d of [sampleData(), emptyData()]) {
    const real = make().sd;
    for (const g of Object.keys(real) as (keyof ScreenData)[]) assert.deepEqual(Object.keys(d[g]).sort(), Object.keys(real[g]).sort(), `fixture ${g} has every call`);
  }
  const s = sampleData(), e = emptyData();
  assert.ok((await s.journey.load()).stages.length > 0 && Object.keys((await s.journey.load()).progress).length > 0);
  assert.deepEqual((await e.journey.load()).progress, {});
  assert.ok((await s.compete.league_board()).length > 0); assert.deepEqual(await e.compete.league_board(), []);
  assert.ok(await s.compete.crew_info()); assert.equal(await e.compete.crew_info(), null);
  assert.ok((await s.compete.liveops()).some((o) => new Date(o.starts_at).getTime() > Date.now()), "the schedule includes upcoming events");
});
test("the contract and App use the groups", () => {
  const contract = src("newui/screens/contract.ts"), app = src("App.tsx");
  assert.match(contract, /\} & ScreenData;/);
  assert.match(contract, /xpLeft: number/);
  assert.ok(app.includes("...dataFor(null, async () => undefined, noop),"), "visitor");
  assert.ok(app.includes("...dataFor(profile.id, refresh, () => void refreshInbox()),"), "player");
  assert.ok(app.includes("xpLeft: hi - profile.xp"));
  assert.ok(src("newui/screens/baseFixture.ts").includes("...(visitor ? visitorData() : sampleData()),"));
});
