-- Bingo Arena 0.25.0: invite friends (referrals) with rewards and fraud checks.
--   * Every player has a personal invite link (?r=CODE). A new player who opens it is linked to the inviter.
--   * The inviter earns coins and gems step by step: the friend saves an account, plays 3 rounds, comes back on a
--     second day, and is active on 7 days. The friend gets a welcome bonus after the first round. All amounts and limits
--     are set in Admin → Referrals.
--   * Fraud checks when the link is used: not the inviter's own account, not the same internet connection (IP), the
--     same browser or the same device as the inviter, the account must be brand new, and daily/lifetime caps.
--     IP addresses are never stored: only a salted one-way hash (fingerprint) made by the server function.
--   * Suspicious invites wait in Admin → Referrals for you to approve or reject. Blocked invites never pay.

-- ============ tables ============
alter table public.profiles add column if not exists ref_code text unique;

create table public.referral_settings (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default true,
  friend_coins int not null default 100 check (friend_coins between 0 and 10000),
  reg_coins int not null default 100 check (reg_coins between 0 and 10000),
  reg_gems int not null default 0 check (reg_gems between 0 and 1000),
  play_rounds int not null default 3 check (play_rounds between 1 and 50),
  play_coins int not null default 150 check (play_coins between 0 and 10000),
  play_gems int not null default 0 check (play_gems between 0 and 1000),
  ret_coins int not null default 0 check (ret_coins between 0 and 10000),
  ret_gems int not null default 5 check (ret_gems between 0 and 1000),
  week_days int not null default 7 check (week_days between 3 and 30),
  week_coins int not null default 500 check (week_coins between 0 and 20000),
  week_gems int not null default 10 check (week_gems between 0 and 1000),
  window_days int not null default 30 check (window_days between 7 and 90),
  daily_cap int not null default 10 check (daily_cap between 1 and 100),
  lifetime_cap int not null default 100 check (lifetime_cap between 1 and 10000),
  max_per_ip int not null default 2 check (max_per_ip between 1 and 20),
  updated_at timestamptz not null default now()
);
insert into public.referral_settings (id) values (1);
alter table public.referral_settings enable row level security;

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer uuid not null references public.profiles (id) on delete cascade,
  referred uuid not null unique references public.profiles (id) on delete cascade,
  code text not null,
  status text not null default 'ok' check (status in ('ok', 'review', 'blocked', 'rejected', 'capped')),
  reason text not null default '',
  ip_hash text, device_hash text, vid uuid,
  friend_paid boolean not null default false,
  m_register timestamptz, m_play timestamptz, m_return timestamptz, m_week timestamptz,
  coins_paid int not null default 0, gems_paid int not null default 0,
  decided_by uuid, decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index referrals_referrer_idx on public.referrals (referrer, created_at desc);
alter table public.referrals enable row level security;

-- connection, device and browser fingerprints seen per player (hashes only), used to spot self-referrals
create table public.player_marks (
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('ip', 'dev', 'vid')),
  hash text not null check (char_length(hash) between 8 and 80),
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  hits int not null default 1,
  primary key (user_id, kind, hash)
);
create index player_marks_hash_idx on public.player_marks (kind, hash);
alter table public.player_marks enable row level security;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in ('wave', 'info', 'prize', 'overtake', 'referral'));

-- ============ fingerprints (server function only) ============
create function public.note_marks(p_user uuid, p_ip text, p_dev text, p_vid text) returns void
language plpgsql security definer set search_path = public as
$$
declare k text; h text;
begin
  foreach k in array array['ip', 'dev', 'vid'] loop
    h := case k when 'ip' then p_ip when 'dev' then p_dev else p_vid end;
    if coalesce(h, '') ~ '^[a-zA-Z0-9-]{8,80}$' then
      insert into public.player_marks as m (user_id, kind, hash) values (p_user, k, h)
        on conflict (user_id, kind, hash) do update set last_seen = now(), hits = least(m.hits + 1, 100000);
    end if;
  end loop;
end;
$$;

