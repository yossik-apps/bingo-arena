-- Read-only check for migration 024 (grants). Run it in the SQL editor before and after the migration; it changes nothing.
-- One row per public table where anon or authenticated holds any privilege, with what each role holds.
-- Before 024: 22 tables show TRUNCATE (broad = true). After 024: no row has broad = true;
-- store_products, store_settings, ad_settings and app_links show SELECT for both roles, purchases and gem_ledger SELECT for authenticated,
-- and the other 16 of the 22 tables no longer appear.
select c.relname as table_name,
  c.relrowsecurity as row_security,
  coalesce(string_agg(p.priv, ',' order by p.priv) filter (where has_table_privilege('anon', c.oid, p.priv)), '') as anon,
  coalesce(string_agg(p.priv, ',' order by p.priv) filter (where has_table_privilege('authenticated', c.oid, p.priv)), '') as authenticated,
  bool_or(p.priv = 'TRUNCATE' and (has_table_privilege('anon', c.oid, 'TRUNCATE') or has_table_privilege('authenticated', c.oid, 'TRUNCATE'))) as broad
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) as p(priv)
where n.nspname = 'public' and c.relkind = 'r'
group by c.relname, c.relrowsecurity
having bool_or(has_table_privilege('anon', c.oid, p.priv) or has_table_privilege('authenticated', c.oid, p.priv))
order by broad desc, c.relname;
