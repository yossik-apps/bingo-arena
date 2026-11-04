-- Read-only check for migration 025 (default privileges). Run it in the SQL editor before and after; it changes nothing.
-- What postgres's new objects give the client roles by default: anon and authenticated in schema public, and PUBLIC (everyone)
-- for functions in any schema.
-- Before 025: every row shows privileges. After 025: every row is empty.
select r.role, k.kind,
  coalesce((
    select string_agg(distinct a.privilege_type, ',' order by a.privilege_type)
    from pg_default_acl d, aclexplode(d.defaclacl) a
    where d.defaclrole = 'postgres'::regrole and d.defaclnamespace = 'public'::regnamespace and d.defaclobjtype = k.code
      and a.grantee = (select oid from pg_roles where rolname = r.role)
  ), '') as default_privileges
from (values ('anon'), ('authenticated')) as r(role)
cross join (values ('tables', 'r'::"char"), ('sequences', 'S'::"char"), ('functions', 'f'::"char")) as k(kind, code)
union all
-- no global entry means Postgres's built-in default: PUBLIC may run every new function
select 'PUBLIC', 'functions (all schemas)',
  case when not exists (select 1 from pg_default_acl d where d.defaclrole = 'postgres'::regrole and d.defaclnamespace = 0 and d.defaclobjtype = 'f')
         or exists (select 1 from pg_default_acl d, aclexplode(d.defaclacl) a where d.defaclrole = 'postgres'::regrole and d.defaclnamespace = 0 and d.defaclobjtype = 'f' and a.grantee = 0)
       then 'EXECUTE' else '' end
order by 1, 2;
