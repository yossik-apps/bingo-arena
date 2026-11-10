-- Bingo Arena: heatmaps for admins. Additive and safe to run twice. Starts Off (feature flag "heatmaps").
--   * Game board: per board square and level, how often players daub, tap wrong, tap late, or miss a number, and their
--     reaction time; per tenth of a round, taps and errors; when players quit a round. Written by submit-round after the
--     round is scored. Totals only (no player id), so it cannot change any score or result.
--   * Screens: where players tap on each screen (position, the button or element, taps that do nothing, repeated angry
--     taps) and how far they scroll. Anonymous: no player id, no browser id, no IP address.
--   Flag modes: off = nothing is collected; admins = only admins' own play is collected (to test); all = everyone.

begin;

insert into public.feature_flags (key) values ('heatmaps') on conflict (key) do nothing;

-- ============ tables ============
create table if not exists public.heat_board (
  day date not null default current_date,
  level text not null check (char_length(level) between 1 and 20),
  mode text not null check (char_length(mode) between 1 and 10),
  cell smallint not null check (cell between 0 and 24),
  hits int not null default 0, wrong int not null default 0, late int not null default 0, missed int not null default 0,
  rt_sum bigint not null default 0, rt_n int not null default 0,
  primary key (day, level, mode, cell)
);
create table if not exists public.heat_time (
  day date not null default current_date,
  level text not null check (char_length(level) between 1 and 20),
  mode text not null check (char_length(mode) between 1 and 10),
  slice smallint not null check (slice between 0 and 9),
  taps int not null default 0, hits int not null default 0, errors int not null default 0, quits int not null default 0,
  primary key (day, level, mode, slice)
);
create table if not exists public.heat_rounds (
  day date not null default current_date,
  level text not null check (char_length(level) between 1 and 20),
  mode text not null check (char_length(mode) between 1 and 10),
  finished int not null default 0, quit int not null default 0,
  primary key (day, level, mode)
);
create table if not exists public.ui_taps (
  id bigserial primary key,
  day date not null default current_date,
  screen text not null check (screen ~ '^[a-z0-9_:\-]{1,60}$'),
  device text not null check (device in ('phone', 'tablet', 'desktop')),
  wide boolean not null default false,          -- the two-column computer layout
  vw smallint not null check (vw between 200 and 8000), -- viewport width in CSS pixels
  x smallint not null check (x between 0 and 1000), -- across the screen, 0 to 1000
  y int not null check (y between 0 and 100000), -- CSS pixels from the top of the scrolled page
  el text not null default '' check (char_length(el) <= 60),
  dead boolean not null default false,          -- the tap hit nothing that reacts
  rage boolean not null default false           -- the third or later quick tap on the same spot
);
create index if not exists ui_taps_screen_idx on public.ui_taps (screen, day);
create table if not exists public.ui_scroll (
  day date not null default current_date,
  screen text not null check (screen ~ '^[a-z0-9_:\-]{1,60}$'),
  device text not null check (device in ('phone', 'tablet', 'desktop')),
  bucket smallint not null check (bucket between 0 and 10), -- deepest tenth of the page seen; 10 = the whole page
  n int not null default 0,
  primary key (day, screen, device, bucket)
);

alter table public.heat_board enable row level security;
alter table public.heat_time enable row level security;
alter table public.heat_rounds enable row level security;
alter table public.ui_taps enable row level security;
alter table public.ui_scroll enable row level security;
-- Supabase gives new tables broad default grants, so remove them explicitly. Nobody reads or writes these tables directly.
revoke all on public.heat_board, public.heat_time, public.heat_rounds, public.ui_taps, public.ui_scroll from public, anon, authenticated;
revoke all on sequence public.ui_taps_id_seq from public, anon, authenticated;

-- ============ is collection on for this viewer? ============
create or replace function public.heat_on(p_user uuid) returns boolean language sql stable security definer set search_path = public as
$$
  select coalesce((select case mode when 'all' then true
                                    when 'admins' then exists (select 1 from public.profiles where id = p_user and role = 'admin')
                                    else false end
                   from public.feature_flags where key = 'heatmaps'), false)
$$;

-- the game asks once per page load whether to record screen taps
create or replace function public.hm_collect() returns boolean language sql stable security definer set search_path = public as
$$ select public.heat_on(auth.uid()) $$;

