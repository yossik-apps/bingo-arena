-- Bingo Arena Phase 5: Journey (worlds and stages), Album (stamps), streak packs, journey tuning for the admin.
-- Design rules: every reward is EARNED by playing (no paid random packs), odds are shown to players,
-- an Epic stamp is guaranteed within 10 packs, and rewards are given once per achievement so replays cannot farm coins.

alter table public.rounds drop constraint rounds_mode_check;
alter table public.rounds add constraint rounds_mode_check check (mode in ('solo', 'ghost', 'pvp', 'tour', 'stage'));
alter table public.rounds add column stage_id text;

create table public.worlds (
  id int primary key, name text not null, blurb text not null default '',
  stars_needed int not null default 0, reward_item text, reward_coins int not null default 200, sort int not null default 0
);
create table public.stages (
  id text primary key, world int not null references public.worlds (id), idx int not null, name text not null,
  level text not null, seed bigint not null, mods jsonb not null default '{}',
  s1 int not null, s2 int not null, s3 int not null, reward_coins int not null default 20,
  unique (world, idx), check (s1 >= 0 and s1 <= s2 and s2 <= s3)
);
alter table public.rounds add constraint rounds_stage_fk foreign key (stage_id) references public.stages (id) on delete set null;
create table public.user_stages (
  user_id uuid not null references public.profiles (id) on delete cascade, stage_id text not null references public.stages (id),
  best_score int not null default 0, stars int not null default 0, attempts int not null default 0, first_clear_at timestamptz,
  primary key (user_id, stage_id)
);
create table public.stamps (
  id text primary key, world int not null references public.worlds (id), name text not null,
  rarity text not null check (rarity in ('common', 'rare', 'epic')), sort int not null default 0
);
create table public.user_stamps (
  user_id uuid not null references public.profiles (id) on delete cascade, stamp_id text not null references public.stamps (id),
  qty int not null default 1, first_at timestamptz not null default now(), primary key (user_id, stamp_id)
);
create table public.user_collect (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  dust int not null default 0 check (dust >= 0), packs_since_epic int not null default 0, packs_opened int not null default 0
);
create table public.album_claims (
  user_id uuid not null references public.profiles (id) on delete cascade, world int not null references public.worlds (id),
  claimed_at timestamptz not null default now(), primary key (user_id, world)
);

alter table public.worlds enable row level security;
alter table public.stages enable row level security;
alter table public.user_stages enable row level security;
alter table public.stamps enable row level security;
alter table public.user_stamps enable row level security;
alter table public.user_collect enable row level security;
alter table public.album_claims enable row level security;
create policy worlds_read on public.worlds for select to authenticated using (true);
create policy stages_read on public.stages for select to authenticated using (true);
create policy stamps_read on public.stamps for select to authenticated using (true);
create policy user_stages_read on public.user_stages for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy user_stamps_read on public.user_stamps for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy user_collect_read on public.user_collect for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy album_claims_read on public.album_claims for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- ---------- helpers ----------
create function public.stage_unlocked(p_user uuid, p_stage text) returns boolean
language plpgsql stable security definer set search_path = public as
$$
declare s public.stages; w public.worlds; v_total int; v_prev int;
begin
  select * into s from public.stages where id = p_stage;
  if not found then return false; end if;
  select * into w from public.worlds where id = s.world;
  select coalesce(sum(stars), 0) into v_total from public.user_stages where user_id = p_user;
  if v_total < w.stars_needed then return false; end if;
  if s.idx > 1 then
    select coalesce(max(us.stars), 0) into v_prev from public.user_stages us join public.stages st on st.id = us.stage_id
      where us.user_id = p_user and st.world = s.world and st.idx = s.idx - 1;
    if v_prev < 1 then return false; end if;
  end if;
  return true;
end;
$$;

create function public.current_world(p_user uuid) returns int language sql stable security definer set search_path = public as
$$ select coalesce(max(st.world), 1) from public.user_stages us join public.stages st on st.id = us.stage_id where us.user_id = p_user and us.stars >= 1 $$;

