-- Bingo Arena Phase 3: admin tools, events (tournaments), no highlight on Beginner.
-- Every admin function checks is_admin() itself, so a normal player calling it gets "forbidden".

-- Beginner no longer highlights the matching number.
update public.game_config set data = jsonb_set(data, '{levels,beginner,hint}', 'false'::jsonb), updated_at = now() where id = 1;
update public.game_config set data = jsonb_set(data, '{g,rake}', '0.1'::jsonb) where id = 1 and not (data -> 'g' ? 'rake');

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 60),
  descr text not null default '' check (char_length(descr) <= 160),
  level text not null,
  fee int not null default 0 check (fee between 0 and 1000),
  attempts int not null default 3 check (attempts between 1 and 20),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  bonus int not null default 0 check (bonus between 0 and 1000000),
  split int[] not null default '{50,30,20}',
  status text not null default 'draft' check (status in ('draft', 'live', 'ended')),
  pool int,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
alter table public.rounds add column event_id uuid references public.events (id) on delete set null;
create index rounds_event_idx on public.rounds (event_id, user_id);

alter table public.events enable row level security;
create policy events_read on public.events for select to authenticated using (status in ('live', 'ended') or public.is_admin());

-- ---------- internal helpers ----------
create function public.require_admin() returns void language plpgsql stable security definer set search_path = public as
$$ begin if not public.is_admin() then raise exception 'forbidden'; end if; end $$;

create function public.admin_log(p_action text, p_detail jsonb) returns void language sql security definer set search_path = public as
$$ insert into public.audit_log (actor, action, detail) values (auth.uid(), p_action, p_detail) $$;

-- ---------- events: round start with attempts and window checks ----------
drop function public.start_round_tx(uuid, text, text, int, bigint, jsonb, text[]);
create function public.start_round_tx(p_user uuid, p_mode text, p_level text, p_fee int, p_seed bigint, p_params jsonb, p_boosters text[] default '{}', p_event uuid default null)
returns uuid language plpgsql security definer set search_path = public as
$$
declare v_id uuid; v_bal int; k text; v_att int; v_used int;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  update public.rounds set status = 'rejected'
    where user_id = p_user and status = 'active'
      and started_at + (((params ->> 'total')::int + 90) * interval '1 second') < now();
  if exists (select 1 from public.rounds where user_id = p_user and status = 'active') then raise exception 'round_in_progress'; end if;
  if p_event is not null then
    select attempts into v_att from public.events where id = p_event and status = 'live' and now() between starts_at and ends_at;
    if not found then raise exception 'event_closed'; end if;
    select count(*) into v_used from public.rounds where user_id = p_user and event_id = p_event;
    if v_used >= v_att then raise exception 'no_attempts'; end if;
  end if;
  if p_fee > 0 then
    select coalesce(sum(amount), 0) into v_bal from public.ledger where user_id = p_user;
    if v_bal < p_fee then raise exception 'insufficient_funds'; end if;
    insert into public.ledger (user_id, amount, reason, ref) values (p_user, -p_fee, 'Entry fee (' || p_mode || ', ' || p_level || ')', 'round');
  end if;
  if coalesce(array_length(p_boosters, 1), 0) > 0 then
    if p_mode not in ('solo', 'ghost') then raise exception 'boosters_not_allowed'; end if;
    foreach k in array p_boosters loop
      update public.user_boosters set qty = qty - 1 where user_id = p_user and key = k and qty > 0;
      if not found then raise exception 'no_booster'; end if;
    end loop;
  end if;
  insert into public.rounds (user_id, mode, level, seed, fee, params, event_id) values (p_user, p_mode, p_level, p_seed, p_fee, p_params, p_event) returning id into v_id;
  return v_id;
end;
$$;

create function public.event_leaderboard(p_event uuid)
returns table (rank int, user_id uuid, display_name text, best int, attempts int)
language sql stable security definer set search_path = public as
$$
  select (row_number() over (order by t.best desc, t.first_at asc))::int, t.user_id, t.display_name, t.best, t.attempts
  from (select r.user_id, p.display_name, max(r.score) as best, count(*)::int as attempts, min(r.finished_at) as first_at
        from public.rounds r join public.profiles p on p.id = r.user_id
        where r.event_id = p_event and r.status = 'scored'
          and exists (select 1 from public.events e where e.id = p_event and (e.status in ('live','ended') or public.is_admin()))
        group by r.user_id, p.display_name) t
  order by 1 limit 50
