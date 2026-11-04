import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

// Migration 025 changes Supabase's default privileges, so new tables, sequences and functions start with no client grants.
// Like grants.test.ts, this turns Supabase's defaults on and runs every migration. Then it checks that 025 leaves every
// existing grant as it was, and that a table and a function made afterwards give anon and authenticated nothing.
const dir = new URL("../migrations/", import.meta.url);
const files = readdirSync(dir).filter((f) => /^\d{3}_.*\.sql$/.test(f)).sort();
const sql = (f: string) => readFileSync(new URL(f, dir), "utf8");
const checkSql = readFileSync(new URL("../checks/025_default_privileges_check.sql", import.meta.url), "utf8");

let db: PGlite;
const q = async <T = Record<string, unknown>>(text: string) => (await db.query<T>(text)).rows;
const grants = async () => JSON.stringify([
  await q("select table_name, grantee, privilege_type from information_schema.role_table_grants where table_schema = 'public' and grantee in ('anon','authenticated','service_role') order by 1, 2, 3"),
  await q("select p.oid::regprocedure::text f, r from pg_proc p cross join (values ('anon'),('authenticated')) a(r) where p.pronamespace = 'public'::regnamespace and has_function_privilege(r, p.oid, 'EXECUTE') order by 1, 2"),
  await q("select c.relname, r from pg_class c cross join (values ('anon'),('authenticated')) a(r) where c.relkind = 'S' and c.relnamespace = 'public'::regnamespace and has_sequence_privilege(r, c.oid, 'USAGE') order by 1, 2"),
]);
const check = () => q<{ role: string; kind: string; default_privileges: string }>(checkSql);

test.before(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{"provider":"email"}', created_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant usage on schema public to anon, authenticated, service_role;
    -- Supabase's defaults for objects made in the dashboard's SQL editor (by postgres)
    alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
    alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, service_role;
  `);
  assert.equal((await q<{ u: string }>("select current_user u"))[0].u, "postgres", "migrations run as postgres, as in the SQL editor");
  for (const f of files.filter((f) => f < "025")) await db.exec(sql(f));
});

test("before 025: new objects get client grants by default, and the check query shows it", async () => {
  const rows = await check();
  for (const r of rows) assert.notEqual(r.default_privileges, "", `${r.role} ${r.kind}`);
  await db.exec("begin; create table public.zz_before (id bigserial primary key); create function public.zz_before_fn() returns int language sql as 'select 1';");
  assert.equal((await q<{ ok: boolean }>("select has_table_privilege('anon', 'public.zz_before', 'TRUNCATE') ok"))[0].ok, true);
  await db.exec("rollback");
});

test("025 runs twice and changes no existing grant", async () => {
  const m = sql("025_default_privileges.sql");
  assert.match(m, /^[\s\S]*?\nbegin;[\s\S]*\ncommit;\s*$/, "wrapped in begin; … commit;");
  assert.doesNotMatch(m.replace(/--.*$/gm, ""), /\b(drop|delete|truncate|update|insert|alter table|rename|grant)\b/i, "only default privileges are revoked");
  const before = await grants();
  await db.exec(m);
  await db.exec(m);
  assert.equal(await grants(), before, "every table, sequence and function keeps the grants it has");
});

test("after 025: a new table, sequence and function give anon and authenticated nothing; service_role keeps its grants", async () => {
  for (const r of await check()) assert.equal(r.default_privileges, "", `check query: ${r.role} ${r.kind}`);
  await db.exec("create table public.zz_future (id bigserial primary key, note text); create function public.zz_future_fn() returns int language sql as 'select 1';");
  for (const role of ["anon", "authenticated"]) {
    for (const p of ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"])
      assert.equal((await q<{ ok: boolean }>(`select has_table_privilege('${role}', 'public.zz_future', '${p}') ok`))[0].ok, false, `${role} ${p}`);
    assert.equal((await q<{ ok: boolean }>(`select has_sequence_privilege('${role}', 'public.zz_future_id_seq', 'USAGE') ok`))[0].ok, false, `${role} sequence`);
    assert.equal((await q<{ ok: boolean }>(`select has_function_privilege('${role}', 'public.zz_future_fn()', 'EXECUTE') ok`))[0].ok, false, `${role} function`);
  }
  assert.equal((await q<{ ok: boolean }>("select has_table_privilege('service_role', 'public.zz_future', 'INSERT') ok"))[0].ok, true);
  assert.equal((await q<{ ok: boolean }>("select has_function_privilege('service_role', 'public.zz_future_fn()', 'EXECUTE') ok"))[0].ok, true);
  // a migration grants what it needs, and CREATE OR REPLACE keeps an existing function's grants
  await db.exec("grant execute on function public.zz_future_fn() to authenticated; create or replace function public.zz_future_fn() returns int language sql as 'select 2';");
  assert.equal((await q<{ ok: boolean }>("select has_function_privilege('authenticated', 'public.zz_future_fn()', 'EXECUTE') ok"))[0].ok, true);
  assert.equal((await q<{ ok: boolean }>("select has_function_privilege('anon', 'public.daily_deals(date)', 'EXECUTE') ok"))[0].ok, true, "existing visitor functions still work");
});
