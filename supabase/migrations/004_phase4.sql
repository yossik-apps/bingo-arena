-- Bingo Arena Phase 4: real-player matches, weekly league, 18+ confirmation for social sign-in.

-- ---------- 18+ confirmation (needed because Google/Facebook sign-ups skip the registration checkbox) ----------
alter table public.profiles add column adult_confirmed boolean not null default false, add column terms_at timestamptz;
update public.profiles p set adult_confirmed = true, terms_at = p.created_at
  from auth.users u where u.id = p.id and u.raw_app_meta_data ->> 'provider' = 'email';

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as
$$
declare v_name text; v_bonus int; v_adult boolean;
begin
  v_name := left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
                          nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
                          split_part(coalesce(new.email, ''), '@', 1)), 20);
  if char_length(v_name) < 2 then v_name := 'Player'; end if;
  v_adult := coalesce((new.raw_user_meta_data ->> 'adult') = 'true', false) and coalesce(new.raw_app_meta_data ->> 'provider', 'email') = 'email';
  insert into public.profiles (id, display_name, adult_confirmed, terms_at) values (new.id, v_name, v_adult, case when v_adult then now() end);
  select coalesce((data -> 'g' ->> 'welcome')::int, 0) into v_bonus from public.game_config;
  if v_bonus > 0 then insert into public.ledger (user_id, amount, reason) values (new.id, v_bonus, 'Registration bonus'); end if;
  return new;
end;
$$;

create function public.confirm_adult() returns void
language plpgsql security definer set search_path = public as
$$ begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  update public.profiles set adult_confirmed = true, terms_at = coalesce(terms_at, now()) where id = auth.uid();
end $$;

-- ---------- tables ----------
create table public.match_queue (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  level text not null,
  enqueued_at timestamptz not null default now()
);
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  level text not null,
  fee int not null,
  seed bigint not null,
  params jsonb not null,
  start_at timestamptz not null,
  status text not null default 'ready' check (status in ('ready', 'settled', 'cancelled')),
  outcome text check (outcome in ('decided', 'tie', 'forfeit', 'cancelled')),
  winner uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
