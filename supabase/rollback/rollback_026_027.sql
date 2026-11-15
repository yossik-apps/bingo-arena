-- EMERGENCY ONLY. Do not run this as part of a normal update.
--
-- Rollback for 026_balance_v2.sql and 027_fair_badges_online.sql: puts back the database behaviour from before 026, if
-- something goes wrong after they were run. Paste it into the Supabase SQL Editor after a manual backup. Safe to run twice.
-- It stops (and changes nothing) if 026 was never run.
--
-- What it does:
--   * Restores the definitions from before 026 of every function 026 and 027 replaced, copied unchanged from the migration
--     that last defined them:
--       finish_round     (004_phase4.sql)   027 and 026 changed it: "First win" rule, the lines2 badge
--       mastery          (006_phase6.sql)   026: version 2 ranks
--       arena_status     (018_arena.sql)    027: "online" also needed a confirmed age
--       todays_missions  (002_phase2.sql)   026: quests by version. ONE ADDED CONDITION, see below.
--   * Disables (does not drop) the triggers 026 and 027 added, so they stop acting:
--       events_set_cv (026, new events get the flag's version), matches_first_win, challenge_plays_first_win,
--       ledger_first_win (027, "First win" for live-match, challenge and event wins).
--     To switch one on again: alter table public.<table> enable trigger <name>;
--
-- What it leaves in place, because it is harmless or needed by the deployed edge functions:
--   * the balance_v2 flag row, the game_config.data.v2 settings, daily_boards.cv, events.cv, mission_defs.balance,
--     mastery_tiers.v2_min_score, the quest rows line1 and daub30, the badge row lines2;
--   * the functions 026 and 027 added and nothing else calls once this has run: balance_cv_for, balance_v2_on, events_set_cv,
--     first_win_match, first_win_duel, first_win_event, and the 8-argument ensure_daily_tx (the edge functions still call it,
--     and it makes version 1 boards while the flag is Off).
--   * Badges already given stay, and no player data is changed.
--
-- todays_missions: the definition from 002 shows every active quest. Since the rows line1 and daub30 (marked 'v2') stay, the
-- exact old text would show them to every player, which is not the old behaviour. So it is the 002 text plus one condition,
-- "and coalesce(balance, 'v1') <> 'v2'", which hides only those two rows. Every other quest shows exactly as before 026.
--
-- Also switch the flag Off in Admin -> Config -> Balance v2 (or: select admin_set_flag('balance_v2', 'off') as an admin),
-- and redeploy the edge functions from before 026 if the problem is in them.

begin;

-- stop here, with nothing changed, if 026 was never run
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'mission_defs' and column_name = 'balance') then
    raise exception 'rollback_not_needed: 026_balance_v2.sql was never run here';
  end if;
end $$;

-- ---------- finish_round, as in 004_phase4.sql ----------
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

-- ---------- mastery, as in 006_phase6.sql ----------
create or replace function public.mastery() returns jsonb language plpgsql stable security definer set search_path = public as
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

-- ---------- todays_missions, as in 002_phase2.sql, plus the one condition explained above ----------
create or replace function public.todays_missions(p_day date default current_date) returns setof public.mission_defs
language sql stable security definer set search_path = public as
$$ select * from public.mission_defs where active and coalesce(balance, 'v1') <> 'v2' order by md5(p_day::text || id) limit 3 $$;

-- ---------- arena_status, as in 018_arena.sql ----------
create or replace function public.arena_status() returns jsonb language plpgsql stable security definer set search_path = public as
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

-- ---------- the triggers 026 and 027 added: disabled, not dropped (only those that exist; 027 may not have been run) ----------
do $$
declare t record;
begin
  for t in select c.relname as tbl, g.tgname as name from pg_trigger g join pg_class c on c.oid = g.tgrelid join pg_namespace s on s.oid = c.relnamespace
           where s.nspname = 'public' and (c.relname, g.tgname) in (('events', 'events_set_cv'), ('matches', 'matches_first_win'),
                 ('challenge_plays', 'challenge_plays_first_win'), ('ledger', 'ledger_first_win')) loop
    execute format('alter table public.%I disable trigger %I', t.tbl, t.name);
  end loop;
end $$;

commit;
