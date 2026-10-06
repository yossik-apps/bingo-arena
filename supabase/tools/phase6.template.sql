-- Bingo Arena Phase 6: Daily Challenge, Streak Shield, Mastery ranks, Beat-my-run challenges, privacy tools (export, terms version).

alter table public.profiles
  add column shields int not null default 0 check (shields between 0 and 2),
  add column daily_done int not null default 0,
  add column terms_version text;
update public.profiles set terms_version = 'legacy' where adult_confirmed;

alter table public.rounds drop constraint rounds_mode_check;
alter table public.rounds add constraint rounds_mode_check check (mode in ('solo', 'ghost', 'pvp', 'tour', 'stage', 'daily', 'duel'));
alter table public.rounds add column daily_day date, add column challenge_code text;
-- one try per player per day, and one try per player per challenge
create unique index rounds_daily_once on public.rounds (user_id, daily_day) where daily_day is not null;
create unique index rounds_duel_once on public.rounds (user_id, challenge_code) where challenge_code is not null;

create table public.daily_boards (
  day date primary key, level text not null, seed bigint not null, mods jsonb not null default '{}',
  g1 int not null, g2 int not null, g3 int not null, created_at timestamptz not null default now()
);
create table public.challenges (
  code text primary key, creator uuid not null references public.profiles (id) on delete cascade,
  round_id uuid unique references public.rounds (id) on delete set null,
  level text not null, seed bigint not null, params jsonb not null, score int not null,
  created_at timestamptz not null default now(), expires_at timestamptz not null, plays int not null default 0
);
create table public.challenge_plays (
  code text not null references public.challenges (code) on delete cascade, user_id uuid not null references public.profiles (id) on delete cascade,
  score int not null, won boolean not null, played_at timestamptz not null default now(), primary key (code, user_id)
);
create table public.mastery_tiers (
  level text not null, tier int not null, name text not null, min_score int not null, primary key (level, tier)
);
alter table public.daily_boards enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_plays enable row level security;
alter table public.mastery_tiers enable row level security;
create policy daily_read on public.daily_boards for select to authenticated using (true);
create policy challenges_read on public.challenges for select to authenticated using (creator = auth.uid());
create policy plays_read on public.challenge_plays for select to authenticated using (user_id = auth.uid());
create policy mastery_read on public.mastery_tiers for select to authenticated using (true);

-- New email sign-ups record which terms version they accepted (social sign-ups accept on the first screen)
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
  insert into public.profiles (id, display_name, adult_confirmed, terms_at, terms_version)
    values (new.id, v_name, v_adult, case when v_adult then now() end, case when v_adult then left(new.raw_user_meta_data ->> 'terms_version', 20) end);
  select coalesce((data -> 'g' ->> 'welcome')::int, 0) into v_bonus from public.game_config;
  if v_bonus > 0 then insert into public.ledger (user_id, amount, reason) values (new.id, v_bonus, 'Registration bonus'); end if;
  return new;
end;
$$;

-- ---------- Daily Challenge ----------
create function public.ensure_daily_tx(p_day date, p_level text, p_seed bigint, p_mods jsonb, p_g1 int, p_g2 int, p_g3 int) returns void
language sql security definer set search_path = public as
$$ insert into public.daily_boards (day, level, seed, mods, g1, g2, g3) values (p_day, p_level, p_seed, p_mods, p_g1, p_g2, p_g3) on conflict (day) do nothing $$;

create function public.daily_leaderboard(p_day date default current_date) returns table (rank int, user_id uuid, display_name text, score int)
language sql stable security definer set search_path = public as
$$
  select (row_number() over (order by r.score desc, r.finished_at asc))::int, r.user_id, p.display_name, r.score
  from public.rounds r join public.profiles p on p.id = r.user_id
  where r.mode = 'daily' and r.daily_day = p_day and r.status = 'scored' and not p.banned
  order by 1 limit 50
$$;

