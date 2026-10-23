-- Bingo Arena 0.23.0: live matches that actually happen, and a Facebook link.
--   * Waiting players keep a heartbeat; anyone who closed the tab leaves the queue within 15 seconds
--     (before, a closed tab stayed in the queue for 2 minutes and the next player "won" against nobody).
--   * arena_status(): how many players are online, who is waiting for a live match right now, and invites for me.
--     The game shows this as a banner ("LuckyLina is waiting for a live match · Play now").
--   * Invites: a waiting player can invite someone who is online; the invitee gets a banner with Accept / Not now.
--   * app_links: the Facebook page link, set in Admin → Config, shown in the menu and in Help.

alter table public.match_queue add column if not exists last_ping timestamptz not null default now();

-- same as before, except stale queue entries are those without a heartbeat for 15 seconds (or older than 10 minutes)
create or replace function public.matchmake_tx(p_user uuid, p_level text, p_params jsonb, p_seed bigint) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare v_fee int := (p_params ->> 'fee')::int; v_bal int; cand record; v_found uuid; v_match uuid := gen_random_uuid();
        v_start timestamptz := now() + interval '6 seconds'; u uuid; v_round uuid;
begin
  perform pg_advisory_xact_lock(42); -- one match is made at a time (fine for early scale)
  update public.rounds set status = 'rejected'
    where user_id = p_user and status = 'active' and started_at + (((params ->> 'total')::int + 90) * interval '1 second') < now();
  if exists (select 1 from public.match_players mp join public.matches m on m.id = mp.match_id join public.rounds r on r.id = mp.round_id
             where mp.user_id = p_user and m.status = 'ready' and r.status = 'active') then
    return jsonb_build_object('status', 'ready');
  end if;
  if exists (select 1 from public.rounds where user_id = p_user and status = 'active') then raise exception 'round_in_progress'; end if;
  delete from public.match_queue where user_id = p_user or last_ping < now() - interval '15 seconds' or enqueued_at < now() - interval '10 minutes';
  select coalesce(sum(amount), 0) into v_bal from public.ledger where user_id = p_user;
  if v_bal < v_fee then raise exception 'insufficient_funds'; end if;

  for cand in select q.user_id from public.match_queue q join public.profiles p on p.id = q.user_id
              where q.level = p_level and not p.banned and p.adult_confirmed order by q.enqueued_at limit 10 loop
    select coalesce(sum(amount), 0) into v_bal from public.ledger where user_id = cand.user_id;
    if v_bal >= v_fee and not exists (select 1 from public.rounds where user_id = cand.user_id and status = 'active') then v_found := cand.user_id; exit; end if;
    delete from public.match_queue where user_id = cand.user_id;
  end loop;
  if v_found is null then
    insert into public.match_queue (user_id, level) values (p_user, p_level);
    return jsonb_build_object('status', 'queued');
  end if;

  insert into public.matches (id, level, fee, seed, params, start_at) values (v_match, p_level, v_fee, p_seed, p_params, v_start);
  for u in select unnest(array[v_found, p_user]) loop
    if v_fee > 0 then insert into public.ledger (user_id, amount, reason, ref) values (u, -v_fee, 'Entry fee (vs player, ' || p_level || ')', 'match:' || v_match); end if;
    insert into public.rounds (user_id, mode, level, seed, fee, params, started_at) values (u, 'pvp', p_level, p_seed, v_fee, p_params, v_start) returning id into v_round;
    insert into public.match_players (match_id, user_id, round_id) values (v_match, u, v_round);
  end loop;
  delete from public.match_queue where user_id = v_found;
  update public.match_invites set status = 'matched' where status in ('pending', 'accepted') and (from_user in (v_found, p_user) or to_user in (v_found, p_user));
  return jsonb_build_object('status', 'ready', 'match_id', v_match);
end;
$$;