$$;

-- ---------- admin: analytics ----------
create function public.admin_overview() returns jsonb language plpgsql stable security definer set search_path = public as
$$
begin
  perform public.require_admin();
  return jsonb_build_object(
    'players', (select count(*) from public.profiles),
    'new7', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'active1', (select count(*) from public.profiles where last_seen > now() - interval '1 day'),
    'active7', (select count(*) from public.profiles where last_seen > now() - interval '7 days'),
    'banned', (select count(*) from public.profiles where banned),
    'rounds', (select count(*) from public.rounds where status = 'scored'),
    'rejected', (select count(*) from public.rounds where status = 'rejected'),
    'coins', (select coalesce(sum(amount), 0) from public.ledger),
    'fees', (select coalesce(sum(fee), 0) from public.rounds where status in ('scored', 'rejected') and mode <> 'solo'),
    'prizes', (select coalesce(sum(prize), 0) from public.rounds where status = 'scored' and mode in ('ghost', 'pvp'))
              + (select coalesce(sum(amount), 0) from public.ledger where reason like 'Event prize%'),
    'by_mode', (select coalesce(jsonb_agg(x), '[]') from (
        select mode, level, count(*) as n, count(*) filter (where (result ->> 'win')::boolean) as wins,
               round(avg(score))::int as avg_score, coalesce(sum(fee), 0) as fees, coalesce(sum(prize), 0) as prizes
        from public.rounds where status = 'scored' group by mode, level order by mode, level) x),
    'signups', (select jsonb_agg(jsonb_build_object('d', d::date, 'n', (select count(*) from public.profiles where created_at::date = d::date)) order by d)
                from generate_series(current_date - 13, current_date, interval '1 day') d),
    'rounds_daily', (select jsonb_agg(jsonb_build_object('d', d::date, 'n', (select count(*) from public.rounds where status = 'scored' and started_at::date = d::date)) order by d)
                from generate_series(current_date - 13, current_date, interval '1 day') d)
  );
end;
$$;

-- ---------- admin: players ----------
create function public.admin_players(p_search text default '', p_limit int default 25, p_offset int default 0) returns jsonb
language plpgsql stable security definer set search_path = public as
$$
declare v_total int; v_rows jsonb; v_q text := '%' || coalesce(p_search, '') || '%';
begin
  perform public.require_admin();
  select count(*) into v_total from public.profiles p join auth.users u on u.id = p.id where p.display_name ilike v_q or u.email ilike v_q;
  select coalesce(jsonb_agg(x), '[]') into v_rows from (
    select p.id, p.display_name, u.email, p.role, p.xp, p.played, p.wins, p.banned, p.created_at, p.last_seen,
           coalesce((select sum(amount) from public.ledger l where l.user_id = p.id), 0)::int as balance
    from public.profiles p join auth.users u on u.id = p.id
    where p.display_name ilike v_q or u.email ilike v_q
    order by p.created_at desc limit least(greatest(p_limit, 1), 1000) offset greatest(p_offset, 0)) x;
  return jsonb_build_object('total', v_total, 'rows', v_rows);
end;
$$;

create function public.admin_player_detail(p_user uuid) returns jsonb language plpgsql stable security definer set search_path = public as
$$
begin
  perform public.require_admin();
  return jsonb_build_object(
    'profile', (select to_jsonb(x) from (select p.id, p.display_name, u.email, p.role, p.xp, p.played, p.wins, p.streak, p.banned, p.created_at, p.last_seen,
                  coalesce((select sum(amount) from public.ledger l where l.user_id = p.id), 0)::int as balance
                from public.profiles p join auth.users u on u.id = p.id where p.id = p_user) x),
    'stats', (select coalesce(jsonb_agg(x), '[]') from (select mode, level, count(*) as n, count(*) filter (where (result ->> 'win')::boolean) as wins, round(avg(score))::int as avg_score
                from public.rounds where user_id = p_user and status = 'scored' group by mode, level order by mode, level) x),
    'rounds', (select coalesce(jsonb_agg(x), '[]') from (select mode, level, status, score, prize, fee, started_at from public.rounds where user_id = p_user order by started_at desc limit 10) x),
    'ledger', (select coalesce(jsonb_agg(x), '[]') from (select amount, reason, created_at from public.ledger where user_id = p_user order by created_at desc limit 20) x)
  );