create function public.settle_daily_tx(p_round uuid) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare r record; b public.daily_boards; v_tier int; v_coins int; v_pack jsonb; v_done int; v_sh int; v_shield boolean; v_rank int;
begin
  update public.rounds set result = coalesce(result, '{}'::jsonb) || '{"daily_settled":true}'::jsonb
    where id = p_round and status = 'scored' and daily_day is not null and not coalesce(result ? 'daily_settled', false)
    returning user_id, score, daily_day into r;
  if r.user_id is null then return jsonb_build_object('ok', false); end if;
  select * into b from public.daily_boards where day = r.daily_day;
  v_tier := case when r.score >= b.g3 then 3 when r.score >= b.g2 then 2 when r.score >= b.g1 then 1 else 0 end;
  v_coins := case v_tier when 3 then 40 when 2 then 25 else 15 end; -- everyone who finishes gets something
  insert into public.ledger (user_id, amount, reason, ref) values (r.user_id, v_coins, 'Daily Challenge', 'daily:' || r.daily_day);
  if v_tier = 3 then v_pack := public.open_pack_tx(r.user_id, public.current_world(r.user_id)); end if;
  select shields into v_sh from public.profiles where id = r.user_id;
  update public.profiles set daily_done = daily_done + 1, last_seen = now() where id = r.user_id returning daily_done into v_done;
  v_shield := (v_done % 5 = 0) and v_sh < 2; -- every 5th challenge earns a Streak Shield (you can hold 2)
  if v_shield then update public.profiles set shields = shields + 1 where id = r.user_id; end if;
  select count(*) + 1 into v_rank from public.rounds where mode = 'daily' and daily_day = r.daily_day and status = 'scored' and score > r.score;
  return jsonb_build_object('ok', true, 'day', r.daily_day, 'tier', v_tier, 'coins', v_coins, 'pack', v_pack, 'shield_earned', v_shield, 'rank', v_rank, 'done', v_done);
end;
$$;

-- The login streak survives ONE missed day if you hold a Streak Shield.
create or replace function public.claim_daily(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare v_last date; v_streak int; v_new int; v_bonus int; v_base int; v_pack jsonb; v_sh int; v_used boolean := false;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 1));
  select last_login, streak, shields into v_last, v_streak, v_sh from public.profiles where id = p_user;
  if v_last = current_date then return jsonb_build_object('claimed', false, 'streak', v_streak, 'bonus', 0); end if;
  if v_last = current_date - 1 then v_new := v_streak + 1;
  elsif v_last = current_date - 2 and v_sh > 0 then v_new := v_streak + 1; v_used := true;
  else v_new := 1; end if;
  select coalesce((data -> 'g' ->> 'login')::int, 10) into v_base from public.game_config;
  v_bonus := v_base * least(v_new, 7);
  update public.profiles set last_login = current_date, streak = v_new, last_seen = now(), shields = shields - case when v_used then 1 else 0 end where id = p_user;
  if v_bonus > 0 then insert into public.ledger (user_id, amount, reason) values (p_user, v_bonus, 'Daily login bonus'); end if;
  if v_new % 7 = 0 then v_pack := public.open_pack_tx(p_user, public.current_world(p_user)); end if;
  return jsonb_build_object('claimed', true, 'streak', v_new, 'bonus', v_bonus, 'pack', v_pack, 'shield_used', v_used);
end;
$$;

-- ---------- Beat my run ----------
create function public.create_challenge_tx(p_user uuid, p_round uuid) returns text
language plpgsql security definer set search_path = public as
$$
declare r public.rounds; v_code text;
begin
  select * into r from public.rounds where id = p_round and user_id = p_user;
  if not found then raise exception 'round_not_found'; end if;
  if r.status <> 'scored' or r.mode not in ('solo', 'ghost') then raise exception 'not_challengeable'; end if;
  if coalesce(jsonb_array_length(r.params -> 'boosters'), 0) > 0 then raise exception 'boosted_round'; end if;
  select code into v_code from public.challenges where round_id = p_round;
  if v_code is not null then return v_code; end if;
  if (select count(*) from public.challenges where creator = p_user and created_at > now() - interval '1 day') >= 10 then raise exception 'too_many_challenges'; end if;
  v_code := substr(md5(random()::text || clock_timestamp()::text || p_user::text), 1, 8);
  insert into public.challenges (code, creator, round_id, level, seed, params, score, expires_at)
    values (v_code, p_user, p_round, r.level, r.seed, r.params || '{"fee":0,"ghost":null,"boosters":[]}'::jsonb, r.score, now() + interval '7 days');
  return v_code;
end;
$$;

create function public.get_challenge(p_code text) returns jsonb language plpgsql security definer set search_path = public as
$$
declare c public.challenges; v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  select * into c from public.challenges where code = p_code;
  if not found then raise exception 'challenge_not_found'; end if;
  return jsonb_build_object('code', c.code, 'creator', (select display_name from public.profiles where id = c.creator), 'level', c.level, 'score', c.score,
    'expired', c.expires_at < now(), 'mine', c.creator = v_user, 'plays', c.plays,
    'played', exists (select 1 from public.challenge_plays where code = p_code and user_id = v_user),
    'my_score', (select score from public.challenge_plays where code = p_code and user_id = v_user));
end;
$$;

