import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

// Migration 024 narrows the table grants. Live got broad grants from Supabase's default privileges, which give anon and
// authenticated every privilege on each new table. This test turns the same defaults on, runs every migration, checks the
// broad grants are there, runs 024 (twice), and then checks that every call the web client makes still has its privilege
// and that the client roles can no longer TRUNCATE or write where no policy allows it.
const dir = new URL("../migrations/", import.meta.url);
const files = readdirSync(dir).filter((f) => /^\d{3}_.*\.sql$/.test(f)).sort();
const sql = (f: string) => readFileSync(new URL(f, dir), "utf8");
const BROAD = ["ad_rewards", "ad_settings", "app_links", "auth_relay", "auto_log", "auto_settings", "club_claims", "club_members", "coin_vault", "event_templates", "gem_ledger",
  "liveop_templates", "match_invites", "overtake_log", "player_marks", "purchases", "referral_settings", "referrals", "spend_limits", "store_products", "store_settings", "visits"];

// every direct call in the web client: .from("table").select(...) and .rpc("name")
const web = new URL("../../web/src/", import.meta.url);
const sources = (readdirSync(web, { recursive: true }) as string[]).filter((f) => /\.(ts|tsx)$/.test(f)).map((f) => readFileSync(new URL(f.replace(/\\/g, "/"), web), "utf8"));
const reads = new Set<string>(), rpcs = new Set<string>();
for (const s of sources) {
  for (const m of s.matchAll(/\.from\("(\w+)"\)\s*\.\s*(\w+)/g)) { assert.equal(m[2], "select", `the client only reads tables directly (${m[1]}.${m[2]})`); reads.add(m[1]); }
  for (const m of s.matchAll(/\.rpc\("(\w+)"/g)) rpcs.add(m[1]);
}
// what a visitor (anon) reads and runs in Classic: App's visitor shell, Journey, the store, the shop, flags, links, sign-up tracking
const VISITOR_READS = ["game_config", "shop_items", "liveops", "worlds", "stages", "stamps", "store_products", "store_settings", "app_links", "feature_flags"];
const VISITOR_RPCS = ["daily_deals", "track_visit", "track_step", "presence_ping", "auto_tick", "relay_take", "ref_lookup"];

let db: PGlite;
const q = async <T = Record<string, unknown>>(text: string, params?: unknown[]) => (await db.query<T>(text, params)).rows;
const can = async (role: string, table: string, priv: string) =>
  (await q<{ ok: boolean }>(`select has_table_privilege($1, 'public.' || $2, $3) or ($3 in ('SELECT','INSERT','UPDATE') and has_any_column_privilege($1, 'public.' || $2, $3)) ok`, [role, table, priv]))[0].ok;
const canRun = async (role: string, fn: string) =>
  (await q<{ ok: boolean }>("select coalesce(bool_or(has_function_privilege($1, p.oid, 'EXECUTE')), false) ok from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = $2", [role, fn]))[0].ok;
/** true when the statement fails for this role */
const refused = async (role: string, statement: string) => {
  await db.exec("begin");
  try { await db.exec(`set local role ${role}; ${statement}`); return false; } catch { return true; } finally { await db.exec("rollback"); }
};
type Check = { table_name: string; anon: string; authenticated: string; broad: boolean };
const check = () => q<Check>(readFileSync(new URL("../checks/024_grants_check.sql", import.meta.url), "utf8"));
const broadTables = async (role: string) => (await q<{ t: string }>("select c.relname t from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and has_table_privilege($1, c.oid, 'TRUNCATE') order by 1", [role])).map((r) => r.t);

test.before(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{"provider":"email"}', created_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant usage on schema public to anon, authenticated, service_role;
    -- Supabase's defaults for objects made in the dashboard's SQL editor
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  `);
  for (const f of files.filter((f) => f < "024")) await db.exec(sql(f));
});

test("before 024: the 22 tables give anon and authenticated every privilege, as on live", async () => {
  assert.deepEqual(await broadTables("anon"), BROAD);
  assert.deepEqual(await broadTables("authenticated"), BROAD);
  assert.equal(await refused("anon", "truncate public.purchases"), false, "anon could empty the purchases table");
  assert.deepEqual((await check()).filter((r) => r.broad).map((r) => r.table_name), BROAD, "the live check query shows them");
});

test("024 runs, and runs again without changes", async () => {
  const m = sql("024_grants.sql");
  assert.match(m, /^[\s\S]*?\nbegin;[\s\S]*\ncommit;\s*$/, "wrapped in begin; … commit;");
  assert.doesNotMatch(m.replace(/--.*$/gm, ""), /\b(drop|delete|truncate|update|insert|alter table|rename)\b/i, "no data or schema changes");
  const snapshot = () => q("select table_name, grantee, privilege_type from information_schema.role_table_grants where table_schema = 'public' and grantee in ('anon','authenticated','service_role') order by 1, 2, 3");
  await db.exec(m);
  const once = await snapshot();
  await db.exec(m);
  assert.deepEqual(await snapshot(), once, "safe to run twice");
});

test("after 024: no client role can TRUNCATE, REFERENCE or add triggers to any table", async () => {
  for (const role of ["anon", "authenticated"]) {
    assert.deepEqual(await broadTables(role), [], `${role} TRUNCATE`);
    for (const t of BROAD) for (const p of ["REFERENCES", "TRIGGER"]) assert.equal(await can(role, t, p), false, `${role} ${p} ${t}`);
    assert.equal(await refused(role, "truncate public.purchases"), true);
    assert.equal(await refused(role, "truncate public.gem_ledger"), true);
  }
});

test("after 024: the live check query shows the narrow grants", async () => {
  const rows = Object.fromEntries((await check()).map((r) => [r.table_name, r]));
  assert.ok(Object.values(rows).every((r) => !r.broad), "no broad table");
  for (const t of ["store_products", "store_settings", "ad_settings", "app_links"]) assert.deepEqual([rows[t].anon, rows[t].authenticated], ["SELECT", "SELECT"], t);
  for (const t of ["purchases", "gem_ledger"]) assert.deepEqual([rows[t].anon, rows[t].authenticated], ["", "SELECT"], t);
  assert.equal(BROAD.filter((t) => rows[t]).length, 6, "the other 16 no longer appear");
});

test("after 024: anon and authenticated write only where a policy allows it", async () => {
  const tables = (await q<{ t: string }>("select c.relname t from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' order by 1")).map((r) => r.t);
  for (const role of ["anon", "authenticated"]) for (const t of tables) for (const p of ["INSERT", "UPDATE", "DELETE"]) {
    if (!(await can(role, t, p))) continue;
    const policy = await q("select 1 from pg_policies where schemaname = 'public' and tablename = $1 and cmd in ($2, 'ALL') and ($3 = any(roles) or 'public' = any(roles))", [t, p, role]);
    assert.ok(policy.length > 0, `${role} may ${p} ${t} with no policy that allows it`);
  }
  for (const t of BROAD.filter((t) => !["store_products", "store_settings", "ad_settings", "app_links", "purchases", "gem_ledger"].includes(t)))
    for (const role of ["anon", "authenticated"]) assert.equal(await can(role, t, "SELECT"), false, `${role} reads ${t} only through server functions`);
  // the edge functions use the service role, which keeps everything
  for (const t of BROAD) assert.equal(await can("service_role", t, "INSERT"), true, `service_role ${t}`);
});

// main also has 024_heatmaps.sql (run by hand on live; kept under its name). It runs after 024_grants.sql in name order and
// defines functions the client calls (hm_ui, hm_collect, admin_heat_*), so the check below needs it.
test("024_heatmaps runs after 024_grants; its tables stay closed to anon and authenticated", async () => {
  await db.exec(sql("024_heatmaps.sql"));
  for (const role of ["anon", "authenticated"]) for (const t of ["heat_board", "heat_time", "heat_rounds", "ui_taps", "ui_scroll"])
    for (const p of ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE"]) assert.equal(await can(role, t, p), false, `${role} ${p} ${t}`);
  assert.equal(await canRun("anon", "hm_round"), false, "only submit-round (service role) writes board totals");
});

test("after 024: every call the web client makes still has its privilege", async () => {
  assert.ok(reads.size >= 20 && rpcs.size >= 50, `found the client calls (${reads.size} tables, ${rpcs.size} functions)`);
  for (const t of reads) assert.ok(await can("authenticated", t, "SELECT"), `a player reads ${t}`);
  for (const t of VISITOR_READS) assert.ok(reads.has(t) && (await can("anon", t, "SELECT")), `a visitor reads ${t}`);
  for (const t of ["store_products", "store_settings", "ad_settings", "app_links"]) assert.ok(await can("anon", t, "SELECT") && (await can("authenticated", t, "SELECT")), `everyone reads ${t}`);
  for (const t of ["purchases", "gem_ledger"]) assert.ok(await can("authenticated", t, "SELECT"), `a player reads their own ${t}`);
  const missing = [];
  for (const f of rpcs) if (!(await canRun("authenticated", f)) && !(await canRun("anon", f))) missing.push(f);
  assert.deepEqual(missing, [], "functions the client calls that no client role may run");
  for (const f of VISITOR_RPCS) assert.ok(await canRun("anon", f), `a visitor runs ${f}`);
});

test("after 024: the rows a policy shows are still visible to the right player only", async () => {
  const [a, b] = (await q<{ id: string }>("insert into auth.users(email) values ('g1@test.com'), ('g2@test.com') returning id")).map((r) => r.id);
  await db.exec(`insert into public.gem_ledger(user_id, amount, reason) values ('${a}', 5, 'test'), ('${b}', 7, 'test')`);
  await db.exec("begin");
  try {
    await db.exec(`set local role authenticated; select set_config('request.jwt.claim.sub', '${a}', true)`);
    const rows = await q<{ amount: number }>("select amount from public.gem_ledger");
    assert.deepEqual(rows.map((r) => r.amount), [5], "own gem history only");
    assert.ok((await q("select id from public.store_products where active")).length >= 0);
  } finally { await db.exec("rollback"); }
  assert.equal(await refused("anon", "select * from public.gem_ledger"), true);
  assert.equal(await refused("anon", "select * from public.referrals"), true);
});
