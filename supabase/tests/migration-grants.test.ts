import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { FIRST_CHECKED, createdObjects, missingGrants } from "./migrationGrants.ts";

// Since 025 new objects give the client roles nothing, so each new migration must say what anon and authenticated get
// (see migrationGrants.ts and CONTRIBUTING.md). This fails the PR when a migration from 026 on leaves something out.
const dir = new URL("../migrations/", import.meta.url);
const files = readdirSync(dir).filter((f) => /^\d{3}_.*\.sql$/.test(f)).sort();
const sql = (f: string) => readFileSync(new URL(f, dir), "utf8");
const report = (f: string, missing: ReturnType<typeof missingGrants>) =>
  missing.map((o) => `${f}:${o.line} creates ${o.kind} ${o.name} with no grant or revoke for anon/authenticated (or "-- no client access")`).join("\n");

test("every migration from 026 on says what anon and authenticated get for each object it creates", () => {
  const earlier = new Set<string>();
  for (const f of files) {
    if (f >= FIRST_CHECKED) {
      const missing = missingGrants(sql(f), earlier);
      assert.equal(missing.length, 0, report(f, missing));
    }
    for (const o of createdObjects(sql(f))) earlier.add(o.name);
  }
});

test("migrations/TEMPLATE.sql passes the check", () => {
  const t = sql("TEMPLATE.sql");
  assert.equal(createdObjects(t).length, 3, "the template's table and two functions are found");
  assert.deepEqual(missingGrants(t), []);
  assert.match(t, /\nbegin;[\s\S]*\ncommit;\s*$/, "wrapped in begin; … commit;");
});

test("the check catches a table, view, sequence or function with no grant", () => {
  const bad = `begin;
create table if not exists public.zz_new (id int);
alter table public.zz_new enable row level security;
create or replace view public.zz_view as select 1 as one;
create sequence zz_seq;
create or replace function public.zz_fn(p int) returns int language sql as 'select p';
-- grant select on public.zz_new to authenticated;   (a comment is not a grant)
grant select on public.something_else to authenticated;
grant execute on function public.zz_fn(int) to service_role;
commit;`;
  assert.deepEqual(missingGrants(bad).map((o) => `${o.line} ${o.kind} ${o.name}`),
    ["2 table public.zz_new", "4 view public.zz_view", "5 sequence public.zz_seq", "6 function public.zz_fn"]);
});

test("a grant, a revoke or the comment satisfies it; temporary tables and objects from earlier migrations are skipped", () => {
  const good = `begin;
create table public."ZZ_A" (id int);
create table public.zz_b (id int);
create table zz_c (id int);
grant select (id) on public.zz_a, public.zz_b to anon, authenticated;
revoke all on table zz_c from public, anon, authenticated;
create function public.zz_f(a text, b int) returns int language sql as 'select 1';
grant execute on function public.zz_f(text, int) to authenticated;
create view public.zz_v as select 1; -- no client access
-- no client access
create sequence public.zz_s;
create temp table zz_tmp (id int);
create or replace function public.daily_deals(p date) returns int language sql as 'select 1';
commit;`;
  assert.deepEqual(missingGrants(good, new Set(["public.daily_deals"])), []);
  assert.equal(missingGrants(good).length, 1, "without the earlier list, the redefined function is reported");
});
