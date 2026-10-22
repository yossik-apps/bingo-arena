-- Bingo Arena 0.21.0: the game runs itself.
--   * Events start and finish on a schedule (from templates) and pay their winners.
--   * The weekly league and crew prizes are paid every Monday, sized by how many people played.
--   * A new season starts when the old one ends; players are reminded to claim season rewards.
--   * Live ops (boosts) repeat on a weekly plan; XP races during boosts have their own leaderboard and prizes.
--   * Winners get an inbox message with the amount. Players get a message when someone passes them on a leaderboard.
--   * Admins can see who is online (last 10 minutes).
-- The engine is public.auto_run(). It runs every 5 minutes with pg_cron when available, and the game also nudges it
-- (public.auto_tick) at most every 5 minutes, so it keeps running even without pg_cron.

-- ============ settings ============
create table public.auto_settings (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default true,
  league_on boolean not null default true,
  league_base int not null default 150 check (league_base between 0 and 100000),
  league_per_player int not null default 10 check (league_per_player between 0 and 10000),
  league_max int not null default 5000 check (league_max between 0 and 1000000),
  league_split int[] not null default '{40,25,15,10,10}',
  crews_on boolean not null default true,
  crews_base int not null default 60 check (crews_base between 0 and 100000),
  crews_per_crew int not null default 10 check (crews_per_crew between 0 and 10000),
  crews_max int not null default 1000 check (crews_max between 0 and 1000000),
  crews_split int[] not null default '{50,30,20}',
  events_on boolean not null default true,
  seasons_on boolean not null default true,
  season_days int not null default 28 check (season_days between 7 and 90),
  liveops_on boolean not null default true,
  liveop_prizes int[] not null default '{150,80,40}',
  notify_winners boolean not null default true,
  notify_overtake boolean not null default true,
  overtake_cooldown_h int not null default 3 check (overtake_cooldown_h between 0 and 72),
  last_run timestamptz,
  last_result jsonb,
  updated_at timestamptz not null default now()
);
insert into public.auto_settings (id) values (1);
alter table public.auto_settings enable row level security;

create table public.auto_log (
  id bigserial primary key,
  action text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index auto_log_created_idx on public.auto_log (created_at desc);
alter table public.auto_log enable row level security;

-- ============ event templates ============
create table public.event_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 60),
  descr text not null default '' check (char_length(descr) <= 160),
  level text not null,
  fee int not null default 0 check (fee between 0 and 1000),
  attempts int not null default 3 check (attempts between 1 and 20),
  schedule text not null default 'daily' check (schedule in ('daily', 'weekly')),
  weekday int check (weekday between 1 and 7),           -- ISO: 1 = Monday … 7 = Sunday (weekly only)
  start_hour int not null default 0 check (start_hour between 0 and 23),
  duration_hours int not null default 24 check (duration_hours between 1 and 168),
  bonus int not null default 0 check (bonus between 0 and 1000000),
  bonus_per_player int not null default 0 check (bonus_per_player between 0 and 10000),
  bonus_max int not null default 5000 check (bonus_max between 0 and 1000000),
  split int[] not null default '{50,30,20}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (schedule = 'daily' or weekday is not null)
);
alter table public.event_templates enable row level security;
alter table public.events add column if not exists template_id uuid references public.event_templates (id) on delete set null;
alter table public.events add column if not exists auto boolean not null default false;
create unique index if not exists events_template_start on public.events (template_id, starts_at) where template_id is not null;

insert into public.event_templates (name, descr, level, fee, attempts, schedule, weekday, start_hour, duration_hours, bonus, bonus_per_player, bonus_max, split) values
  ('Daily Sprint', 'A new event every day. Best score wins. 3 tries.', 'medium', 20, 3, 'daily', null, 0, 24, 200, 10, 2000, '{50,30,20}'),
  ('Midweek Rookie Cup', 'Beginner pace, small entry, big smiles. 3 tries.', 'beginner', 10, 3, 'weekly', 3, 0, 24, 300, 10, 2000, '{50,30,20}'),
  ('Weekend Championship', 'The big one: Hard level, 5 tries, the biggest prize pool of the week.', 'hard', 40, 5, 'weekly', 5, 12, 58, 1000, 20, 8000, '{40,25,15,10,10}');

-- ============ live ops templates + XP races ============
create table public.liveop_templates (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('xp_boost', 'coin_boost', 'fee_discount', 'banner')),
  title text not null check (char_length(title) between 2 and 60),
  descr text not null default '' check (char_length(descr) <= 160),
  mult numeric(3, 1) not null default 1 check (mult between 1 and 5),
  pct int not null default 0 check (pct between 0 and 90),
  weekday int check (weekday between 1 and 7),           -- null = every day
  start_hour int not null default 0 check (start_hour between 0 and 23),
  duration_hours int not null default 2 check (duration_hours between 1 and 168),
  board boolean not null default false,                  -- an XP race with prizes while it runs
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.liveop_templates enable row level security;
alter table public.liveops add column if not exists template_id uuid references public.liveop_templates (id) on delete set null;
alter table public.liveops add column if not exists board boolean not null default false;
alter table public.liveops add column if not exists paid_at timestamptz;
create unique index if not exists liveops_template_start on public.liveops (template_id, starts_at) where template_id is not null;

insert into public.liveop_templates (kind, title, descr, mult, pct, weekday, start_hour, duration_hours, board) values
  ('xp_boost', 'Happy Hour: double XP', 'Double XP for two hours, and an XP race: the top 3 win coins.', 2.0, 0, null, 18, 2, true),
  ('fee_discount', 'Midweek deal: 25% off entries', 'Every paid mode costs 25% less today.', 1, 25, 3, 0, 24, false),
  ('coin_boost', 'Weekend Coin Rush', 'Coin prizes x1.5 all weekend, plus an XP race with prizes.', 1.5, 0, 6, 0, 48, true);

-- ============ inbox: new kinds of notices ============
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in ('wave', 'info', 'prize', 'overtake'));

create function public.notify(p_user uuid, p_kind text, p_title text, p_body text, p_from uuid default null) returns void
language sql security definer set search_path = public as
$$ insert into public.notifications (user_id, kind, title, body, from_user) values (p_user, p_kind, left(p_title, 120), left(coalesce(p_body, ''), 300), p_from) $$;

create function public.auto_note(p_action text, p_detail jsonb) returns void language sql security definer set search_path = public as
$$ insert into public.auto_log (action, detail) values (p_action, p_detail) $$;

create function public.fmt_coins(n int) returns text language sql immutable as
$$ select to_char(n, 'FM999,999,990') $$;