create function public.settle_duel_tx(p_round uuid) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare r record; c public.challenges; v_win boolean;
begin
  update public.rounds set result = coalesce(result, '{}'::jsonb) || '{"duel_settled":true}'::jsonb
    where id = p_round and status = 'scored' and challenge_code is not null and not coalesce(result ? 'duel_settled', false)
    returning user_id, score, challenge_code into r;
  if r.user_id is null then return jsonb_build_object('ok', false); end if;
  select * into c from public.challenges where code = r.challenge_code;
  v_win := r.score > c.score;
  insert into public.challenge_plays (code, user_id, score, won) values (c.code, r.user_id, r.score, v_win) on conflict do nothing;
  update public.challenges set plays = plays + 1 where code = c.code;
  return jsonb_build_object('ok', true, 'creator', (select display_name from public.profiles where id = c.creator), 'creator_score', c.score, 'score', r.score, 'win', v_win, 'tie', r.score = c.score);
end;
$$;

-- ---------- Mastery ranks ----------
create function public.mastery() returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare v_user uuid := auth.uid(); lv text; v_best int; t record; n record; out jsonb := '[]';
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  foreach lv in array array['beginner', 'medium', 'hard'] loop
    select coalesce(max(score), 0) into v_best from public.rounds
      where user_id = v_user and level = lv and status = 'scored' and mode in ('solo', 'ghost', 'pvp', 'tour');
    select * into t from public.mastery_tiers where level = lv and min_score <= v_best order by tier desc limit 1;
    select * into n from public.mastery_tiers where level = lv and tier = coalesce(t.tier, 0) + 1;
    out := out || jsonb_build_object('level', lv, 'best', v_best, 'tier', coalesce(t.tier, 0), 'name', coalesce(t.name, 'Bronze'), 'next_name', n.name, 'next_min', n.min_score);
  end loop;
  return out;
end;
$$;

-- ---------- privacy tools ----------
create function public.accept_terms(p_version text) returns void language plpgsql security definer set search_path = public as
$$ begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if char_length(coalesce(p_version, '')) not between 1 and 20 then raise exception 'invalid_version'; end if;
  update public.profiles set adult_confirmed = true, terms_at = now(), terms_version = p_version where id = auth.uid();
end $$;

create function public.export_my_data() returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  return jsonb_build_object(
    'exported_at', now(),
    'account', (select jsonb_build_object('email', u.email, 'created_at', u.created_at, 'sign_in_method', u.raw_app_meta_data ->> 'provider') from auth.users u where u.id = v_user),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = v_user),
    'wallet_history', (select coalesce(jsonb_agg(to_jsonb(l) order by l.created_at desc), '[]') from public.ledger l where l.user_id = v_user),
    'rounds', (select coalesce(jsonb_agg(x), '[]') from (select id, mode, level, status, score, prize, fee, started_at, finished_at from public.rounds where user_id = v_user order by started_at desc limit 1000) x),
    'inventory', (select coalesce(jsonb_agg(to_jsonb(i)), '[]') from public.inventory i where i.user_id = v_user),
    'boosters', (select coalesce(jsonb_agg(to_jsonb(b)), '[]') from public.user_boosters b where b.user_id = v_user),
    'stamps', (select coalesce(jsonb_agg(to_jsonb(s)), '[]') from public.user_stamps s where s.user_id = v_user),
    'stage_progress', (select coalesce(jsonb_agg(to_jsonb(s)), '[]') from public.user_stages s where s.user_id = v_user),
    'achievements', (select coalesce(jsonb_agg(to_jsonb(a)), '[]') from public.user_achievements a where a.user_id = v_user),
    'challenges_created', (select coalesce(jsonb_agg(jsonb_build_object('code', c.code, 'score', c.score, 'created_at', c.created_at)), '[]') from public.challenges c where c.creator = v_user)
  );
end;
$$;

-- ---------- BUG FIX: admins could see every player's rows through normal queries ----------
-- That made an admin's wallet, profile, shop and quests show mixed-up data as soon as a second player existed.
-- Admins now use the admin_* functions to look at other players. Normal queries only ever return your own rows.
drop policy profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid());
drop policy ledger_read on public.ledger;
create policy ledger_read on public.ledger for select to authenticated using (user_id = auth.uid());
drop policy rounds_read on public.rounds;
create policy rounds_read on public.rounds for select to authenticated using (user_id = auth.uid());
drop policy inventory_read on public.inventory;
create policy inventory_read on public.inventory for select to authenticated using (user_id = auth.uid());
drop policy boosters_read on public.user_boosters;
create policy boosters_read on public.user_boosters for select to authenticated using (user_id = auth.uid());
drop policy progress_read on public.daily_progress;
create policy progress_read on public.daily_progress for select to authenticated using (user_id = auth.uid());
drop policy userach_read on public.user_achievements;
create policy userach_read on public.user_achievements for select to authenticated using (user_id = auth.uid());
drop policy queue_read on public.match_queue;
create policy queue_read on public.match_queue for select to authenticated using (user_id = auth.uid());
drop policy mp_read on public.match_players;
create policy mp_read on public.match_players for select to authenticated using (user_id = auth.uid());
drop policy matches_read on public.matches;
create policy matches_read on public.matches for select to authenticated using (exists (select 1 from public.match_players mp where mp.match_id = id and mp.user_id = auth.uid()));
drop policy user_stages_read on public.user_stages;
create policy user_stages_read on public.user_stages for select to authenticated using (user_id = auth.uid());
drop policy user_stamps_read on public.user_stamps;
create policy user_stamps_read on public.user_stamps for select to authenticated using (user_id = auth.uid());
drop policy user_collect_read on public.user_collect;
create policy user_collect_read on public.user_collect for select to authenticated using (user_id = auth.uid());
drop policy album_claims_read on public.album_claims;
create policy album_claims_read on public.album_claims for select to authenticated using (user_id = auth.uid());

