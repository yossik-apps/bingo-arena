-- Bingo Arena 0.19.0: an Analytics tab for admins (players, visitors, new players, returning players, revenue, games, economy).
-- Visitors are counted with a random ID the browser makes up and keeps (no name, no email, no IP address is stored).
-- One row per visitor per day. When a visitor logs in, their earlier visits are linked to the account, so the
-- sign-up funnel (visit → free round → sign-up form → account → first round → came back) can be measured.

create table public.visits (
  vid uuid not null,
  day date not null default current_date,
  user_id uuid references public.profiles (id) on delete set null,
  device text not null default 'desktop' check (device in ('phone', 'tablet', 'desktop')),
  source text not null default 'direct' check (source ~ '^[a-z0-9.\-]{1,40}$'),
  landing text not null default 'lobby' check (landing ~ '^[a-z0-9_\-]{1,30}$'),
  hits int not null default 1,
  guest_rounds int not null default 0,
  signup_open boolean not null default false,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  primary key (vid, day)
);
create index visits_day_idx on public.visits (day);
create index visits_user_idx on public.visits (user_id, day) where user_id is not null;
alter table public.visits enable row level security; -- no policies: only the functions below read or write it

-- indexes for date-range reports
create index if not exists rounds_started_idx on public.rounds (started_at) where status = 'scored';
create index if not exists purchases_created_idx on public.purchases (created_at);
create index if not exists ledger_created_idx on public.ledger (created_at);
create index if not exists profiles_created_idx on public.profiles (created_at);
create index if not exists ad_rewards_created_idx on public.ad_rewards (created_at);

-- a player counts as active on a day when they finished a round or opened the game while logged in
create view public.an_activity with (security_invoker = true) as
  select user_id, started_at::date as day from public.rounds where status = 'scored'
  union
  select user_id, day from public.visits where user_id is not null;
revoke all on public.an_activity from public, anon, authenticated;

create function public.track_visit(p_vid uuid, p_device text, p_source text, p_landing text) returns void
language plpgsql security definer set search_path = public as
$$
declare v_user uuid := auth.uid();
  v_dev text := case when p_device in ('phone', 'tablet', 'desktop') then p_device else 'desktop' end;
  v_src text := left(regexp_replace(lower(coalesce(p_source, '')), '[^a-z0-9.\-]', '', 'g'), 40);
  v_land text := left(regexp_replace(lower(coalesce(p_landing, '')), '[^a-z0-9_\-]', '', 'g'), 30);
begin
  if p_vid is null then raise exception 'bad_request'; end if;
  if v_src = '' then v_src := 'direct'; end if;
  if v_land = '' then v_land := 'lobby'; end if;
  insert into public.visits as v (vid, day, user_id, device, source, landing) values (p_vid, current_date, v_user, v_dev, v_src, v_land)
  on conflict (vid, day) do update set hits = least(v.hits + 1, 10000), last_at = now(), user_id = coalesce(excluded.user_id, v.user_id);
  -- link this browser's earlier visits to the account (for the sign-up funnel)
  if v_user is not null then
    update public.visits set user_id = v_user where vid = p_vid and user_id is null and day >= current_date - 60;
  end if;
end;
$$;

create function public.track_step(p_vid uuid, p_step text) returns void
language plpgsql security definer set search_path = public as
$$
begin
  if p_vid is null or p_step not in ('guest_round', 'signup_open') then raise exception 'bad_request'; end if;
  insert into public.visits as v (vid, day, user_id, guest_rounds, signup_open)
  values (p_vid, current_date, auth.uid(), case when p_step = 'guest_round' then 1 else 0 end, p_step = 'signup_open')
  on conflict (vid, day) do update set last_at = now(),
    guest_rounds = least(v.guest_rounds + case when p_step = 'guest_round' then 1 else 0 end, 500),
    signup_open = v.signup_open or p_step = 'signup_open';
end;
$$;

