-- Bingo Arena 0.17.0: the economy. Gems (a second currency), a store with priced products, Bingo Club,
-- Coin Vault, paid Season Pass, Crew Treat, purchase records, spending limits and an admin store.
-- Real-money payments are NOT switched on here. The store mode decides what players can do:
--   off      = store hidden
--   preview  = players see products and prices, buttons say "Coming soon" (default)
--   test     = like preview, and admins can make free test purchases to try every flow
--   live     = reserved for the payment provider (a later update adds the payment webhook)
-- Coins and gems have no cash value and can never be cashed out or transferred.

create table public.store_settings (
  id int primary key default 1 check (id = 1),
  mode text not null default 'preview' check (mode in ('off', 'preview', 'test', 'live')),
  vault_pct int not null default 10 check (vault_pct between 0 and 50),
  vault_cap int not null default 3000 check (vault_cap between 0 and 1000000),
  updated_at timestamptz not null default now()
);
insert into public.store_settings (id) values (1);

create table public.store_products (
  id text primary key check (id ~ '^[a-z0-9_]{2,40}$'),
  kind text not null check (kind in ('coins', 'gems', 'starter', 'club', 'vault', 'pass', 'crew_treat')),
  name text not null check (char_length(name) between 2 and 60),
  descr text not null default '' check (char_length(descr) <= 200),
  price_cents int not null check (price_cents between 0 and 100000),
  coins int not null default 0 check (coins >= 0),
  gems int not null default 0 check (gems >= 0),
  days int not null default 0 check (days >= 0),
  one_time boolean not null default false,
  badge text not null default '' check (char_length(badge) <= 30),
  active boolean not null default true,
  sort int not null default 0
);
insert into public.store_products (id, kind, name, descr, price_cents, coins, gems, days, one_time, badge, sort) values
  ('starter', 'starter', 'Starter pack', '3,000 coins and 30 gems. Three times the usual value, once per player.', 199, 3000, 30, 0, true, 'Best value · once', 1),
  ('coins_s', 'coins', '1,000 coins', '', 199, 1000, 0, 0, false, '', 10),
  ('coins_m', 'coins', '2,800 coins', '', 499, 2800, 0, 0, false, '+12%', 11),
  ('coins_l', 'coins', '6,000 coins', '', 999, 6000, 0, 0, false, '+20%', 12),
  ('coins_xl', 'coins', '13,000 coins', '', 1999, 13000, 0, 0, false, '+30%', 13),
  ('coins_xxl', 'coins', '35,000 coins', '', 4999, 35000, 0, 0, false, '+40%', 14),
  ('gems_s', 'gems', '50 gems', '', 199, 0, 50, 0, false, '', 20),
  ('gems_m', 'gems', '140 gems', '', 499, 0, 140, 0, false, '+12%', 21),
  ('gems_l', 'gems', '300 gems', '', 999, 0, 300, 0, false, '+20%', 22),
  ('club', 'club', 'Bingo Club · 30 days', '150 coins and 5 gems every day, a Club badge, and your last 50 games in Bingo DNA.', 499, 0, 0, 30, false, 'Members', 30),
  ('vault', 'vault', 'Open the Coin Vault', 'Every win puts extra coins in your vault. Open it to take them all.', 299, 0, 0, 0, false, '', 40),
  ('pass', 'pass', 'Season Pass Premium', 'A second reward on every tier of the current season.', 499, 0, 0, 0, false, '', 50),
  ('crew_treat', 'crew_treat', 'Crew Treat', 'Everyone in your crew gets 200 coins, with your name on it.', 299, 200, 0, 0, false, 'Social', 60);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id text not null references public.store_products (id),
  price_cents int not null,
  status text not null check (status in ('test', 'paid', 'refunded')),
  provider text not null default 'test',
  provider_ref text unique,
  granted jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index purchases_user_idx on public.purchases (user_id, created_at desc);

create table public.gem_ledger (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount int not null,
  reason text not null,
  ref text,
  created_at timestamptz not null default now()
);
create index gem_ledger_user_idx on public.gem_ledger (user_id, created_at desc);

create table public.club_members (user_id uuid primary key references public.profiles (id) on delete cascade, until timestamptz not null, since timestamptz not null default now());
create table public.club_claims (user_id uuid not null references public.profiles (id) on delete cascade, day date not null, primary key (user_id, day));
create table public.coin_vault (user_id uuid primary key references public.profiles (id) on delete cascade, coins int not null default 0 check (coins >= 0), opened int not null default 0);
create table public.spend_limits (user_id uuid primary key references public.profiles (id) on delete cascade, monthly_cents int check (monthly_cents is null or monthly_cents between 0 and 100000));