-- ---------- admin: audit log and a health check ----------
create function public.admin_audit(p_limit int default 100) returns jsonb language plpgsql stable security definer set search_path = public as
$$ begin
  perform public.require_admin();
  return (select coalesce(jsonb_agg(x), '[]') from (
    select a.id, a.action, a.detail, a.created_at, p.display_name as actor
    from public.audit_log a left join public.profiles p on p.id = a.actor order by a.created_at desc limit least(greatest(p_limit, 1), 500)) x);
end $$;

-- Reports which parts of the database are installed, so a missing update is easy to spot.
create function public.admin_health() returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare f text; out jsonb := '[]';
  fns text[] := array['admin_overview','admin_players','admin_player_detail','admin_adjust_coins','admin_set_banned','admin_save_config','admin_save_item',
    'admin_save_mission','admin_events','admin_save_event','admin_set_event_status','admin_delete_event','admin_finalize_event','admin_pay_league',
    'admin_save_stage','admin_journey_stats','admin_audit','event_leaderboard','league_board','matchmake_tx','settle_stage_tx','claim_album',
    'settle_daily_tx','create_challenge_tx','mastery','export_my_data','accept_terms'];
  tbls text[] := array['events','matches','match_queue','league_payouts','worlds','stages','stamps','user_stages','daily_boards','challenges','mastery_tiers'];
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

-- ---------- permissions ----------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
grant select on public.game_config, public.shop_items to anon, authenticated;
grant select on public.profiles, public.ledger, public.rounds, public.wallet, public.audit_log, public.inventory, public.user_boosters,
  public.mission_defs, public.daily_progress, public.ach_defs, public.user_achievements, public.events,
  public.match_queue, public.matches, public.match_players, public.league_payouts,
  public.worlds, public.stamps, public.user_stages, public.user_stamps, public.user_collect, public.album_claims,
  public.challenges, public.challenge_plays, public.mastery_tiers to authenticated;
grant select (id, world, idx, name, level, mods, s1, s2, s3, reward_coins) on public.stages to authenticated;
grant select (day, level, mods, g1, g2, g3) on public.daily_boards to authenticated;
grant execute on function public.is_admin(), public.buy_item(text), public.equip_item(text, boolean), public.claim_mission(text),
  public.daily_deals(date), public.todays_missions(date), public.event_leaderboard(uuid),
  public.confirm_adult(), public.my_match(), public.cancel_queue(), public.match_result(uuid), public.league_board(date), public.week_start(timestamptz),
  public.craft_stamp(text), public.claim_album(int),
  public.daily_leaderboard(date), public.get_challenge(text), public.mastery(), public.accept_terms(text), public.export_my_data(),
  public.admin_overview(), public.admin_players(text, int, int), public.admin_player_detail(uuid), public.admin_adjust_coins(uuid, int, text),
  public.admin_set_banned(uuid, boolean), public.admin_save_config(jsonb), public.admin_save_item(text, text, text, int, int, boolean),
  public.admin_save_mission(text, text, int, int, boolean), public.admin_events(),
  public.admin_save_event(uuid, text, text, text, int, int, timestamptz, timestamptz, int, int[]),
  public.admin_set_event_status(uuid, text), public.admin_delete_event(uuid), public.admin_finalize_event(uuid),
  public.admin_pay_league(date, int[]), public.admin_save_stage(text, int, int, int, int), public.admin_journey_stats(), public.admin_audit(int), public.admin_health() to authenticated;
grant execute on function public.start_round_tx(uuid, text, text, int, bigint, jsonb, text[], uuid), public.finish_round(uuid, int, int, int, jsonb),
  public.claim_daily(uuid), public.matchmake_tx(uuid, text, jsonb, bigint), public.settle_match_tx(uuid),
  public.stage_unlocked(uuid, text), public.current_world(uuid), public.open_pack_tx(uuid, int), public.settle_stage_tx(uuid),
  public.ensure_daily_tx(date, text, bigint, jsonb, int, int, int), public.settle_daily_tx(uuid), public.create_challenge_tx(uuid, uuid), public.settle_duel_tx(uuid) to service_role;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