-- ============ events: finish and pay (shared by the admin button and the engine) ============
create function public.finalize_event_tx(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare e public.events; t public.event_templates; v_attempts int; v_players int; v_pool int; v_rake numeric; i int := 0; rec record; n int; v_bonus int;
  v_winners jsonb := '[]'; s public.auto_settings;
begin
  select * into e from public.events where id = p_id for update;
  if not found then raise exception 'event_not_found'; end if;
  if e.status = 'ended' then raise exception 'already_finalized'; end if;
  select * into s from public.auto_settings where id = 1;
  select coalesce((data -> 'g' ->> 'rake')::numeric, 0.1) into v_rake from public.game_config;
  select count(*), count(distinct user_id) filter (where status = 'scored') into v_attempts, v_players
    from public.rounds where event_id = p_id and status in ('scored', 'rejected');
  v_bonus := e.bonus;
  if e.template_id is not null then
    select * into t from public.event_templates where id = e.template_id;
    if found then v_bonus := least(t.bonus_max, t.bonus + t.bonus_per_player * v_players); end if;
  end if;
  v_pool := v_bonus + floor(v_attempts * e.fee * (1 - v_rake))::int;
  for rec in select r.user_id, p.display_name, max(r.score) as best, min(r.finished_at) as first_at from public.rounds r join public.profiles p on p.id = r.user_id
             where r.event_id = p_id and r.status = 'scored' group by r.user_id, p.display_name order by best desc, first_at asc limit coalesce(array_length(e.split, 1), 0) loop
    i := i + 1;
    n := floor(v_pool * e.split[i] / 100.0)::int;
    if n > 0 then
      insert into public.ledger (user_id, amount, reason, ref) values (rec.user_id, n, 'Event prize: ' || e.name || ' #' || i, 'event:' || p_id);
      if coalesce(s.notify_winners, true) then
        perform public.notify(rec.user_id, 'prize', '🏆 You won ' || public.fmt_coins(n) || ' coins in ' || e.name || '!',
          'You finished #' || i || ' with ' || rec.best || ' points. The coins are already in your wallet. Well played!');
      end if;
    end if;
    v_winners := v_winners || jsonb_build_object('rank', i, 'name', rec.display_name, 'best', rec.best, 'prize', n);
  end loop;
  update public.events set status = 'ended', pool = v_pool, bonus = v_bonus, finalized_at = now() where id = p_id;
  return jsonb_build_object('event', e.name, 'pool', v_pool, 'players', v_players, 'winners', v_winners);
end;
$$;

create or replace function public.admin_finalize_event(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare r jsonb;
begin
  perform public.require_admin();
  r := public.finalize_event_tx(p_id);
  perform public.admin_log('finalize_event', jsonb_build_object('id', p_id) || r);
  return jsonb_build_object('pool', r -> 'pool', 'winners', jsonb_array_length(r -> 'winners'));
end;
$$;

-- ============ league: prizes sized by how many played ============
create function public.league_players(p_week date) returns int language sql stable security definer set search_path = public as
$$ select count(*)::int from (select r.user_id from public.rounds r join public.profiles p on p.id = r.user_id
     where r.status = 'scored' and not p.banned
       and r.finished_at >= (p_week::timestamp at time zone 'utc') and r.finished_at < ((p_week + 7)::timestamp at time zone 'utc')
     group by r.user_id having sum(r.xp_gain) > 0) x $$;

create function public.league_prizes(p_week date) returns int[] language plpgsql stable security definer set search_path = public as
$$
declare s public.auto_settings; v_pool int; v_out int[] := '{}'; x int;
begin
  select * into s from public.auto_settings where id = 1;
  v_pool := least(s.league_max, s.league_base + s.league_per_player * public.league_players(p_week));
  foreach x in array s.league_split loop v_out := v_out || floor(v_pool * x / 100.0)::int; end loop;
  return v_out;
end;
$$;

create function public.pay_league_tx(p_week date, p_prizes int[]) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare rec record; i int := 0; v_winners jsonb := '[]'; s public.auto_settings;
begin
  if exists (select 1 from public.league_payouts where week = p_week) then raise exception 'already_paid'; end if;
  select * into s from public.auto_settings where id = 1;
  for rec in select * from public.league_board(p_week) limit coalesce(array_length(p_prizes, 1), 0) loop
    i := i + 1;
    if p_prizes[i] > 0 then
      insert into public.ledger (user_id, amount, reason, ref) values (rec.user_id, p_prizes[i], 'League prize #' || i || ' (week of ' || p_week || ')', 'league:' || p_week);
      if coalesce(s.notify_winners, true) then
        perform public.notify(rec.user_id, 'prize', '🏆 You won ' || public.fmt_coins(p_prizes[i]) || ' coins in the weekly league!',
          'You finished #' || i || ' with ' || rec.points || ' XP in the week of ' || to_char(p_week, 'DD Mon') || '. The coins are already in your wallet. A new week has started: go for the top again!');
      end if;
    end if;
    v_winners := v_winners || jsonb_build_object('rank', i, 'user', rec.user_id, 'name', rec.display_name, 'points', rec.points, 'prize', p_prizes[i]);
  end loop;
  insert into public.league_payouts (week, prizes, winners) values (p_week, p_prizes, v_winners);
  return jsonb_build_object('week', p_week, 'prizes', p_prizes, 'winners', v_winners);
end;
$$;

create or replace function public.admin_pay_league(p_week date, p_prizes int[] default '{200,100,50}') returns jsonb
language plpgsql security definer set search_path = public as
$$
declare r jsonb;
begin
  perform public.require_admin();
  if p_week <> public.week_start(p_week::timestamp at time zone 'utc') then raise exception 'invalid_week'; end if;
  if p_week >= public.week_start() then raise exception 'week_not_finished'; end if;
  if coalesce(array_length(p_prizes, 1), 0) not between 1 and 10 or exists (select 1 from unnest(p_prizes) x where x < 0 or x > 100000) then raise exception 'invalid_prizes'; end if;
  r := public.pay_league_tx(p_week, p_prizes);
  perform public.admin_log('pay_league', r);
  return jsonb_build_object('winners', r -> 'winners');
end;
$$;

-- what players see: this week's prize pool so far
create function public.league_info() returns jsonb language sql stable security definer set search_path = public as
$$ select jsonb_build_object('week', public.week_start(), 'ends_at', (public.week_start() + 7)::timestamp at time zone 'utc',
     'players', public.league_players(public.week_start()), 'prizes', to_jsonb(public.league_prizes(public.week_start())),
     'auto', (select enabled and league_on from public.auto_settings where id = 1)) $$;

-- ============ crews ============
create function public.crew_prizes(p_week date) returns int[] language plpgsql stable security definer set search_path = public as
$$
declare s public.auto_settings; v_pool int; v_out int[] := '{}'; x int; v_n int;
begin
  select * into s from public.auto_settings where id = 1;
  select count(*) into v_n from public.crew_board(p_week);
  v_pool := least(s.crews_max, s.crews_base + s.crews_per_crew * v_n);
  foreach x in array s.crews_split loop v_out := v_out || floor(v_pool * x / 100.0)::int; end loop;
  return v_out;
end;
$$;

create function public.pay_crews_tx(p_week date, p_prizes int[]) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare rec record; mem record; i int := 0; v_paid int; v_winners jsonb := '[]'; s public.auto_settings;
begin
  if exists (select 1 from public.crew_payouts where week = p_week) then raise exception 'already_paid'; end if;
  select * into s from public.auto_settings where id = 1;
  for rec in select * from public.crew_board(p_week) limit coalesce(array_length(p_prizes, 1), 0) loop
    i := i + 1; v_paid := 0;
    for mem in select user_id from public.crew_members where crew_id = rec.crew_id and public.member_week_points(user_id, crew_id, p_week) >= 20 loop
      if p_prizes[i] > 0 then
        insert into public.ledger (user_id, amount, reason, ref) values (mem.user_id, p_prizes[i], 'Crew prize #' || i || ' (week of ' || p_week || ')', 'crews:' || p_week);
        if coalesce(s.notify_winners, true) then
          perform public.notify(mem.user_id, 'prize', '🏆 Your crew ' || rec.name || ' finished #' || i || ': +' || public.fmt_coins(p_prizes[i]) || ' coins!',
            'Great teamwork in the week of ' || to_char(p_week, 'DD Mon') || '. The coins are already in your wallet.');
        end if;
      end if;
      v_paid := v_paid + 1;
    end loop;
    v_winners := v_winners || jsonb_build_object('rank', i, 'crew', rec.name, 'points', rec.points, 'prize', p_prizes[i], 'members_paid', v_paid);
  end loop;
  insert into public.crew_payouts (week, prizes, winners) values (p_week, p_prizes, v_winners);
  return jsonb_build_object('week', p_week, 'prizes', p_prizes, 'winners', v_winners);
end;
$$;

create or replace function public.admin_pay_crews(p_week date, p_prizes int[] default '{100,60,30}') returns jsonb
language plpgsql security definer set search_path = public as
$$
declare r jsonb;
begin
  perform public.require_admin();
  if p_week <> public.week_start(p_week::timestamp at time zone 'utc') then raise exception 'invalid_week'; end if;
  if p_week >= public.week_start() then raise exception 'week_not_finished'; end if;
  if coalesce(array_length(p_prizes, 1), 0) not between 1 and 10 or exists (select 1 from unnest(p_prizes) x where x < 0 or x > 100000) then raise exception 'invalid_prizes'; end if;
  r := public.pay_crews_tx(p_week, p_prizes);
  perform public.admin_log('pay_crews', r);
  return jsonb_build_object('winners', r -> 'winners');
end;
$$;

-- ============ live op XP races ============
create function public.liveop_board(p_id uuid) returns table (rank int, user_id uuid, display_name text, points int)
language sql stable security definer set search_path = public as
$$
  select (row_number() over (order by t.pts desc, t.last_at asc))::int, t.user_id, t.display_name, t.pts
  from (select r.user_id, p.display_name, sum(r.xp_gain)::int as pts, max(r.finished_at) as last_at
        from public.liveops l join public.rounds r on r.finished_at >= l.starts_at and r.finished_at < l.ends_at and r.status = 'scored'
        join public.profiles p on p.id = r.user_id
        where l.id = p_id and l.board and l.active and not p.banned
        group by r.user_id, p.display_name having sum(r.xp_gain) > 0) t
  order by 1 limit 50
$$;

create function public.pay_liveop_tx(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare l public.liveops; s public.auto_settings; rec record; i int := 0; v_winners jsonb := '[]';
begin
  select * into l from public.liveops where id = p_id for update;
  if not found or l.paid_at is not null or not l.board then return null; end if;
  select * into s from public.auto_settings where id = 1;
  for rec in select * from public.liveop_board(p_id) limit coalesce(array_length(s.liveop_prizes, 1), 0) loop
    i := i + 1;
    if s.liveop_prizes[i] > 0 then
      insert into public.ledger (user_id, amount, reason, ref) values (rec.user_id, s.liveop_prizes[i], 'Event prize: ' || l.title || ' #' || i, 'liveop:' || p_id);
      if s.notify_winners then
        perform public.notify(rec.user_id, 'prize', '🏆 You won ' || public.fmt_coins(s.liveop_prizes[i]) || ' coins in ' || l.title || '!',
          'You finished #' || i || ' in the XP race with ' || rec.points || ' XP. The coins are already in your wallet.');
      end if;
    end if;
    v_winners := v_winners || jsonb_build_object('rank', i, 'name', rec.display_name, 'points', rec.points, 'prize', s.liveop_prizes[i]);
  end loop;
  update public.liveops set paid_at = now() where id = p_id;
  return jsonb_build_object('liveop', l.title, 'winners', v_winners);
end;
$$;

-- what players see: running XP races with the board and prizes
create function public.live_races() returns jsonb language sql stable security definer set search_path = public as
$$ select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'title', l.title, 'descr', l.descr, 'kind', l.kind, 'mult', l.mult, 'ends_at', l.ends_at,
     'prizes', to_jsonb((select liveop_prizes from public.auto_settings where id = 1)),
     'board', (select coalesce(jsonb_agg(jsonb_build_object('rank', b.rank, 'name', b.display_name, 'points', b.points, 'me', b.user_id = auth.uid()) order by b.rank), '[]')
               from public.liveop_board(l.id) b where b.rank <= 10 or b.user_id = auth.uid())) order by l.ends_at), '[]')
   from public.liveops l where l.active and l.board and now() >= l.starts_at and now() < l.ends_at $$;

