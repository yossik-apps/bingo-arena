-- Bingo Arena Phase 2: shop, boosters, daily quests, badges.
-- Players can call only the few functions below (they always act on auth.uid(), never on a user id sent by the app).

alter table public.profiles
  add column played int not null default 0,
  add column wins int not null default 0,
  add column equipped jsonb not null default '{"theme":"rose","style":"","board":"classic","ball":"gold","frame":"","title":""}';

create table public.shop_items (
  id text primary key,
  slot text not null check (slot in ('theme','style','board','ball','frame','title','boost','bundle')),
  key text not null,
  grp text not null,
  name text not null,
  descr text not null default '',
  price int not null check (price >= 0),
  min_level int not null default 0,
  meta jsonb not null default '{}',
  sort int not null default 0,
  active boolean not null default true
);
create table public.inventory (
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id text not null references public.shop_items (id),
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
create table public.user_boosters (
  user_id uuid not null references public.profiles (id) on delete cascade,
  key text not null check (key in ('slow','win','time','hint')),
  qty int not null default 0 check (qty >= 0),
  primary key (user_id, key)
);
create table public.mission_defs (
  id text primary key, label text not null, counter text not null,
  goal int not null check (goal > 0), reward int not null check (reward >= 0), active boolean not null default true
);
create table public.daily_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  counters jsonb not null default '{}',
  claimed text[] not null default '{}',
  primary key (user_id, day)
);
create table public.ach_defs (id text primary key, label text not null);
create table public.user_achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  ach_id text not null references public.ach_defs (id),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, ach_id)
);

-- ---------- catalog ----------
insert into public.shop_items (id, slot, key, grp, name, descr, price, min_level, meta, sort) values
 ('th_rose','theme','rose','dauber','Rose','Dauber color',0,0,'{"color":"#d6336c"}',1),
 ('th_violet','theme','violet','dauber','Violet','Dauber color',80,0,'{"color":"#6d28d9"}',2),
 ('th_orange','theme','orange','dauber','Sunset','Dauber color',120,0,'{"color":"#c2410c"}',3),
 ('th_green','theme','green','dauber','Emerald','Dauber color',150,0,'{"color":"#0f7a45"}',4),
 ('th_ocean','theme','ocean','dauber','Ocean','Dauber color',100,0,'{"color":"#0369a1"}',5),
 ('th_graphite','theme','graphite','dauber','Graphite','Dauber color',120,0,'{"color":"#334155"}',6),
 ('th_berry','theme','berry','dauber','Berry','Dauber color',180,0,'{"color":"#9d174d"}',7),
 ('th_gold','theme','gold','dauber','Gold','Dauber color',220,0,'{"color":"#a16207"}',8),
 ('ds_round','style','round','dauber','Round stamp','Circular daubs',90,0,'{"style":{"borderRadius":"50%"}}',10),
 ('ds_ring','style','ring','dauber','Ring stamp','Daubs with an inner ring',110,0,'{"style":{"boxShadow":"inset 0 0 0 5px rgba(255,255,255,.55)"}}',11),
 ('ds_bevel','style','bevel','dauber','Chunky stamp','Raised, bevelled daubs',130,0,'{"style":{"boxShadow":"inset 0 -6px 0 rgba(0,0,0,.25)"}}',12),
 ('bd_classic','board','classic','board','Classic','Default board',0,0,'{"card":"var(--panel)","cell":"var(--cell)","ink":"var(--ink)"}',20),
 ('bd_midnight','board','midnight','board','Midnight','Deep indigo board',120,0,'{"card":"#1e1b4b","cell":"#312e81","ink":"#ffffff"}',21),
 ('bd_paper','board','paper','board','Paper hall','Warm bingo-hall paper',100,0,'{"card":"#fef9c3","cell":"#fef3c7","ink":"#422006"}',22),
 ('bd_mint','board','mint','board','Mint','Fresh green board',100,0,'{"card":"#a7f3d0","cell":"#d1fae5","ink":"#064e3b"}',23),
 ('bd_neon','board','neon','board','Neon night','Glowing cyan on black',220,6,'{"card":"#020617","cell":"#0f172a","ink":"#67e8f9"}',24),
 ('ball_gold','ball','gold','ball','Gold','Default ball',0,0,'{"bg":"#f5b50a","ink":"#221800"}',30),
 ('ball_ruby','ball','ruby','ball','Ruby','Deep red ball',80,0,'{"bg":"#be123c","ink":"#ffffff"}',31),
 ('ball_ocean','ball','ocean','ball','Ocean','Blue ball',80,0,'{"bg":"#0369a1","ink":"#ffffff"}',32),
 ('ball_mono','ball','mono','ball','Slate','Dark ball',100,0,'{"bg":"#1e293b","ink":"#ffffff"}',33),
 ('ball_pearl','ball','pearl','ball','Pearl','Pale ball',120,0,'{"bg":"#f1f5f9","ink":"#1e1b3a"}',34),
 ('fr_gold','frame','gold','frame','Gold ring','Avatar frame',100,0,'{}',40),
 ('fr_violet','frame','violet','frame','Violet ring','Avatar frame',100,0,'{}',41),
 ('fr_rainbow','frame','rainbow','frame','Rainbow ring','Avatar frame',250,5,'{}',42),
 ('fr_ember','frame','ember','frame','Ember ring','Avatar frame',400,8,'{}',43),
 ('t_eye','title','eye','title','Sharp Eye','Title under your name',60,0,'{}',50),
 ('t_line','title','line','title','Line Hunter','Title under your name',80,0,'{}',51),
 ('t_combo','title','combo','title','Combo King','Title under your name',150,4,'{}',52),
 ('t_grand','title','grand','title','Grand Dauber','Title under your name',300,8,'{}',53),
 ('b_slow','boost','slow','boost','Slow motion','Numbers 30% slower for one round',30,0,'{"ic":"clock"}',60),
 ('b_win','boost','win','boost','Extra window','One more number stays daubable',30,0,'{"ic":"quest"}',61),
 ('b_time','boost','time','boost','Extra time','+15 seconds',25,0,'{"ic":"zap"}',62),
 ('b_hint','boost','hint','boost','Hint glow','Highlights matching squares',20,0,'{"ic":"eye"}',63),
 ('bundle_starter','bundle','starter','boost','Starter pack','Midnight board, Ocean dauber, 2 of each booster',220,0,'{"ic":"gift"}',70);

