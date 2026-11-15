-- Bingo Arena 027: the "First win" badge only for a real win, and one rule for "online". Safe to run twice.
--   * BA-08: "First win" was given for the first Practice round (a new Practice best counts as a "win" there). Now it is
--     given only for a real win: beating the ghost, beating a person (live match or a friend's challenge) or a prize place
--     in an event. Badges already given stay as they are (nothing is deleted).
--   * BA-36: arena_status's "online" count did not require a confirmed age, but the list of players you can invite
--     (online_players) did, so the two numbers differed. Both now count only players who confirmed their age.
-- Nothing else changes: same scores, prizes, XP and quests. finish_round is the 026 version with one line changed.
-- Abandoned rounds (WP5) need no database change: the start-round edge function closes them.

begin;

-- ---------- BA-08: finish_round, as in 026, except 'first' needs a ghost win ----------
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
      case when v_win and v_mode = 'ghost' then 'first' end, case when v_played >= 10 then 'ten' end,
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

-- ---------- BA-08: the other real wins, which are settled outside finish_round ----------
-- A live match with a winner (decided or by forfeit): settle_match_tx sets matches.winner.
-- no client access
create or replace function public.first_win_match() returns trigger language plpgsql security definer set search_path = public as
$$ begin
  insert into public.user_achievements (user_id, ach_id) values (new.winner, 'first') on conflict do nothing;
  return new;
end $$;
revoke all on function public.first_win_match() from public;

-- A friend's challenge beaten: settle_duel_tx adds a challenge_plays row with won = true.
-- no client access
create or replace function public.first_win_duel() returns trigger language plpgsql security definer set search_path = public as
$$ begin
  insert into public.user_achievements (user_id, ach_id) values (new.user_id, 'first') on conflict do nothing;
  return new;
end $$;
revoke all on function public.first_win_duel() from public;

-- An event prize place: finalize_event_tx pays it as a ledger row 'Event prize: ...'.
-- no client access
create or replace function public.first_win_event() returns trigger language plpgsql security definer set search_path = public as
$$ begin
  insert into public.user_achievements (user_id, ach_id) values (new.user_id, 'first') on conflict do nothing;
  return new;
end $$;
revoke all on function public.first_win_event() from public;

-- CREATE TRIGGER has no "if not exists", so check first (a second run adds nothing).
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'matches_first_win' and tgrelid = 'public.matches'::regclass) then
    create trigger matches_first_win after update of winner on public.matches
      for each row when (new.winner is not null and old.winner is distinct from new.winner) execute function public.first_win_match();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'challenge_plays_first_win' and tgrelid = 'public.challenge_plays'::regclass) then
    create trigger challenge_plays_first_win after insert on public.challenge_plays
      for each row when (new.won) execute function public.first_win_duel();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'ledger_first_win' and tgrelid = 'public.ledger'::regclass) then
    create trigger ledger_first_win after insert on public.ledger
      for each row when (new.amount > 0 and new.reason like 'Event prize:%') execute function public.first_win_event();
  end if;
end $$;

-- ---------- BA-36: arena_status, as in 018, except "online" also needs a confirmed age (as online_players does) ----------
create or replace function public.arena_status() returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'not_signed_in'; end if;
  return jsonb_build_object(
    'online', (select count(*) from public.profiles where last_seen > now() - interval '5 minutes' and id <> v_me and adult_confirmed and not banned),
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

commit;
