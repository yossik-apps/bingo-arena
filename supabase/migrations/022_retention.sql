-- Bingo Arena 0.25.2: Analytics → Retention.
-- Answers "do players come back, and why not?" with numbers that do not depend on one summary card:
--   * day-by-day sign-up groups: of the players who joined on a day, how many came back 1, 3 and 7 days later;
--   * the same for browsers (visitors), which does not depend on accounts at all: if browsers come back but players do
--     not, players are losing their account and getting a new one (the "lost accounts" check below);
--   * what returning players did on their first day (rounds played, saved account, where they joined).
-- Activity = played a round or opened the game while logged in (the same rule as everywhere in Analytics).

create function public.admin_retention(p_days int default 14, p_seg text default 'all') returns jsonb
language plpgsql stable security definer set search_path = public as
$$
declare v_days int := case when p_days in (7, 14, 30) then p_days else 14 end;
  v_from date := current_date - (case when p_days in (7, 14, 30) then p_days else 14 end) + 1;
  v_seg text := case when p_seg in ('all', 'crazygames', 'web', 'saved', 'guest') then p_seg else 'all' end;
begin
  perform public.require_admin();
  return (
    with np as (   -- new players in the range, in the chosen group
      select p.id, p.created_at::date d0, p.is_guest, p.joined_on from public.profiles p
      where p.created_at >= v_from - 30 and p.role <> 'admin'
        and (v_seg = 'all' or (v_seg = 'crazygames' and p.joined_on = 'crazygames') or (v_seg = 'web' and p.joined_on = 'web')
             or (v_seg = 'saved' and not p.is_guest) or (v_seg = 'guest' and p.is_guest))),
    act as (select distinct a.user_id, a.day from public.an_activity a join np on np.id = a.user_id),
    per as (       -- one row per new player: did they come back, and what did they do on day 0
      select np.*,
        exists (select 1 from act where act.user_id = np.id and act.day = np.d0 + 1) b1,
        exists (select 1 from act where act.user_id = np.id and act.day = np.d0 + 3) b3,
        exists (select 1 from act where act.user_id = np.id and act.day = np.d0 + 7) b7,
        exists (select 1 from act where act.user_id = np.id and act.day > np.d0) bany,
        (select count(*) from act where act.user_id = np.id and act.day > np.d0) days_back,
        (select count(*) from public.rounds r where r.user_id = np.id and r.status = 'scored' and r.started_at::date = np.d0) r0
      from np),
    days as (select g::date d from generate_series(v_from, current_date, interval '1 day') g),
    -- browsers: first visit day per browser, then visits on later days
    vf as (select vid, min(day) d0 from public.visits group by vid having min(day) >= v_from - 7),
    vb as (select vf.vid, vf.d0,
             exists (select 1 from public.visits v where v.vid = vf.vid and v.day = vf.d0 + 1) b1,
             exists (select 1 from public.visits v where v.vid = vf.vid and v.day = vf.d0 + 7) b7,
             exists (select 1 from public.visits v where v.vid = vf.vid and v.day > vf.d0) bany
           from vf),
    -- browsers that have more than one player account (a returning person who got a new account)
    multi as (select v.vid, count(distinct v.user_id) n from public.visits v
              where v.user_id is not null and v.day >= v_from group by v.vid having count(distinct v.user_id) > 1)
    select jsonb_build_object(
      'range', jsonb_build_object('from', v_from, 'to', current_date, 'days', v_days, 'seg', v_seg),
      'cohorts', (select coalesce(jsonb_agg(jsonb_build_object('d', days.d,
          'n', (select count(*) from per where d0 = days.d),
          'b1', case when days.d + 1 <= current_date then (select count(*) from per where d0 = days.d and b1) end,
          'b3', case when days.d + 3 <= current_date then (select count(*) from per where d0 = days.d and b3) end,
          'b7', case when days.d + 7 <= current_date then (select count(*) from per where d0 = days.d and b7) end,
          'bany', case when days.d < current_date then (select count(*) from per where d0 = days.d and bany) end) order by days.d desc), '[]') from days),
      'totals', (select jsonb_build_object(
          'n1', count(*) filter (where d0 between v_from and current_date - 1), 'b1', count(*) filter (where d0 between v_from and current_date - 1 and b1),
          'n3', count(*) filter (where d0 between v_from and current_date - 3), 'b3', count(*) filter (where d0 between v_from and current_date - 3 and b3),
          'n7', count(*) filter (where d0 between v_from - 7 and current_date - 7), 'b7', count(*) filter (where d0 between v_from - 7 and current_date - 7 and b7),
          'nany', count(*) filter (where d0 between v_from and current_date - 1), 'bany', count(*) filter (where d0 between v_from and current_date - 1 and bany),
          'new', count(*) filter (where d0 >= v_from)) from per),
      'visitors', (select jsonb_build_object(
          'n1', count(*) filter (where d0 between v_from and current_date - 1), 'b1', count(*) filter (where d0 between v_from and current_date - 1 and b1),
          'n7', count(*) filter (where d0 between v_from - 7 and current_date - 7), 'b7', count(*) filter (where d0 between v_from - 7 and current_date - 7 and b7),
          'bany', count(*) filter (where d0 between v_from and current_date - 1 and bany)) from vb),
      'lost', jsonb_build_object(
          'browsers', (select count(*) from multi),
          'accounts', (select coalesce(sum(n), 0) from multi),
          'new_on_known_browser', (select count(distinct p.id) from public.profiles p join public.visits v on v.user_id = p.id
             where p.created_at >= v_from and exists (select 1 from public.visits v2 join public.profiles p2 on p2.id = v2.user_id
               where v2.vid = v.vid and p2.id <> p.id and p2.created_at < p.created_at))),
      -- what players who came back did on their first day
      'by_rounds', (select coalesce(jsonb_agg(jsonb_build_object('label', g, 'n', n, 'back', b) order by o), '[]') from (
          select case when r0 = 0 then '0 rounds' when r0 = 1 then '1 round' when r0 = 2 then '2 rounds' when r0 <= 5 then '3–5 rounds' else '6+ rounds' end g,
                 min(case when r0 = 0 then 0 when r0 = 1 then 1 when r0 = 2 then 2 when r0 <= 5 then 3 else 4 end) o, count(*) n, count(*) filter (where b1) b
          from per where d0 between v_from and current_date - 1 group by 1) x),
      'by_kind', (select coalesce(jsonb_agg(jsonb_build_object('label', g, 'n', n, 'back', b)), '[]') from (
          select case when joined_on = 'crazygames' then (case when is_guest then 'CrazyGames · guest' else 'CrazyGames · logged in' end)
                      else (case when is_guest then 'Website · guest' else 'Website · saved account' end) end g, count(*) n, count(*) filter (where b1) b
          from per where d0 between v_from and current_date - 1 group by 1) x),
      'regulars', (select jsonb_build_object('two_plus', count(*) filter (where days_back >= 2), 'five_plus', count(*) filter (where days_back >= 5))
          from per where d0 >= v_from - 30)
    ));
end;
$$;
revoke all on function public.admin_retention(int, text) from public, anon;
grant execute on function public.admin_retention(int, text) to authenticated;
