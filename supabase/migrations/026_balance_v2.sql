-- 026: balance v2 (reports/balance-spec.md). Safe to run twice. Additive: no drops, no renames, no deletes.
--
-- Nothing a player sees changes until the flag "balance_v2" is moved from Off. While it is Off (the default) this file only adds
-- columns, a flag row, settings and server-only functions; rounds, quests, badges and ranks behave exactly as before.
--   * the flag row balance_v2 (off) and its settings in game_config.data.v2 (calls, bonus, ghost share, XP divisor per level)
--   * daily_boards.cv and events.cv: the version a shared board or event was created with (see balance_cv_for)
--   * ensure_daily_tx with a version argument (the 7-argument one stays for version 1 boards)
--   * quests line1 "Complete 1 line" (25 coins) and daub30 "Daub 30 numbers" for version 2; line3 and daub25 stay for version 1
--   * the badge lines2 "2 lines in one round", given for version 2 rounds only
--   * the version 2 rank thresholds (mastery_tiers.v2_min_score); mastery() shows "Unranked" until a player's first version 2
--     round at a level, and counts version 2 rounds only
-- Who is on version 2 (balance_v2_on): the flag is All, or Admins and the player is an admin.

begin;

-- ---------- the flag, and the server's right to read it ----------
insert into public.feature_flags (key) values ('balance_v2') on conflict (key) do nothing;
grant select on public.feature_flags to service_role;

-- ---------- the settings (only if there are none yet, so a later edit in Admin is never overwritten) ----------
update public.game_config
   set data = jsonb_set(data, '{v2}', '{
     "beginner": {"calls": 0.5, "bonus": 5, "share": 0.812, "xpDiv": 2.4},
     "medium":   {"calls": 0.4, "bonus": 5, "share": 0.827, "xpDiv": 1.7},
     "hard":     {"bonus": 5, "share": 0.867, "xpDiv": 1.2}
   }'::jsonb, true), updated_at = now()
 where id = 1 and not (data ? 'v2');

-- ---------- the version of a shared board ----------
alter table public.daily_boards add column if not exists cv smallint not null default 1;
alter table public.events add column if not exists cv smallint not null default 1;

-- Version 2 for a board or event of this UTC day only if the flag was already All before that day began, so a flag change takes
-- effect at the next UTC midnight and one board never mixes versions. Any problem answers 1.
-- no client access
create or replace function public.balance_cv_for(p_day date) returns smallint
language plpgsql stable security definer set search_path = public as
$$
declare m text; u timestamptz;
begin
  select mode, updated_at into m, u from public.feature_flags where key = 'balance_v2';
  if m = 'all' and u < (p_day::timestamp at time zone 'UTC') then return 2; end if;
  return 1;
exception when others then
  return 1;
end;
$$;
revoke all on function public.balance_cv_for(date) from public, anon, authenticated;
grant execute on function public.balance_cv_for(date) to service_role;

-- A new event gets the version of the day it is created on.
-- no client access
create or replace function public.events_set_cv() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
  new.cv := public.balance_cv_for((now() at time zone 'UTC')::date);
  return new;
end;
$$;
revoke all on function public.events_set_cv() from public, anon, authenticated;
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'events_set_cv' and tgrelid = 'public.events'::regclass) then
    create trigger events_set_cv before insert on public.events for each row execute function public.events_set_cv();
  end if;
end $$;

-- The Daily Challenge board with its version. The 7-argument ensure_daily_tx (version 1) is unchanged.
-- no client access
create or replace function public.ensure_daily_tx(p_day date, p_level text, p_seed bigint, p_mods jsonb, p_g1 int, p_g2 int, p_g3 int, p_cv int)
returns void language sql security definer set search_path = public as
$$ insert into public.daily_boards (day, level, seed, mods, g1, g2, g3, cv)
   values (p_day, p_level, p_seed, p_mods, p_g1, p_g2, p_g3, case when p_cv = 2 then 2 else 1 end) on conflict (day) do nothing $$;
revoke all on function public.ensure_daily_tx(date, text, bigint, jsonb, int, int, int, int) from public, anon, authenticated;
grant execute on function public.ensure_daily_tx(date, text, bigint, jsonb, int, int, int, int) to service_role;

-- ---------- who is on version 2 for quests, badges and ranks ----------
-- no client access
create or replace function public.balance_v2_on(p_user uuid) returns boolean
language plpgsql stable security definer set search_path = public as
$$
declare m text;
begin
  select mode into m from public.feature_flags where key = 'balance_v2';
  if m = 'all' then return true; end if;
  if m = 'admins' and p_user is not null then
    return exists (select 1 from public.profiles where id = p_user and role = 'admin' and not banned);
  end if;
  return false;
exception when others then
  return false;
end;
$$;
revoke all on function public.balance_v2_on(uuid) from public, anon, authenticated;
grant execute on function public.balance_v2_on(uuid) to service_role;

