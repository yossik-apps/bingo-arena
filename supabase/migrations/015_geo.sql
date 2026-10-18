-- Bingo Arena 0.20.0: visitor and player countries for the Analytics map.
-- The country is guessed in the browser from its time zone (for example Asia/Jerusalem → IL).
-- No IP address is looked up or stored.

alter table public.visits add column if not exists country text check (country is null or country ~ '^[A-Z]{2}$');
create index if not exists visits_country_idx on public.visits (day, country);

create or replace function public.track_visit(p_vid uuid, p_device text, p_source text, p_landing text, p_country text) returns void
language plpgsql security definer set search_path = public as
$$
declare v_user uuid := auth.uid();
  v_dev text := case when p_device in ('phone', 'tablet', 'desktop') then p_device else 'desktop' end;
  v_src text := left(regexp_replace(lower(coalesce(p_source, '')), '[^a-z0-9.\-]', '', 'g'), 40);
  v_land text := left(regexp_replace(lower(coalesce(p_landing, '')), '[^a-z0-9_\-]', '', 'g'), 30);
  v_cc text := case when upper(coalesce(p_country, '')) ~ '^[A-Z]{2}$' then upper(p_country) end;
begin
  if p_vid is null then raise exception 'bad_request'; end if;
  if v_src = '' then v_src := 'direct'; end if;
  if v_land = '' then v_land := 'lobby'; end if;
  insert into public.visits as v (vid, day, user_id, device, source, landing, country) values (p_vid, current_date, v_user, v_dev, v_src, v_land, v_cc)
  on conflict (vid, day) do update set hits = least(v.hits + 1, 10000), last_at = now(), user_id = coalesce(excluded.user_id, v.user_id),
    country = coalesce(excluded.country, v.country);
  if v_user is not null then
    update public.visits set user_id = v_user where vid = p_vid and user_id is null and day >= current_date - 60;
  end if;
end;
$$;

-- older browsers that still send four values keep working
create or replace function public.track_visit(p_vid uuid, p_device text, p_source text, p_landing text) returns void
language sql security definer set search_path = public as
$$ select public.track_visit(p_vid, p_device, p_source, p_landing, null::text) $$;

create function public.admin_geo(p_days int default 30, p_test boolean default false) returns jsonb
language plpgsql stable security definer set search_path = public as
$$
declare
  v_to date := current_date;
  v_from date := current_date - (case when p_days in (7, 30, 90) then p_days else 30 end - 1);
  out jsonb;
begin
  perform public.require_admin();
  with uc as (select distinct on (user_id) user_id, country from public.visits
              where user_id is not null and country is not null order by user_id, day desc),
  v as (select coalesce(country, '??') c, count(distinct vid) n from public.visits where day between v_from and v_to group by 1),
  a as (select coalesce(uc.country, '??') c, count(distinct a.user_id) n from public.an_activity a left join uc using (user_id)
        where a.day between v_from and v_to group by 1),
  np as (select coalesce(uc.country, '??') c, count(*) n from public.profiles p left join uc on uc.user_id = p.id
         where p.created_at >= v_from and p.created_at < v_to + 1 group by 1),
  rv as (select coalesce(uc.country, '??') c, count(distinct pu.user_id) payers, sum(pu.price_cents) cents from public.purchases pu left join uc using (user_id)
         where pu.created_at >= v_from and pu.created_at < v_to + 1 and (pu.status = 'paid' or (p_test and pu.status = 'test')) group by 1),
  cs as (select c from v union select c from a union select c from np union select c from rv)
  select jsonb_build_object(
    'rows', coalesce(jsonb_agg(jsonb_build_object('c', cs.c, 'visitors', coalesce(v.n, 0), 'players', coalesce(a.n, 0), 'new_players', coalesce(np.n, 0),
              'payers', coalesce(rv.payers, 0), 'cents', coalesce(rv.cents, 0)) order by coalesce(v.n, 0) + coalesce(a.n, 0) desc), '[]'),
    'since', (select min(day) from public.visits where country is not null))
  into out
  from cs left join v using (c) left join a using (c) left join np using (c) left join rv using (c);
  return out;
end;
$$;

revoke all on function public.track_visit(uuid, text, text, text, text), public.admin_geo(int, boolean) from public;
grant execute on function public.track_visit(uuid, text, text, text, text) to anon, authenticated;
revoke all on function public.admin_geo(int, boolean) from anon;
grant execute on function public.admin_geo(int, boolean) to authenticated;

-- health check also looks for the map
create or replace function public.admin_health() returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare f text; out jsonb := '[]';
  fns text[] := array['admin_overview','admin_players','admin_player_detail','admin_adjust_coins','admin_set_banned','admin_save_config','admin_save_item',
    'admin_save_mission','admin_events','admin_save_event','admin_set_event_status','admin_delete_event','admin_finalize_event','admin_pay_league',
    'admin_save_stage','admin_journey_stats','admin_audit','event_leaderboard','league_board','matchmake_tx','settle_stage_tx','claim_album',
    'settle_daily_tx','create_challenge_tx','mastery','export_my_data','accept_terms','set_guide_seen','create_crew','crew_info','claim_crew_chest','admin_pay_crews','season_info','claim_season_tier','admin_save_liveop','admin_save_season','valid_reward','contact_support','reply_support','admin_reply','admin_send_message','wave_hello','inbox_summary','new_players','settle_drill_tx','grant_purchase','buy_test','my_economy','club_claim','gem_spend','admin_store','claim_ad_reward','my_ad_status','admin_ads','track_visit','track_step','admin_analytics','admin_geo'];
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
