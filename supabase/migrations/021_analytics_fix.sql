-- Bingo Arena 0.25.1: Analytics fix.
-- "Returning players" in the summary counted only players who joined BEFORE the chosen range, while the daily table
-- counts everyone who came back on a later day than they joined. With most players new this week, the summary stayed
-- at 1 while the table showed more. Both now use the same rule; the old number is kept as "returning_before".

create or replace function public.an_kpi(p_from date, p_to date, p_test boolean) returns jsonb
language sql stable security definer set search_path = public as
$$
  with act as (select distinct user_id, day from public.an_activity where day between p_from and p_to),
  buys as (select * from public.purchases where created_at >= p_from and created_at < p_to + 1
           and (status = 'paid' or (p_test and status = 'test')))
  select jsonb_build_object(
    'visitors', (select count(distinct vid) from public.visits where day between p_from and p_to),
    'new_visitors', (select count(*) from (select vid from public.visits group by vid having min(day) between p_from and p_to) x),
    'new_players', (select count(*) from public.profiles where created_at >= p_from and created_at < p_to + 1),
    'active', (select count(distinct user_id) from act),
    -- came back: active in the range on a later day than the day they joined (same rule as the daily table)
    'returning', (select count(distinct a.user_id) from act a join public.profiles p on p.id = a.user_id where a.day > p.created_at::date),
    -- players who joined before the range and were active in it
    'returning_before', (select count(distinct a.user_id) from act a join public.profiles p on p.id = a.user_id where p.created_at < p_from),
    'dau', round((select count(*) from act)::numeric / (p_to - p_from + 1), 1),
    'rounds', (select count(*) from public.rounds where status = 'scored' and started_at >= p_from and started_at < p_to + 1),
    'guest_rounds', (select coalesce(sum(guest_rounds), 0) from public.visits where day between p_from and p_to),
    'revenue_cents', (select coalesce(sum(price_cents), 0) from buys),
    'purchases', (select count(*) from buys),
    'payers', (select count(distinct user_id) from buys),
    'refunded_cents', (select coalesce(sum(price_cents), 0) from public.purchases where status = 'refunded' and created_at >= p_from and created_at < p_to + 1),
    'ad_views', (select count(*) from public.ad_rewards where created_at >= p_from and created_at < p_to + 1),
    'ad_viewers', (select count(distinct user_id) from public.ad_rewards where created_at >= p_from and created_at < p_to + 1),
    'coins_in', (select coalesce(sum(amount), 0) from public.ledger where amount > 0 and created_at >= p_from and created_at < p_to + 1),
    'coins_out', (select coalesce(-sum(amount), 0) from public.ledger where amount < 0 and created_at >= p_from and created_at < p_to + 1)
  )
$$;
revoke all on function public.an_kpi(date, date, boolean) from public, anon, authenticated;
