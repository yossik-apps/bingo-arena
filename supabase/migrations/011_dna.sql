-- Bingo Arena 0.11.0: Bingo DNA drills.
-- A drill is a free 60-second round that trains one skill. The first drill each day (UTC) gives 20 coins.
-- The Bingo DNA itself is worked out in the game from the player's own rounds, so it needs no new tables.

alter table public.rounds drop constraint rounds_mode_check;
alter table public.rounds add constraint rounds_mode_check check (mode in ('solo', 'ghost', 'pvp', 'tour', 'stage', 'daily', 'duel', 'drill'));

create function public.settle_drill_tx(p_round uuid) returns jsonb language plpgsql security definer set search_path = public as
$$
declare r record; v_first boolean; v_coins int := 0;
begin
  update public.rounds set result = coalesce(result, '{}'::jsonb) || '{"drill_settled":true}'::jsonb
    where id = p_round and status = 'scored' and mode = 'drill' and not coalesce(result ? 'drill_settled', false)
    returning user_id, params ->> 'drill' as skill into r;
  if r.user_id is null then return jsonb_build_object('ok', false); end if;
  perform pg_advisory_xact_lock(hashtextextended(r.user_id::text, 9));
  v_first := not exists (select 1 from public.rounds where user_id = r.user_id and mode = 'drill' and id <> p_round
    and coalesce(result ? 'drill_settled', false) and (finished_at at time zone 'utc')::date = (now() at time zone 'utc')::date);
  if v_first then
    v_coins := 20;
    insert into public.ledger (user_id, amount, reason, ref) values (r.user_id, v_coins, 'Daily drill', 'drill:' || p_round);
  end if;
  insert into public.daily_progress (user_id, day) values (r.user_id, current_date) on conflict do nothing;
  update public.daily_progress set counters = counters || jsonb_build_object('drills', coalesce((counters ->> 'drills')::int, 0) + 1)
    where user_id = r.user_id and day = current_date;
  return jsonb_build_object('ok', true, 'first_today', v_first, 'coins', v_coins, 'skill', r.skill);
end;
$$;

-- health check also looks for the drill function
create or replace function public.admin_health() returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare f text; out jsonb := '[]';
  fns text[] := array['admin_overview','admin_players','admin_player_detail','admin_adjust_coins','admin_set_banned','admin_save_config','admin_save_item',
    'admin_save_mission','admin_events','admin_save_event','admin_set_event_status','admin_delete_event','admin_finalize_event','admin_pay_league',
    'admin_save_stage','admin_journey_stats','admin_audit','event_leaderboard','league_board','matchmake_tx','settle_stage_tx','claim_album',
    'settle_daily_tx','create_challenge_tx','mastery','export_my_data','accept_terms','set_guide_seen','create_crew','crew_info','claim_crew_chest','admin_pay_crews','season_info','claim_season_tier','admin_save_liveop','admin_save_season','valid_reward','contact_support','reply_support','admin_reply','admin_send_message','wave_hello','inbox_summary','new_players','settle_drill_tx'];
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

revoke all on function public.settle_drill_tx(uuid) from public, anon, authenticated;
grant execute on function public.settle_drill_tx(uuid) to service_role;
revoke all on function public.admin_health() from public, anon, authenticated;
grant execute on function public.admin_health() to authenticated;