insert into public.mission_defs (id, label, counter, goal, reward) values
 ('play3','Play 3 rounds','played',3,25), ('win1','Win a round','wins',1,30), ('daub25','Daub 25 numbers','daubs',25,30),
 ('line3','Complete 3 lines','lines',3,35), ('adv','Play a Medium or Hard round','adv',1,30), ('combo','Reach a x3 combo','combo',1,30);
insert into public.ach_defs (id, label) values
 ('first','First win'), ('ten','Play 10 rounds'), ('hard','Beat the ghost on Hard'),
 ('perfect','Perfect round (no misses, no wrong taps)'), ('lines3','3 lines in one round'), ('lv5','Reach level 5');

-- ---------- public helper functions ----------
create function public.daily_deals(p_day date default current_date) returns text[]
language sql stable security definer set search_path = public as
$$ select coalesce(array_agg(id order by h), '{}') from (
     select id, md5(p_day::text || id) as h from public.shop_items
     where active and price > 0 and slot not in ('boost','bundle') order by md5(p_day::text || id) limit 3) s $$;

create function public.todays_missions(p_day date default current_date) returns setof public.mission_defs
language sql stable security definer set search_path = public as
$$ select * from public.mission_defs where active order by md5(p_day::text || id) limit 3 $$;

-- ---------- player actions ----------
create function public.buy_item(p_item text) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare v_user uuid := auth.uid(); it public.shop_items; v_price int; v_bal int; v_lvl int; v_banned boolean;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
  select * into it from public.shop_items where id = p_item and active;
  if not found then raise exception 'item_not_found'; end if;
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

create function public.equip_item(p_item text, p_on boolean default true) returns void
language plpgsql security definer set search_path = public as
$$
declare v_user uuid := auth.uid(); it public.shop_items;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  select * into it from public.shop_items where id = p_item and active;
  if not found or it.slot in ('boost','bundle') then raise exception 'item_not_found'; end if;
  if it.price > 0 and not exists (select 1 from public.inventory where user_id = v_user and item_id = it.id) then
    raise exception 'not_owned';
  end if;
  if p_on then
    update public.profiles set equipped = jsonb_set(equipped, array[it.slot], to_jsonb(it.key)) where id = v_user;
  elsif it.slot in ('style','frame','title') then
    update public.profiles set equipped = jsonb_set(equipped, array[it.slot], '""'::jsonb) where id = v_user;
  end if;
end;
$$;

create function public.claim_mission(p_id text) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare v_user uuid := auth.uid(); m public.mission_defs; v_prog jsonb; v_claimed text[];
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 2));
  select * into m from public.mission_defs where id = p_id and active;
  if not found or not exists (select 1 from public.todays_missions() t where t.id = p_id) then raise exception 'not_todays_mission'; end if;
  select counters, claimed into v_prog, v_claimed from public.daily_progress where user_id = v_user and day = current_date;
  if not found then raise exception 'not_complete'; end if;
  if p_id = any (v_claimed) then raise exception 'already_claimed'; end if;
  if coalesce((v_prog ->> m.counter)::int, 0) < m.goal then raise exception 'not_complete'; end if;
  update public.daily_progress set claimed = array_append(claimed, p_id) where user_id = v_user and day = current_date;
  insert into public.ledger (user_id, amount, reason, ref) values (v_user, m.reward, 'Quest: ' || m.label, 'quest:' || p_id);
  update public.profiles set xp = xp + 15 where id = v_user;
  return jsonb_build_object('reward', m.reward);
end;
$$;