end;
$$;

create function public.admin_adjust_coins(p_user uuid, p_amount int, p_reason text) returns int
language plpgsql security definer set search_path = public as
$$
declare v_bal int;
begin
  perform public.require_admin();
  if p_amount = 0 or abs(p_amount) > 100000 then raise exception 'invalid_amount'; end if;
  if char_length(trim(coalesce(p_reason, ''))) < 2 or char_length(p_reason) > 60 then raise exception 'invalid_reason'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  select coalesce(sum(amount), 0) into v_bal from public.ledger where user_id = p_user;
  if v_bal + p_amount < 0 then raise exception 'insufficient_funds'; end if;
  insert into public.ledger (user_id, amount, reason, ref) values (p_user, p_amount, 'Admin: ' || trim(p_reason), 'admin');
  perform public.admin_log('adjust_coins', jsonb_build_object('user', p_user, 'amount', p_amount, 'reason', p_reason));
  return v_bal + p_amount;
end;
$$;

create function public.admin_set_banned(p_user uuid, p_banned boolean) returns void
language plpgsql security definer set search_path = public as
$$
begin
  perform public.require_admin();
  if p_user = auth.uid() then raise exception 'cannot_ban_self'; end if;
  update public.profiles set banned = p_banned where id = p_user;
  perform public.admin_log(case when p_banned then 'suspend_player' else 'reinstate_player' end, jsonb_build_object('user', p_user));
end;
$$;

-- ---------- admin: configuration and catalog ----------
create function public.admin_save_config(p_data jsonb) returns void
language plpgsql security definer set search_path = public as
$$
declare lvl text; f text; v numeric;
  lb jsonb := '{"every":[1000,10000],"win":[1,8],"pt":[0.5,5],"pen":[0,100],"xm":[0.5,5],"fee":[0,1000],"gl":[0,3000],"gr":[1,3000]}';
  gb jsonb := '{"pay":[1,1.95],"login":[0,200],"welcome":[0,1000],"total":[30,300],"rake":[0,0.5]}';
begin
  perform public.require_admin();
  if not coalesce((p_data -> 'levels') ?& array['beginner', 'medium', 'hard'], false) then raise exception 'invalid_config: levels'; end if;
  for lvl in select jsonb_object_keys(p_data -> 'levels') loop
    for f in select jsonb_object_keys(lb) loop
      v := (p_data -> 'levels' -> lvl ->> f)::numeric;
      if v is null or v < (lb -> f ->> 0)::numeric or v > (lb -> f ->> 1)::numeric then raise exception 'invalid_config: %.%', lvl, f; end if;
    end loop;
    if jsonb_typeof(p_data -> 'levels' -> lvl -> 'hint') is distinct from 'boolean' then raise exception 'invalid_config: %.hint', lvl; end if;
  end loop;
  for f in select jsonb_object_keys(gb) loop
    v := (p_data -> 'g' ->> f)::numeric;
    if v is null or v < (gb -> f ->> 0)::numeric or v > (gb -> f ->> 1)::numeric then raise exception 'invalid_config: g.%', f; end if;
  end loop;
  foreach f in array array['maint', 'paid', 'pvp'] loop
    if jsonb_typeof(p_data -> 'g' -> f) is distinct from 'boolean' then raise exception 'invalid_config: g.%', f; end if;
  end loop;
  if jsonb_typeof(p_data -> 'g' -> 'note') is distinct from 'string' or char_length(p_data -> 'g' ->> 'note') > 200 then raise exception 'invalid_config: g.note'; end if;
  update public.game_config set data = p_data, updated_at = now() where id = 1;
  perform public.admin_log('save_config', p_data);