-- polling while waiting doubles as the heartbeat
create or replace function public.my_match() returns jsonb language plpgsql security definer set search_path = public as
$$
declare v_user uuid := auth.uid(); r record;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  update public.match_queue set last_ping = now() where user_id = v_user;
  if found then
    return jsonb_build_object('status', 'queued', 'waited', (select extract(epoch from now() - enqueued_at)::int from public.match_queue where user_id = v_user));
  end if;
  select m.id as match_id, mp.round_id, m.seed, m.params, m.start_at, opp.display_name as opp_name into r
    from public.match_players mp join public.matches m on m.id = mp.match_id join public.rounds rd on rd.id = mp.round_id
    left join public.match_players omp on omp.match_id = m.id and omp.user_id <> v_user
    left join public.profiles opp on opp.id = omp.user_id
    where mp.user_id = v_user and m.status = 'ready' and rd.status = 'active' order by m.created_at desc limit 1;
  if found then
    return jsonb_build_object('status', 'ready', 'match_id', r.match_id, 'round_id', r.round_id, 'seed', r.seed, 'params', r.params,
                              'start_at', r.start_at, 'server_now', now(), 'opponent', r.opp_name);
  end if;
  return jsonb_build_object('status', 'none');
end;
$$;

-- ============ invites ============
create table public.match_invites (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles (id) on delete cascade,
  to_user uuid not null references public.profiles (id) on delete cascade,
  level text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'matched')),
  created_at timestamptz not null default now()
);
create index match_invites_to_idx on public.match_invites (to_user, created_at desc);
create index match_invites_from_idx on public.match_invites (from_user, created_at desc);
alter table public.match_invites enable row level security;

create function public.send_invite(p_user uuid, p_level text) returns uuid language plpgsql security definer set search_path = public as
$$
declare v_me uuid := auth.uid(); v_id uuid;
begin
  if v_me is null then raise exception 'not_signed_in'; end if;
  if p_user = v_me then raise exception 'bad_request'; end if;
  if not exists (select 1 from public.game_config where data -> 'levels' ? p_level) then raise exception 'bad_level'; end if;
  if not exists (select 1 from public.profiles where id = v_me and adult_confirmed and not banned) then raise exception 'account_suspended'; end if;
  if not exists (select 1 from public.profiles where id = p_user and adult_confirmed and not banned and last_seen > now() - interval '5 minutes') then raise exception 'player_offline'; end if;
  if (select count(*) from public.match_invites where from_user = v_me and created_at > now() - interval '10 minutes') >= 8 then raise exception 'too_many_invites'; end if;
  update public.match_invites set status = 'declined' where from_user = v_me and to_user = p_user and status = 'pending';
  insert into public.match_invites (from_user, to_user, level) values (v_me, p_user, p_level) returning id into v_id;
  return v_id;
end;
$$;

create function public.answer_invite(p_id uuid, p_accept boolean) returns jsonb language plpgsql security definer set search_path = public as
$$
declare i public.match_invites;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  update public.match_invites set status = case when p_accept then 'accepted' else 'declined' end
    where id = p_id and to_user = auth.uid() and status = 'pending' and created_at > now() - interval '3 minutes' returning * into i;
  if not found then raise exception 'invite_expired'; end if;
  return jsonb_build_object('level', i.level, 'waiting', exists (select 1 from public.match_queue where user_id = i.from_user and last_ping > now() - interval '15 seconds'));
end;
$$;

-- everything the game needs for the live-match banner, in one call (every 15 seconds while the game is open)
create function public.arena_status() returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'not_signed_in'; end if;
  return jsonb_build_object(
    'online', (select count(*) from public.profiles where last_seen > now() - interval '5 minutes' and id <> v_me and not banned),
    'waiting', (select coalesce(jsonb_agg(x order by x.waited desc), '[]') from (
        select q.user_id as id, p.display_name as name, q.level, extract(epoch from now() - q.enqueued_at)::int as waited,
               floor(sqrt(p.xp / 40.0))::int + 1 as player_level
        from public.match_queue q join public.profiles p on p.id = q.user_id
        where q.user_id <> v_me and q.last_ping > now() - interval '15 seconds' and not p.banned limit 5) x),
    'invites', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
        select i.id, i.level, i.created_at, p.display_name as from_name,
               exists (select 1 from public.match_queue q where q.user_id = i.from_user and q.last_ping > now() - interval '15 seconds') as waiting
        from public.match_invites i join public.profiles p on p.id = i.from_user
        where i.to_user = v_me and i.status = 'pending' and i.created_at > now() - interval '2 minutes' limit 3) x),
    'sent', (select coalesce(jsonb_agg(jsonb_build_object('to', p.display_name, 'status', i.status) order by i.created_at desc), '[]')
             from public.match_invites i join public.profiles p on p.id = i.to_user
             where i.from_user = v_me and i.created_at > now() - interval '3 minutes'));