-- ============ seasons ============
alter table public.seasons add column if not exists end_noticed boolean not null default false;

create function public.default_tier_rewards(p_tier int) returns jsonb language sql immutable as
$$ select jsonb_build_object(
     'free', case when p_tier % 5 = 0 then jsonb_build_object('pack', 1)
                  when p_tier % 3 = 0 then jsonb_build_object('booster', jsonb_build_object('key', 'time', 'qty', 1))
                  else jsonb_build_object('coins', 25 + p_tier * 5) end,
     'premium', case when p_tier % 5 = 0 then jsonb_build_object('pack', 2)
                     when p_tier % 4 = 0 then jsonb_build_object('booster', jsonb_build_object('key', 'slow', 'qty', 2))
                     else jsonb_build_object('coins', 60 + p_tier * 10) end) $$;

create function public.auto_seasons() returns jsonb language plpgsql security definer set search_path = public as
$$
declare s public.auto_settings; last public.seasons; v_id int; v_start timestamptz; v_next timestamptz; v_out jsonb := '[]'; rec record; v_n int := 0;
begin
  select * into s from public.auto_settings where id = 1;
  -- reminders when a season ends: players with unclaimed tiers have 3 days to claim
  for last in select * from public.seasons where ends_at < now() and not end_noticed and ends_at > now() - interval '3 days' loop
    for rec in select r.user_id, least(30, sum(r.xp_gain) / last.xp_per_tier)::int as tiers from public.rounds r
               where r.status = 'scored' and r.finished_at >= last.starts_at and r.finished_at < last.ends_at group by r.user_id
               having least(30, sum(r.xp_gain) / last.xp_per_tier) > (select count(*) from public.season_claims c where c.user_id = r.user_id and c.season_id = last.id and c.track = 'free') loop
      perform public.notify(rec.user_id, 'info', '⏳ ' || last.name || ' has ended: claim your rewards', 'You reached tier ' || rec.tiers || '. Open Journey → Season within 3 days to collect everything you earned.');
      v_n := v_n + 1;
    end loop;
    update public.seasons set end_noticed = true where id = last.id;
    v_out := v_out || jsonb_build_object('season_ended', last.name, 'reminded', v_n);
  end loop;
  -- start the next season when none is running or about to start
  if exists (select 1 from public.seasons where ends_at > now() and starts_at <= now() + interval '1 day') then return v_out; end if;
  -- copy the settings and rewards of the most recent season; if one is already planned for later, fill the gap until it starts
  select * into last from public.seasons where starts_at <= now() order by ends_at desc limit 1;
  select min(starts_at) into v_next from public.seasons where starts_at > now();
  v_id := coalesce((select max(id) from public.seasons), 0) + 1;
  v_start := date_trunc('hour', now());
  insert into public.seasons (id, name, blurb, starts_at, ends_at, xp_per_tier, pass_price)
    values (v_id, 'Season ' || v_id, 'Play any mode to earn season XP. 30 tiers of coins, packs and boosters.', v_start,
            least(v_start + make_interval(days => s.season_days), coalesce(v_next, 'infinity'::timestamptz)),
            coalesce(last.xp_per_tier, 200), coalesce(last.pass_price, 600));
  if last.id is not null and exists (select 1 from public.season_tiers where season_id = last.id) then
    insert into public.season_tiers (season_id, tier, free_reward, premium_reward) select v_id, tier, free_reward, premium_reward from public.season_tiers where season_id = last.id;
  else
    insert into public.season_tiers (season_id, tier, free_reward, premium_reward)
      select v_id, t, public.default_tier_rewards(t) -> 'free', public.default_tier_rewards(t) -> 'premium' from generate_series(1, 30) t;
  end if;
  return v_out || jsonb_build_object('season_started', 'Season ' || v_id, 'starts_at', v_start);
