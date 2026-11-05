-- 024: narrow table grants. Tables created after 006 kept Supabase's default grants, so anon and authenticated held every
-- privilege on them, TRUNCATE included (row security does not stop TRUNCATE). This takes those away and gives back only
-- what a row-security policy and a direct client call need. Everything else on these tables goes through security
-- definer functions or the edge functions (service role), which do not need the client roles' grants.
-- No data changes. Safe to run twice. Checked in CI by supabase/tests/grants.test.ts.
begin;

do $$
declare
  t text; s text;
  tbls text[] := array['ad_rewards','ad_settings','app_links','auth_relay','auto_log','auto_settings','club_claims','club_members',
    'coin_vault','event_templates','gem_ledger','liveop_templates','match_invites','overtake_log','player_marks','purchases',
    'referral_settings','referrals','spend_limits','store_products','store_settings','visits'];
begin
  foreach t in array tbls loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke all on table public.%I from anon, authenticated', t);
      execute format('grant all on table public.%I to service_role', t);
      -- the id sequences of these tables: clients never insert, so they need none
      for s in select seq.relname from pg_depend d join pg_class seq on seq.oid = d.objid and seq.relkind = 'S'
               where d.refobjid = ('public.' || t)::regclass and d.deptype in ('a', 'i') loop
        execute format('revoke all on sequence public.%I from anon, authenticated', s);
      end loop;
    end if;
  end loop;
end $$;

-- read policies for everyone (the store, the store mode, ad settings, the Facebook link)
grant select on public.store_products, public.store_settings, public.ad_settings, public.app_links to anon, authenticated;
-- read policies for the owner only (Wallet's purchase history and gem history)
grant select on public.purchases, public.gem_ledger to authenticated;

commit;