-- Opens one stamp pack: 70% common, 25% rare, 5% epic, and an epic is guaranteed after 9 packs without one.
-- Duplicates turn into dust (5 / 15 / 40) that can craft any missing stamp.
create function public.open_pack_tx(p_user uuid, p_world int) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare c public.user_collect; v_rar text; v_stamp public.stamps; v_new boolean; v_dust int := 0; v_roll int;
begin
  insert into public.user_collect (user_id) values (p_user) on conflict do nothing;
  select * into c from public.user_collect where user_id = p_user for update;
  v_roll := 1 + floor(random() * 100)::int;
  v_rar := case when c.packs_since_epic >= 9 then 'epic' when v_roll <= 5 then 'epic' when v_roll <= 30 then 'rare' else 'common' end;
  select * into v_stamp from public.stamps where world = p_world and rarity = v_rar order by random() limit 1;
  if not found then select * into v_stamp from public.stamps where world = p_world order by random() limit 1; end if;
  v_new := not exists (select 1 from public.user_stamps where user_id = p_user and stamp_id = v_stamp.id);
  if v_new then
    insert into public.user_stamps (user_id, stamp_id) values (p_user, v_stamp.id);
  else
    update public.user_stamps set qty = qty + 1 where user_id = p_user and stamp_id = v_stamp.id;
    v_dust := case v_stamp.rarity when 'epic' then 40 when 'rare' then 15 else 5 end;
  end if;
  update public.user_collect set dust = dust + v_dust, packs_opened = packs_opened + 1,
    packs_since_epic = case when v_stamp.rarity = 'epic' then 0 else packs_since_epic + 1 end where user_id = p_user;
  return jsonb_build_object('stamp_id', v_stamp.id, 'name', v_stamp.name, 'rarity', v_stamp.rarity, 'world', v_stamp.world, 'is_new', v_new, 'dust', v_dust);
end;
$$;

-- Scores a finished stage round: stars, first-clear rewards, packs. Safe to call twice (second call does nothing).
create function public.settle_stage_tx(p_round uuid) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare r record; s public.stages; v_old int; v_now int; v_new int; v_coins int := 0; v_packs jsonb := '[]'; v_total int; v_cleared int;
begin
  update public.rounds set result = coalesce(result, '{}'::jsonb) || '{"stage_settled":true}'::jsonb
    where id = p_round and status = 'scored' and stage_id is not null and not coalesce(result ? 'stage_settled', false)
    returning user_id, score, stage_id into r;
  if r.user_id is null then return jsonb_build_object('ok', false); end if;
  select * into s from public.stages where id = r.stage_id;
  select stars into v_old from public.user_stages where user_id = r.user_id and stage_id = s.id;
  v_old := coalesce(v_old, 0);
  v_now := case when r.score >= s.s3 then 3 when r.score >= s.s2 then 2 when r.score >= s.s1 then 1 else 0 end;
  v_new := greatest(v_old, v_now);
  insert into public.user_stages (user_id, stage_id, best_score, stars, attempts, first_clear_at)
    values (r.user_id, s.id, r.score, v_new, 1, case when v_new >= 1 then now() end)
    on conflict (user_id, stage_id) do update set best_score = greatest(public.user_stages.best_score, excluded.best_score), stars = v_new,
      attempts = public.user_stages.attempts + 1, first_clear_at = coalesce(public.user_stages.first_clear_at, case when v_new >= 1 then now() end);

  if v_old = 0 and v_new >= 1 then
    v_coins := s.reward_coins + 10 * (v_new - 1);
    v_packs := v_packs || public.open_pack_tx(r.user_id, s.world);
  elsif v_new > v_old then
    v_coins := 10 * (v_new - v_old);
  end if;
  if v_old < 3 and v_new = 3 and v_old > 0 then v_packs := v_packs || public.open_pack_tx(r.user_id, s.world); end if;
  if v_old = 0 and v_new = 3 then v_packs := v_packs || public.open_pack_tx(r.user_id, s.world); end if;
  if v_coins > 0 then insert into public.ledger (user_id, amount, reason, ref) values (r.user_id, v_coins, 'Journey: ' || s.name, 'stage:' || s.id); end if;

  select count(*) filter (where us.stars >= 1) into v_cleared from public.stages st
    left join public.user_stages us on us.stage_id = st.id and us.user_id = r.user_id where st.world = s.world;
  select coalesce(sum(stars), 0) into v_total from public.user_stages where user_id = r.user_id;
  return jsonb_build_object('ok', true, 'stage', s.id, 'stage_name', s.name, 'stars', v_now, 'best_stars', v_new, 'new_stars', v_new - v_old,
    'coins', v_coins, 'packs', v_packs, 'world', s.world, 'world_cleared', v_cleared = (select count(*) from public.stages where world = s.world), 'total_stars', v_total);
end;
$$;