end;
$$;

-- ============ the engine ============
-- next start time of a schedule (UTC) at or before now, so a running window is found
create function public.slot_start(p_weekday int, p_hour int, p_at timestamptz default now()) returns timestamptz language sql stable as
$$ select case when p_weekday is null
     then (date_trunc('day', p_at at time zone 'utc') + make_interval(hours => p_hour)) at time zone 'utc'
          - case when p_at < (date_trunc('day', p_at at time zone 'utc') + make_interval(hours => p_hour)) at time zone 'utc' then interval '1 day' else interval '0' end
     else (date_trunc('week', p_at at time zone 'utc') + make_interval(days => p_weekday - 1, hours => p_hour)) at time zone 'utc'
          - case when p_at < (date_trunc('week', p_at at time zone 'utc') + make_interval(days => p_weekday - 1, hours => p_hour)) at time zone 'utc' then interval '7 days' else interval '0' end
   end $$;

create function public.auto_run() returns jsonb language plpgsql security definer set search_path = public as
$$
declare s public.auto_settings; t public.event_templates; lt public.liveop_templates; ev record; lo record; v_start timestamptz; v_id uuid;
  v_out jsonb := '[]'; r jsonb; v_week date := public.week_start() - 7; k int;
begin
  if not pg_try_advisory_xact_lock(hashtext('bingo_auto_run')) then return jsonb_build_object('skipped', 'busy'); end if;
  select * into s from public.auto_settings where id = 1;
  if not s.enabled then
    update public.auto_settings set last_run = now(), last_result = '{"skipped":"off"}' where id = 1;
    return jsonb_build_object('skipped', 'off');
  end if;

  -- 1. events: open the current slot of every template, and finish events whose time is up
  if s.events_on then
    for t in select * from public.event_templates where active loop
     begin
      v_start := public.slot_start(case when t.schedule = 'daily' then null else t.weekday end, t.start_hour);
      if now() < v_start + make_interval(hours => t.duration_hours) - interval '30 minutes'
         and not exists (select 1 from public.events where template_id = t.id and starts_at = v_start) then
        insert into public.events (name, descr, level, fee, attempts, starts_at, ends_at, bonus, split, status, template_id, auto)
          values (t.name, t.descr, t.level, t.fee, t.attempts, v_start, v_start + make_interval(hours => t.duration_hours), t.bonus, t.split, 'live', t.id, true)
          returning id into v_id;
        v_out := v_out || jsonb_build_object('event_opened', t.name, 'ends_at', v_start + make_interval(hours => t.duration_hours));
        perform public.auto_note('event_opened', jsonb_build_object('id', v_id, 'name', t.name, 'starts_at', v_start));
      end if;
     exception when others then perform public.auto_note('error', jsonb_build_object('step', 'open_event', 'template', t.name, 'error', sqlerrm));
     end;
    end loop;
  end if;
  -- finishing always runs (also for events an admin created by hand), so nobody waits for a prize
  for ev in select id from public.events where status = 'live' and ends_at <= now() order by ends_at loop
    begin
      r := public.finalize_event_tx(ev.id);
      v_out := v_out || jsonb_build_object('event_paid', r);
      perform public.auto_note('event_paid', r);
    exception when others then perform public.auto_note('error', jsonb_build_object('step', 'event', 'id', ev.id, 'error', sqlerrm));
    end;
  end loop;

  -- 2. league and crews: pay last week every Monday
  if s.league_on and now() > (public.week_start()::timestamp at time zone 'utc') + interval '5 minutes'
     and not exists (select 1 from public.league_payouts where week = v_week) then
    begin
      r := public.pay_league_tx(v_week, public.league_prizes(v_week));
      v_out := v_out || jsonb_build_object('league_paid', r);
      perform public.auto_note('league_paid', r);
    exception when others then perform public.auto_note('error', jsonb_build_object('step', 'league', 'error', sqlerrm));
    end;
  end if;
  if s.crews_on and now() > (public.week_start()::timestamp at time zone 'utc') + interval '5 minutes'
     and not exists (select 1 from public.crew_payouts where week = v_week) then
    begin
      r := public.pay_crews_tx(v_week, public.crew_prizes(v_week));
      v_out := v_out || jsonb_build_object('crews_paid', r);
      perform public.auto_note('crews_paid', r);
    exception when others then perform public.auto_note('error', jsonb_build_object('step', 'crews', 'error', sqlerrm));
    end;
  end if;

  -- 3. seasons
  if s.seasons_on then
    begin
      r := public.auto_seasons();
      if jsonb_array_length(r) > 0 then v_out := v_out || jsonb_build_object('seasons', r); perform public.auto_note('seasons', r); end if;
    exception when others then perform public.auto_note('error', jsonb_build_object('step', 'seasons', 'error', sqlerrm));
    end;
  end if;

  -- 4. live ops: plan the next 7 days from the templates, and pay finished XP races
  if s.liveops_on then
    for lt in select * from public.liveop_templates where active loop
      for k in 0..7 loop
        v_start := public.slot_start(lt.weekday, lt.start_hour, now() + make_interval(days => k));
        if v_start + make_interval(hours => lt.duration_hours) > now() and v_start < now() + interval '7 days'
           and not exists (select 1 from public.liveops where template_id = lt.id and starts_at = v_start) then
          insert into public.liveops (kind, title, descr, starts_at, ends_at, mult, pct, active, template_id, board)
            values (lt.kind, lt.title, lt.descr, v_start, v_start + make_interval(hours => lt.duration_hours),
                    case when lt.kind in ('xp_boost', 'coin_boost') then lt.mult else 1 end, case when lt.kind = 'fee_discount' then lt.pct else 0 end, true, lt.id, lt.board);
          perform public.auto_note('liveop_planned', jsonb_build_object('title', lt.title, 'starts_at', v_start));
        end if;
      end loop;
    end loop;
  end if;
  for lo in select id from public.liveops where board and paid_at is null and ends_at <= now() and active loop
    begin
      r := public.pay_liveop_tx(lo.id);
      if r is not null then v_out := v_out || jsonb_build_object('race_paid', r); perform public.auto_note('race_paid', r); end if;
    exception when others then perform public.auto_note('error', jsonb_build_object('step', 'race', 'id', lo.id, 'error', sqlerrm));
    end;
  end loop;

  update public.auto_settings set last_run = now(), last_result = v_out where id = 1;
  return v_out;
