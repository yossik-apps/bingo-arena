-- Bingo Arena 0.18.0: optional reward videos and (optional) short ads between rounds, using Google's
-- Ad Placement API for web games (H5 Games Ads). Ads are off until the owner adds an AdSense publisher ID
-- in Admin → Store → Ads. Bingo Club members never see ads.
-- Note: the game cannot prove on the server that a video was watched (the ad runs in the browser), so
-- rewards are capped per day and spaced out in time.

create table public.ad_settings (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default false,
  client text not null default '' check (client ~ '^(ca-pub-[0-9]{10,20})?$'),
  test_mode boolean not null default true,
  reward_coins int not null default 50 check (reward_coins between 1 and 1000),
  daily_cap int not null default 5 check (daily_cap between 0 and 50),
  interstitial boolean not null default false,
  every_n_rounds int not null default 3 check (every_n_rounds between 1 and 20),
  updated_at timestamptz not null default now()
);
insert into public.ad_settings (id) values (1);
alter table public.ad_settings enable row level security;
create policy ad_settings_read on public.ad_settings for select to anon, authenticated using (true);
grant select on public.ad_settings to anon, authenticated;

create table public.ad_rewards (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  placement text not null check (placement ~ '^[a-z_]{2,30}$'),
  coins int not null,
  created_at timestamptz not null default now()
);
create index ad_rewards_user_idx on public.ad_rewards (user_id, created_at desc);
alter table public.ad_rewards enable row level security;

create function public.my_ad_status() returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare v_user uuid := auth.uid(); s public.ad_settings; v_today int;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  select * into s from public.ad_settings where id = 1;
  select count(*) into v_today from public.ad_rewards where user_id = v_user and created_at >= date_trunc('day', now());
  return jsonb_build_object('enabled', s.enabled and s.client <> '', 'client', s.client, 'test_mode', s.test_mode, 'reward_coins', s.reward_coins,
    'left_today', greatest(0, s.daily_cap - v_today), 'interstitial', s.interstitial, 'every_n_rounds', s.every_n_rounds,
    'club', exists (select 1 from public.club_members where user_id = v_user and until > now()));
end;
$$;

create function public.claim_ad_reward(p_placement text) returns jsonb language plpgsql security definer set search_path = public as
$$
declare v_user uuid := auth.uid(); s public.ad_settings; v_today int; v_last timestamptz;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 13));
  select * into s from public.ad_settings where id = 1;
  if not s.enabled or s.client = '' then raise exception 'ads_off'; end if;
  if p_placement !~ '^[a-z_]{2,30}$' then raise exception 'bad_request'; end if;
  select count(*), max(created_at) into v_today, v_last from public.ad_rewards where user_id = v_user and created_at >= date_trunc('day', now());
  if v_today >= s.daily_cap then raise exception 'ad_limit'; end if;
  if v_last is not null and v_last > now() - interval '20 seconds' then raise exception 'ad_too_soon'; end if;
  insert into public.ad_rewards (user_id, placement, coins) values (v_user, p_placement, s.reward_coins);
  insert into public.ledger (user_id, amount, reason, ref) values (v_user, s.reward_coins, 'Reward video', 'ad:' || p_placement);
  return jsonb_build_object('coins', s.reward_coins, 'left_today', s.daily_cap - v_today - 1);
end;
$$;

create function public.admin_ads() returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare s public.ad_settings;
begin
  perform public.require_admin();
  select * into s from public.ad_settings where id = 1;
  return to_jsonb(s) || jsonb_build_object(
    'today', (select count(*) from public.ad_rewards where created_at >= date_trunc('day', now())),
    'week', (select count(*) from public.ad_rewards where created_at > now() - interval '7 days'),
    'total', (select count(*) from public.ad_rewards),
    'viewers_week', (select count(distinct user_id) from public.ad_rewards where created_at > now() - interval '7 days'),
    'by_placement', (select coalesce(jsonb_object_agg(placement, n), '{}') from (select placement, count(*) n from public.ad_rewards where created_at > now() - interval '7 days' group by placement) x));
end;
$$;

create function public.admin_set_ads(p_enabled boolean, p_client text, p_test boolean, p_coins int, p_cap int, p_inter boolean, p_every int) returns void language plpgsql security definer set search_path = public as
$$
begin
  perform public.require_admin();
  if p_enabled and coalesce(p_client, '') = '' then raise exception 'ads_need_client'; end if;
  update public.ad_settings set enabled = p_enabled, client = coalesce(p_client, ''), test_mode = p_test, reward_coins = p_coins, daily_cap = p_cap,
    interstitial = p_inter, every_n_rounds = p_every, updated_at = now() where id = 1;
  perform public.admin_log('ad_settings', jsonb_build_object('enabled', p_enabled, 'client', p_client, 'test', p_test, 'coins', p_coins, 'cap', p_cap, 'interstitial', p_inter, 'every', p_every));
end;
$$;

-- health check also looks for the ad functions
create or replace function public.admin_health() returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare f text; out jsonb := '[]';
  fns text[] := array['admin_overview','admin_players','admin_player_detail','admin_adjust_coins','admin_set_banned','admin_save_config','admin_save_item',
    'admin_save_mission','admin_events','admin_save_event','admin_set_event_status','admin_delete_event','admin_finalize_event','admin_pay_league',
    'admin_save_stage','admin_journey_stats','admin_audit','event_leaderboard','league_board','matchmake_tx','settle_stage_tx','claim_album',
    'settle_daily_tx','create_challenge_tx','mastery','export_my_data','accept_terms','set_guide_seen','create_crew','crew_info','claim_crew_chest','admin_pay_crews','season_info','claim_season_tier','admin_save_liveop','admin_save_season','valid_reward','contact_support','reply_support','admin_reply','admin_send_message','wave_hello','inbox_summary','new_players','settle_drill_tx','grant_purchase','buy_test','my_economy','club_claim','gem_spend','admin_store','claim_ad_reward','my_ad_status','admin_ads'];
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

revoke all on function public.my_ad_status(), public.claim_ad_reward(text), public.admin_ads(), public.admin_set_ads(boolean, text, boolean, int, int, boolean, int) from public, anon;
grant execute on function public.my_ad_status(), public.claim_ad_reward(text), public.admin_ads(), public.admin_set_ads(boolean, text, boolean, int, int, boolean, int) to authenticated;
revoke all on function public.admin_health() from public, anon, authenticated;
grant execute on function public.admin_health() to authenticated;