-- ---------- player actions ----------
create function public.craft_stamp(p_stamp text) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare v_user uuid := auth.uid(); st public.stamps; v_cost int; v_dust int;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 3));
  select * into st from public.stamps where id = p_stamp;
  if not found then raise exception 'item_not_found'; end if;
  if exists (select 1 from public.user_stamps where user_id = v_user and stamp_id = p_stamp) then raise exception 'already_owned'; end if;
  v_cost := case st.rarity when 'epic' then 240 when 'rare' then 90 else 30 end;
  select dust into v_dust from public.user_collect where user_id = v_user;
  if coalesce(v_dust, 0) < v_cost then raise exception 'not_enough_dust'; end if;
  update public.user_collect set dust = dust - v_cost where user_id = v_user;
  insert into public.user_stamps (user_id, stamp_id) values (v_user, p_stamp);
  return jsonb_build_object('cost', v_cost, 'dust', v_dust - v_cost);
end;
$$;

create function public.claim_album(p_world int) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare v_user uuid := auth.uid(); w public.worlds; v_have int; v_all int;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 4));
  select * into w from public.worlds where id = p_world;
  if not found then raise exception 'item_not_found'; end if;
  select count(*) into v_all from public.stamps where world = p_world;
  select count(*) into v_have from public.user_stamps us join public.stamps s on s.id = us.stamp_id where us.user_id = v_user and s.world = p_world;
  if v_have < v_all then raise exception 'album_incomplete'; end if;
  insert into public.album_claims (user_id, world) values (v_user, p_world) on conflict do nothing;
  if not found then raise exception 'already_claimed'; end if;
  if w.reward_coins > 0 then insert into public.ledger (user_id, amount, reason, ref) values (v_user, w.reward_coins, 'Album complete: ' || w.name, 'album:' || p_world); end if;
  if w.reward_item is not null then insert into public.inventory (user_id, item_id) values (v_user, w.reward_item) on conflict do nothing; end if;
  return jsonb_build_object('coins', w.reward_coins, 'item', w.reward_item);
end;
$$;

-- Reward-only items cannot be bought.
create or replace function public.buy_item(p_item text) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare v_user uuid := auth.uid(); it public.shop_items; v_price int; v_bal int; v_lvl int; v_banned boolean;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
  select * into it from public.shop_items where id = p_item and active;
  if not found then raise exception 'item_not_found'; end if;
  if coalesce(it.meta ->> 'reward', 'false') = 'true' then raise exception 'not_for_sale'; end if;
  select banned, floor(sqrt(xp / 40.0))::int + 1 into v_banned, v_lvl from public.profiles where id = v_user;
  if v_banned then raise exception 'account_suspended'; end if;
  if v_lvl < it.min_level then raise exception 'level_too_low'; end if;
  if it.slot <> 'boost' and (it.price = 0 or exists (select 1 from public.inventory where user_id = v_user and item_id = it.id)) then
    raise exception 'already_owned';
  end if;
  v_price := case when it.id = any (public.daily_deals()) then round(it.price * 0.75)::int else it.price end;
  select coalesce(sum(amount), 0) into v_bal from public.ledger where user_id = v_user;
  if v_bal < v_price then raise exception 'insufficient_funds'; end if;
  insert into public.ledger (user_id, amount, reason, ref) values (v_user, -v_price, 'Bought ' || it.name, 'shop:' || it.id);
  if it.slot = 'boost' then
    insert into public.user_boosters (user_id, key, qty) values (v_user, it.key, 1)
      on conflict (user_id, key) do update set qty = public.user_boosters.qty + 1;
  elsif it.slot = 'bundle' then
    insert into public.inventory (user_id, item_id) values (v_user, it.id), (v_user, 'bd_midnight'), (v_user, 'th_ocean') on conflict do nothing;
    insert into public.user_boosters (user_id, key, qty) select v_user, k, 2 from unnest(array['slow','win','time','hint']) k
      on conflict (user_id, key) do update set qty = public.user_boosters.qty + 2;
  else
    insert into public.inventory (user_id, item_id) values (v_user, it.id);
    update public.profiles set equipped = jsonb_set(equipped, array[it.slot], to_jsonb(it.key)) where id = v_user;
  end if;
  return jsonb_build_object('price', v_price, 'balance', v_bal - v_price);
end;
$$;