-- ---------- server-only functions (replaced) ----------
drop function public.start_round_tx(uuid, text, text, int, bigint, jsonb);
create function public.start_round_tx(p_user uuid, p_mode text, p_level text, p_fee int, p_seed bigint, p_params jsonb, p_boosters text[] default '{}')
returns uuid language plpgsql security definer set search_path = public as
$$
declare v_id uuid; v_bal int; k text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  update public.rounds set status = 'rejected'
    where user_id = p_user and status = 'active'
      and started_at + (((params ->> 'total')::int + 90) * interval '1 second') < now();
  if exists (select 1 from public.rounds where user_id = p_user and status = 'active') then
    raise exception 'round_in_progress';
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
  insert into public.rounds (user_id, mode, level, seed, fee, params) values (p_user, p_mode, p_level, p_seed, p_fee, p_params) returning id into v_id;
  return v_id;
end;
$$;

drop function public.finish_round(uuid, int, int, int, jsonb);
create function public.finish_round(p_round uuid, p_score int, p_prize int, p_xp int, p_result jsonb)
returns jsonb language plpgsql security definer set search_path = public as
$$
declare
  v_user uuid; v_level text;
  v_win boolean := coalesce((p_result ->> 'win')::boolean, false);
  v_daubs int := coalesce((p_result ->> 'daubs')::int, 0);
  v_wrong int := coalesce((p_result ->> 'wrong')::int, 0);
  v_late int := coalesce((p_result ->> 'late')::int, 0);
  v_lines int := coalesce((p_result ->> 'lines')::int, 0);
  v_mult int := coalesce((p_result ->> 'maxMult')::int, 1);
  v_played int; v_wins int; v_xp int; v_new text[] := '{}'; a text;
begin
  update public.rounds set status = 'scored', finished_at = now(), score = p_score, prize = p_prize, xp_gain = p_xp, result = p_result
    where id = p_round and status = 'active' returning user_id, level into v_user, v_level;
  if v_user is null then return jsonb_build_object('ok', false); end if;
  if p_prize > 0 then
    insert into public.ledger (user_id, amount, reason, ref) values (v_user, p_prize, 'Prize', 'round:' || p_round);
  end if;
  update public.profiles set xp = xp + p_xp, played = played + 1, wins = wins + case when v_win then 1 else 0 end, last_seen = now()
    where id = v_user returning played, wins, xp into v_played, v_wins, v_xp;

  insert into public.daily_progress (user_id, day) values (v_user, current_date) on conflict do nothing;
  update public.daily_progress set counters = counters || jsonb_build_object(
      'played', coalesce((counters ->> 'played')::int, 0) + 1,
      'wins',   coalesce((counters ->> 'wins')::int, 0) + case when v_win then 1 else 0 end,
      'daubs',  coalesce((counters ->> 'daubs')::int, 0) + v_daubs,
      'lines',  coalesce((counters ->> 'lines')::int, 0) + v_lines,
      'adv',    coalesce((counters ->> 'adv')::int, 0) + case when v_level <> 'beginner' then 1 else 0 end,
      'combo',  coalesce((counters ->> 'combo')::int, 0) + case when v_mult >= 3 then 1 else 0 end)
    where user_id = v_user and day = current_date;

  for a in select unnest(array[
      case when v_wins >= 1 then 'first' end,
      case when v_played >= 10 then 'ten' end,
      case when v_win and v_level = 'hard' then 'hard' end,
      case when v_daubs >= 5 and v_wrong + v_late = 0 then 'perfect' end,
      case when v_lines >= 3 then 'lines3' end,
      case when floor(sqrt(v_xp / 40.0)) + 1 >= 5 then 'lv5' end]) loop
    if a is not null then
      insert into public.user_achievements (user_id, ach_id) values (v_user, a) on conflict do nothing;
      if found then v_new := array_append(v_new, a); end if;
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'ach', to_jsonb(v_new));
end;
$$;

-- ---------- security ----------
alter table public.shop_items enable row level security;
alter table public.inventory enable row level security;
alter table public.user_boosters enable row level security;
alter table public.mission_defs enable row level security;
alter table public.daily_progress enable row level security;
alter table public.ach_defs enable row level security;
alter table public.user_achievements enable row level security;

create policy shop_read on public.shop_items for select to anon, authenticated using (true);
create policy mission_defs_read on public.mission_defs for select to authenticated using (true);
create policy ach_defs_read on public.ach_defs for select to authenticated using (true);
create policy inventory_read on public.inventory for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy boosters_read on public.user_boosters for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy progress_read on public.daily_progress for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy userach_read on public.user_achievements for select to authenticated using (user_id = auth.uid() or public.is_admin());

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
grant select on public.game_config, public.shop_items to anon, authenticated;
grant update (data, updated_at) on public.game_config to authenticated;
grant select on public.profiles, public.ledger, public.rounds, public.wallet, public.audit_log,
  public.inventory, public.user_boosters, public.mission_defs, public.daily_progress, public.ach_defs, public.user_achievements to authenticated;
grant execute on function public.is_admin(), public.buy_item(text), public.equip_item(text, boolean), public.claim_mission(text),
  public.daily_deals(date), public.todays_missions(date) to authenticated;
grant execute on function public.start_round_tx(uuid, text, text, int, bigint, jsonb, text[]), public.finish_round(uuid, int, int, int, jsonb),
  public.claim_daily(uuid) to service_role;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