alter table public.store_settings enable row level security;
alter table public.store_products enable row level security;
alter table public.purchases enable row level security;
alter table public.gem_ledger enable row level security;
alter table public.club_members enable row level security;
alter table public.club_claims enable row level security;
alter table public.coin_vault enable row level security;
alter table public.spend_limits enable row level security;
create policy store_settings_read on public.store_settings for select to anon, authenticated using (true);
create policy store_products_read on public.store_products for select to anon, authenticated using (active);
create policy purchases_own on public.purchases for select to authenticated using (user_id = auth.uid());
create policy gem_ledger_own on public.gem_ledger for select to authenticated using (user_id = auth.uid());
grant select on public.store_settings, public.store_products to anon, authenticated;
grant select on public.purchases, public.gem_ledger to authenticated;

-- ---------- the Coin Vault fills from game earnings; the first drill of the day also gives 1 gem ----------
create function public.ledger_economy_hook() returns trigger language plpgsql security definer set search_path = public as
$$
declare s public.store_settings; v_add int;
begin
  if new.amount > 0 and new.reason !~* '^(Purchase|Coin Vault|Admin|Registration|Gem exchange|Crew Treat|Bingo Club|Starter)' then
    select * into s from public.store_settings where id = 1;
    v_add := ceil(new.amount * s.vault_pct / 100.0);
    if v_add > 0 then
      insert into public.coin_vault (user_id, coins) values (new.user_id, least(v_add, s.vault_cap))
        on conflict (user_id) do update set coins = least(public.coin_vault.coins + v_add, s.vault_cap);
    end if;
  end if;
  if new.reason = 'Daily drill' then
    insert into public.gem_ledger (user_id, amount, reason, ref) values (new.user_id, 1, 'Daily drill', new.ref);
  end if;
  return new;
end;
$$;
create trigger ledger_economy after insert on public.ledger for each row execute function public.ledger_economy_hook();

-- ---------- granting a purchase (the only place that hands out what was bought) ----------
create function public.grant_purchase(p_user uuid, p_product text, p_status text, p_provider text, p_ref text) returns jsonb language plpgsql security definer set search_path = public as
$$
declare p public.store_products; v_limit int; v_spent int; v_coins int := 0; v_gems int := 0; v_extra jsonb := '{}'; v_crew uuid; v_name text; v_season int; v_until timestamptz; v_id uuid; m record;
begin
  if p_status not in ('test', 'paid') then raise exception 'bad_status'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 11));
  if p_ref is not null and exists (select 1 from public.purchases where provider_ref = p_ref) then
    return (select jsonb_build_object('ok', true, 'duplicate', true, 'granted', granted) from public.purchases where provider_ref = p_ref);
  end if;
  select * into p from public.store_products where id = p_product and active;
  if not found then raise exception 'unknown_product'; end if;
  if p.one_time and exists (select 1 from public.purchases where user_id = p_user and product_id = p.id and status <> 'refunded') then raise exception 'already_owned'; end if;
  select monthly_cents into v_limit from public.spend_limits where user_id = p_user;
  if v_limit is not null then
    select coalesce(sum(price_cents), 0) into v_spent from public.purchases where user_id = p_user and status <> 'refunded' and created_at >= date_trunc('month', now());
    if v_spent + p.price_cents > v_limit then raise exception 'spend_limit'; end if;
  end if;
  select display_name into v_name from public.profiles where id = p_user;

  if p.kind in ('coins', 'gems', 'starter') then
    v_coins := p.coins; v_gems := p.gems;
  elsif p.kind = 'club' then
    insert into public.club_members (user_id, until) values (p_user, now() + make_interval(days => p.days))
      on conflict (user_id) do update set until = greatest(public.club_members.until, now()) + make_interval(days => p.days)
      returning until into v_until;
    v_extra := jsonb_build_object('club_until', v_until);
  elsif p.kind = 'vault' then
    select coins into v_coins from public.coin_vault where user_id = p_user for update;
    if coalesce(v_coins, 0) <= 0 then raise exception 'vault_empty'; end if;
    update public.coin_vault set coins = 0, opened = opened + 1 where user_id = p_user;
  elsif p.kind = 'pass' then
    v_season := public.current_season_id();
    if v_season is null or not exists (select 1 from public.seasons where id = v_season and now() <= ends_at) then raise exception 'no_season'; end if;
    if exists (select 1 from public.season_pass where user_id = p_user and season_id = v_season) then raise exception 'already_owned'; end if;
    insert into public.season_pass (user_id, season_id) values (p_user, v_season);
    v_extra := jsonb_build_object('season', v_season);
  elsif p.kind = 'crew_treat' then
    select crew_id into v_crew from public.crew_members where user_id = p_user;
    if v_crew is null then raise exception 'no_crew'; end if;
    for m in select user_id from public.crew_members where crew_id = v_crew loop
      insert into public.ledger (user_id, amount, reason, ref) values (m.user_id, p.coins, 'Crew Treat from ' || v_name, 'treat:' || p_user);
      if m.user_id <> p_user then
        insert into public.notifications (user_id, kind, title, body, from_user) values (m.user_id, 'info', v_name || ' sent the crew a treat!', 'You got ' || p.coins || ' coins. Say thanks in your crew.', p_user);
      end if;
    end loop;
    v_extra := jsonb_build_object('crew_members', (select count(*) from public.crew_members where crew_id = v_crew));
  end if;

  if v_coins > 0 then insert into public.ledger (user_id, amount, reason, ref) values (p_user, v_coins, case when p.kind = 'vault' then 'Coin Vault opened' else 'Purchase: ' || p.name end, 'purchase:' || p.id); end if;
  if v_gems > 0 then insert into public.gem_ledger (user_id, amount, reason, ref) values (p_user, v_gems, 'Purchase: ' || p.name, 'purchase:' || p.id); end if;
  insert into public.purchases (user_id, product_id, price_cents, status, provider, provider_ref, granted)
    values (p_user, p.id, p.price_cents, p_status, p_provider, p_ref, jsonb_build_object('coins', case when p.kind = 'crew_treat' then 0 else v_coins end, 'gems', v_gems) || v_extra)
    returning id into v_id;
  return jsonb_build_object('ok', true, 'purchase', v_id, 'product', p.id, 'name', p.name, 'coins', case when p.kind = 'crew_treat' then p.coins else v_coins end, 'gems', v_gems) || v_extra;