end;
$$;

-- the game nudges the engine; it runs at most every 5 minutes, whoever calls
create function public.auto_tick() returns boolean language plpgsql security definer set search_path = public as
$$
begin
  if exists (select 1 from public.auto_settings where id = 1 and (last_run is null or last_run < now() - interval '5 minutes')) then
    perform public.auto_run();
    return true;
  end if;
  return false;
end;
$$;

-- every 5 minutes on the database itself, when pg_cron is available (Supabase: Database → Extensions → pg_cron)
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('bingo-auto-run', '*/5 * * * *', 'select public.auto_run()');
exception when others then
  raise notice 'pg_cron is not available (%). The game will run the automation itself every few minutes.', sqlerrm;
end $$;

-- ============ "someone passed you" messages ============
create table public.overtake_log (
  user_id uuid not null references public.profiles (id) on delete cascade,
  board text not null,
  last_at timestamptz not null default now(),
  primary key (user_id, board)
);
alter table public.overtake_log enable row level security;

create function public.overtake_notify(p_me uuid, p_board text, p_label text, p_victims jsonb, p_extra text) returns int
language plpgsql security definer set search_path = public as
$$
declare s public.auto_settings; v record; v_name text; n int := 0;
begin
  select * into s from public.auto_settings where id = 1;
  select display_name into v_name from public.profiles where id = p_me;
  for v in select (x ->> 'user')::uuid as uid, (x ->> 'rank')::int as rnk from jsonb_array_elements(p_victims) x loop
    if exists (select 1 from public.overtake_log where user_id = v.uid and board = p_board and last_at > now() - make_interval(hours => s.overtake_cooldown_h)) then continue; end if;
    insert into public.overtake_log (user_id, board, last_at) values (v.uid, p_board, now()) on conflict (user_id, board) do update set last_at = now();
    perform public.notify(v.uid, 'overtake', '⚔️ ' || v_name || ' just passed you in ' || p_label,
      'You are now #' || v.rnk || '. ' || p_extra, p_me);
    n := n + 1;
  end loop;
  return n;
end;
$$;

