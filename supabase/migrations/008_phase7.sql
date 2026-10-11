-- Bingo Arena Phase 7: Live ops calendar (timed boosts), Crews (teams with weekly goals), Season track.
-- Everything is earned by playing, calculated on the server, and written to the same coin ledger as the rest of the game.

-- ======================= Live ops =======================
create table public.liveops (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('xp_boost', 'coin_boost', 'fee_discount', 'banner')),
  title text not null check (char_length(title) between 2 and 60),
  descr text not null default '' check (char_length(descr) <= 160),
  starts_at timestamptz not null, ends_at timestamptz not null,
  mult numeric(3, 1) not null default 1 check (mult between 1 and 5),
  pct int not null default 0 check (pct between 0 and 90),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at and ends_at <= starts_at + interval '31 days')
);
alter table public.liveops enable row level security;
create policy liveops_read on public.liveops for select to authenticated using (active);

create function public.admin_liveops() returns jsonb language plpgsql stable security definer set search_path = public as
$$ begin
  perform public.require_admin();
  return (select coalesce(jsonb_agg(to_jsonb(l) order by l.starts_at desc), '[]') from public.liveops l where l.ends_at > now() - interval '60 days');
end $$;

create function public.admin_save_liveop(p_id uuid, p_kind text, p_title text, p_descr text, p_starts timestamptz, p_ends timestamptz, p_mult numeric, p_pct int, p_active boolean) returns uuid
language plpgsql security definer set search_path = public as
$$
declare v_id uuid := p_id;
begin
  perform public.require_admin();
  if p_kind in ('xp_boost', 'coin_boost') and (p_mult < 1.1 or p_mult > 5) then raise exception 'invalid_liveop: multiplier must be 1.1 to 5'; end if;
  if p_kind = 'fee_discount' and (p_pct < 5 or p_pct > 90) then raise exception 'invalid_liveop: discount must be 5 to 90 percent'; end if;
  if p_ends <= p_starts or p_ends > p_starts + interval '31 days' then raise exception 'invalid_liveop: an event lasts up to 31 days and must end after it starts'; end if;
  if v_id is null then
    insert into public.liveops (kind, title, descr, starts_at, ends_at, mult, pct, active)
      values (p_kind, trim(p_title), coalesce(p_descr, ''), p_starts, p_ends, case when p_kind in ('xp_boost', 'coin_boost') then p_mult else 1 end, case when p_kind = 'fee_discount' then p_pct else 0 end, p_active)
      returning id into v_id;
  else
    update public.liveops set kind = p_kind, title = trim(p_title), descr = coalesce(p_descr, ''), starts_at = p_starts, ends_at = p_ends,
      mult = case when p_kind in ('xp_boost', 'coin_boost') then p_mult else 1 end, pct = case when p_kind = 'fee_discount' then p_pct else 0 end, active = p_active where id = v_id;
    if not found then raise exception 'liveop_not_found'; end if;
  end if;
  perform public.admin_log('save_liveop', jsonb_build_object('id', v_id, 'kind', p_kind, 'title', p_title, 'starts', p_starts, 'ends', p_ends));
  return v_id;
end;
$$;

create function public.admin_delete_liveop(p_id uuid) returns void language plpgsql security definer set search_path = public as
$$ begin
  perform public.require_admin();
  delete from public.liveops where id = p_id;
  perform public.admin_log('delete_liveop', jsonb_build_object('id', p_id));
end $$;

-- ======================= Crews =======================
create table public.crews (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name ~ '^[A-Za-z0-9][A-Za-z0-9 ]{2,19}$'),
  name_key text generated always as (lower(name)) stored unique,
  tag text not null check (tag ~ '^[A-Za-z0-9]{2,4}$'),
  descr text not null default '' check (char_length(descr) <= 120),
  open boolean not null default true,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);
create table public.crew_members (
  crew_id uuid not null references public.crews (id) on delete cascade,
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('leader', 'member')),
  joined_at timestamptz not null default now(),
  primary key (crew_id, user_id)
);
create table public.crew_claims (
  user_id uuid not null references public.profiles (id) on delete cascade, week date not null, tier int not null check (tier in (1, 2)),
  claimed_at timestamptz not null default now(), primary key (user_id, week, tier)
);
create table public.crew_payouts (week date primary key, paid_at timestamptz not null default now(), prizes int[] not null, winners jsonb not null);
alter table public.crews enable row level security;
alter table public.crew_members enable row level security;
alter table public.crew_claims enable row level security;
alter table public.crew_payouts enable row level security;