-- ============ invite code ============
create function public.ensure_ref_code(p_user uuid) returns text language plpgsql security definer set search_path = public as
$$
declare v text; abc text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int;
begin
  select ref_code into v from public.profiles where id = p_user;
  if v is not null then return v; end if;
  loop
    v := '';
    for i in 1..7 loop v := v || substr(abc, 1 + floor(random() * length(abc))::int, 1); end loop;
    begin
      update public.profiles set ref_code = v where id = p_user and ref_code is null;
      exit;
    exception when unique_violation then -- try another code
    end;
  end loop;
  select ref_code into v from public.profiles where id = p_user;
  return v;
end;
$$;

-- who invited me (shown on the welcome card); null when the code is unknown or invites are off
create function public.ref_lookup(p_code text) returns text language sql stable security definer set search_path = public as
$$
  select p.display_name from public.profiles p, public.referral_settings s
  where s.enabled and p.ref_code = upper(trim(p_code)) and not p.banned and coalesce(p_code, '') ~* '^[A-Z0-9]{5,10}$'
$$;

-- ============ using an invite link (server function refer-claim only) ============
create function public.refer_claim_tx(p_referred uuid, p_code text, p_ip text, p_dev text, p_vid uuid) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare s public.referral_settings; v_ref uuid; v_rname text; v_new public.profiles; v_status text := 'ok'; v_reason text := ''; v_today int; v_total int; v_ipn int;
begin
  select * into s from public.referral_settings where id = 1;
  if not s.enabled then return jsonb_build_object('ok', false, 'error', 'referrals_off'); end if;
  select id, display_name into v_ref, v_rname from public.profiles where ref_code = upper(trim(p_code)) and not banned;
  if v_ref is null then return jsonb_build_object('ok', false, 'error', 'bad_code'); end if;
  if v_ref = p_referred then return jsonb_build_object('ok', false, 'error', 'self_referral'); end if;
  perform pg_advisory_xact_lock(hashtextextended(v_ref::text, 20));
  if exists (select 1 from public.referrals where referred = p_referred) then return jsonb_build_object('ok', false, 'error', 'already_referred'); end if;
  select * into v_new from public.profiles where id = p_referred;
  -- only brand-new players can be invited
  if v_new.id is null or v_new.created_at < now() - interval '48 hours' or v_new.played > 5 then return jsonb_build_object('ok', false, 'error', 'not_new'); end if;
  -- the inviter cannot be someone this player invited (A invites B, B invites A)
  if exists (select 1 from public.referrals where referrer = p_referred and referred = v_ref) then return jsonb_build_object('ok', false, 'error', 'self_referral'); end if;

  -- fraud checks against the inviter's own connections, devices and browsers
  if p_ip is not null and exists (select 1 from public.player_marks where user_id = v_ref and kind = 'ip' and hash = p_ip and last_seen > now() - interval '60 days') then
    v_status := 'blocked'; v_reason := 'same_network';
  elsif p_dev is not null and exists (select 1 from public.player_marks where user_id = v_ref and kind = 'dev' and hash = p_dev) then
    v_status := 'blocked'; v_reason := 'same_device';
  elsif p_vid is not null and (exists (select 1 from public.player_marks where user_id = v_ref and kind = 'vid' and hash = p_vid::text)
                               or exists (select 1 from public.visits where user_id = v_ref and vid = p_vid)) then
    v_status := 'blocked'; v_reason := 'same_browser';
  elsif p_dev is not null and exists (select 1 from public.referrals where referrer = v_ref and device_hash = p_dev) then
    v_status := 'blocked'; v_reason := 'device_used_before';
  elsif p_vid is not null and exists (select 1 from public.referrals where referrer = v_ref and vid = p_vid) then
    v_status := 'blocked'; v_reason := 'browser_used_before';
  end if;
  if v_status = 'ok' then
    select count(*) into v_ipn from public.referrals where referrer = v_ref and ip_hash = p_ip and created_at > now() - interval '30 days';
    select count(*) filter (where created_at >= date_trunc('day', now())), count(*) filter (where status in ('ok', 'review'))
      into v_today, v_total from public.referrals where referrer = v_ref;
    if p_ip is not null and v_ipn >= s.max_per_ip then v_status := 'review'; v_reason := 'many_from_one_network';
    elsif v_total >= s.lifetime_cap then v_status := 'capped'; v_reason := 'lifetime_cap';
    elsif v_today >= s.daily_cap then v_status := 'review'; v_reason := 'daily_cap';
    elsif p_ip is null and p_dev is null then v_status := 'review'; v_reason := 'no_fingerprint';
    end if;
  end if;

  insert into public.referrals (referrer, referred, code, status, reason, ip_hash, device_hash, vid)
    values (v_ref, p_referred, upper(trim(p_code)), v_status, v_reason, p_ip, p_dev, p_vid);
  perform public.note_marks(p_referred, p_ip, p_dev, p_vid::text);
  if v_status in ('ok', 'review') then
    perform public.notify(v_ref, 'referral', v_new.display_name || ' joined with your invite link!',
      'You earn rewards as they play: when they save their account, play ' || s.play_rounds || ' rounds, come back on another day and play on ' || s.week_days || ' days. See Invite friends.', p_referred);
  end if;
  return jsonb_build_object('ok', true, 'status', v_status, 'inviter', v_rname, 'friend_coins', case when v_status = 'ok' then s.friend_coins else 0 end);