-- Day 7, 14, 21... of a login streak also gives one stamp pack.
create or replace function public.claim_daily(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare v_last date; v_streak int; v_new int; v_bonus int; v_base int; v_pack jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 1));
  select last_login, streak into v_last, v_streak from public.profiles where id = p_user;
  if v_last = current_date then return jsonb_build_object('claimed', false, 'streak', v_streak, 'bonus', 0); end if;
  v_new := case when v_last = current_date - 1 then v_streak + 1 else 1 end;
  select coalesce((data -> 'g' ->> 'login')::int, 10) into v_base from public.game_config;
  v_bonus := v_base * least(v_new, 7);
  update public.profiles set last_login = current_date, streak = v_new, last_seen = now() where id = p_user;
  if v_bonus > 0 then insert into public.ledger (user_id, amount, reason) values (p_user, v_bonus, 'Daily login bonus'); end if;
  if v_new % 7 = 0 then v_pack := public.open_pack_tx(p_user, public.current_world(p_user)); end if;
  return jsonb_build_object('claimed', true, 'streak', v_new, 'bonus', v_bonus, 'pack', v_pack);
end;
$$;

-- ---------- admin: tune the journey ----------
create function public.admin_save_stage(p_id text, p_s1 int, p_s2 int, p_s3 int, p_coins int) returns void
language plpgsql security definer set search_path = public as
$$
begin
  perform public.require_admin();
  if p_s1 < 0 or p_s1 > p_s2 or p_s2 > p_s3 or p_s3 > 100000 or p_coins < 0 or p_coins > 10000 then raise exception 'invalid_stage'; end if;
  update public.stages set s1 = p_s1, s2 = p_s2, s3 = p_s3, reward_coins = p_coins where id = p_id;
  if not found then raise exception 'item_not_found'; end if;
  perform public.admin_log('save_stage', jsonb_build_object('id', p_id, 's1', p_s1, 's2', p_s2, 's3', p_s3, 'coins', p_coins));
end;
$$;

create function public.admin_journey_stats() returns jsonb language plpgsql stable security definer set search_path = public as
$$
begin
  perform public.require_admin();
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.id), '[]') from (
    select st.id, st.world, st.idx, st.name, st.level, st.mods ->> 'label' as label, st.s1, st.s2, st.s3, st.reward_coins,
           count(us.user_id) as players, count(us.user_id) filter (where us.stars >= 1) as cleared,
           count(us.user_id) filter (where us.stars = 3) as three_star,
           coalesce(round(avg(us.attempts), 1), 0) as avg_attempts
    from public.stages st left join public.user_stages us on us.stage_id = st.id group by st.id) x);
end;
$$;

-- ---------- permissions ----------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
grant select on public.game_config, public.shop_items to anon, authenticated;
grant select on public.profiles, public.ledger, public.rounds, public.wallet, public.audit_log, public.inventory, public.user_boosters,
  public.mission_defs, public.daily_progress, public.ach_defs, public.user_achievements, public.events,
  public.match_queue, public.matches, public.match_players, public.league_payouts,
  public.worlds, public.stamps, public.user_stages, public.user_stamps, public.user_collect, public.album_claims to authenticated;
-- the stage seed stays secret; players only see the goals and rules
grant select (id, world, idx, name, level, mods, s1, s2, s3, reward_coins) on public.stages to authenticated;
grant execute on function public.is_admin(), public.buy_item(text), public.equip_item(text, boolean), public.claim_mission(text),
  public.daily_deals(date), public.todays_missions(date), public.event_leaderboard(uuid),
  public.confirm_adult(), public.my_match(), public.cancel_queue(), public.match_result(uuid), public.league_board(date), public.week_start(timestamptz),
  public.craft_stamp(text), public.claim_album(int),
  public.admin_overview(), public.admin_players(text, int, int), public.admin_player_detail(uuid), public.admin_adjust_coins(uuid, int, text),
  public.admin_set_banned(uuid, boolean), public.admin_save_config(jsonb), public.admin_save_item(text, text, text, int, int, boolean),
  public.admin_save_mission(text, text, int, int, boolean), public.admin_events(),
  public.admin_save_event(uuid, text, text, text, int, int, timestamptz, timestamptz, int, int[]),
  public.admin_set_event_status(uuid, text), public.admin_delete_event(uuid), public.admin_finalize_event(uuid),
  public.admin_pay_league(date, int[]), public.admin_save_stage(text, int, int, int, int), public.admin_journey_stats() to authenticated;
grant execute on function public.start_round_tx(uuid, text, text, int, bigint, jsonb, text[], uuid), public.finish_round(uuid, int, int, int, jsonb),
  public.claim_daily(uuid), public.matchmake_tx(uuid, text, jsonb, bigint), public.settle_match_tx(uuid),
  public.stage_unlocked(uuid, text), public.current_world(uuid), public.open_pack_tx(uuid, int), public.settle_stage_tx(uuid) to service_role;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