-- Crew XP only counts what a player earned AFTER joining, so hopping between crews gains nothing.
create function public.member_week_points(p_user uuid, p_crew uuid, p_week date) returns int language sql stable security definer set search_path = public as
$$ select coalesce(sum(r.xp_gain), 0)::int from public.crew_members m
   join public.rounds r on r.user_id = m.user_id and r.status = 'scored'
     and r.finished_at >= greatest(m.joined_at, p_week::timestamp at time zone 'utc') and r.finished_at < (p_week + 7)::timestamp at time zone 'utc'
   where m.user_id = p_user and m.crew_id = p_crew $$;

create function public.crew_week_points(p_crew uuid, p_week date) returns int language sql stable security definer set search_path = public as
$$ select coalesce(sum(public.member_week_points(m.user_id, m.crew_id, p_week)), 0)::int from public.crew_members m where m.crew_id = p_crew $$;

create function public.create_crew(p_name text, p_tag text, p_descr text, p_open boolean) returns uuid
language plpgsql security definer set search_path = public as
$$
declare v_user uuid := auth.uid(); v_id uuid; v_ok boolean;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  select adult_confirmed and not banned into v_ok from public.profiles where id = v_user;
  if not coalesce(v_ok, false) then raise exception 'account_suspended'; end if;
  if exists (select 1 from public.crew_members where user_id = v_user) then raise exception 'already_in_crew'; end if;
  begin
    insert into public.crews (name, tag, descr, open, invite_code)
      values (trim(p_name), upper(trim(p_tag)), left(coalesce(p_descr, ''), 120), coalesce(p_open, true), upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)))
      returning id into v_id;
  exception when unique_violation then raise exception 'crew_name_taken';
            when check_violation then raise exception 'invalid_crew_name';
  end;
  insert into public.crew_members (crew_id, user_id, role) values (v_id, v_user, 'leader');
  return v_id;
end;
$$;

create function public.join_crew(p_crew uuid, p_code text default null) returns void
language plpgsql security definer set search_path = public as
$$
declare v_user uuid := auth.uid(); c public.crews; v_ok boolean;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  select adult_confirmed and not banned into v_ok from public.profiles where id = v_user;
  if not coalesce(v_ok, false) then raise exception 'account_suspended'; end if;
  if exists (select 1 from public.crew_members where user_id = v_user) then raise exception 'already_in_crew'; end if;
  if p_code is not null then select * into c from public.crews where invite_code = upper(trim(p_code));
  else select * into c from public.crews where id = p_crew and open; end if;
  if not found then raise exception 'crew_not_found'; end if;
  perform pg_advisory_xact_lock(hashtextextended(c.id::text, 5));
  if (select count(*) from public.crew_members where crew_id = c.id) >= 20 then raise exception 'crew_full'; end if;
  insert into public.crew_members (crew_id, user_id) values (c.id, v_user);
end;
$$;

create function public.leave_crew() returns void language plpgsql security definer set search_path = public as
$$
declare m public.crew_members; v_next uuid;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into m from public.crew_members where user_id = auth.uid();
  if not found then raise exception 'not_in_crew'; end if;
  delete from public.crew_members where user_id = auth.uid();
  if m.role = 'leader' then
    select user_id into v_next from public.crew_members where crew_id = m.crew_id order by joined_at limit 1;
    if v_next is null then delete from public.crews where id = m.crew_id;
    else update public.crew_members set role = 'leader' where crew_id = m.crew_id and user_id = v_next; end if;
  end if;
end;
$$;

create function public.kick_crew_member(p_user uuid) returns void language plpgsql security definer set search_path = public as
$$
declare v_crew uuid;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select crew_id into v_crew from public.crew_members where user_id = auth.uid() and role = 'leader';
  if v_crew is null then raise exception 'not_crew_leader'; end if;
  if p_user = auth.uid() then raise exception 'cannot_kick_self'; end if;
  delete from public.crew_members where user_id = p_user and crew_id = v_crew;
  if not found then raise exception 'not_in_crew'; end if;
end;
$$;