end;
$$;

-- ============ rewards: checked whenever the invited player plays, saves or logs in ============
create function public.ref_pay(p_ref public.referrals, p_step text, p_coins int, p_gems int, p_label text) returns void
language plpgsql security definer set search_path = public as
$$
declare v_name text;
begin
  select display_name into v_name from public.profiles where id = p_ref.referred;
  if p_coins > 0 then insert into public.ledger (user_id, amount, reason, ref) values (p_ref.referrer, p_coins, 'Invite reward: ' || v_name || ' ' || p_label, 'ref:' || p_ref.id || ':' || p_step); end if;
  if p_gems > 0 then insert into public.gem_ledger (user_id, amount, reason, ref) values (p_ref.referrer, p_gems, 'Invite reward: ' || v_name || ' ' || p_label, 'ref:' || p_ref.id || ':' || p_step); end if;
  if p_coins > 0 or p_gems > 0 then
    update public.referrals set coins_paid = coins_paid + p_coins, gems_paid = gems_paid + p_gems where id = p_ref.id;
    perform public.notify(p_ref.referrer, 'prize', 'Invite reward: ' || concat_ws(' and ', case when p_coins > 0 then '+' || p_coins || ' coins' end, case when p_gems > 0 then '+' || p_gems || ' gems' end),
      v_name || ' ' || p_label || '. Thanks for bringing them!', p_ref.referred);
  end if;
end;
$$;

create function public.ref_progress(p_user uuid) returns void language plpgsql security definer set search_path = public as
$$
declare r public.referrals; s public.referral_settings; v_saved boolean; v_rounds int; v_days int; v_until timestamptz;
begin
  select * into r from public.referrals where referred = p_user for update;
  if r.id is null or r.status <> 'ok' then return; end if;
  select * into s from public.referral_settings where id = 1;
  if not s.enabled then return; end if;
  v_until := r.created_at + make_interval(days => s.window_days);
  select not is_guest into v_saved from public.profiles where id = p_user;
  -- real rounds only (a score above 0) inside the reward window
  select count(*) into v_rounds from public.rounds where user_id = p_user and status = 'scored' and coalesce(score, 0) > 0 and finished_at <= v_until;
  select count(distinct d) into v_days from (
    select day as d from public.visits where user_id = p_user and day <= v_until::date
    union select finished_at::date from public.rounds where user_id = p_user and status = 'scored' and finished_at <= v_until) x;

  if not r.friend_paid and v_rounds >= 1 then
    if s.friend_coins > 0 then insert into public.ledger (user_id, amount, reason, ref) values (p_user, s.friend_coins, 'Welcome bonus: invited by a friend', 'ref:' || r.id || ':friend'); end if;
    update public.referrals set friend_paid = true where id = r.id;
  end if;
  if r.m_register is null and v_saved and v_rounds >= 1 then
    update public.referrals set m_register = now() where id = r.id;
    perform public.ref_pay(r, 'register', s.reg_coins, s.reg_gems, 'saved their account');
  end if;
  if r.m_play is null and v_rounds >= s.play_rounds then
    update public.referrals set m_play = now() where id = r.id;
    perform public.ref_pay(r, 'play', s.play_coins, s.play_gems, 'played ' || s.play_rounds || ' rounds');
  end if;
  if r.m_return is null and v_days >= 2 and v_rounds >= 1 then
    update public.referrals set m_return = now() where id = r.id;
    perform public.ref_pay(r, 'return', s.ret_coins, s.ret_gems, 'came back on another day');
  end if;
  if r.m_week is null and v_days >= s.week_days and v_rounds >= s.play_rounds then
    update public.referrals set m_week = now() where id = r.id;
    perform public.ref_pay(r, 'week', s.week_coins, s.week_gems, 'played on ' || s.week_days || ' days');
  end if;