create table public.match_players (
  match_id uuid not null references public.matches (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  round_id uuid references public.rounds (id) on delete set null,
  prize int not null default 0,
  primary key (match_id, user_id)
);
create index match_players_user_idx on public.match_players (user_id);
create table public.league_payouts (week date primary key, paid_at timestamptz not null default now(), prizes int[] not null, winners jsonb not null);

alter table public.match_queue enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;
alter table public.league_payouts enable row level security;
create policy queue_read on public.match_queue for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy mp_read on public.match_players for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy matches_read on public.matches for select to authenticated using (
  public.is_admin() or exists (select 1 from public.match_players mp where mp.match_id = id and mp.user_id = auth.uid()));
create policy payouts_read on public.league_payouts for select to authenticated using (true);

insert into public.mission_defs (id, label, counter, goal, reward) values ('pvp', 'Play a real-player match', 'pvp', 1, 40);
insert into public.ach_defs (id, label) values ('pvpwin', 'Beat a real player');

-- finish_round: also counts real-player matches for the daily quest
drop function public.finish_round(uuid, int, int, int, jsonb);
create function public.finish_round(p_round uuid, p_score int, p_prize int, p_xp int, p_result jsonb)
returns jsonb language plpgsql security definer set search_path = public as
$$
declare
  v_user uuid; v_level text; v_mode text;
  v_win boolean := coalesce((p_result ->> 'win')::boolean, false);
  v_daubs int := coalesce((p_result ->> 'daubs')::int, 0);
  v_wrong int := coalesce((p_result ->> 'wrong')::int, 0);
  v_late int := coalesce((p_result ->> 'late')::int, 0);
  v_lines int := coalesce((p_result ->> 'lines')::int, 0);
  v_mult int := coalesce((p_result ->> 'maxMult')::int, 1);
  v_played int; v_wins int; v_xp int; v_new text[] := '{}'; a text;
begin
  update public.rounds set status = 'scored', finished_at = now(), score = p_score, prize = p_prize, xp_gain = p_xp, result = p_result
    where id = p_round and status = 'active' returning user_id, level, mode into v_user, v_level, v_mode;
  if v_user is null then return jsonb_build_object('ok', false); end if;
  if p_prize > 0 then insert into public.ledger (user_id, amount, reason, ref) values (v_user, p_prize, 'Prize', 'round:' || p_round); end if;
  update public.profiles set xp = xp + p_xp, played = played + 1, wins = wins + case when v_win then 1 else 0 end, last_seen = now()
    where id = v_user returning played, wins, xp into v_played, v_wins, v_xp;
  insert into public.daily_progress (user_id, day) values (v_user, current_date) on conflict do nothing;
  update public.daily_progress set counters = counters || jsonb_build_object(
      'played', coalesce((counters ->> 'played')::int, 0) + 1,
      'wins',   coalesce((counters ->> 'wins')::int, 0) + case when v_win then 1 else 0 end,
      'daubs',  coalesce((counters ->> 'daubs')::int, 0) + v_daubs,
      'lines',  coalesce((counters ->> 'lines')::int, 0) + v_lines,
      'adv',    coalesce((counters ->> 'adv')::int, 0) + case when v_level <> 'beginner' then 1 else 0 end,
      'combo',  coalesce((counters ->> 'combo')::int, 0) + case when v_mult >= 3 then 1 else 0 end,
      'pvp',    coalesce((counters ->> 'pvp')::int, 0) + case when v_mode = 'pvp' then 1 else 0 end)
    where user_id = v_user and day = current_date;
  for a in select unnest(array[
      case when v_wins >= 1 then 'first' end, case when v_played >= 10 then 'ten' end,
      case when v_win and v_level = 'hard' then 'hard' end, case when v_daubs >= 5 and v_wrong + v_late = 0 then 'perfect' end,
      case when v_lines >= 3 then 'lines3' end, case when floor(sqrt(v_xp / 40.0)) + 1 >= 5 then 'lv5' end]) loop
    if a is not null then
      insert into public.user_achievements (user_id, ach_id) values (v_user, a) on conflict do nothing;
      if found then v_new := array_append(v_new, a); end if;
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'ach', to_jsonb(v_new));
end;
$$;

-- ---------- matchmaking ----------
create function public.matchmake_tx(p_user uuid, p_level text, p_params jsonb, p_seed bigint) returns jsonb
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
  delete from public.match_queue where user_id = p_user or enqueued_at < now() - interval '2 minutes';
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
  return jsonb_build_object('status', 'ready', 'match_id', v_match);
end;
$$;

create function public.my_match() returns jsonb language plpgsql security definer set search_path = public as
$$
declare v_user uuid := auth.uid(); r record;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  if exists (select 1 from public.match_queue where user_id = v_user) then
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

create function public.cancel_queue() returns boolean language plpgsql security definer set search_path = public as
$$ begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  delete from public.match_queue where user_id = auth.uid();
  return found;
end $$;