create function public.update_crew(p_descr text, p_open boolean) returns void language plpgsql security definer set search_path = public as
$$
declare v_crew uuid;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select crew_id into v_crew from public.crew_members where user_id = auth.uid() and role = 'leader';
  if v_crew is null then raise exception 'not_crew_leader'; end if;
  update public.crews set descr = left(coalesce(p_descr, ''), 120), open = coalesce(p_open, open) where id = v_crew;
end;
$$;

create function public.crew_info() returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare v_user uuid := auth.uid(); c public.crews; v_week date := public.week_start(); v_n int; v_pts int;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  select cr.* into c from public.crews cr join public.crew_members m on m.crew_id = cr.id where m.user_id = v_user;
  if not found then return null; end if;
  select count(*) into v_n from public.crew_members where crew_id = c.id;
  v_pts := public.crew_week_points(c.id, v_week);
  return jsonb_build_object('id', c.id, 'name', c.name, 'tag', c.tag, 'descr', c.descr, 'open', c.open, 'invite_code', c.invite_code,
    'members', (select coalesce(jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', p.display_name, 'role', m.role, 'points', public.member_week_points(m.user_id, c.id, v_week))
                order by public.member_week_points(m.user_id, c.id, v_week) desc, m.joined_at), '[]')
                from public.crew_members m join public.profiles p on p.id = m.user_id where m.crew_id = c.id),
    'week_points', v_pts, 'size', v_n, 'goal', 150 * v_n, 'tier1', 90 * v_n,
    'my_points', public.member_week_points(v_user, c.id, v_week),
    'claimed', (select coalesce(jsonb_agg(tier), '[]') from public.crew_claims where user_id = v_user and week = v_week),
    'rank', 1 + (select count(*) from public.crews o where public.crew_week_points(o.id, v_week) > v_pts),
    'is_leader', exists (select 1 from public.crew_members where crew_id = c.id and user_id = v_user and role = 'leader'),
    'min_members', 3, 'min_points', 40);
end;
$$;

create function public.search_crews(p_q text) returns jsonb language plpgsql stable security definer set search_path = public as
$$ begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  return (select coalesce(jsonb_agg(x), '[]') from (
    select c.id, c.name, c.tag, c.descr, (select count(*) from public.crew_members m where m.crew_id = c.id) as members,
           public.crew_week_points(c.id, public.week_start()) as points
    from public.crews c
    where c.open and (coalesce(p_q, '') = '' or c.name ilike '%' || p_q || '%') and (select count(*) from public.crew_members m where m.crew_id = c.id) < 20
    order by points desc, members desc limit 20) x);
end $$;

create function public.crew_board(p_week date default null) returns table (rank int, crew_id uuid, name text, tag text, members int, points int)
language sql stable security definer set search_path = public as
$$
  select (row_number() over (order by t.pts desc, t.members desc, t.name))::int, t.id, t.name, t.tag, t.members, t.pts
  from (select c.id, c.name, c.tag, (select count(*)::int from public.crew_members m where m.crew_id = c.id) as members,
               public.crew_week_points(c.id, coalesce(p_week, public.week_start())) as pts from public.crews c) t
  where t.pts > 0 order by 1 limit 20
$$;

-- Crew chest: 60% of the weekly goal gives 30 coins, 100% gives 60 coins and a stamp pack.
-- Needs a crew of at least 3 and 40 XP of your own this week.
create function public.claim_crew_chest(p_tier int) returns jsonb language plpgsql security definer set search_path = public as
$$
declare v_user uuid := auth.uid(); v_crew uuid; v_week date := public.week_start(); v_n int; v_need int; v_pack jsonb; v_coins int;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  if p_tier not in (1, 2) then raise exception 'invalid_tier'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 6));
  select crew_id into v_crew from public.crew_members where user_id = v_user;
  if v_crew is null then raise exception 'not_in_crew'; end if;
  select count(*) into v_n from public.crew_members where crew_id = v_crew;
  if v_n < 3 then raise exception 'crew_too_small'; end if;
  v_need := case p_tier when 1 then 90 * v_n else 150 * v_n end;
  if public.crew_week_points(v_crew, v_week) < v_need then raise exception 'goal_not_reached'; end if;
  if public.member_week_points(v_user, v_crew, v_week) < 40 then raise exception 'contribute_more'; end if;
  insert into public.crew_claims (user_id, week, tier) values (v_user, v_week, p_tier) on conflict do nothing;
  if not found then raise exception 'already_claimed'; end if;
  v_coins := case p_tier when 1 then 30 else 60 end;
  insert into public.ledger (user_id, amount, reason, ref) values (v_user, v_coins, 'Crew chest', 'crew:' || v_week || ':' || p_tier);
  if p_tier = 2 then v_pack := public.open_pack_tx(v_user, public.current_world(v_user)); end if;
  return jsonb_build_object('coins', v_coins, 'pack', v_pack);