-- the headline numbers for one date range (internal: only admin_analytics calls it)
create function public.an_kpi(p_from date, p_to date, p_test boolean) returns jsonb
language sql stable security definer set search_path = public as
$$
  with act as (select distinct user_id, day from public.an_activity where day between p_from and p_to),
  buys as (select * from public.purchases where created_at >= p_from and created_at < p_to + 1
           and (status = 'paid' or (p_test and status = 'test')))
  select jsonb_build_object(
    'visitors', (select count(distinct vid) from public.visits where day between p_from and p_to),
    'new_visitors', (select count(*) from (select vid from public.visits group by vid having min(day) between p_from and p_to) x),
    'new_players', (select count(*) from public.profiles where created_at >= p_from and created_at < p_to + 1),
    'active', (select count(distinct user_id) from act),
    'returning', (select count(distinct a.user_id) from act a join public.profiles p on p.id = a.user_id where p.created_at < p_from),
    'dau', round((select count(*) from act)::numeric / (p_to - p_from + 1), 1),
    'rounds', (select count(*) from public.rounds where status = 'scored' and started_at >= p_from and started_at < p_to + 1),
    'guest_rounds', (select coalesce(sum(guest_rounds), 0) from public.visits where day between p_from and p_to),
    'revenue_cents', (select coalesce(sum(price_cents), 0) from buys),
    'purchases', (select count(*) from buys),
    'payers', (select count(distinct user_id) from buys),
    'refunded_cents', (select coalesce(sum(price_cents), 0) from public.purchases where status = 'refunded' and created_at >= p_from and created_at < p_to + 1),
    'ad_views', (select count(*) from public.ad_rewards where created_at >= p_from and created_at < p_to + 1),
    'ad_viewers', (select count(distinct user_id) from public.ad_rewards where created_at >= p_from and created_at < p_to + 1),
    'coins_in', (select coalesce(sum(amount), 0) from public.ledger where amount > 0 and created_at >= p_from and created_at < p_to + 1),
    'coins_out', (select coalesce(-sum(amount), 0) from public.ledger where amount < 0 and created_at >= p_from and created_at < p_to + 1)
  )
$$;
revoke all on function public.an_kpi(date, date, boolean) from public, anon, authenticated;

-- which kind of coin movement a ledger line is
create function public.an_coin_kind(p_reason text) returns text language sql immutable set search_path = public as
$$
  select case
    when p_reason ~* 'refunded' then 'Refunds'
    when p_reason ~* '^entry fee' then 'Entry fees'
    when p_reason ~* '^(prize|event prize|league prize|crew prize)' then 'Game prizes'
    when p_reason ~* '^bought ' then 'Shop (looks and boosters)'
    when p_reason ~* '^(daily login|daily drill|daily challenge|quest|journey|album|crew chest|season pass)' then 'Daily play rewards'
    when p_reason ~* '^(purchase|coin vault|bingo club|crew treat|starter|gem exchange)' then 'Store and gems'
    when p_reason ~* '^reward video' then 'Reward videos'
    when p_reason ~* '^registration' then 'Welcome bonus'
    when p_reason ~* '^admin' then 'Admin changes'
    else 'Other' end
$$;

create function public.admin_analytics(p_days int default 30, p_test boolean default false, p_tz text default 'UTC') returns jsonb
language plpgsql stable security definer set search_path = public as
$$
declare
  v_days int := case when p_days in (7, 30, 90) then p_days else 30 end;
  v_to date := current_date;
  v_from date := current_date - (case when p_days in (7, 30, 90) then p_days else 30 end - 1);
  v_pto date; v_pfrom date;
  v_tz text := coalesce(nullif(p_tz, ''), 'UTC');
  out jsonb;