end;
$$;

create function public.admin_save_item(p_id text, p_name text, p_descr text, p_price int, p_min_level int, p_active boolean) returns void
language plpgsql security definer set search_path = public as
$$
begin
  perform public.require_admin();
  if p_price < 0 or p_price > 100000 or p_min_level < 0 or p_min_level > 100 or char_length(trim(p_name)) < 2 then raise exception 'invalid_item'; end if;
  update public.shop_items set name = trim(p_name), descr = left(coalesce(p_descr, ''), 120), price = p_price, min_level = p_min_level, active = p_active where id = p_id;
  if not found then raise exception 'item_not_found'; end if;
  perform public.admin_log('save_item', jsonb_build_object('id', p_id, 'price', p_price, 'min_level', p_min_level, 'active', p_active));
end;
$$;

create function public.admin_save_mission(p_id text, p_label text, p_goal int, p_reward int, p_active boolean) returns void
language plpgsql security definer set search_path = public as
$$
begin
  perform public.require_admin();
  if p_goal < 1 or p_goal > 1000 or p_reward < 0 or p_reward > 10000 or char_length(trim(p_label)) < 2 then raise exception 'invalid_mission'; end if;
  update public.mission_defs set label = trim(p_label), goal = p_goal, reward = p_reward, active = p_active where id = p_id;
  if not found then raise exception 'mission_not_found'; end if;
  perform public.admin_log('save_mission', jsonb_build_object('id', p_id, 'goal', p_goal, 'reward', p_reward, 'active', p_active));
end;
$$;

-- ---------- admin: events ----------
create function public.admin_events() returns jsonb language plpgsql stable security definer set search_path = public as
$$
begin
  perform public.require_admin();
  return (select coalesce(jsonb_agg(x order by (x ->> 'starts_at') desc), '[]') from (
    select to_jsonb(e) || jsonb_build_object(
      'players', (select count(distinct user_id) from public.rounds r where r.event_id = e.id and r.status = 'scored'),
      'attempts', (select count(*) from public.rounds r where r.event_id = e.id and r.status in ('scored', 'rejected')),
      'est_pool', e.bonus + floor((select count(*) from public.rounds r where r.event_id = e.id and r.status in ('scored', 'rejected')) * e.fee
                   * (1 - coalesce((select (data -> 'g' ->> 'rake')::numeric from public.game_config), 0.1)))::int) as x
    from public.events e) t);
end;
$$;

create function public.admin_save_event(p_id uuid, p_name text, p_descr text, p_level text, p_fee int, p_attempts int,
  p_starts timestamptz, p_ends timestamptz, p_bonus int, p_split int[]) returns uuid
language plpgsql security definer set search_path = public as
$$
declare v_id uuid; v_sum int; s int; e public.events;
begin
  perform public.require_admin();
  if not exists (select 1 from public.game_config where data -> 'levels' ? p_level) then raise exception 'invalid_event: level'; end if;
  if p_split is null or coalesce(array_length(p_split, 1), 0) not between 1 and 10 then raise exception 'invalid_event: split'; end if;
  v_sum := 0; foreach s in array p_split loop if s < 1 then raise exception 'invalid_event: split'; end if; v_sum := v_sum + s; end loop;
  if v_sum > 100 then raise exception 'invalid_event: split over 100'; end if;
  if p_id is null then
    insert into public.events (name, descr, level, fee, attempts, starts_at, ends_at, bonus, split)
      values (trim(p_name), coalesce(p_descr, ''), p_level, p_fee, p_attempts, p_starts, p_ends, p_bonus, p_split) returning id into v_id;
    perform public.admin_log('create_event', jsonb_build_object('id', v_id, 'name', p_name));
  else
    select * into e from public.events where id = p_id for update;
    if not found then raise exception 'event_not_found'; end if;
    if e.status = 'ended' then raise exception 'event_ended'; end if;
    if exists (select 1 from public.rounds where event_id = p_id) and (e.level <> p_level or e.fee <> p_fee) then raise exception 'event_has_entries'; end if;
    update public.events set name = trim(p_name), descr = coalesce(p_descr, ''), level = p_level, fee = p_fee, attempts = p_attempts,
      starts_at = p_starts, ends_at = p_ends, bonus = p_bonus, split = p_split where id = p_id;
    v_id := p_id;
    perform public.admin_log('update_event', jsonb_build_object('id', v_id, 'name', p_name));
  end if;
  return v_id;
