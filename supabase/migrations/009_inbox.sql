-- Bingo Arena 0.9.0: Inbox (support messages, messages from the admin, notifications) and "welcome waves" for new players.
-- Players only ever reach their own messages, through these functions. No table is readable directly.

create table public.support_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject text not null check (char_length(subject) between 2 and 80),
  origin text not null default 'player' check (origin in ('player', 'admin')),
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  user_unread boolean not null default false,
  admin_unread boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_threads_user_idx on public.support_threads (user_id, updated_at desc);
create index support_threads_admin_idx on public.support_threads (admin_unread, updated_at desc);
create table public.support_messages (
  id bigserial primary key,
  thread_id uuid not null references public.support_threads (id) on delete cascade,
  sender text not null check (sender in ('player', 'admin')),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index support_messages_thread_idx on public.support_messages (thread_id, id);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('wave', 'info')),
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '' check (char_length(body) <= 300),
  from_user uuid references public.profiles (id) on delete set null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index waves_once on public.notifications (user_id, from_user) where kind = 'wave';
create index notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;
alter table public.notifications enable row level security;

-- ---------- player: contact us ----------
create function public.contact_support(p_subject text, p_body text) returns uuid language plpgsql security definer set search_path = public as
$$
declare v_user uuid := auth.uid(); v_id uuid;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  if char_length(trim(coalesce(p_subject, ''))) < 2 or char_length(p_subject) > 80 then raise exception 'invalid_subject'; end if;
  if char_length(trim(coalesce(p_body, ''))) < 5 or char_length(p_body) > 2000 then raise exception 'invalid_message'; end if;
  if (select count(*) from public.support_threads where user_id = v_user and origin = 'player' and created_at > now() - interval '1 day') >= 5 then raise exception 'too_many_messages'; end if;
  insert into public.support_threads (user_id, subject, origin, status, admin_unread) values (v_user, trim(p_subject), 'player', 'open', true) returning id into v_id;
  insert into public.support_messages (thread_id, sender, body) values (v_id, 'player', trim(p_body));
  return v_id;
end;
$$;

create function public.reply_support(p_thread uuid, p_body text) returns void language plpgsql security definer set search_path = public as
$$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  if char_length(trim(coalesce(p_body, ''))) < 1 or char_length(p_body) > 2000 then raise exception 'invalid_message'; end if;
  if not exists (select 1 from public.support_threads where id = p_thread and user_id = v_user) then raise exception 'thread_not_found'; end if;
  if (select count(*) from public.support_messages m join public.support_threads t on t.id = m.thread_id
      where t.user_id = v_user and m.sender = 'player' and m.created_at > now() - interval '1 day') >= 30 then raise exception 'too_many_messages'; end if;
  insert into public.support_messages (thread_id, sender, body) values (p_thread, 'player', trim(p_body));
  update public.support_threads set status = 'open', admin_unread = true, user_unread = false, updated_at = now() where id = p_thread;
end;
$$;

create function public.my_threads() returns jsonb language plpgsql stable security definer set search_path = public as
$$ begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  return (select coalesce(jsonb_agg(x order by x.updated_at desc), '[]') from (
    select t.id, t.subject, t.status, t.origin, t.user_unread as unread, t.updated_at,
      (select left(m.body, 120) from public.support_messages m where m.thread_id = t.id order by m.id desc limit 1) as last_message,
      (select m.sender from public.support_messages m where m.thread_id = t.id order by m.id desc limit 1) as last_sender
    from public.support_threads t where t.user_id = auth.uid() order by t.updated_at desc limit 50) x);
end $$;

create function public.thread_messages(p_thread uuid) returns jsonb language plpgsql security definer set search_path = public as
$$
declare t public.support_threads;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into t from public.support_threads where id = p_thread and user_id = auth.uid();
  if not found then raise exception 'thread_not_found'; end if;
  update public.support_threads set user_unread = false where id = p_thread and user_unread;
  return jsonb_build_object('id', t.id, 'subject', t.subject, 'status', t.status, 'origin', t.origin,
    'messages', (select coalesce(jsonb_agg(jsonb_build_object('sender', m.sender, 'body', m.body, 'created_at', m.created_at) order by m.id), '[]') from public.support_messages m where m.thread_id = t.id));
end;
$$;

-- ---------- player: notifications, badge, new players ----------
create function public.my_notifications() returns jsonb language plpgsql stable security definer set search_path = public as
$$ begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  return (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
    select n.id, n.kind, n.title, n.body, n.read, n.created_at, p.display_name as from_name
    from public.notifications n left join public.profiles p on p.id = n.from_user
    where n.user_id = auth.uid() order by n.created_at desc limit 50) x);