end;
$$;

create function public.admin_crews() returns jsonb language plpgsql stable security definer set search_path = public as
$$ begin
  perform public.require_admin();
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.points desc), '[]') from (
    select c.id, c.name, c.tag, c.descr, c.open, c.created_at,
      (select count(*) from public.crew_members m where m.crew_id = c.id) as members,
      (select p.display_name from public.crew_members m join public.profiles p on p.id = m.user_id where m.crew_id = c.id and m.role = 'leader') as leader,
      public.crew_week_points(c.id, public.week_start()) as points from public.crews c) x);
end $$;

create function public.admin_rename_crew(p_crew uuid, p_name text) returns void language plpgsql security definer set search_path = public as
$$ begin
  perform public.require_admin();
  begin update public.crews set name = trim(p_name) where id = p_crew;
  exception when unique_violation then raise exception 'crew_name_taken'; when check_violation then raise exception 'invalid_crew_name'; end;
  if not found then raise exception 'crew_not_found'; end if;
  perform public.admin_log('rename_crew', jsonb_build_object('crew', p_crew, 'name', p_name));
end $$;

create function public.admin_delete_crew(p_crew uuid) returns void language plpgsql security definer set search_path = public as
$$ begin
  perform public.require_admin();
  delete from public.crews where id = p_crew;
  perform public.admin_log('delete_crew', jsonb_build_object('crew', p_crew));
end $$;

create function public.admin_pay_crews(p_week date, p_prizes int[] default '{100,60,30}') returns jsonb
language plpgsql security definer set search_path = public as
$$
declare rec record; mem record; i int := 0; v_paid int; v_winners jsonb := '[]';
begin
  perform public.require_admin();
  if p_week <> public.week_start(p_week::timestamp at time zone 'utc') then raise exception 'invalid_week'; end if;
  if p_week >= public.week_start() then raise exception 'week_not_finished'; end if;
  if exists (select 1 from public.crew_payouts where week = p_week) then raise exception 'already_paid'; end if;
  if coalesce(array_length(p_prizes, 1), 0) not between 1 and 10 or exists (select 1 from unnest(p_prizes) x where x < 0 or x > 100000) then raise exception 'invalid_prizes'; end if;
  for rec in select * from public.crew_board(p_week) limit array_length(p_prizes, 1) loop
    i := i + 1; v_paid := 0;
    for mem in select user_id from public.crew_members where crew_id = rec.crew_id and public.member_week_points(user_id, crew_id, p_week) >= 20 loop
      if p_prizes[i] > 0 then insert into public.ledger (user_id, amount, reason, ref) values (mem.user_id, p_prizes[i], 'Crew prize #' || i || ' (week of ' || p_week || ')', 'crews:' || p_week); end if;
      v_paid := v_paid + 1;
    end loop;
    v_winners := v_winners || jsonb_build_object('rank', i, 'crew', rec.name, 'points', rec.points, 'prize', p_prizes[i], 'members_paid', v_paid);
  end loop;
  insert into public.crew_payouts (week, prizes, winners) values (p_week, p_prizes, v_winners);
  perform public.admin_log('pay_crews', jsonb_build_object('week', p_week, 'prizes', p_prizes, 'winners', v_winners));
  return jsonb_build_object('winners', v_winners);
end;
$$;