-- Decides a match once both scores are in (or the opponent walked away). Safe to call many times.
create function public.settle_match_tx(p_match uuid) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare m public.matches; a record; b record; v_total int; v_win uuid; v_lose uuid; v_prize int; v_outcome text; u record;
begin
  select * into m from public.matches where id = p_match for update;
  if not found then raise exception 'match_not_found'; end if;
  if m.status <> 'ready' then return jsonb_build_object('status', m.status); end if;
  v_total := (m.params ->> 'total')::int;
  select mp.user_id, mp.round_id, r.status, r.score into a from public.match_players mp join public.rounds r on r.id = mp.round_id where mp.match_id = p_match order by mp.user_id limit 1;
  select mp.user_id, mp.round_id, r.status, r.score into b from public.match_players mp join public.rounds r on r.id = mp.round_id where mp.match_id = p_match order by mp.user_id offset 1 limit 1;

  if a.status = 'scored' and b.status = 'scored' then
    if a.score = b.score then v_outcome := 'tie';
    else v_outcome := 'decided'; v_win := case when a.score > b.score then a.user_id else b.user_id end; end if;
  elsif (a.status = 'scored') <> (b.status = 'scored') and now() > m.start_at + ((v_total + 45) * interval '1 second') then
    v_outcome := 'forfeit'; v_win := case when a.status = 'scored' then a.user_id else b.user_id end;
    update public.rounds set status = 'rejected', finished_at = now(), result = jsonb_build_object('reason', 'no_show')
      where id in (a.round_id, b.round_id) and status = 'active';
  elsif a.status <> 'scored' and b.status <> 'scored' and now() > m.start_at + ((v_total + 120) * interval '1 second') then
    v_outcome := 'cancelled';
  else
    return jsonb_build_object('status', 'waiting');
  end if;

  if v_outcome in ('tie', 'cancelled') then
    for u in select user_id from public.match_players where match_id = p_match loop
      if m.fee > 0 then insert into public.ledger (user_id, amount, reason, ref) values (u.user_id, m.fee, case when v_outcome = 'tie' then 'Tie: entry refunded' else 'Match cancelled: entry refunded' end, 'match:' || p_match); end if;
    end loop;
    if v_outcome = 'cancelled' then update public.rounds set status = 'rejected', finished_at = now(), result = jsonb_build_object('reason', 'cancelled') where id in (a.round_id, b.round_id) and status = 'active'; end if;
  else
    v_prize := round(m.fee * (m.params ->> 'pay')::numeric)::int;
    if v_prize > 0 then insert into public.ledger (user_id, amount, reason, ref) values (v_win, v_prize, 'Prize (vs player)', 'match:' || p_match); end if;
    update public.match_players set prize = v_prize where match_id = p_match and user_id = v_win;
    update public.rounds set prize = v_prize, result = coalesce(result, '{}'::jsonb) || jsonb_build_object('win', true)
      where id = (select round_id from public.match_players where match_id = p_match and user_id = v_win);
    update public.profiles set xp = xp + 20, wins = wins + 1 where id = v_win;
    insert into public.daily_progress (user_id, day) values (v_win, current_date) on conflict do nothing;
    update public.daily_progress set counters = counters || jsonb_build_object('wins', coalesce((counters ->> 'wins')::int, 0) + 1) where user_id = v_win and day = current_date;
    if v_outcome = 'decided' then insert into public.user_achievements (user_id, ach_id) values (v_win, 'pvpwin') on conflict do nothing; end if;
  end if;
  update public.matches set status = case when v_outcome = 'cancelled' then 'cancelled' else 'settled' end, outcome = v_outcome, winner = v_win, settled_at = now() where id = p_match;
  return jsonb_build_object('status', 'settled', 'outcome', v_outcome);
end;
$$;

create function public.match_result(p_match uuid) returns jsonb language plpgsql security definer set search_path = public as
$$
declare v_user uuid := auth.uid(); m public.matches; mine record; opp record; v_res text;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from public.match_players where match_id = p_match and user_id = v_user) then raise exception 'forbidden'; end if;
  perform public.settle_match_tx(p_match);
  select * into m from public.matches where id = p_match;
  select mp.prize, r.score, r.status into mine from public.match_players mp join public.rounds r on r.id = mp.round_id where mp.match_id = p_match and mp.user_id = v_user;
  select p.display_name, r.score, r.status into opp from public.match_players mp join public.rounds r on r.id = mp.round_id join public.profiles p on p.id = mp.user_id
    where mp.match_id = p_match and mp.user_id <> v_user;
  if m.status = 'ready' then return jsonb_build_object('status', 'waiting', 'my_score', mine.score, 'opponent', opp.display_name); end if;
  v_res := case when m.outcome = 'tie' then 'tie' when m.outcome = 'cancelled' then 'cancelled'
                when m.winner = v_user then case when m.outcome = 'forfeit' then 'forfeit_win' else 'win' end
                else case when m.outcome = 'forfeit' then 'forfeit_loss' else 'lose' end end;
  return jsonb_build_object('status', 'settled', 'result', v_res, 'my_score', mine.score, 'opp_score', case when opp.status = 'scored' then opp.score end,
                            'opponent', opp.display_name, 'prize', mine.prize, 'fee', m.fee);
end;
$$;

-- ---------- weekly league (points = XP earned from scored rounds, Monday to Sunday UTC) ----------
create function public.week_start(p_ts timestamptz default now()) returns date language sql immutable as
$$ select date_trunc('week', p_ts at time zone 'utc')::date $$;

