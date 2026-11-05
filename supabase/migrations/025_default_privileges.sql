-- 025: new tables, sequences and functions start with no grants for the client roles. Run only after 024 is live and checked.
-- Supabase's defaults give anon and authenticated every privilege on each table, sequence and function that postgres creates in
-- public (migrations pasted in the SQL editor run as postgres); that is how 22 tables ended up with TRUNCATE (see 024).
-- This changes only those defaults: nothing that exists today changes, and service_role keeps its defaults.
-- From now on each migration grants what it needs, as 001 to 006, 023 and 024 do. CREATE OR REPLACE keeps a function's grants.
-- No data changes. Safe to run twice. Checked in CI by supabase/tests/default-privileges.test.ts.
begin;

alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;
-- Postgres itself lets PUBLIC run every new function. That default is global, so it is revoked globally (not per schema):
-- it covers functions postgres makes in any schema. Supabase's own schemas belong to other roles and are not affected.
alter default privileges for role postgres revoke execute on functions from public;

commit;