create function public.rounds_overtake() returns trigger language plpgsql security definer set search_path = public as
$$
declare s public.auto_settings; e public.events; v_before int; v_after int; v_week date; v_victims jsonb; l public.liveops;
begin
  begin
    select * into s from public.auto_settings where id = 1;
    if not coalesce(s.notify_overtake, false) or not coalesce(s.enabled, false) then return new; end if;

    -- events: best score per player
    if new.event_id is not null then
      select * into e from public.events where id = new.event_id;
      select max(score) into v_before from public.rounds where event_id = new.event_id and user_id = new.user_id and status = 'scored' and id <> new.id;
      v_after := greatest(coalesce(v_before, -1), coalesce(new.score, 0));
      if v_after > coalesce(v_before, -1) then
        with b as (select r.user_id, max(r.score) best from public.rounds r join public.profiles p on p.id = r.user_id
                   where r.event_id = new.event_id and r.status = 'scored' and r.user_id <> new.user_id and not p.banned group by r.user_id),
             ranked as (select user_id, best, (select count(*) from b b2 where b2.best > b.best) + 1 as rank_before from b)
        select coalesce(jsonb_agg(jsonb_build_object('user', user_id, 'rank', rank_before + 1) order by best desc), '[]') into v_victims
        from (select * from ranked where best < v_after and best > coalesce(v_before, -1) and rank_before <= 20 order by best desc limit 5) x;
        perform public.overtake_notify(new.user_id, 'event:' || new.event_id, e.name, v_victims, 'Use one of your tries to take your place back!');
      end if;
    end if;

    -- weekly league: XP this week
    if coalesce(new.xp_gain, 0) > 0 then
      v_week := public.week_start();
      select coalesce(sum(xp_gain), 0) into v_after from public.rounds where user_id = new.user_id and status = 'scored'
        and finished_at >= (v_week::timestamp at time zone 'utc') and finished_at < ((v_week + 7)::timestamp at time zone 'utc');
      v_before := v_after - new.xp_gain;
      with b as (select r.user_id, sum(r.xp_gain) pts from public.rounds r join public.profiles p on p.id = r.user_id
                 where r.status = 'scored' and not p.banned and r.user_id <> new.user_id
                   and r.finished_at >= (v_week::timestamp at time zone 'utc') and r.finished_at < ((v_week + 7)::timestamp at time zone 'utc')
                 group by r.user_id having sum(r.xp_gain) > 0),
           ranked as (select user_id, pts, (select count(*) from b b2 where b2.pts > b.pts) + 1 as rank_before from b)
      select coalesce(jsonb_agg(jsonb_build_object('user', user_id, 'rank', rank_before + 1) order by pts desc), '[]') into v_victims
      from (select * from ranked where pts < v_after and pts > v_before and rank_before <= 20 order by pts desc limit 5) x;
      perform public.overtake_notify(new.user_id, 'league:' || v_week, 'the weekly league', v_victims, 'Play a round to climb back before the week ends on Sunday.');

      -- XP races during live ops
      for l in select * from public.liveops where active and board and new.finished_at >= starts_at and new.finished_at < ends_at loop
        select coalesce(sum(xp_gain), 0) into v_after from public.rounds where user_id = new.user_id and status = 'scored' and finished_at >= l.starts_at and finished_at < l.ends_at;
        v_before := v_after - new.xp_gain;
        with b as (select r.user_id, sum(r.xp_gain) pts from public.rounds r join public.profiles p on p.id = r.user_id
                   where r.status = 'scored' and not p.banned and r.user_id <> new.user_id and r.finished_at >= l.starts_at and r.finished_at < l.ends_at
                   group by r.user_id having sum(r.xp_gain) > 0),
             ranked as (select user_id, pts, (select count(*) from b b2 where b2.pts > b.pts) + 1 as rank_before from b)
        select coalesce(jsonb_agg(jsonb_build_object('user', user_id, 'rank', rank_before + 1) order by pts desc), '[]') into v_victims
        from (select * from ranked where pts < v_after and pts > v_before and rank_before <= 10 order by pts desc limit 5) x;
        perform public.overtake_notify(new.user_id, 'liveop:' || l.id, l.title, v_victims, 'The race ends at ' || to_char(l.ends_at at time zone 'utc', 'HH24:MI') || ' UTC. Play now to win it back!');
      end loop;
    end if;
  exception when others then
    -- never let a message problem block a round from being scored
    perform public.auto_note('overtake_error', jsonb_build_object('error', sqlerrm, 'round', new.id));
  end;
  return new;
end;
$$;

create trigger rounds_overtake after update of status on public.rounds
  for each row when (new.status = 'scored' and old.status is distinct from 'scored') execute function public.rounds_overtake();

-- ============ who is online ============
create index if not exists profiles_last_seen_idx on public.profiles (last_seen desc);

create function public.presence_ping(p_vid uuid default null) returns void language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is not null then
    update public.profiles set last_seen = now() where id = auth.uid() and last_seen < now() - interval '45 seconds';
  end if;
  if p_vid is not null then
    update public.visits set last_at = now() where vid = p_vid and day = current_date and last_at < now() - interval '45 seconds';
  end if;
end;
$$;

create function public.admin_online(p_minutes int default 10) returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare v_m int := least(greatest(coalesce(p_minutes, 10), 1), 120);
begin
  perform public.require_admin();
  return jsonb_build_object(
    'minutes', v_m,
    'players', (select count(*) from public.profiles where last_seen > now() - make_interval(mins => v_m)),
    'guests', (select count(distinct vid) from public.visits where day >= current_date - 1 and user_id is null and last_at > now() - make_interval(mins => v_m)),
    'list', (select coalesce(jsonb_agg(x order by x.last_seen desc), '[]') from (
      select p.id, p.display_name as name, p.last_seen, floor(sqrt(p.xp / 40.0))::int + 1 as level,
             (select v.device from public.visits v where v.user_id = p.id order by v.last_at desc limit 1) as device,
             (select v.country from public.visits v where v.user_id = p.id and v.country is not null order by v.last_at desc limit 1) as country,
             (select r.mode from public.rounds r where r.user_id = p.id and r.status = 'active' limit 1) as playing
      from public.profiles p where p.last_seen > now() - make_interval(mins => v_m) order by p.last_seen desc limit 100) x));
end;
$$;

-- ============ admin: automation settings ============
create function public.admin_auto() returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare s public.auto_settings;
begin
  perform public.require_admin();
  select * into s from public.auto_settings where id = 1;
  return jsonb_build_object(
    'settings', to_jsonb(s),
    'cron', exists (select 1 from pg_extension where extname = 'pg_cron'),
    'templates', (select coalesce(jsonb_agg(to_jsonb(t) order by t.schedule, t.weekday nulls first, t.start_hour), '[]') from public.event_templates t),
    'liveop_templates', (select coalesce(jsonb_agg(to_jsonb(t) order by t.weekday nulls first, t.start_hour), '[]') from public.liveop_templates t),
    'league', jsonb_build_object('players', public.league_players(public.week_start()), 'prizes', to_jsonb(public.league_prizes(public.week_start()))),
    'crews', jsonb_build_object('prizes', to_jsonb(public.crew_prizes(public.week_start()))),
    'season', (select jsonb_build_object('name', name, 'starts_at', starts_at, 'ends_at', ends_at) from public.seasons where ends_at > now() order by starts_at limit 1),
    'live_events', (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'ends_at', ends_at, 'auto', auto) order by ends_at), '[]') from public.events where status = 'live'),
    'next_liveops', (select coalesce(jsonb_agg(jsonb_build_object('title', title, 'starts_at', starts_at, 'ends_at', ends_at, 'board', board) order by starts_at), '[]')
                     from (select * from public.liveops where ends_at > now() and active order by starts_at limit 8) x),
    'log', (select coalesce(jsonb_agg(jsonb_build_object('action', action, 'detail', detail, 'at', created_at) order by created_at desc), '[]')
            from (select * from public.auto_log order by created_at desc limit 30) x));
end;
$$;

create function public.valid_split(p int[]) returns boolean language sql immutable as
$$ select coalesce(array_length(p, 1), 0) between 1 and 10 and not exists (select 1 from unnest(p) x where x < 0) and (select sum(x) from unnest(p) x) <= 100 $$;