end;
$$;

-- a free test purchase: only admins, only while the store is in test mode
create function public.buy_test(p_product text) returns jsonb language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if (select mode from public.store_settings where id = 1) <> 'test' or not public.is_admin() then raise exception 'store_not_open'; end if;
  return public.grant_purchase(auth.uid(), p_product, 'test', 'test', null);
end;
$$;

-- everything the game needs to show the player's economy in one call
create function public.my_economy() returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare v_user uuid := auth.uid(); s public.store_settings;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  select * into s from public.store_settings where id = 1;
  return jsonb_build_object(
    'mode', s.mode, 'is_admin', public.is_admin(),
    'gems', (select coalesce(sum(amount), 0) from public.gem_ledger where user_id = v_user),
    'vault', coalesce((select coins from public.coin_vault where user_id = v_user), 0), 'vault_cap', s.vault_cap, 'vault_pct', s.vault_pct,
    'club_until', (select until from public.club_members where user_id = v_user and until > now()),
    'club_claimed', exists (select 1 from public.club_claims where user_id = v_user and day = (now() at time zone 'utc')::date),
    'limit_cents', (select monthly_cents from public.spend_limits where user_id = v_user),
    'month_cents', (select coalesce(sum(price_cents), 0) from public.purchases where user_id = v_user and status <> 'refunded' and created_at >= date_trunc('month', now())),
    'owned', coalesce((select jsonb_agg(distinct product_id) from public.purchases p join public.store_products sp on sp.id = p.product_id where p.user_id = v_user and sp.one_time and p.status <> 'refunded'), '[]'),
    'in_crew', exists (select 1 from public.crew_members where user_id = v_user),
    'has_pass', exists (select 1 from public.season_pass where user_id = v_user and season_id = public.current_season_id()));
end;
$$;

create function public.club_claim() returns jsonb language plpgsql security definer set search_path = public as
$$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from public.club_members where user_id = v_user and until > now()) then raise exception 'not_member'; end if;
  insert into public.club_claims (user_id, day) values (v_user, (now() at time zone 'utc')::date) on conflict do nothing;
  if not found then raise exception 'already_claimed'; end if;
  insert into public.ledger (user_id, amount, reason, ref) values (v_user, 150, 'Bingo Club daily gift', 'club');
  insert into public.gem_ledger (user_id, amount, reason, ref) values (v_user, 5, 'Bingo Club daily gift', 'club');
  return jsonb_build_object('coins', 150, 'gems', 5);