begin
  perform public.require_admin();
  v_pto := v_from - 1; v_pfrom := v_pto - (v_days - 1);
  if not exists (select 1 from pg_timezone_names where name = v_tz) then v_tz := 'UTC'; end if;

  out := jsonb_build_object(
    'range', jsonb_build_object('days', v_days, 'from', v_from, 'to', v_to, 'prev_from', v_pfrom, 'prev_to', v_pto, 'test', p_test, 'tz', v_tz),
    'now', public.an_kpi(v_from, v_to, p_test),
    'prev', public.an_kpi(v_pfrom, v_pto, p_test),
    'totals', jsonb_build_object(
      'players', (select count(*) from public.profiles),
      'banned', (select count(*) from public.profiles where banned),
      'mau', (select count(distinct user_id) from public.an_activity where day > current_date - 30),
      'wau', (select count(distinct user_id) from public.an_activity where day > current_date - 7),
      'dau', (select count(distinct user_id) from public.an_activity where day = current_date),
      'coins', (select coalesce(sum(amount), 0) from public.ledger),
      'gems', (select coalesce(sum(amount), 0) from public.gem_ledger),
      'club_active', (select count(*) from public.club_members where until > now()),
      'revenue_all_cents', (select coalesce(sum(price_cents), 0) from public.purchases where status = 'paid' or (p_test and status = 'test')),
      'payers_all', (select count(distinct user_id) from public.purchases where status = 'paid' or (p_test and status = 'test')),
      'rejected', (select count(*) from public.rounds where status = 'rejected' and started_at >= v_from),
      'tracking_since', (select min(day) from public.visits))
  );

  -- one row per day
  out := out || jsonb_build_object('daily', (
    with days as (select g::date d from generate_series(v_from, v_to, interval '1 day') g),
    vis as (select day d, count(distinct vid) n, coalesce(sum(guest_rounds), 0) gr, count(*) filter (where signup_open) so from public.visits where day between v_from and v_to group by day),
    np as (select created_at::date d, count(*) n from public.profiles where created_at >= v_from group by 1),
    act as (select a.day d, count(distinct a.user_id) n, count(distinct a.user_id) filter (where p.created_at::date < a.day) ret
            from public.an_activity a join public.profiles p on p.id = a.user_id where a.day between v_from and v_to group by 1),
    rd as (select started_at::date d, count(*) n from public.rounds where status = 'scored' and started_at >= v_from group by 1),
    rev as (select created_at::date d, sum(price_cents) c, count(*) n from public.purchases where created_at >= v_from and (status = 'paid' or (p_test and status = 'test')) group by 1),
    ads as (select created_at::date d, count(*) n from public.ad_rewards where created_at >= v_from group by 1)
    select coalesce(jsonb_agg(jsonb_build_object('d', days.d, 'visitors', coalesce(vis.n, 0), 'guest_rounds', coalesce(vis.gr, 0), 'signup_open', coalesce(vis.so, 0),
      'new', coalesce(np.n, 0), 'active', coalesce(act.n, 0), 'returning', coalesce(act.ret, 0), 'rounds', coalesce(rd.n, 0),
      'revenue_cents', coalesce(rev.c, 0), 'purchases', coalesce(rev.n, 0), 'ads', coalesce(ads.n, 0)) order by days.d), '[]')
    from days left join vis on vis.d = days.d left join np on np.d = days.d left join act on act.d = days.d
      left join rd on rd.d = days.d left join rev on rev.d = days.d left join ads on ads.d = days.d));

  -- the sign-up funnel for this range
  out := out || jsonb_build_object('funnel', (
    with nv as (select vid from public.visits group by vid having min(day) between v_from and v_to),
    nvd as (select v.* from public.visits v join nv using (vid)),
    np as (select id, created_at from public.profiles where created_at >= v_from and created_at < v_to + 1)
    select jsonb_build_object(
      'visitors', (select count(*) from nv),
      'tried', (select count(distinct vid) from nvd where guest_rounds > 0),
      'signup_open', (select count(distinct vid) from nvd where signup_open),
      'joined', (select count(*) from np),
      'joined_tracked', (select count(distinct vid) from nvd where user_id in (select id from np)),
      'first_round', (select count(*) from np where exists (select 1 from public.rounds r where r.user_id = np.id and r.status = 'scored')),
      'came_back', (select count(*) from np where exists (select 1 from public.an_activity a where a.user_id = np.id and a.day > np.created_at::date)),
      'tried_joined', (select count(distinct vid) from nvd where guest_rounds > 0 and vid in (select vid from nvd where user_id in (select id from np))))));

  -- returning players: classic retention and weekly sign-up groups (cohorts)
  out := out || jsonb_build_object('retention', (
    with c as (select id, created_at::date d0 from public.profiles where created_at > now() - interval '180 days')
    select jsonb_build_object(
      'd1', (select jsonb_build_object('n', count(*), 'back', count(*) filter (where exists (select 1 from public.an_activity a where a.user_id = c.id and a.day = c.d0 + 1))) from c where c.d0 <= current_date - 1),
      'd7', (select jsonb_build_object('n', count(*), 'back', count(*) filter (where exists (select 1 from public.an_activity a where a.user_id = c.id and a.day between c.d0 + 7 and c.d0 + 13))) from c where c.d0 <= current_date - 13),
      'd30', (select jsonb_build_object('n', count(*), 'back', count(*) filter (where exists (select 1 from public.an_activity a where a.user_id = c.id and a.day >= c.d0 + 30))) from c where c.d0 <= current_date - 30),
      'cohorts', (select coalesce(jsonb_agg(x order by x ->> 'week' desc), '[]') from (
        select jsonb_build_object('week', w, 'size', count(*),
          'w', (select jsonb_agg(case when w + 7 * k + 6 >= current_date then null else
                  (select count(*) from c c2 where date_trunc('week', c2.d0)::date = w
                     and exists (select 1 from public.an_activity a where a.user_id = c2.id and a.day between c2.d0 + 7 * k and c2.d0 + 7 * k + 6)) end order by k)
                from generate_series(1, 4) k)) x
        from (select date_trunc('week', d0)::date w from c where d0 > current_date - 56) cw group by w) t)
    )));

  -- how often active players come: by number of active days, plus churned and won back players
  out := out || jsonb_build_object('loyalty', (
    with cur as (select user_id, count(*) n from (select distinct user_id, day from public.an_activity where day between v_from and v_to) z group by user_id),
    prv as (select distinct user_id from public.an_activity where day between v_pfrom and v_pto)
    select jsonb_build_object(
      'buckets', jsonb_build_array(
        jsonb_build_object('label', '1 day', 'n', (select count(*) from cur where n = 1)),
        jsonb_build_object('label', '2–3 days', 'n', (select count(*) from cur where n between 2 and 3)),
        jsonb_build_object('label', '4–7 days', 'n', (select count(*) from cur where n between 4 and 7)),
        jsonb_build_object('label', '8–14 days', 'n', (select count(*) from cur where n between 8 and 14)),
        jsonb_build_object('label', '15+ days', 'n', (select count(*) from cur where n >= 15))),
      'kept', (select count(*) from cur where user_id in (select user_id from prv)),
      'churned', (select count(*) from prv where user_id not in (select user_id from cur)),
      'won_back', (select count(*) from cur join public.profiles p on p.id = cur.user_id
                   where cur.user_id not in (select user_id from prv) and p.created_at < v_pfrom))));

  -- revenue detail
  out := out || jsonb_build_object('revenue', (
    with b as (select pu.*, sp.name, sp.kind from public.purchases pu join public.store_products sp on sp.id = pu.product_id
               where pu.status = 'paid' or (p_test and pu.status = 'test')),
    inr as (select * from b where created_at >= v_from and created_at < v_to + 1)
    select jsonb_build_object(
      'by_product', (select coalesce(jsonb_agg(x order by (x ->> 'cents')::int desc), '[]') from (
          select jsonb_build_object('id', product_id, 'name', name, 'kind', kind, 'n', count(*), 'cents', sum(price_cents), 'buyers', count(distinct user_id)) x
          from inr group by product_id, name, kind) t),
      'first_time', (select count(*) from (select user_id from b group by user_id having min(created_at) >= v_from) x),
      'repeat', (select count(*) from (select user_id from b where user_id in (select user_id from inr) group by user_id having count(*) >= 2) x),
      'top', (select coalesce(jsonb_agg(x), '[]') from (
          select p.display_name as name, count(*) n, sum(inr.price_cents) cents from inr join public.profiles p on p.id = inr.user_id
          group by p.id, p.display_name order by sum(inr.price_cents) desc limit 5) x),
      'ads_by_placement', (select coalesce(jsonb_object_agg(placement, n), '{}') from (
          select placement, count(*) n from public.ad_rewards where created_at >= v_from group by placement) x))));

  -- games: modes and levels, and when people play (weekday × hour in the admin's time zone)
  out := out || jsonb_build_object('games', (
    with r as (select * from public.rounds where status = 'scored' and started_at >= v_from)
    select jsonb_build_object(
      'by_mode', (select coalesce(jsonb_agg(x), '[]') from (
          select mode, level, count(*) n, count(distinct user_id) players, count(*) filter (where (result ->> 'win')::boolean) wins,
                 round(avg(score))::int avg_score, round(avg((result ->> 'accuracy')::numeric) * 100)::int acc,
                 coalesce(sum(fee), 0) fees, coalesce(sum(prize), 0) prizes
          from r group by mode, level order by count(*) desc) x),
      'heat', (select coalesce(jsonb_agg(jsonb_build_array(dw, hr, n)), '[]') from (
          select extract(isodow from started_at at time zone v_tz)::int dw, extract(hour from started_at at time zone v_tz)::int hr, count(*) n
          from r group by 1, 2) x),
      'top_players', (select coalesce(jsonb_agg(x), '[]') from (
          select p.display_name as name, count(*) rounds, count(distinct r.started_at::date) days, round(avg(r.score))::int avg_score, p.created_at::date joined
          from r join public.profiles p on p.id = r.user_id group by p.id order by count(*) desc limit 10) x))));

  -- traffic: devices, where visitors come from, and the first screen they saw
  out := out || jsonb_build_object('traffic', (
    with v as (select * from public.visits where day between v_from and v_to)
    select jsonb_build_object(
      'devices', (select coalesce(jsonb_object_agg(device, n), '{}') from (select device, count(distinct vid) n from v group by device) x),
      'sources', (select coalesce(jsonb_agg(x), '[]') from (select source, count(distinct vid) n from v group by source order by 2 desc limit 8) x),
      'landing', (select coalesce(jsonb_agg(x), '[]') from (select landing, count(distinct vid) n from v group by landing order by 2 desc limit 8) x),
      'logged_in_share', (select count(distinct vid) filter (where user_id is not null) from v))));

  -- coin economy: where coins come from and where they go
  out := out || jsonb_build_object('economy', (
    select coalesce(jsonb_agg(x order by abs((x ->> 'amount')::bigint) desc), '[]') from (
      select jsonb_build_object('kind', public.an_coin_kind(reason), 'dir', case when amount > 0 then 'in' else 'out' end,
             'amount', sum(abs(amount)), 'n', count(*)) x
      from public.ledger where created_at >= v_from group by public.an_coin_kind(reason), amount > 0) t));

  return out;
end;
$$;

revoke all on function public.track_visit(uuid, text, text, text), public.track_step(uuid, text), public.admin_analytics(int, boolean, text) from public;
grant execute on function public.track_visit(uuid, text, text, text), public.track_step(uuid, text) to anon, authenticated;
revoke all on function public.admin_analytics(int, boolean, text) from anon;
grant execute on function public.admin_analytics(int, boolean, text) to authenticated;

-- health check also looks for the analytics pieces
create or replace function public.admin_health() returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare f text; out jsonb := '[]';
  fns text[] := array['admin_overview','admin_players','admin_player_detail','admin_adjust_coins','admin_set_banned','admin_save_config','admin_save_item',
    'admin_save_mission','admin_events','admin_save_event','admin_set_event_status','admin_delete_event','admin_finalize_event','admin_pay_league',
    'admin_save_stage','admin_journey_stats','admin_audit','event_leaderboard','league_board','matchmake_tx','settle_stage_tx','claim_album',
    'settle_daily_tx','create_challenge_tx','mastery','export_my_data','accept_terms','set_guide_seen','create_crew','crew_info','claim_crew_chest','admin_pay_crews','season_info','claim_season_tier','admin_save_liveop','admin_save_season','valid_reward','contact_support','reply_support','admin_reply','admin_send_message','wave_hello','inbox_summary','new_players','settle_drill_tx','grant_purchase','buy_test','my_economy','club_claim','gem_spend','admin_store','claim_ad_reward','my_ad_status','admin_ads','track_visit','track_step','admin_analytics'];
  tbls text[] := array['events','matches','match_queue','league_payouts','worlds','stages','stamps','user_stages','daily_boards','challenges','mastery_tiers','liveops','crews','seasons','season_tiers','support_threads','support_messages','notifications','visits'];
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
revoke all on function public.admin_health() from public, anon, authenticated;
grant execute on function public.admin_health() to authenticated;