end;
$$;

create function public.admin_set_event_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as
$$
begin
  perform public.require_admin();
  if p_status not in ('draft', 'live') then raise exception 'invalid_status'; end if;
  update public.events set status = p_status where id = p_id and status <> 'ended';
  if not found then raise exception 'event_not_found'; end if;
  perform public.admin_log('event_status', jsonb_build_object('id', p_id, 'status', p_status));
end;
$$;

create function public.admin_delete_event(p_id uuid) returns void
language plpgsql security definer set search_path = public as
$$
begin
  perform public.require_admin();
  if exists (select 1 from public.rounds where event_id = p_id) then raise exception 'event_has_entries'; end if;
  delete from public.events where id = p_id;
  perform public.admin_log('delete_event', jsonb_build_object('id', p_id));
end;
$$;

create function public.admin_finalize_event(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare e public.events; v_attempts int; v_pool int; v_rake numeric; i int := 0; rec record; n int;
begin
  perform public.require_admin();
  select * into e from public.events where id = p_id for update;
  if not found then raise exception 'event_not_found'; end if;
  if e.status = 'ended' then raise exception 'already_finalized'; end if;
  select coalesce((data -> 'g' ->> 'rake')::numeric, 0.1) into v_rake from public.game_config;
  select count(*) into v_attempts from public.rounds where event_id = p_id and status in ('scored', 'rejected');
  v_pool := e.bonus + floor(v_attempts * e.fee * (1 - v_rake))::int;
  for rec in select user_id, max(score) as best, min(finished_at) as first_at from public.rounds
             where event_id = p_id and status = 'scored' group by user_id order by best desc, first_at asc limit coalesce(array_length(e.split, 1), 0) loop
    i := i + 1;
    n := floor(v_pool * e.split[i] / 100.0)::int;
    if n > 0 then insert into public.ledger (user_id, amount, reason, ref) values (rec.user_id, n, 'Event prize: ' || e.name || ' #' || i, 'event:' || p_id); end if;
  end loop;
  update public.events set status = 'ended', pool = v_pool, finalized_at = now() where id = p_id;
  perform public.admin_log('finalize_event', jsonb_build_object('id', p_id, 'pool', v_pool, 'winners', i));
  return jsonb_build_object('pool', v_pool, 'winners', i);
end;
$$;

-- ---------- permissions ----------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
grant select on public.game_config, public.shop_items to anon, authenticated;
grant select on public.profiles, public.ledger, public.rounds, public.wallet, public.audit_log, public.inventory, public.user_boosters,
  public.mission_defs, public.daily_progress, public.ach_defs, public.user_achievements, public.events to authenticated;
grant execute on function public.is_admin(), public.buy_item(text), public.equip_item(text, boolean), public.claim_mission(text),
  public.daily_deals(date), public.todays_missions(date), public.event_leaderboard(uuid),
  public.admin_overview(), public.admin_players(text, int, int), public.admin_player_detail(uuid), public.admin_adjust_coins(uuid, int, text),
  public.admin_set_banned(uuid, boolean), public.admin_save_config(jsonb), public.admin_save_item(text, text, text, int, int, boolean),
  public.admin_save_mission(text, text, int, int, boolean), public.admin_events(),
  public.admin_save_event(uuid, text, text, text, int, int, timestamptz, timestamptz, int, int[]),
  public.admin_set_event_status(uuid, text), public.admin_delete_event(uuid), public.admin_finalize_event(uuid) to authenticated;
grant execute on function public.start_round_tx(uuid, text, text, int, bigint, jsonb, text[], uuid), public.finish_round(uuid, int, int, int, jsonb),
  public.claim_daily(uuid) to service_role;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