-- ============ game board (called by submit-round with the service role) ============
create or replace function public.hm_round(p_user uuid, p_level text, p_mode text, p_cells jsonb, p_slices jsonb, p_quit_slice int default null) returns boolean
language plpgsql security definer set search_path = public as
$$
declare i int; c jsonb; s jsonb; v_level text := left(coalesce(p_level, '?'), 20); v_mode text := left(coalesce(p_mode, '?'), 10);
begin
  if not public.heat_on(p_user) then return false; end if;
  if p_quit_slice is not null then
    insert into public.heat_rounds as h (level, mode, quit) values (v_level, v_mode, 1)
      on conflict (day, level, mode) do update set quit = h.quit + 1;
    insert into public.heat_time as h (level, mode, slice, quits) values (v_level, v_mode, least(greatest(p_quit_slice, 0), 9), 1)
      on conflict (day, level, mode, slice) do update set quits = h.quits + 1;
    return true;
  end if;
  if jsonb_typeof(p_cells) <> 'array' or jsonb_array_length(p_cells) <> 25 or jsonb_typeof(p_slices) <> 'array' or jsonb_array_length(p_slices) <> 10 then
    raise exception 'bad_request';
  end if;
  insert into public.heat_rounds as h (level, mode, finished) values (v_level, v_mode, 1)
    on conflict (day, level, mode) do update set finished = h.finished + 1;
  for i in 0..24 loop
    c := p_cells -> i;
    if (c ->> 0)::int + (c ->> 1)::int + (c ->> 2)::int + (c ->> 3)::int > 0 then
      insert into public.heat_board as h (level, mode, cell, hits, wrong, late, missed, rt_sum, rt_n)
        values (v_level, v_mode, i, least((c ->> 0)::int, 1000), least((c ->> 1)::int, 1000), least((c ->> 2)::int, 1000), least((c ->> 3)::int, 1000),
                least((c ->> 4)::bigint, 10000000), least((c ->> 5)::int, 1000))
        on conflict (day, level, mode, cell) do update set hits = h.hits + excluded.hits, wrong = h.wrong + excluded.wrong, late = h.late + excluded.late,
          missed = h.missed + excluded.missed, rt_sum = h.rt_sum + excluded.rt_sum, rt_n = h.rt_n + excluded.rt_n;
    end if;
  end loop;
  for i in 0..9 loop
    s := p_slices -> i;
    if (s ->> 0)::int > 0 then
      insert into public.heat_time as h (level, mode, slice, taps, hits, errors)
        values (v_level, v_mode, i, least((s ->> 0)::int, 1000), least((s ->> 1)::int, 1000), least((s ->> 2)::int, 1000))
        on conflict (day, level, mode, slice) do update set taps = h.taps + excluded.taps, hits = h.hits + excluded.hits, errors = h.errors + excluded.errors;
    end if;
  end loop;
  return true;
end;
$$;

-- ============ screens (sent by the game in small batches) ============
create or replace function public.hm_ui(p_device text, p_taps jsonb, p_scroll jsonb default '[]') returns int
language plpgsql security definer set search_path = public as
$$
declare t jsonb; v_n int := 0; v_dev text := case when p_device in ('phone', 'tablet', 'desktop') then p_device else 'desktop' end;
begin
  if not public.heat_on(auth.uid()) then return -1; end if; -- -1 tells the game to stop recording
  for t in select * from jsonb_array_elements(case when jsonb_typeof(p_taps) = 'array' then p_taps else '[]' end) limit 60 loop
    begin
      insert into public.ui_taps (screen, device, wide, vw, x, y, el, dead, rage)
        values (t ->> 's', v_dev, coalesce((t ->> 'w')::boolean, false), (t ->> 'vw')::int, (t ->> 'x')::int, (t ->> 'y')::int,
                left(coalesce(t ->> 'el', ''), 60), coalesce((t ->> 'd')::boolean, false), coalesce((t ->> 'r')::boolean, false));
      v_n := v_n + 1;
    exception when check_violation or invalid_text_representation or numeric_value_out_of_range or not_null_violation then null; -- skip a bad line
    end;
  end loop;
  for t in select * from jsonb_array_elements(case when jsonb_typeof(p_scroll) = 'array' then p_scroll else '[]' end) limit 20 loop
    begin
      insert into public.ui_scroll as u (screen, device, bucket, n) values (t ->> 's', v_dev, (t ->> 'b')::int, 1)
        on conflict (day, screen, device, bucket) do update set n = u.n + 1;
    exception when check_violation or invalid_text_representation or numeric_value_out_of_range or not_null_violation then null;
    end;
  end loop;
  return v_n;
end;
$$;