end;
$$;

create function public.ref_on_round() returns trigger language plpgsql security definer set search_path = public as
$$ begin if exists (select 1 from public.referrals where referred = new.user_id and status = 'ok') then perform public.ref_progress(new.user_id); end if; return new; end $$;
create trigger ref_on_round after update of status on public.rounds
  for each row when (new.status = 'scored' and old.status is distinct from 'scored') execute function public.ref_on_round();

create function public.ref_on_profile() returns trigger language plpgsql security definer set search_path = public as
$$ begin if exists (select 1 from public.referrals where referred = new.id and status = 'ok') then perform public.ref_progress(new.id); end if; return new; end $$;
create trigger ref_on_profile after update of is_guest, last_login on public.profiles
  for each row execute function public.ref_on_profile();

-- ============ the player's Invite friends page ============
create function public.my_referral() returns jsonb language plpgsql security definer set search_path = public as
$$
declare v_user uuid := auth.uid(); s public.referral_settings; v_code text;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  select * into s from public.referral_settings where id = 1;
  v_code := public.ensure_ref_code(v_user);
  return jsonb_build_object(
    'enabled', s.enabled, 'code', v_code,
    'rewards', jsonb_build_object('friend_coins', s.friend_coins, 'reg_coins', s.reg_coins, 'reg_gems', s.reg_gems, 'play_rounds', s.play_rounds,
      'play_coins', s.play_coins, 'play_gems', s.play_gems, 'ret_coins', s.ret_coins, 'ret_gems', s.ret_gems, 'week_days', s.week_days,
      'week_coins', s.week_coins, 'week_gems', s.week_gems, 'window_days', s.window_days),
    'stats', (select jsonb_build_object('invited', count(*), 'active', count(*) filter (where status = 'ok'),
        'registered', count(m_register), 'played', count(m_play), 'returned', count(m_return), 'week', count(m_week),
        'coins', coalesce(sum(coins_paid), 0), 'gems', coalesce(sum(gems_paid), 0))
      from public.referrals where referrer = v_user),
    'friends', (select coalesce(jsonb_agg(jsonb_build_object('name', p.display_name, 'joined', r.created_at, 'status', r.status,
        'register', r.m_register is not null, 'play', r.m_play is not null, 'return', r.m_return is not null, 'week', r.m_week is not null,
        'rounds', p.played, 'coins', r.coins_paid, 'gems', r.gems_paid, 'saved', not p.is_guest,
        'ends', r.created_at + make_interval(days => s.window_days)) order by r.created_at desc), '[]')
      from (select * from public.referrals where referrer = v_user order by created_at desc limit 100) r join public.profiles p on p.id = r.referred));
end;
$$;