-- ======================= Season track =======================
create table public.seasons (
  id int primary key, name text not null check (char_length(name) between 2 and 40), blurb text not null default '' check (char_length(blurb) <= 160),
  starts_at timestamptz not null, ends_at timestamptz not null,
  xp_per_tier int not null default 200 check (xp_per_tier between 50 and 2000), pass_price int not null default 600 check (pass_price between 0 and 100000),
  check (ends_at > starts_at)
);
create table public.season_tiers (
  season_id int not null references public.seasons (id) on delete cascade, tier int not null check (tier between 1 and 30),
  free_reward jsonb not null, premium_reward jsonb not null, primary key (season_id, tier)
);
create table public.season_pass (user_id uuid not null references public.profiles (id) on delete cascade, season_id int not null references public.seasons (id) on delete cascade, bought_at timestamptz not null default now(), primary key (user_id, season_id));
create table public.season_claims (
  user_id uuid not null references public.profiles (id) on delete cascade, season_id int not null references public.seasons (id) on delete cascade,
  tier int not null, track text not null check (track in ('free', 'premium')), claimed_at timestamptz not null default now(), primary key (user_id, season_id, tier, track)
);
alter table public.seasons enable row level security;
alter table public.season_tiers enable row level security;
alter table public.season_pass enable row level security;
alter table public.season_claims enable row level security;
create policy seasons_read on public.seasons for select to authenticated using (true);
create policy season_tiers_read on public.season_tiers for select to authenticated using (true);
create policy season_pass_read on public.season_pass for select to authenticated using (user_id = auth.uid());
create policy season_claims_read on public.season_claims for select to authenticated using (user_id = auth.uid());

create function public.valid_reward(p jsonb) returns boolean language plpgsql stable security definer set search_path = public as
$$
begin
  if p is null or jsonb_typeof(p) <> 'object' or (select count(*) from jsonb_object_keys(p)) <> 1 then return false; end if;
  return (p ? 'coins' and (p ->> 'coins')::int between 1 and 5000)
      or (p ? 'pack' and (p ->> 'pack')::int between 1 and 5)
      or (p ? 'item' and exists (select 1 from public.shop_items where id = p ->> 'item'))
      or (p ? 'booster' and (p -> 'booster' ->> 'key') in ('slow', 'win', 'time', 'hint') and (p -> 'booster' ->> 'qty')::int between 1 and 10);
exception when others then return false;
end;
$$;

create function public.grant_reward_tx(p_user uuid, p_reward jsonb, p_reason text) returns jsonb language plpgsql security definer set search_path = public as
$$
declare v_packs jsonb := '[]'; i int;
begin
  if p_reward ? 'coins' then
    insert into public.ledger (user_id, amount, reason, ref) values (p_user, (p_reward ->> 'coins')::int, p_reason, 'season');
  elsif p_reward ? 'pack' then
    for i in 1..(p_reward ->> 'pack')::int loop v_packs := v_packs || public.open_pack_tx(p_user, public.current_world(p_user)); end loop;
  elsif p_reward ? 'item' then
    insert into public.inventory (user_id, item_id) values (p_user, p_reward ->> 'item') on conflict do nothing;
  elsif p_reward ? 'booster' then
    insert into public.user_boosters (user_id, key, qty) values (p_user, p_reward -> 'booster' ->> 'key', (p_reward -> 'booster' ->> 'qty')::int)
      on conflict (user_id, key) do update set qty = public.user_boosters.qty + (p_reward -> 'booster' ->> 'qty')::int;
  end if;
  return jsonb_build_object('reward', p_reward, 'packs', v_packs);
end;
$$;

-- the running season, plus 3 days to claim rewards after it ends
create function public.current_season_id() returns int language sql stable security definer set search_path = public as
$$ select id from public.seasons where starts_at <= now() and now() <= ends_at + interval '3 days' order by starts_at desc limit 1 $$;

create function public.season_xp(p_user uuid, p_season int) returns int language sql stable security definer set search_path = public as
$$ select coalesce(sum(r.xp_gain), 0)::int from public.rounds r join public.seasons s on s.id = p_season
   where r.user_id = p_user and r.status = 'scored' and r.finished_at >= s.starts_at and r.finished_at < s.ends_at $$;

create function public.season_info() returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare v_user uuid := auth.uid(); s public.seasons; v_xp int;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  select * into s from public.seasons where id = public.current_season_id();
  if not found then
    return jsonb_build_object('active', false, 'next', (select jsonb_build_object('name', name, 'starts_at', starts_at) from public.seasons where starts_at > now() order by starts_at limit 1));
  end if;
  v_xp := public.season_xp(v_user, s.id);
  return jsonb_build_object('active', true, 'id', s.id, 'name', s.name, 'blurb', s.blurb, 'starts_at', s.starts_at, 'ends_at', s.ends_at, 'over', now() > s.ends_at,
    'grace_ends', s.ends_at + interval '3 days', 'xp_per_tier', s.xp_per_tier, 'pass_price', s.pass_price, 'xp', v_xp, 'tier', least(30, v_xp / s.xp_per_tier),
    'pass', exists (select 1 from public.season_pass where user_id = v_user and season_id = s.id),
    'tiers', (select jsonb_agg(jsonb_build_object('tier', t.tier, 'free', t.free_reward, 'premium', t.premium_reward,
        'free_claimed', exists (select 1 from public.season_claims c where c.user_id = v_user and c.season_id = s.id and c.tier = t.tier and c.track = 'free'),
        'premium_claimed', exists (select 1 from public.season_claims c where c.user_id = v_user and c.season_id = s.id and c.tier = t.tier and c.track = 'premium')) order by t.tier)
      from public.season_tiers t where t.season_id = s.id));