create function public.admin_save_auto(p jsonb) returns void language plpgsql security definer set search_path = public as
$$
declare v_ls int[]; v_cs int[]; v_lp int[];
begin
  perform public.require_admin();
  v_ls := array(select jsonb_array_elements_text(p -> 'league_split')::int);
  v_cs := array(select jsonb_array_elements_text(p -> 'crews_split')::int);
  v_lp := array(select jsonb_array_elements_text(p -> 'liveop_prizes')::int);
  if not public.valid_split(v_ls) or not public.valid_split(v_cs) then raise exception 'invalid_auto: the prize split must be 1 to 10 shares that add up to 100 or less'; end if;
  if coalesce(array_length(v_lp, 1), 0) not between 1 and 10 or exists (select 1 from unnest(v_lp) x where x < 0 or x > 100000) then raise exception 'invalid_auto: race prizes'; end if;
  begin
    update public.auto_settings set
      enabled = (p ->> 'enabled')::boolean, league_on = (p ->> 'league_on')::boolean, league_base = (p ->> 'league_base')::int,
      league_per_player = (p ->> 'league_per_player')::int, league_max = (p ->> 'league_max')::int, league_split = v_ls,
      crews_on = (p ->> 'crews_on')::boolean, crews_base = (p ->> 'crews_base')::int, crews_per_crew = (p ->> 'crews_per_crew')::int,
      crews_max = (p ->> 'crews_max')::int, crews_split = v_cs, events_on = (p ->> 'events_on')::boolean,
      seasons_on = (p ->> 'seasons_on')::boolean, season_days = (p ->> 'season_days')::int, liveops_on = (p ->> 'liveops_on')::boolean,
      liveop_prizes = v_lp, notify_winners = (p ->> 'notify_winners')::boolean, notify_overtake = (p ->> 'notify_overtake')::boolean,
      overtake_cooldown_h = (p ->> 'overtake_cooldown_h')::int, updated_at = now()
    where id = 1;
  exception when check_violation or not_null_violation or invalid_text_representation then raise exception 'invalid_auto: check the numbers';
  end;
  perform public.admin_log('auto_settings', p);
end;
$$;

create function public.admin_save_event_template(p_id uuid, p jsonb) returns uuid language plpgsql security definer set search_path = public as
$$
declare v_id uuid := p_id; v_split int[] := array(select jsonb_array_elements_text(p -> 'split')::int);
begin
  perform public.require_admin();
  if not exists (select 1 from public.game_config where data -> 'levels' ? (p ->> 'level')) then raise exception 'invalid_auto: level'; end if;
  if not public.valid_split(v_split) then raise exception 'invalid_auto: the prize split must be 1 to 10 shares that add up to 100 or less'; end if;
  begin
    if v_id is null then
      insert into public.event_templates (name, descr, level, fee, attempts, schedule, weekday, start_hour, duration_hours, bonus, bonus_per_player, bonus_max, split, active)
      values (trim(p ->> 'name'), coalesce(p ->> 'descr', ''), p ->> 'level', (p ->> 'fee')::int, (p ->> 'attempts')::int, p ->> 'schedule',
              case when p ->> 'schedule' = 'weekly' then (p ->> 'weekday')::int end, (p ->> 'start_hour')::int, (p ->> 'duration_hours')::int,
              (p ->> 'bonus')::int, (p ->> 'bonus_per_player')::int, (p ->> 'bonus_max')::int, v_split, (p ->> 'active')::boolean) returning id into v_id;
    else
      update public.event_templates set name = trim(p ->> 'name'), descr = coalesce(p ->> 'descr', ''), level = p ->> 'level', fee = (p ->> 'fee')::int,
        attempts = (p ->> 'attempts')::int, schedule = p ->> 'schedule', weekday = case when p ->> 'schedule' = 'weekly' then (p ->> 'weekday')::int end,
        start_hour = (p ->> 'start_hour')::int, duration_hours = (p ->> 'duration_hours')::int, bonus = (p ->> 'bonus')::int,
        bonus_per_player = (p ->> 'bonus_per_player')::int, bonus_max = (p ->> 'bonus_max')::int, split = v_split, active = (p ->> 'active')::boolean
      where id = v_id;
      if not found then raise exception 'event_not_found'; end if;
    end if;
  exception when check_violation or not_null_violation or invalid_text_representation then raise exception 'invalid_auto: check the event details';
  end;
  perform public.admin_log('event_template', jsonb_build_object('id', v_id) || p);
  return v_id;
end;
$$;

create function public.admin_delete_event_template(p_id uuid) returns void language plpgsql security definer set search_path = public as
$$ begin perform public.require_admin(); delete from public.event_templates where id = p_id; perform public.admin_log('delete_event_template', jsonb_build_object('id', p_id)); end $$;

create function public.admin_save_liveop_template(p_id uuid, p jsonb) returns uuid language plpgsql security definer set search_path = public as
$$
declare v_id uuid := p_id; v_kind text := p ->> 'kind';
begin
  perform public.require_admin();
  if v_kind in ('xp_boost', 'coin_boost') and ((p ->> 'mult')::numeric < 1.1 or (p ->> 'mult')::numeric > 5) then raise exception 'invalid_liveop: multiplier must be 1.1 to 5'; end if;
  if v_kind = 'fee_discount' and ((p ->> 'pct')::int < 5 or (p ->> 'pct')::int > 90) then raise exception 'invalid_liveop: discount must be 5 to 90 percent'; end if;
  begin
    if v_id is null then
      insert into public.liveop_templates (kind, title, descr, mult, pct, weekday, start_hour, duration_hours, board, active)
      values (v_kind, trim(p ->> 'title'), coalesce(p ->> 'descr', ''), case when v_kind in ('xp_boost', 'coin_boost') then (p ->> 'mult')::numeric else 1 end,
              case when v_kind = 'fee_discount' then (p ->> 'pct')::int else 0 end, nullif(p ->> 'weekday', '')::int, (p ->> 'start_hour')::int,
              (p ->> 'duration_hours')::int, coalesce((p ->> 'board')::boolean, false) and v_kind in ('xp_boost', 'coin_boost'), (p ->> 'active')::boolean) returning id into v_id;
    else
      update public.liveop_templates set kind = v_kind, title = trim(p ->> 'title'), descr = coalesce(p ->> 'descr', ''),
        mult = case when v_kind in ('xp_boost', 'coin_boost') then (p ->> 'mult')::numeric else 1 end, pct = case when v_kind = 'fee_discount' then (p ->> 'pct')::int else 0 end,
        weekday = nullif(p ->> 'weekday', '')::int, start_hour = (p ->> 'start_hour')::int, duration_hours = (p ->> 'duration_hours')::int,
        board = coalesce((p ->> 'board')::boolean, false) and v_kind in ('xp_boost', 'coin_boost'), active = (p ->> 'active')::boolean
      where id = v_id;
      if not found then raise exception 'liveop_not_found'; end if;
    end if;
  exception when check_violation or not_null_violation or invalid_text_representation then raise exception 'invalid_liveop: check the details';
  end;
  -- future, not yet started copies follow the new plan
  delete from public.liveops where template_id = v_id and starts_at > now();
  perform public.admin_log('liveop_template', jsonb_build_object('id', v_id) || p);
  return v_id;