-- ============ admin ============
create or replace function public.admin_heat_board(p_days int default 30, p_level text default null, p_mode text default null) returns jsonb
language plpgsql stable security definer set search_path = public as
$$
declare v_from date := current_date - least(greatest(coalesce(p_days, 30), 1), 365) + 1;
begin
  perform public.require_admin();
  return jsonb_build_object(
    'since', (select min(day) from public.heat_rounds),
    'levels', (select coalesce(jsonb_agg(distinct level), '[]') from public.heat_rounds where day >= v_from),
    'modes', (select coalesce(jsonb_agg(distinct mode), '[]') from public.heat_rounds where day >= v_from),
    'rounds', (select jsonb_build_object('finished', coalesce(sum(finished), 0), 'quit', coalesce(sum(quit), 0)) from public.heat_rounds
               where day >= v_from and (p_level is null or level = p_level) and (p_mode is null or mode = p_mode)),
    'cells', (select coalesce(jsonb_agg(jsonb_build_object('cell', cell, 'hits', hits, 'wrong', wrong, 'late', late, 'missed', missed,
                'rt', case when rt_n > 0 then round(rt_sum::numeric / rt_n) end) order by cell), '[]') from (
               select cell, sum(hits) hits, sum(wrong) wrong, sum(late) late, sum(missed) missed, sum(rt_sum) rt_sum, sum(rt_n) rt_n
               from public.heat_board where day >= v_from and (p_level is null or level = p_level) and (p_mode is null or mode = p_mode) group by cell) x),
    'slices', (select coalesce(jsonb_agg(jsonb_build_object('slice', slice, 'taps', taps, 'hits', hits, 'errors', errors, 'quits', quits) order by slice), '[]') from (
               select slice, sum(taps) taps, sum(hits) hits, sum(errors) errors, sum(quits) quits
               from public.heat_time where day >= v_from and (p_level is null or level = p_level) and (p_mode is null or mode = p_mode) group by slice) x));
end;
$$;

create or replace function public.admin_heat_screens(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as
$$
declare v_from date := current_date - least(greatest(coalesce(p_days, 30), 1), 365) + 1;
begin
  perform public.require_admin();
  return jsonb_build_object(
    'since', (select min(day) from public.ui_taps),
    'screens', (select coalesce(jsonb_agg(to_jsonb(x) order by x.taps desc), '[]') from (
      select screen, count(*) taps, count(*) filter (where dead) dead, count(*) filter (where rage) rage,
             count(*) filter (where device = 'phone') phone, count(*) filter (where device = 'desktop') desktop, count(*) filter (where device = 'tablet') tablet
      from public.ui_taps where day >= v_from group by screen) x));
end;
$$;

create or replace function public.admin_heat_screen(p_screen text, p_days int default 30, p_device text default null, p_wide boolean default null) returns jsonb
language plpgsql stable security definer set search_path = public as
$$
declare v_from date := current_date - least(greatest(coalesce(p_days, 30), 1), 365) + 1;
begin
  perform public.require_admin();
  return (with t as (select * from public.ui_taps where screen = p_screen and day >= v_from
                      and (p_device is null or device = p_device) and (p_wide is null or wide = p_wide))
    select jsonb_build_object(
      'taps', (select count(*) from t),
      'dead', (select count(*) from t where dead),
      'rage', (select count(*) from t where rage),
      'elements', (select coalesce(jsonb_agg(to_jsonb(x) order by x.taps desc), '[]') from (
        select el, count(*) taps, count(*) filter (where dead) dead, count(*) filter (where rage) rage
        from t group by el order by count(*) desc limit 25) x),
      -- the newest 4,000 points, for the density map
      'points', (select coalesce(jsonb_agg(jsonb_build_array(x, y, vw, case when dead then 1 else 0 end)), '[]') from (select x, y, vw, dead from t order by id desc limit 4000) p),
      'scroll', (select coalesce(jsonb_agg(jsonb_build_object('bucket', bucket, 'n', n) order by bucket), '[]') from (
        select bucket, sum(n) n from public.ui_scroll where screen = p_screen and day >= v_from and (p_device is null or device = p_device) group by bucket) s)));
end;
$$;

-- ============ permissions ============
revoke all on function public.heat_on(uuid), public.hm_round(uuid, text, text, jsonb, jsonb, int) from public, anon, authenticated;
grant execute on function public.hm_round(uuid, text, text, jsonb, jsonb, int) to service_role;
revoke all on function public.hm_collect(), public.hm_ui(text, jsonb, jsonb) from public;
grant execute on function public.hm_collect(), public.hm_ui(text, jsonb, jsonb) to anon, authenticated;
revoke all on function public.admin_heat_board(int, text, text), public.admin_heat_screens(int), public.admin_heat_screen(text, int, text, boolean) from public, anon;
grant execute on function public.admin_heat_board(int, text, text), public.admin_heat_screens(int), public.admin_heat_screen(text, int, text, boolean) to authenticated;
grant all on public.heat_board, public.heat_time, public.heat_rounds, public.ui_taps, public.ui_scroll to service_role;
grant usage, select on sequence public.ui_taps_id_seq to service_role;

commit;
