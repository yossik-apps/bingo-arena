-- Bingo Arena 0.28.0: channel report for admins (flag "channels", Off by default). Additive and safe to run twice.
-- Answers "which channel brings players who play and come back?". For every traffic source (utm_source, the referring
-- site, or "direct", as visits already records it) and every utm_campaign: visitors, how many started and finished a
-- round, how many came back on a later day, and share taps (WhatsApp, Telegram, Facebook).
-- New objects only: visits, track_visit and track_step are not changed. Same privacy as visits: a random browser id,
-- no name, email or IP address.

begin;

insert into public.feature_flags (key) values ('channels') on conflict (key) do nothing;

-- one row per browser, day, kind and detail: share taps per target, and the campaign a visit came from
create table if not exists public.visit_events (
  vid uuid not null,
  day date not null default current_date,
  kind text not null check (kind in ('share', 'campaign')),
  detail text not null default '' check (detail ~ '^[a-z0-9_\-]{0,40}$'),
  n int not null default 1,
  primary key (vid, day, kind, detail)
);
create index if not exists visit_events_day_idx on public.visit_events (day);
alter table public.visit_events enable row level security; -- no policies: only the functions below read or write it
revoke all on public.visit_events from public, anon, authenticated;

-- is recording on for this viewer? all = everyone; admins = only admins (to test); off or a missing flag = nobody
-- no client access
create or replace function public.channels_on(p_user uuid) returns boolean language sql stable security definer set search_path = public as
$$
  select coalesce((select case mode when 'all' then true
                                    when 'admins' then exists (select 1 from public.profiles where id = p_user and role = 'admin')
                                    else false end
                   from public.feature_flags where key = 'channels'), false)
$$;
revoke all on function public.channels_on(uuid) from public, anon, authenticated;

-- the game sends a share tap or the visit's campaign; returns -1 when recording is off, so the game stops sending
create or replace function public.track_event(p_vid uuid, p_kind text, p_detail text default '') returns int
language plpgsql security definer set search_path = public as
$$
declare v_det text := left(regexp_replace(lower(coalesce(p_detail, '')), '[^a-z0-9_\-]', '', 'g'), 40);
begin
  if not public.channels_on(auth.uid()) then return -1; end if;
  if p_vid is null or p_kind not in ('share', 'campaign') then raise exception 'bad_request'; end if;
  if p_kind = 'share' and v_det not in ('whatsapp', 'telegram', 'facebook') then raise exception 'bad_request'; end if;
  insert into public.visit_events as e (vid, day, kind, detail) values (p_vid, current_date, p_kind, v_det)
  on conflict (vid, day, kind, detail) do update set n = least(e.n + 1, 500);
  return 1;
end;
$$;
revoke all on function public.track_event(uuid, text, text) from public;
grant execute on function public.track_event(uuid, text, text) to anon, authenticated;

-- the report. A browser belongs to the source of its first visit in the period; it "played" when the account it
-- signed in with started a round on or after that first visit, and "came back" when it was active on a later day.
create or replace function public.admin_channels(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as
$$
declare v_from date := current_date - (case when p_days in (7, 30, 90) then p_days else 30 end - 1);
begin
  perform public.require_admin();
  return (
    with v as (select * from public.visits where day >= v_from),
    first_v as (select distinct on (vid) vid, day d0, source, landing from v order by vid, day, first_at),
    acct as (select distinct vid, user_id from v where user_id is not null),
    per as (
      select f.vid, f.source, f.landing,
        (select string_agg(distinct e.detail, ',') from public.visit_events e where e.vid = f.vid and e.kind = 'campaign' and e.day >= v_from) campaign,
        exists (select 1 from acct a join public.rounds r on r.user_id = a.user_id where a.vid = f.vid and r.started_at >= f.d0) played,
        exists (select 1 from acct a join public.rounds r on r.user_id = a.user_id where a.vid = f.vid and r.started_at >= f.d0 and r.status = 'scored') finished,
        exists (select 1 from acct a join public.an_activity x on x.user_id = a.user_id where a.vid = f.vid and x.day > f.d0) came_back,
        coalesce((select sum(e.n) from public.visit_events e where e.vid = f.vid and e.kind = 'share' and e.day >= v_from), 0) shares
      from first_v f)
    select jsonb_build_object(
      'since', (select min(day) from public.visit_events),
      'sources', (select coalesce(jsonb_agg(x order by x.visitors desc), '[]') from (
        select source, count(*) visitors, count(*) filter (where played) played, count(*) filter (where finished) finished,
               count(*) filter (where came_back) came_back, sum(shares)::int shares
        from per group by source order by count(*) desc limit 20) x),
      'campaigns', (select coalesce(jsonb_agg(x order by x.visitors desc), '[]') from (
        select campaign, count(*) visitors, count(*) filter (where played) played, count(*) filter (where finished) finished,
               count(*) filter (where came_back) came_back
        from per where campaign is not null group by campaign order by count(*) desc limit 20) x),
      'shares', (select coalesce(jsonb_object_agg(detail, n), '{}') from (
        select detail, sum(n)::int n from public.visit_events where kind = 'share' and day >= v_from group by detail) s),
      'challenge', jsonb_build_object(
        'made', (select count(*) from public.challenges where created_at >= v_from),
        'link_visitors', (select count(*) from first_v where landing = 'challenge'),
        'plays', (select count(*) from public.challenge_plays where played_at >= v_from))));
end;
$$;
revoke all on function public.admin_channels(int) from public, anon;
grant execute on function public.admin_channels(int) to authenticated;

commit;