end $$;

create function public.mark_notifications_read() returns void language plpgsql security definer set search_path = public as
$$ begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  update public.notifications set read = true where user_id = auth.uid() and not read;
end $$;

-- the number on the inbox badge (and, for admins, the number of unanswered player messages)
create function public.inbox_summary() returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare v_t int; v_n int; v_a int := 0;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select count(*) into v_t from public.support_threads where user_id = auth.uid() and user_unread;
  select count(*) into v_n from public.notifications where user_id = auth.uid() and not read;
  if public.is_admin() then select count(*) into v_a from public.support_threads where admin_unread; end if;
  return jsonb_build_object('threads', v_t, 'notifications', v_n, 'unread', v_t + v_n, 'admin_unread', v_a);
end;
$$;

create function public.new_players(p_limit int default 20) returns jsonb language plpgsql stable security definer set search_path = public as
$$ begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  return jsonb_build_object(
    'total', (select count(*) from public.profiles where created_at > now() - interval '7 days' and adult_confirmed and not banned),
    'players', (select coalesce(jsonb_agg(x order by x.joined_at desc), '[]') from (
      select p.id as user_id, p.display_name as name, floor(sqrt(p.xp / 40.0))::int + 1 as level, p.created_at as joined_at, p.id = auth.uid() as is_me,
             exists (select 1 from public.notifications n where n.user_id = p.id and n.from_user = auth.uid() and n.kind = 'wave') as waved
      from public.profiles p where p.created_at > now() - interval '7 days' and p.adult_confirmed and not p.banned
      order by p.created_at desc limit least(greatest(p_limit, 1), 50)) x));
end $$;

-- A one-tap welcome. Fixed wording (no free text), once per pair, 5 a day.
create function public.wave_hello(p_user uuid) returns void language plpgsql security definer set search_path = public as
$$
declare v_me uuid := auth.uid(); v_name text; v_ok boolean;
begin
  if v_me is null then raise exception 'not_signed_in'; end if;
  if p_user = v_me then raise exception 'cannot_wave_self'; end if;
  select adult_confirmed and not banned, display_name into v_ok, v_name from public.profiles where id = v_me;
  if not coalesce(v_ok, false) then raise exception 'account_suspended'; end if;
  if not exists (select 1 from public.profiles where id = p_user and created_at > now() - interval '7 days' and adult_confirmed and not banned) then raise exception 'not_a_new_player'; end if;
  if (select count(*) from public.notifications where from_user = v_me and kind = 'wave' and created_at > now() - interval '1 day') >= 5 then raise exception 'too_many_waves'; end if;
  begin
    insert into public.notifications (user_id, kind, title, body, from_user) values (p_user, 'wave', v_name || ' says welcome to Bingo Arena!', 'Have fun, and good luck on your first rounds.', v_me);
  exception when unique_violation then raise exception 'already_waved';
  end;
end;
$$;

-- ---------- admin: answer players and write to them first ----------
create function public.admin_threads(p_status text default null) returns jsonb language plpgsql stable security definer set search_path = public as
$$ begin
  perform public.require_admin();
  return (select coalesce(jsonb_agg(x order by x.updated_at desc), '[]') from (
    select t.id, t.subject, t.status, t.origin, t.admin_unread, t.updated_at, t.created_at, t.user_id, p.display_name as player, u.email,
      (select left(m.body, 140) from public.support_messages m where m.thread_id = t.id order by m.id desc limit 1) as last_message,
      (select m.sender from public.support_messages m where m.thread_id = t.id order by m.id desc limit 1) as last_sender,
      (select count(*) from public.support_messages m where m.thread_id = t.id) as messages
    from public.support_threads t join public.profiles p on p.id = t.user_id join auth.users u on u.id = t.user_id
    where p_status is null or p_status = '' or t.status = p_status order by t.admin_unread desc, t.updated_at desc limit 200) x);
end $$;

create function public.admin_thread_messages(p_thread uuid) returns jsonb language plpgsql security definer set search_path = public as
$$
declare t public.support_threads;
begin
  perform public.require_admin();
  select * into t from public.support_threads where id = p_thread;
  if not found then raise exception 'thread_not_found'; end if;
  update public.support_threads set admin_unread = false where id = p_thread and admin_unread;
  return jsonb_build_object('id', t.id, 'subject', t.subject, 'status', t.status, 'origin', t.origin,
    'player', (select jsonb_build_object('id', p.id, 'name', p.display_name, 'email', u.email, 'banned', p.banned) from public.profiles p join auth.users u on u.id = p.id where p.id = t.user_id),
    'messages', (select coalesce(jsonb_agg(jsonb_build_object('sender', m.sender, 'body', m.body, 'created_at', m.created_at) order by m.id), '[]') from public.support_messages m where m.thread_id = t.id));