create function public.league_board(p_week date default null) returns table (rank int, user_id uuid, display_name text, points int)
language sql stable security definer set search_path = public as
$$
  select (row_number() over (order by t.pts desc, t.last_at asc))::int, t.user_id, t.display_name, t.pts
  from (select r.user_id, p.display_name, sum(r.xp_gain)::int as pts, max(r.finished_at) as last_at
        from public.rounds r join public.profiles p on p.id = r.user_id
        where r.status = 'scored' and not p.banned
          and r.finished_at >= (coalesce(p_week, public.week_start())::timestamp at time zone 'utc')
          and r.finished_at < ((coalesce(p_week, public.week_start()) + 7)::timestamp at time zone 'utc')
        group by r.user_id, p.display_name having sum(r.xp_gain) > 0) t
  order by 1 limit 50
$$;

create function public.admin_pay_league(p_week date, p_prizes int[] default '{200,100,50}') returns jsonb
language plpgsql security definer set search_path = public as
$$
declare rec record; i int := 0; v_winners jsonb := '[]';
begin
  perform public.require_admin();
  if p_week <> public.week_start(p_week::timestamp at time zone 'utc') then raise exception 'invalid_week'; end if;
  if p_week >= public.week_start() then raise exception 'week_not_finished'; end if;
  if exists (select 1 from public.league_payouts where week = p_week) then raise exception 'already_paid'; end if;
  if coalesce(array_length(p_prizes, 1), 0) not between 1 and 10 or exists (select 1 from unnest(p_prizes) x where x < 0 or x > 100000) then raise exception 'invalid_prizes'; end if;
  for rec in select * from public.league_board(p_week) limit array_length(p_prizes, 1) loop
    i := i + 1;
    if p_prizes[i] > 0 then insert into public.ledger (user_id, amount, reason, ref) values (rec.user_id, p_prizes[i], 'League prize #' || i || ' (week of ' || p_week || ')', 'league:' || p_week); end if;
    v_winners := v_winners || jsonb_build_object('rank', i, 'user', rec.user_id, 'name', rec.display_name, 'points', rec.points, 'prize', p_prizes[i]);
  end loop;
  insert into public.league_payouts (week, prizes, winners) values (p_week, p_prizes, v_winners);
  perform public.admin_log('pay_league', jsonb_build_object('week', p_week, 'prizes', p_prizes, 'winners', v_winners));
  return jsonb_build_object('winners', v_winners);
end;
$$;

-- ---------- permissions ----------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
grant select on public.game_config, public.shop_items to anon, authenticated;
grant select on public.profiles, public.ledger, public.rounds, public.wallet, public.audit_log, public.inventory, public.user_boosters,
  public.mission_defs, public.daily_progress, public.ach_defs, public.user_achievements, public.events,
  public.match_queue, public.matches, public.match_players, public.league_payouts to authenticated;
grant execute on function public.is_admin(), public.buy_item(text), public.equip_item(text, boolean), public.claim_mission(text),
  public.daily_deals(date), public.todays_missions(date), public.event_leaderboard(uuid),
  public.confirm_adult(), public.my_match(), public.cancel_queue(), public.match_result(uuid), public.league_board(date), public.week_start(timestamptz),
  public.admin_overview(), public.admin_players(text, int, int), public.admin_player_detail(uuid), public.admin_adjust_coins(uuid, int, text),
  public.admin_set_banned(uuid, boolean), public.admin_save_config(jsonb), public.admin_save_item(text, text, text, int, int, boolean),
  public.admin_save_mission(text, text, int, int, boolean), public.admin_events(),
  public.admin_save_event(uuid, text, text, text, int, int, timestamptz, timestamptz, int, int[]),
  public.admin_set_event_status(uuid, text), public.admin_delete_event(uuid), public.admin_finalize_event(uuid),
  public.admin_pay_league(date, int[]) to authenticated;
grant execute on function public.start_round_tx(uuid, text, text, int, bigint, jsonb, text[], uuid), public.finish_round(uuid, int, int, int, jsonb),
  public.claim_daily(uuid), public.matchmake_tx(uuid, text, jsonb, bigint), public.settle_match_tx(uuid) to service_role;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