end;
$$;

-- what gems can buy: coin exchanges and a Streak Shield
create function public.gem_spend(p_what text) returns jsonb language plpgsql security definer set search_path = public as
$$
declare v_user uuid := auth.uid(); v_cost int; v_coins int := 0; v_gems int;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 11));
  v_cost := case p_what when 'coins_s' then 10 when 'coins_l' then 50 when 'shield' then 20 else null end;
  if v_cost is null then raise exception 'bad_request'; end if;
  select coalesce(sum(amount), 0) into v_gems from public.gem_ledger where user_id = v_user;
  if v_gems < v_cost then raise exception 'insufficient_gems'; end if;
  if p_what = 'shield' then
    if (select shields from public.profiles where id = v_user) >= 2 then raise exception 'shields_full'; end if;
    update public.profiles set shields = shields + 1 where id = v_user;
  else
    v_coins := case p_what when 'coins_s' then 600 else 3500 end;
    insert into public.ledger (user_id, amount, reason, ref) values (v_user, v_coins, 'Gem exchange', 'gems:' || p_what);
  end if;
  insert into public.gem_ledger (user_id, amount, reason, ref) values (v_user, -v_cost, case when p_what = 'shield' then 'Streak Shield' else 'Gem exchange: ' || v_coins || ' coins' end, 'gems:' || p_what);
  return jsonb_build_object('gems', v_gems - v_cost, 'coins', v_coins);
end;
$$;

create function public.set_spend_limit(p_cents int) returns void language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if p_cents is not null and (p_cents < 0 or p_cents > 100000) then raise exception 'bad_request'; end if;
  insert into public.spend_limits (user_id, monthly_cents) values (auth.uid(), p_cents) on conflict (user_id) do update set monthly_cents = excluded.monthly_cents;
end;
$$;

create function public.my_purchases() returns jsonb language sql stable security definer set search_path = public as
$$ select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]') from (
     select p.id, p.product_id, sp.name, p.price_cents, p.status, p.created_at from public.purchases p join public.store_products sp on sp.id = p.product_id
     where p.user_id = auth.uid() order by p.created_at desc limit 50) x $$;

-- ---------- admin ----------
create function public.admin_store() returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare s public.store_settings;
begin
  perform public.require_admin();
  select * into s from public.store_settings where id = 1;
  return jsonb_build_object(
    'mode', s.mode, 'vault_pct', s.vault_pct, 'vault_cap', s.vault_cap,
    'products', (select coalesce(jsonb_agg(to_jsonb(p) order by p.sort), '[]') from public.store_products p),
    'paid_30d_cents', (select coalesce(sum(price_cents), 0) from public.purchases where status = 'paid' and created_at > now() - interval '30 days'),
    'paid_all_cents', (select coalesce(sum(price_cents), 0) from public.purchases where status = 'paid'),
    'buyers_30d', (select count(distinct user_id) from public.purchases where status = 'paid' and created_at > now() - interval '30 days'),
    'tests', (select count(*) from public.purchases where status = 'test'),
    'club_active', (select count(*) from public.club_members where until > now()),
    'gems_total', (select coalesce(sum(amount), 0) from public.gem_ledger),
    'by_product', (select coalesce(jsonb_agg(to_jsonb(x) order by x.n desc), '[]') from (
        select product_id, count(*) n, coalesce(sum(price_cents) filter (where status = 'paid'), 0) cents from public.purchases where created_at > now() - interval '30 days' group by product_id) x),
    'recent', (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]') from (
        select p.created_at, p.product_id, p.price_cents, p.status, pr.display_name player from public.purchases p join public.profiles pr on pr.id = p.user_id order by p.created_at desc limit 20) x));
end;
$$;

create function public.admin_set_store(p_mode text, p_vault_pct int, p_vault_cap int) returns void language plpgsql security definer set search_path = public as
$$
begin
  perform public.require_admin();
  if p_mode = 'live' then raise exception 'live_needs_payments'; end if;
  update public.store_settings set mode = p_mode, vault_pct = p_vault_pct, vault_cap = p_vault_cap, updated_at = now() where id = 1;
  perform public.admin_log('store_settings', jsonb_build_object('mode', p_mode, 'vault_pct', p_vault_pct, 'vault_cap', p_vault_cap));
end;
$$;