-- ---------- quests ----------
alter table public.mission_defs add column if not exists balance text check (balance in ('v1', 'v2'));
-- the old quests keep working for version 1; the new ones show for version 2 (goals from reports/balance-spec.md section 6)
update public.mission_defs set balance = 'v1' where id in ('line3', 'daub25') and balance is null;
insert into public.mission_defs (id, label, counter, goal, reward, balance) values
  ('line1', 'Complete 1 line', 'lines', 1, 25, 'v2'),
  ('daub30', 'Daub 30 numbers', 'daubs', 30, 30, 'v2')
on conflict (id) do nothing;

-- Same as before, except a quest with a version only shows to players on that version. claim_mission already checks this list.
create or replace function public.todays_missions(p_day date default current_date) returns setof public.mission_defs
language sql stable security definer set search_path = public as
$$ select * from public.mission_defs
   where active and (balance is null or balance = case when public.balance_v2_on(auth.uid()) then 'v2' else 'v1' end)
   order by md5(p_day::text || id) limit 3 $$;

-- ---------- the badge ----------
insert into public.ach_defs (id, label) values ('lines2', '2 lines in one round') on conflict (id) do nothing;

-- Same as before (004), plus: lines2 for a version 2 round with 2 or more lines.
create or replace function public.finish_round(p_round uuid, p_score int, p_prize int, p_xp int, p_result jsonb)
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
  v_cv int := coalesce((p_result ->> 'cv')::int, 1);
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
      case when v_lines >= 3 then 'lines3' end, case when v_cv = 2 and v_lines >= 2 then 'lines2' end,
      case when floor(sqrt(v_xp / 40.0)) + 1 >= 5 then 'lv5' end]) loop
    if a is not null then
      insert into public.user_achievements (user_id, ach_id) values (v_user, a) on conflict do nothing;
      if found then v_new := array_append(v_new, a); end if;
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'ach', to_jsonb(v_new));
end;
$$;

-- ---------- mastery ranks ----------
alter table public.mastery_tiers add column if not exists v2_min_score int;
update public.mastery_tiers t set v2_min_score = v.s
  from (values ('beginner', 0, 0), ('beginner', 1, 320), ('beginner', 2, 430), ('beginner', 3, 520), ('beginner', 4, 720),
               ('medium', 0, 0), ('medium', 1, 530), ('medium', 2, 750), ('medium', 3, 940), ('medium', 4, 1400),
               ('hard', 0, 0), ('hard', 1, 750), ('hard', 2, 1020), ('hard', 3, 1200), ('hard', 4, 1600)) as v(level, tier, s)
 where t.level = v.level and t.tier = v.tier and t.v2_min_score is distinct from v.s;

-- Same as before for players on version 1 (version 2 rounds do not count there, in case the flag is switched back). On version 2 only version 2 rounds count, the thresholds are v2_min_score, and a
-- player with no version 2 round at a level is "Unranked" there ("ranked": false). Bronze starts with the first such round.
create or replace function public.mastery() returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare v_user uuid := auth.uid(); lv text; v_best int; v_any boolean; t record; n record; out jsonb := '[]'; v_v2 boolean;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  v_v2 := public.balance_v2_on(v_user);
  foreach lv in array array['beginner', 'medium', 'hard'] loop
    if not v_v2 then
      select coalesce(max(score), 0) into v_best from public.rounds
        where user_id = v_user and level = lv and status = 'scored' and mode in ('solo', 'ghost', 'pvp', 'tour') and coalesce(params ->> 'cv', '1') <> '2';
      select * into t from public.mastery_tiers where level = lv and min_score <= v_best order by tier desc limit 1;
      select * into n from public.mastery_tiers where level = lv and tier = coalesce(t.tier, 0) + 1;
      out := out || jsonb_build_object('level', lv, 'best', v_best, 'tier', coalesce(t.tier, 0), 'name', coalesce(t.name, 'Bronze'), 'next_name', n.name, 'next_min', n.min_score);
    else
      select max(score), count(*) > 0 into v_best, v_any from public.rounds
        where user_id = v_user and level = lv and status = 'scored' and mode in ('solo', 'ghost', 'pvp', 'tour') and params ->> 'cv' = '2';
      if not v_any then
        out := out || jsonb_build_object('level', lv, 'best', 0, 'tier', 0, 'name', 'Unranked', 'ranked', false, 'next_name', 'Bronze', 'next_min', 0);
      else
        select * into t from public.mastery_tiers where level = lv and v2_min_score is not null and v2_min_score <= v_best order by tier desc limit 1;
        select * into n from public.mastery_tiers where level = lv and tier = coalesce(t.tier, 0) + 1 and v2_min_score is not null;
        out := out || jsonb_build_object('level', lv, 'best', v_best, 'tier', coalesce(t.tier, 0), 'name', coalesce(t.name, 'Bronze'), 'ranked', true, 'next_name', n.name, 'next_min', n.v2_min_score);
      end if;
    end if;
  end loop;
  return out;
end;
$$;

commit;