end;
$$;

create function public.admin_reply(p_thread uuid, p_body text) returns void language plpgsql security definer set search_path = public as
$$ begin
  perform public.require_admin();
  if char_length(trim(coalesce(p_body, ''))) < 1 or char_length(p_body) > 2000 then raise exception 'invalid_message'; end if;
  if not exists (select 1 from public.support_threads where id = p_thread) then raise exception 'thread_not_found'; end if;
  insert into public.support_messages (thread_id, sender, body) values (p_thread, 'admin', trim(p_body));
  update public.support_threads set status = 'answered', user_unread = true, admin_unread = false, updated_at = now() where id = p_thread;
  perform public.admin_log('support_reply', jsonb_build_object('thread', p_thread));
end $$;

create function public.admin_set_thread_status(p_thread uuid, p_status text) returns void language plpgsql security definer set search_path = public as
$$ begin
  perform public.require_admin();
  if p_status not in ('open', 'answered', 'closed') then raise exception 'invalid_status'; end if;
  update public.support_threads set status = p_status, admin_unread = false where id = p_thread;
  if not found then raise exception 'thread_not_found'; end if;
end $$;

create function public.admin_send_message(p_user uuid, p_subject text, p_body text) returns uuid language plpgsql security definer set search_path = public as
$$
declare v_id uuid;
begin
  perform public.require_admin();
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'player_not_found'; end if;
  if char_length(trim(coalesce(p_subject, ''))) < 2 or char_length(p_subject) > 80 then raise exception 'invalid_subject'; end if;
  if char_length(trim(coalesce(p_body, ''))) < 1 or char_length(p_body) > 2000 then raise exception 'invalid_message'; end if;
  insert into public.support_threads (user_id, subject, origin, status, user_unread, admin_unread) values (p_user, trim(p_subject), 'admin', 'answered', true, false) returning id into v_id;
  insert into public.support_messages (thread_id, sender, body) values (v_id, 'admin', trim(p_body));
  perform public.admin_log('send_message', jsonb_build_object('thread', v_id, 'user', p_user, 'subject', p_subject));
  return v_id;
end;
$$;


-- ======================= health check (now also checks the inbox) =======================
create or replace function public.admin_health() returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare f text; out jsonb := '[]';
  fns text[] := array['admin_overview','admin_players','admin_player_detail','admin_adjust_coins','admin_set_banned','admin_save_config','admin_save_item',
    'admin_save_mission','admin_events','admin_save_event','admin_set_event_status','admin_delete_event','admin_finalize_event','admin_pay_league',
    'admin_save_stage','admin_journey_stats','admin_audit','event_leaderboard','league_board','matchmake_tx','settle_stage_tx','claim_album',
    'settle_daily_tx','create_challenge_tx','mastery','export_my_data','accept_terms','set_guide_seen','create_crew','crew_info','claim_crew_chest','admin_pay_crews','season_info','claim_season_tier','admin_save_liveop','admin_save_season','valid_reward','contact_support','reply_support','admin_reply','admin_send_message','wave_hello','inbox_summary','new_players'];
  tbls text[] := array['events','matches','match_queue','league_payouts','worlds','stages','stamps','user_stages','daily_boards','challenges','mastery_tiers','liveops','crews','seasons','season_tiers','support_threads','support_messages','notifications'];
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

-- ======================= permissions =======================
revoke all on public.support_threads, public.support_messages, public.notifications from anon, authenticated;
revoke all on function public.contact_support(text, text), public.reply_support(uuid, text), public.my_threads(), public.thread_messages(uuid), public.my_notifications(), public.mark_notifications_read(), public.inbox_summary(), public.new_players(int), public.wave_hello(uuid), public.admin_threads(text), public.admin_thread_messages(uuid), public.admin_reply(uuid, text), public.admin_set_thread_status(uuid, text), public.admin_send_message(uuid, text, text) from public, anon, authenticated;
grant execute on function public.contact_support(text, text), public.reply_support(uuid, text), public.my_threads(), public.thread_messages(uuid), public.my_notifications(), public.mark_notifications_read(), public.inbox_summary(), public.new_players(int), public.wave_hello(uuid), public.admin_threads(text), public.admin_thread_messages(uuid), public.admin_reply(uuid, text), public.admin_set_thread_status(uuid, text), public.admin_send_message(uuid, text, text) to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