-- ============ admin ============
create function public.admin_referrals(p_days int default 30) returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare v_from timestamptz := now() - make_interval(days => case when p_days in (7, 30, 90, 365) then p_days else 30 end);
begin
  perform public.require_admin();
  return jsonb_build_object(
    'settings', (select to_jsonb(s) - 'id' from public.referral_settings s),
    'kpis', (select jsonb_build_object('invited', count(*), 'referrers', count(distinct referrer),
        'ok', count(*) filter (where status = 'ok'), 'review', count(*) filter (where status = 'review'),
        'blocked', count(*) filter (where status = 'blocked'), 'rejected', count(*) filter (where status = 'rejected'), 'capped', count(*) filter (where status = 'capped'),
        'registered', count(m_register), 'played', count(m_play), 'returned', count(m_return), 'week', count(m_week),
        'coins', coalesce(sum(coins_paid), 0), 'gems', coalesce(sum(gems_paid), 0),
        'friend_coins', (select coalesce(sum(amount), 0) from public.ledger where ref like 'ref:%:friend' and created_at >= v_from))
      from public.referrals where created_at >= v_from),
    'all_time', (select jsonb_build_object('invited', count(*), 'coins', coalesce(sum(coins_paid), 0), 'gems', coalesce(sum(gems_paid), 0),
        'with_code', (select count(*) from public.profiles where ref_code is not null)) from public.referrals),
    'reasons', (select coalesce(jsonb_object_agg(reason, n), '{}') from (select reason, count(*) n from public.referrals where created_at >= v_from and reason <> '' group by reason) x),
    'top', (select coalesce(jsonb_agg(to_jsonb(x) order by x.ok desc, x.invited desc), '[]') from (
        select p.id, p.display_name as name, count(*) as invited, count(*) filter (where r.status = 'ok') as ok,
               count(*) filter (where r.status in ('blocked', 'rejected')) as bad, count(r.m_play) as played, count(r.m_week) as week,
               sum(r.coins_paid) as coins, sum(r.gems_paid) as gems
        from public.referrals r join public.profiles p on p.id = r.referrer where r.created_at >= v_from
        group by p.id, p.display_name order by count(*) filter (where r.status = 'ok') desc limit 20) x),
    'rows', (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]') from (
        select r.id, r.created_at, r.status, r.reason, a.display_name as referrer, b.display_name as referred, b.joined_on, b.is_guest, b.played,
               r.m_register is not null as register, r.m_play is not null as play, r.m_return is not null as return_day, r.m_week is not null as week,
               r.coins_paid, r.gems_paid, r.friend_paid,
               (select count(*) from public.referrals r2 where r2.ip_hash = r.ip_hash and r.ip_hash is not null) as same_ip
        from public.referrals r join public.profiles a on a.id = r.referrer join public.profiles b on b.id = r.referred
        where r.created_at >= v_from order by (r.status = 'review') desc, r.created_at desc limit 300) x));
end;
$$;

create function public.admin_ref_decide(p_id uuid, p_ok boolean) returns void language plpgsql security definer set search_path = public as
$$
declare r public.referrals;
begin
  perform public.require_admin();
  select * into r from public.referrals where id = p_id;
  if r.id is null then raise exception 'item_not_found'; end if;
  update public.referrals set status = case when p_ok then 'ok' else 'rejected' end, decided_by = auth.uid(), decided_at = now() where id = p_id;
  perform public.admin_log('referral_' || case when p_ok then 'approved' else 'rejected' end, jsonb_build_object('id', p_id, 'was', r.status, 'reason', r.reason));
  if p_ok then perform public.ref_progress(r.referred); end if; -- pays every step already reached
end;
$$;

create function public.admin_save_ref_settings(p jsonb) returns void language plpgsql security definer set search_path = public as
$$
begin
  perform public.require_admin();
  begin
    update public.referral_settings set
      enabled = coalesce((p ->> 'enabled')::boolean, enabled),
      friend_coins = coalesce((p ->> 'friend_coins')::int, friend_coins),
      reg_coins = coalesce((p ->> 'reg_coins')::int, reg_coins), reg_gems = coalesce((p ->> 'reg_gems')::int, reg_gems),
      play_rounds = coalesce((p ->> 'play_rounds')::int, play_rounds), play_coins = coalesce((p ->> 'play_coins')::int, play_coins), play_gems = coalesce((p ->> 'play_gems')::int, play_gems),
      ret_coins = coalesce((p ->> 'ret_coins')::int, ret_coins), ret_gems = coalesce((p ->> 'ret_gems')::int, ret_gems),
      week_days = coalesce((p ->> 'week_days')::int, week_days), week_coins = coalesce((p ->> 'week_coins')::int, week_coins), week_gems = coalesce((p ->> 'week_gems')::int, week_gems),
      window_days = coalesce((p ->> 'window_days')::int, window_days), daily_cap = coalesce((p ->> 'daily_cap')::int, daily_cap),
      lifetime_cap = coalesce((p ->> 'lifetime_cap')::int, lifetime_cap), max_per_ip = coalesce((p ->> 'max_per_ip')::int, max_per_ip),
      updated_at = now()
    where id = 1;
  exception when check_violation or invalid_text_representation or numeric_value_out_of_range then raise exception 'invalid_referral_settings';
  end;
  perform public.admin_log('save_referral_settings', p);