create function public.admin_save_product(p_id text, p_name text, p_descr text, p_price_cents int, p_coins int, p_gems int, p_days int, p_badge text, p_active boolean) returns void language plpgsql security definer set search_path = public as
$$
begin
  perform public.require_admin();
  update public.store_products set name = p_name, descr = p_descr, price_cents = p_price_cents, coins = p_coins, gems = p_gems, days = p_days, badge = p_badge, active = p_active where id = p_id;
  if not found then raise exception 'unknown_product'; end if;
  perform public.admin_log('store_product', jsonb_build_object('id', p_id, 'price_cents', p_price_cents, 'coins', p_coins, 'gems', p_gems, 'active', p_active));
end;
$$;

create function public.admin_grant_gems(p_user uuid, p_amount int, p_reason text) returns void language plpgsql security definer set search_path = public as
$$
begin
  perform public.require_admin();
  if p_amount = 0 or abs(p_amount) > 100000 or char_length(coalesce(p_reason, '')) < 2 then raise exception 'bad_request'; end if;
  insert into public.gem_ledger (user_id, amount, reason, ref) values (p_user, p_amount, 'Admin: ' || p_reason, 'admin:' || auth.uid());
  perform public.admin_log('grant_gems', jsonb_build_object('user', p_user, 'amount', p_amount, 'reason', p_reason));
end;
$$;

-- health check also looks for the economy functions
create or replace function public.admin_health() returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare f text; out jsonb := '[]';
  fns text[] := array['admin_overview','admin_players','admin_player_detail','admin_adjust_coins','admin_set_banned','admin_save_config','admin_save_item',
    'admin_save_mission','admin_events','admin_save_event','admin_set_event_status','admin_delete_event','admin_finalize_event','admin_pay_league',
    'admin_save_stage','admin_journey_stats','admin_audit','event_leaderboard','league_board','matchmake_tx','settle_stage_tx','claim_album',
    'settle_daily_tx','create_challenge_tx','mastery','export_my_data','accept_terms','set_guide_seen','create_crew','crew_info','claim_crew_chest','admin_pay_crews','season_info','claim_season_tier','admin_save_liveop','admin_save_season','valid_reward','contact_support','reply_support','admin_reply','admin_send_message','wave_hello','inbox_summary','new_players','settle_drill_tx','grant_purchase','buy_test','my_economy','club_claim','gem_spend','admin_store'];
  tbls text[] := array['events','matches','match_queue','league_payouts','worlds','stages','stamps','user_stages','daily_boards','challenges','mastery_tiers','liveops','crews','seasons','season_tiers','support_threads','support_messages','notifications'];
begin
  perform public.require_admin();
  foreach f in array fns loop
    out := out || jsonb_build_object('kind', 'function', 'name', f,
      'ok', exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = f));
  end loop;
  foreach f in array tbls loop
    out := out || jsonb_build_object('kind', 'table', 'name', f,
      'ok', exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = f and c.relkind = 'r'));
  end loop;
  out := out || jsonb_build_object('kind', 'data', 'name', 'game_config has all three levels', 'ok', (select data -> 'levels' ?& array['beginner','medium','hard'] from public.game_config));
  out := out || jsonb_build_object('kind', 'data', 'name', 'at least 3 active daily quests', 'ok', (select count(*) from public.mission_defs where active) >= 3);
  out := out || jsonb_build_object('kind', 'data', 'name', 'shop has active items', 'ok', (select count(*) from public.shop_items where active) > 0);
  out := out || jsonb_build_object('kind', 'data', 'name', 'your account is an admin', 'ok', public.is_admin());
  return out;
end;
$$;

revoke all on function public.grant_purchase(uuid, text, text, text, text), public.ledger_economy_hook() from public, anon, authenticated;
grant execute on function public.grant_purchase(uuid, text, text, text, text) to service_role;
revoke all on function public.buy_test(text), public.my_economy(), public.club_claim(), public.gem_spend(text), public.set_spend_limit(int), public.my_purchases(),
  public.admin_store(), public.admin_set_store(text, int, int), public.admin_save_product(text, text, text, int, int, int, int, text, boolean), public.admin_grant_gems(uuid, int, text) from public, anon;
grant execute on function public.buy_test(text), public.my_economy(), public.club_claim(), public.gem_spend(text), public.set_spend_limit(int), public.my_purchases(),
  public.admin_store(), public.admin_set_store(text, int, int), public.admin_save_product(text, text, text, int, int, int, int, text, boolean), public.admin_grant_gems(uuid, int, text) to authenticated;
revoke all on function public.admin_health() from public, anon, authenticated;
grant execute on function public.admin_health() to authenticated;