end;
$$;

create function public.buy_season_pass() returns jsonb language plpgsql security definer set search_path = public as
$$
declare v_user uuid := auth.uid(); s public.seasons; v_bal int;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 7));
  select * into s from public.seasons where id = public.current_season_id();
  if not found or now() > s.ends_at then raise exception 'no_season'; end if;
  if exists (select 1 from public.season_pass where user_id = v_user and season_id = s.id) then raise exception 'already_owned'; end if;
  select coalesce(sum(amount), 0) into v_bal from public.ledger where user_id = v_user;
  if v_bal < s.pass_price then raise exception 'insufficient_funds'; end if;
  if s.pass_price > 0 then insert into public.ledger (user_id, amount, reason, ref) values (v_user, -s.pass_price, 'Season pass: ' || s.name, 'season:' || s.id); end if;
  insert into public.season_pass (user_id, season_id) values (v_user, s.id);
  return jsonb_build_object('price', s.pass_price, 'balance', v_bal - s.pass_price);
end;
$$;

create function public.claim_season_tier(p_tier int, p_track text) returns jsonb language plpgsql security definer set search_path = public as
$$
declare v_user uuid := auth.uid(); s public.seasons; v_tier int; t public.season_tiers; v_reward jsonb;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  if p_track not in ('free', 'premium') then raise exception 'invalid_track'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 8));
  select * into s from public.seasons where id = public.current_season_id();
  if not found then raise exception 'no_season'; end if;
  v_tier := least(30, public.season_xp(v_user, s.id) / s.xp_per_tier);
  if p_tier < 1 or p_tier > v_tier then raise exception 'tier_not_reached'; end if;
  if p_track = 'premium' and not exists (select 1 from public.season_pass where user_id = v_user and season_id = s.id) then raise exception 'pass_required'; end if;
  select * into t from public.season_tiers where season_id = s.id and tier = p_tier;
  if not found then raise exception 'tier_not_found'; end if;
  insert into public.season_claims (user_id, season_id, tier, track) values (v_user, s.id, p_tier, p_track) on conflict do nothing;
  if not found then raise exception 'already_claimed'; end if;
  v_reward := case p_track when 'free' then t.free_reward else t.premium_reward end;
  return public.grant_reward_tx(v_user, v_reward, 'Season ' || s.name || ' tier ' || p_tier);
end;
$$;

create function public.admin_seasons() returns jsonb language plpgsql stable security definer set search_path = public as
$$ begin
  perform public.require_admin();
  return (select coalesce(jsonb_agg(to_jsonb(s) order by s.starts_at desc), '[]') from public.seasons s);
end $$;

create function public.admin_season_tiers(p_season int) returns jsonb language plpgsql stable security definer set search_path = public as
$$ begin
  perform public.require_admin();
  return (select coalesce(jsonb_agg(to_jsonb(t) order by t.tier), '[]') from public.season_tiers t where t.season_id = p_season);
end $$;