end;
$$;

-- ============ permissions ============
revoke all on function public.note_marks(uuid, text, text, text), public.ensure_ref_code(uuid), public.refer_claim_tx(uuid, text, text, text, uuid),
  public.ref_pay(public.referrals, text, int, int, text), public.ref_progress(uuid), public.ref_on_round(), public.ref_on_profile() from public, anon, authenticated;
grant execute on function public.note_marks(uuid, text, text, text), public.refer_claim_tx(uuid, text, text, text, uuid) to service_role;
revoke all on function public.ref_lookup(text) from public;
grant execute on function public.ref_lookup(text) to anon, authenticated;
revoke all on function public.my_referral(), public.admin_referrals(int), public.admin_ref_decide(uuid, boolean), public.admin_save_ref_settings(jsonb) from public, anon;
grant execute on function public.my_referral(), public.admin_referrals(int), public.admin_ref_decide(uuid, boolean), public.admin_save_ref_settings(jsonb) to authenticated;
grant all on public.referral_settings, public.referrals, public.player_marks to service_role;

-- health check also looks for the referral pieces
create or replace function public.admin_health() returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare f text; out jsonb := '[]';
  fns text[] := array['admin_overview','admin_players','admin_player_detail','admin_adjust_coins','admin_set_banned','admin_save_config','admin_save_item',
    'admin_save_mission','admin_events','admin_save_event','admin_set_event_status','admin_delete_event','admin_finalize_event','admin_pay_league',
    'admin_save_stage','admin_journey_stats','admin_audit','event_leaderboard','league_board','matchmake_tx','settle_stage_tx','claim_album',
    'settle_daily_tx','create_challenge_tx','mastery','export_my_data','accept_terms','set_guide_seen','create_crew','crew_info','claim_crew_chest','admin_pay_crews','season_info','claim_season_tier','admin_save_liveop','admin_save_season','valid_reward','contact_support','reply_support','admin_reply','admin_send_message','wave_hello','inbox_summary','new_players','settle_drill_tx','grant_purchase','buy_test','my_economy','club_claim','gem_spend','admin_store','claim_ad_reward','my_ad_status','admin_ads','track_visit','track_step','admin_analytics','admin_geo','auto_run','auto_tick','admin_auto','admin_online','presence_ping','league_info','live_races','finalize_event_tx','relay_put','relay_take','admin_joined_on','arena_status','send_invite','answer_invite','online_players','admin_save_links','guest_saved','cg_attach','login_calendar','admin_set_cg_ads','refer_claim_tx','ref_progress','my_referral','admin_referrals','admin_ref_decide','admin_save_ref_settings','note_marks'];
  tbls text[] := array['events','matches','match_queue','league_payouts','worlds','stages','stamps','user_stages','daily_boards','challenges','mastery_tiers','liveops','crews','seasons','season_tiers','support_threads','support_messages','notifications','visits','auto_settings','event_templates','liveop_templates','auth_relay','match_invites','app_links','referrals','referral_settings','player_marks'];
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
  out := out || jsonb_build_object('kind', 'data', 'name', 'login calendar has 7 rewards', 'ok', array_length(public.calendar_rewards(), 1) = 7);
  out := out || jsonb_build_object('kind', 'data', 'name', 'your account is an admin', 'ok', public.is_admin());
  return out;
end;
$$;
revoke all on function public.admin_health() from public, anon, authenticated;
grant execute on function public.admin_health() to authenticated;