end;
$$;

create function public.admin_delete_liveop_template(p_id uuid) returns void language plpgsql security definer set search_path = public as
$$ begin
  perform public.require_admin();
  delete from public.liveops where template_id = p_id and starts_at > now();
  delete from public.liveop_templates where id = p_id;
  perform public.admin_log('delete_liveop_template', jsonb_build_object('id', p_id));
end $$;

create function public.admin_run_auto() returns jsonb language plpgsql security definer set search_path = public as
$$ declare r jsonb; begin perform public.require_admin(); r := public.auto_run(); perform public.admin_log('auto_run', jsonb_build_object('result', r)); return r; end $$;

-- ============ sign-up funnel: more steps ============
alter table public.visits add column if not exists signup_google boolean not null default false;
alter table public.visits add column if not exists signup_email boolean not null default false;
alter table public.visits add column if not exists confirm_needed boolean not null default false;

create or replace function public.track_step(p_vid uuid, p_step text) returns void
language plpgsql security definer set search_path = public as
$$
begin
  if p_vid is null or p_step not in ('guest_round', 'signup_open', 'signup_google', 'signup_email', 'confirm_needed') then raise exception 'bad_request'; end if;
  insert into public.visits as v (vid, day, user_id, guest_rounds, signup_open, signup_google, signup_email, confirm_needed)
  values (p_vid, current_date, auth.uid(), case when p_step = 'guest_round' then 1 else 0 end, p_step = 'signup_open', p_step = 'signup_google', p_step = 'signup_email', p_step = 'confirm_needed')
  on conflict (vid, day) do update set last_at = now(),
    guest_rounds = least(v.guest_rounds + case when p_step = 'guest_round' then 1 else 0 end, 500),
    signup_open = v.signup_open or p_step = 'signup_open',
    signup_google = v.signup_google or p_step = 'signup_google',
    signup_email = v.signup_email or p_step = 'signup_email',
    confirm_needed = v.confirm_needed or p_step = 'confirm_needed';
end;
$$;

create function public.admin_signup_steps(p_days int default 30) returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare v_from date := current_date - (case when p_days in (7, 30, 90) then p_days else 30 end - 1);
begin
  perform public.require_admin();
  return (with nv as (select vid from public.visits group by vid having min(day) >= v_from),
               d as (select v.* from public.visits v join nv using (vid))
          select jsonb_build_object(
            'opened', (select count(distinct vid) from d where signup_open),
            'google', (select count(distinct vid) from d where signup_google),
            'email', (select count(distinct vid) from d where signup_email),
            'confirm_needed', (select count(distinct vid) from d where confirm_needed),
            'joined', (select count(distinct vid) from d where user_id is not null)));
end;
$$;

-- ============ permissions ============
revoke all on function public.notify(uuid, text, text, text, uuid), public.auto_note(text, jsonb), public.finalize_event_tx(uuid), public.pay_league_tx(date, int[]),
  public.pay_crews_tx(date, int[]), public.pay_liveop_tx(uuid), public.auto_seasons(), public.auto_run(), public.overtake_notify(uuid, text, text, jsonb, text),
  public.rounds_overtake(), public.league_players(date), public.league_prizes(date), public.crew_prizes(date) from public, anon, authenticated;
revoke all on function public.league_info(), public.live_races(), public.liveop_board(uuid), public.auto_tick(), public.presence_ping(uuid), public.admin_online(int),
  public.admin_auto(), public.admin_save_auto(jsonb), public.admin_save_event_template(uuid, jsonb), public.admin_delete_event_template(uuid),
  public.admin_save_liveop_template(uuid, jsonb), public.admin_delete_liveop_template(uuid), public.admin_run_auto(), public.admin_signup_steps(int) from public, anon;
grant execute on function public.league_info(), public.live_races(), public.liveop_board(uuid), public.auto_tick(), public.presence_ping(uuid), public.admin_online(int),
  public.admin_auto(), public.admin_save_auto(jsonb), public.admin_save_event_template(uuid, jsonb), public.admin_delete_event_template(uuid),
  public.admin_save_liveop_template(uuid, jsonb), public.admin_delete_liveop_template(uuid), public.admin_run_auto(), public.admin_signup_steps(int) to authenticated;
grant execute on function public.auto_tick(), public.presence_ping(uuid) to anon;
revoke all on function public.admin_finalize_event(uuid), public.admin_pay_league(date, int[]), public.admin_pay_crews(date, int[]) from public, anon;
grant execute on function public.admin_finalize_event(uuid), public.admin_pay_league(date, int[]), public.admin_pay_crews(date, int[]) to authenticated;
grant execute on function public.auto_run() to service_role;

-- health check also looks for the automation
create or replace function public.admin_health() returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare f text; out jsonb := '[]';
  fns text[] := array['admin_overview','admin_players','admin_player_detail','admin_adjust_coins','admin_set_banned','admin_save_config','admin_save_item',
    'admin_save_mission','admin_events','admin_save_event','admin_set_event_status','admin_delete_event','admin_finalize_event','admin_pay_league',
    'admin_save_stage','admin_journey_stats','admin_audit','event_leaderboard','league_board','matchmake_tx','settle_stage_tx','claim_album',
    'settle_daily_tx','create_challenge_tx','mastery','export_my_data','accept_terms','set_guide_seen','create_crew','crew_info','claim_crew_chest','admin_pay_crews','season_info','claim_season_tier','admin_save_liveop','admin_save_season','valid_reward','contact_support','reply_support','admin_reply','admin_send_message','wave_hello','inbox_summary','new_players','settle_drill_tx','grant_purchase','buy_test','my_economy','club_claim','gem_spend','admin_store','claim_ad_reward','my_ad_status','admin_ads','track_visit','track_step','admin_analytics','admin_geo','auto_run','auto_tick','admin_auto','admin_online','presence_ping','league_info','live_races','finalize_event_tx'];
  tbls text[] := array['events','matches','match_queue','league_payouts','worlds','stages','stamps','user_stages','daily_boards','challenges','mastery_tiers','liveops','crews','seasons','season_tiers','support_threads','support_messages','notifications','visits','auto_settings','event_templates','liveop_templates'];
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