-- A new season starts as a copy of the latest one's rewards, so you only change what you want.
create function public.admin_save_season(p_id int, p_name text, p_blurb text, p_starts timestamptz, p_ends timestamptz, p_xp int, p_price int) returns int
language plpgsql security definer set search_path = public as
$$
declare v_id int := p_id; v_prev int;
begin
  perform public.require_admin();
  if p_ends <= p_starts or p_ends > p_starts + interval '120 days' then raise exception 'invalid_season: it lasts up to 120 days and must end after it starts'; end if;
  if exists (select 1 from public.seasons where id <> coalesce(p_id, -1) and starts_at < p_ends and ends_at > p_starts) then raise exception 'season_overlap'; end if;
  if v_id is null then
    select id into v_prev from public.seasons order by starts_at desc limit 1;
    v_id := coalesce((select max(id) from public.seasons), 0) + 1;
    insert into public.seasons (id, name, blurb, starts_at, ends_at, xp_per_tier, pass_price) values (v_id, trim(p_name), coalesce(p_blurb, ''), p_starts, p_ends, p_xp, p_price);
    if v_prev is not null then insert into public.season_tiers select v_id, tier, free_reward, premium_reward from public.season_tiers where season_id = v_prev; end if;
  else
    update public.seasons set name = trim(p_name), blurb = coalesce(p_blurb, ''), starts_at = p_starts, ends_at = p_ends, xp_per_tier = p_xp, pass_price = p_price where id = v_id;
    if not found then raise exception 'season_not_found'; end if;
  end if;
  perform public.admin_log('save_season', jsonb_build_object('id', v_id, 'name', p_name, 'starts', p_starts, 'ends', p_ends));
  return v_id;
end;
$$;

create function public.admin_save_tier(p_season int, p_tier int, p_free jsonb, p_premium jsonb) returns void language plpgsql security definer set search_path = public as
$$ begin
  perform public.require_admin();
  if not public.valid_reward(p_free) or not public.valid_reward(p_premium) then raise exception 'invalid_reward'; end if;
  insert into public.season_tiers (season_id, tier, free_reward, premium_reward) values (p_season, p_tier, p_free, p_premium)
    on conflict (season_id, tier) do update set free_reward = excluded.free_reward, premium_reward = excluded.premium_reward;
  perform public.admin_log('save_tier', jsonb_build_object('season', p_season, 'tier', p_tier, 'free', p_free, 'premium', p_premium));
end $$;


-- ======================= Season 1 and its exclusive rewards =======================
insert into public.shop_items (id, slot, key, grp, name, descr, price, min_level, meta, sort) values
  ('fr_neonnights', 'frame', 'neonnights', 'world', 'Neon Nights ring', 'Season 1 reward', 9999, 0, '{"reward":true}', 90),
  ('ball_nightpulse', 'ball', 'nightpulse', 'world', 'Night Pulse ball', 'Season 1 reward', 9999, 0, '{"reward":true,"bg":"#7c3aed","ink":"#ffffff"}', 91),
  ('t_nightowl', 'title', 'nightowl', 'world', 'Night Owl', 'Season 1 reward', 9999, 0, '{"reward":true}', 92),
  ('bd_nightcity', 'board', 'nightcity', 'world', 'Night City board', 'Season 1 reward', 9999, 0, '{"reward":true,"card":"#0b1020","cell":"#1b2340","ink":"#a5f3fc"}', 93);
insert into public.seasons (id, name, blurb, starts_at, ends_at, xp_per_tier, pass_price) values
  (1, 'Neon Nights', 'Six weeks of neon. Play to climb the track and unlock exclusive looks.', date_trunc('day', now()), date_trunc('day', now()) + interval '42 days', 200, 600);
insert into public.season_tiers (season_id, tier, free_reward, premium_reward) values
  (1, 1, '{"coins":23}', '{"coins":45}'),
  (1, 2, '{"coins":26}', '{"coins":50}'),
  (1, 3, '{"coins":29}', '{"item":"ball_nightpulse"}'),
  (1, 4, '{"coins":32}', '{"coins":60}'),
  (1, 5, '{"pack":1}', '{"coins":65}'),
  (1, 6, '{"coins":38}', '{"coins":70}'),
  (1, 7, '{"coins":41}', '{"coins":75}'),
  (1, 8, '{"coins":44}', '{"item":"t_nightowl"}'),
  (1, 9, '{"coins":47}', '{"coins":85}'),
  (1, 10, '{"booster":{"key":"time","qty":2}}', '{"coins":90}'),
  (1, 11, '{"coins":53}', '{"coins":95}'),
  (1, 12, '{"coins":56}', '{"coins":100}'),
  (1, 13, '{"coins":59}', '{"coins":105}'),
  (1, 14, '{"coins":62}', '{"coins":110}'),
  (1, 15, '{"pack":1}', '{"item":"bd_nightcity"}'),
  (1, 16, '{"coins":68}', '{"coins":120}'),
  (1, 17, '{"coins":71}', '{"coins":125}'),
  (1, 18, '{"coins":74}', '{"coins":130}'),
  (1, 19, '{"coins":77}', '{"coins":135}'),
  (1, 20, '{"booster":{"key":"slow","qty":2}}', '{"coins":140}'),
  (1, 21, '{"coins":83}', '{"coins":145}'),
  (1, 22, '{"coins":86}', '{"pack":2}'),
  (1, 23, '{"coins":89}', '{"coins":155}'),
  (1, 24, '{"coins":92}', '{"coins":160}'),
  (1, 25, '{"pack":1}', '{"coins":165}'),
  (1, 26, '{"coins":98}', '{"coins":170}'),
  (1, 27, '{"coins":101}', '{"coins":175}'),
  (1, 28, '{"coins":104}', '{"coins":180}'),
  (1, 29, '{"coins":107}', '{"coins":185}'),
  (1, 30, '{"item":"fr_neonnights"}', '{"pack":3}');