end;
$$;

-- who can be invited: online in the last 5 minutes, not in a round or a queue
create function public.online_players() returns jsonb language plpgsql stable security definer set search_path = public as
$$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  return (select coalesce(jsonb_agg(x order by x.last_seen desc), '[]') from (
    select p.id, p.display_name as name, floor(sqrt(p.xp / 40.0))::int + 1 as level, p.last_seen,
           exists (select 1 from public.rounds r where r.user_id = p.id and r.status = 'active') as playing
    from public.profiles p
    where p.last_seen > now() - interval '5 minutes' and p.id <> auth.uid() and p.adult_confirmed and not p.banned
      and not exists (select 1 from public.match_queue q where q.user_id = p.id and q.last_ping > now() - interval '15 seconds')
    order by p.last_seen desc limit 20) x);
end;
$$;

-- ============ links (Facebook page) ============
create table public.app_links (
  id int primary key default 1 check (id = 1),
  facebook text not null default '' check (facebook = '' or facebook ~ '^https://(www\.|m\.|web\.)?(facebook|fb)\.com/[A-Za-z0-9._/?=&%-]{1,200}$'),
  updated_at timestamptz not null default now()
);
insert into public.app_links (id) values (1);
alter table public.app_links enable row level security;
create policy app_links_read on public.app_links for select to anon, authenticated using (true);
grant select on public.app_links to anon, authenticated;

create function public.admin_save_links(p_facebook text) returns void language plpgsql security definer set search_path = public as
$$
begin
  perform public.require_admin();
  begin
    update public.app_links set facebook = trim(coalesce(p_facebook, '')), updated_at = now() where id = 1;
  exception when check_violation then raise exception 'invalid_link';
  end;
  perform public.admin_log('save_links', jsonb_build_object('facebook', p_facebook));
end;
$$;

revoke all on function public.send_invite(uuid, text), public.answer_invite(uuid, boolean), public.arena_status(), public.online_players(), public.admin_save_links(text) from public, anon;
grant execute on function public.send_invite(uuid, text), public.answer_invite(uuid, boolean), public.arena_status(), public.online_players(), public.admin_save_links(text) to authenticated;

-- health check also looks for the live-match pieces
create or replace function public.admin_health() returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare f text; out jsonb := '[]';
  fns text[] := array['admin_overview','admin_players','admin_player_detail','admin_adjust_coins','admin_set_banned','admin_save_config','admin_save_item',
    'admin_save_mission','admin_events','admin_save_event','admin_set_event_status','admin_delete_event','admin_finalize_event','admin_pay_league',
    'admin_save_stage','admin_journey_stats','admin_audit','event_leaderboard','league_board','matchmake_tx','settle_stage_tx','claim_album',
    'settle_daily_tx','create_challenge_tx','mastery','export_my_data','accept_terms','set_guide_seen','create_crew','crew_info','claim_crew_chest','admin_pay_crews','season_info','claim_season_tier','admin_save_liveop','admin_save_season','valid_reward','contact_support','reply_support','admin_reply','admin_send_message','wave_hello','inbox_summary','new_players','settle_drill_tx','grant_purchase','buy_test','my_economy','club_claim','gem_spend','admin_store','claim_ad_reward','my_ad_status','admin_ads','track_visit','track_step','admin_analytics','admin_geo','auto_run','auto_tick','admin_auto','admin_online','presence_ping','league_info','live_races','finalize_event_tx','relay_put','relay_take','admin_joined_on','arena_status','send_invite','answer_invite','online_players','admin_save_links'];
  tbls text[] := array['events','matches','match_queue','league_payouts','worlds','stages','stamps','user_stages','daily_boards','challenges','mastery_tiers','liveops','crews','seasons','season_tiers','support_threads','support_messages','notifications','visits','auto_settings','event_templates','liveop_templates','auth_relay','match_invites','app_links'];
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