-- ======================= health check (now also checks Phase 7) =======================
create or replace function public.admin_health() returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare f text; out jsonb := '[]';
  fns text[] := array['admin_overview','admin_players','admin_player_detail','admin_adjust_coins','admin_set_banned','admin_save_config','admin_save_item',
    'admin_save_mission','admin_events','admin_save_event','admin_set_event_status','admin_delete_event','admin_finalize_event','admin_pay_league',
    'admin_save_stage','admin_journey_stats','admin_audit','event_leaderboard','league_board','matchmake_tx','settle_stage_tx','claim_album',
    'settle_daily_tx','create_challenge_tx','mastery','export_my_data','accept_terms','set_guide_seen','create_crew','crew_info','claim_crew_chest','admin_pay_crews','season_info','claim_season_tier','admin_save_liveop','admin_save_season','valid_reward'];
  tbls text[] := array['events','matches','match_queue','league_payouts','worlds','stages','stamps','user_stages','daily_boards','challenges','mastery_tiers','liveops','crews','seasons','season_tiers'];
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

-- ======================= permissions =======================
revoke all on public.liveops, public.crews, public.crew_members, public.crew_claims, public.crew_payouts, public.seasons, public.season_tiers, public.season_pass, public.season_claims from anon, authenticated;
grant select on public.liveops, public.seasons, public.season_tiers, public.season_pass, public.season_claims to authenticated;
revoke all on function public.create_crew(text, text, text, boolean), public.join_crew(uuid, text), public.leave_crew(), public.kick_crew_member(uuid), public.update_crew(text, boolean), public.crew_info(), public.search_crews(text), public.crew_board(date), public.claim_crew_chest(int), public.season_info(), public.buy_season_pass(), public.claim_season_tier(int, text), public.admin_liveops(), public.admin_save_liveop(uuid, text, text, text, timestamptz, timestamptz, numeric, int, boolean), public.admin_delete_liveop(uuid), public.admin_crews(), public.admin_rename_crew(uuid, text), public.admin_delete_crew(uuid), public.admin_pay_crews(date, int[]), public.admin_seasons(), public.admin_season_tiers(int), public.admin_save_season(int, text, text, timestamptz, timestamptz, int, int), public.admin_save_tier(int, int, jsonb, jsonb), public.member_week_points(uuid, uuid, date), public.crew_week_points(uuid, date), public.valid_reward(jsonb), public.grant_reward_tx(uuid, jsonb, text), public.current_season_id(), public.season_xp(uuid, int) from public, anon, authenticated;
grant execute on function public.create_crew(text, text, text, boolean), public.join_crew(uuid, text), public.leave_crew(), public.kick_crew_member(uuid), public.update_crew(text, boolean), public.crew_info(), public.search_crews(text), public.crew_board(date), public.claim_crew_chest(int), public.season_info(), public.buy_season_pass(), public.claim_season_tier(int, text), public.admin_liveops(), public.admin_save_liveop(uuid, text, text, text, timestamptz, timestamptz, numeric, int, boolean), public.admin_delete_liveop(uuid), public.admin_crews(), public.admin_rename_crew(uuid, text), public.admin_delete_crew(uuid), public.admin_pay_crews(date, int[]), public.admin_seasons(), public.admin_season_tiers(int), public.admin_save_season(int, text, text, timestamptz, timestamptz, int, int), public.admin_save_tier(int, int, jsonb, jsonb) to authenticated;
grant all on all tables in schema public to service_role;
