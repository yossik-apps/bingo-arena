-- Bingo Arena 0.24.0: instant play and coming back.
--   * Guest accounts: a visitor who presses Play gets a real account at once (Supabase "anonymous sign-in"): coins, levels,
--     quests, events and leagues all work. "Save your progress" later adds Google or email to the same account.
--     Needs: Supabase → Authentication → Sign In / Providers → "Allow anonymous sign-ins" ON.
--   * CrazyGames accounts: players logged in to CrazyGames are recognised automatically (server function cg-login).
--     profiles.cg_user links the CrazyGames user ID to one account; it is set only by the server (app metadata).
--   * 7-day login calendar: rising daily rewards (game_config g.calendar), day 7 also opens a stamp pack.
--   * CrazyGames reward videos (their ads are the only ones allowed there).

alter table public.profiles add column if not exists is_guest boolean not null default false;
alter table public.profiles add column if not exists cg_user text unique;

-- ============ new accounts ============
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as
$$
declare v_name text; v_bonus int; v_adult boolean; v_terms_only boolean; v_cg boolean; v_guest boolean; v_prov text; v_cg_user text;
begin
  v_prov := coalesce(new.raw_app_meta_data ->> 'provider', 'email');
  -- is_anonymous is set by Supabase itself (a player cannot fake it)
  v_guest := coalesce((to_jsonb(new) ->> 'is_anonymous')::boolean, false) or v_prov = 'anonymous';
  v_cg_user := nullif(left(new.raw_app_meta_data ->> 'cg_user', 64), ''); -- app metadata: only the server can set it
  v_name := left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
                          nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
                          nullif(split_part(coalesce(new.email, ''), '@', 1), '')), 20);
  if char_length(coalesce(v_name, '')) < 2 then v_name := 'Player' || (1000 + floor(random() * 9000))::int; end if;
  v_cg := coalesce(new.raw_user_meta_data ->> 'joined_on', '') = 'crazygames' or v_cg_user is not null;
  v_adult := not v_guest and coalesce((new.raw_user_meta_data ->> 'adult') = 'true', false) and v_prov = 'email';
  -- Terms without 18+: CrazyGames sign-ups, and guests (the Play screen says "by playing you accept the Terms")
  v_terms_only := coalesce((new.raw_user_meta_data ->> 'terms') = 'true', false) and ((v_cg and v_prov = 'email') or v_guest);
  insert into public.profiles (id, display_name, adult_confirmed, age_18, joined_on, terms_at, terms_version, is_guest, cg_user)
    values (new.id, v_name, v_adult or v_terms_only, v_adult, case when v_cg then 'crazygames' else 'web' end,
            case when v_adult or v_terms_only then now() end,
            case when v_adult or v_terms_only then left(new.raw_user_meta_data ->> 'terms_version', 20) end,
            v_guest, v_cg_user);
  select coalesce((data -> 'g' ->> 'welcome')::int, 0) into v_bonus from public.game_config;
  if v_bonus > 0 then insert into public.ledger (user_id, amount, reason) values (new.id, v_bonus, 'Registration bonus'); end if;
  return new;
end;
$$;

-- a guest who adds an email or Google (or is linked to CrazyGames) is no longer a guest
create or replace function public.handle_user_saved() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
  if coalesce(new.email, '') <> '' and coalesce((to_jsonb(new) ->> 'is_anonymous')::boolean, false) = false
     or coalesce(new.email, '') <> '' and coalesce(old.email, '') = '' then
    update public.profiles set is_guest = false where id = new.id and is_guest;
  end if;
  return new;
end;
$$;
drop trigger if exists on_auth_user_saved on auth.users;
create trigger on_auth_user_saved after update on auth.users for each row execute function public.handle_user_saved();

-- the game calls this right after "Save your progress" succeeded (in case the trigger above is slower than the screen)
create function public.guest_saved() returns boolean language plpgsql security definer set search_path = public as
$$
declare v_email text;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select email into v_email from auth.users where id = auth.uid();
  if coalesce(v_email, '') = '' then return false; end if;
  update public.profiles set is_guest = false where id = auth.uid();
  return true;
end;
$$;

-- server only (cg-login): link a CrazyGames user to an account that already exists
create function public.cg_attach(p_user uuid, p_cg text, p_name text) returns void language plpgsql security definer set search_path = public as
$$
begin
  if coalesce(p_cg, '') = '' or char_length(p_cg) > 64 then raise exception 'bad_request'; end if;
  update public.profiles set cg_user = p_cg, is_guest = false,
    joined_on = case when is_guest then 'crazygames' else joined_on end,
    -- a guest still has the name the game picked; use the CrazyGames name instead
    display_name = case when is_guest and char_length(trim(coalesce(p_name, ''))) between 2 and 20 then trim(p_name) else display_name end
  where id = p_user and (cg_user is null or cg_user = p_cg);
  if not found then raise exception 'already_linked'; end if;
end;
$$;

-- ============ 7-day login calendar ============
update public.game_config set data = jsonb_set(data, '{g,calendar}', '[20,30,40,50,75,100,200]'::jsonb) where not (data -> 'g' ? 'calendar');

create or replace function public.calendar_rewards() returns int[] language sql stable security definer set search_path = public as
$$
  select case when jsonb_typeof(data -> 'g' -> 'calendar') = 'array' and jsonb_array_length(data -> 'g' -> 'calendar') = 7
    then array(select least(greatest(x::int, 0), 10000) from jsonb_array_elements_text(data -> 'g' -> 'calendar') x)
    else array[20,30,40,50,75,100,200] end
  from public.game_config limit 1
$$;

create or replace function public.claim_daily(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare v_last date; v_streak int; v_new int; v_bonus int; v_pack jsonb; v_sh int; v_used boolean := false; v_cal int[]; v_day int;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 1));
  select last_login, streak, shields into v_last, v_streak, v_sh from public.profiles where id = p_user;
  v_cal := public.calendar_rewards();
  if v_last = current_date then
    v_day := ((greatest(v_streak, 1) - 1) % 7) + 1;
    return jsonb_build_object('claimed', false, 'streak', v_streak, 'bonus', 0, 'day', v_day, 'next', v_cal[(v_day % 7) + 1]);
  end if;
  if v_last = current_date - 1 then v_new := v_streak + 1;
  elsif v_last = current_date - 2 and v_sh > 0 then v_new := v_streak + 1; v_used := true;
  else v_new := 1; end if;
  v_day := ((v_new - 1) % 7) + 1;
  v_bonus := v_cal[v_day];
  update public.profiles set last_login = current_date, streak = v_new, last_seen = now(), shields = shields - case when v_used then 1 else 0 end where id = p_user;
  if v_bonus > 0 then insert into public.ledger (user_id, amount, reason) values (p_user, v_bonus, 'Daily login reward (day ' || v_day || ')'); end if;
  if v_day = 7 then v_pack := public.open_pack_tx(p_user, public.current_world(p_user)); end if;
  return jsonb_build_object('claimed', true, 'streak', v_new, 'bonus', v_bonus, 'pack', v_pack, 'shield_used', v_used, 'day', v_day, 'next', v_cal[(v_day % 7) + 1]);
end;
$$;

-- what the calendar shows: the 7 rewards, today's place and tomorrow's reward
create function public.login_calendar() returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare v_last date; v_streak int; v_sh int; v_cal int[]; v_day int; v_today boolean; v_alive boolean;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select last_login, streak, shields into v_last, v_streak, v_sh from public.profiles where id = auth.uid();
  v_cal := public.calendar_rewards();
  v_today := v_last = current_date;
  v_alive := v_last >= current_date - 1 or (v_last = current_date - 2 and v_sh > 0);
  -- the day that is (or will be) claimed today
  v_day := case when v_today then ((greatest(v_streak, 1) - 1) % 7) + 1 when v_alive then (v_streak % 7) + 1 else 1 end;
  return jsonb_build_object('rewards', to_jsonb(v_cal), 'day', v_day, 'claimed_today', v_today, 'streak', coalesce(v_streak, 0),
    'next', case when v_today then v_cal[(v_day % 7) + 1] else v_cal[v_day] end, 'shields', coalesce(v_sh, 0));
end;
$$;

-- ============ CrazyGames reward videos ============
alter table public.ad_settings add column if not exists cg_enabled boolean not null default true;

create or replace function public.my_ad_status() returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare v_user uuid := auth.uid(); s public.ad_settings; v_today int;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  select * into s from public.ad_settings where id = 1;
  select count(*) into v_today from public.ad_rewards where user_id = v_user and created_at >= date_trunc('day', now());
  return jsonb_build_object('enabled', s.enabled and s.client <> '', 'client', s.client, 'test_mode', s.test_mode, 'reward_coins', s.reward_coins,
    'left_today', greatest(0, s.daily_cap - v_today), 'interstitial', s.interstitial, 'every_n_rounds', s.every_n_rounds,
    'club', exists (select 1 from public.club_members where user_id = v_user and until > now()), 'cg_enabled', s.cg_enabled);
end;
$$;

-- placements starting with cg_ are CrazyGames videos: allowed when CrazyGames videos are on, even with Google ads off
create or replace function public.claim_ad_reward(p_placement text) returns jsonb language plpgsql security definer set search_path = public as
$$
declare v_user uuid := auth.uid(); s public.ad_settings; v_today int; v_last timestamptz;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 13));
  select * into s from public.ad_settings where id = 1;
  if p_placement !~ '^[a-z_]{2,30}$' then raise exception 'bad_request'; end if;
  if p_placement like 'cg\_%' then
    if not s.cg_enabled then raise exception 'ads_off'; end if;
  elsif not s.enabled or s.client = '' then raise exception 'ads_off'; end if;
  select count(*), max(created_at) into v_today, v_last from public.ad_rewards where user_id = v_user and created_at >= date_trunc('day', now());
  if v_today >= s.daily_cap then raise exception 'ad_limit'; end if;
  if v_last is not null and v_last > now() - interval '20 seconds' then raise exception 'ad_too_soon'; end if;
  insert into public.ad_rewards (user_id, placement, coins) values (v_user, p_placement, s.reward_coins);
  insert into public.ledger (user_id, amount, reason, ref) values (v_user, s.reward_coins, 'Reward video', 'ad:' || p_placement);
  return jsonb_build_object('coins', s.reward_coins, 'left_today', s.daily_cap - v_today - 1);
end;
$$;

create function public.admin_set_cg_ads(p_on boolean) returns void language plpgsql security definer set search_path = public as
$$
begin
  perform public.require_admin();
  update public.ad_settings set cg_enabled = coalesce(p_on, true), updated_at = now() where id = 1;
  perform public.admin_log('set_cg_ads', jsonb_build_object('on', p_on));
end;
$$;

-- ============ analytics: the new first steps ============
alter table public.visits add column if not exists guest_start boolean not null default false;
alter table public.visits add column if not exists save_open boolean not null default false;
alter table public.visits add column if not exists save_done boolean not null default false;
alter table public.visits add column if not exists cg_login boolean not null default false;

create or replace function public.track_step(p_vid uuid, p_step text) returns void
language plpgsql security definer set search_path = public as
$$
begin
  if p_vid is null or p_step not in ('guest_round', 'signup_open', 'signup_google', 'signup_email', 'confirm_needed', 'guest_start', 'save_open', 'save_done', 'cg_login') then raise exception 'bad_request'; end if;
  insert into public.visits as v (vid, day, user_id, guest_rounds, signup_open, signup_google, signup_email, confirm_needed, guest_start, save_open, save_done, cg_login)
  values (p_vid, current_date, auth.uid(), case when p_step = 'guest_round' then 1 else 0 end, p_step = 'signup_open', p_step = 'signup_google', p_step = 'signup_email',
          p_step = 'confirm_needed', p_step = 'guest_start', p_step = 'save_open', p_step = 'save_done', p_step = 'cg_login')
  on conflict (vid, day) do update set last_at = now(), user_id = coalesce(auth.uid(), v.user_id),
    guest_rounds = least(v.guest_rounds + case when p_step = 'guest_round' then 1 else 0 end, 500),
    signup_open = v.signup_open or p_step = 'signup_open',
    signup_google = v.signup_google or p_step = 'signup_google',
    signup_email = v.signup_email or p_step = 'signup_email',
    confirm_needed = v.confirm_needed or p_step = 'confirm_needed',
    guest_start = v.guest_start or p_step = 'guest_start',
    save_open = v.save_open or p_step = 'save_open',
    save_done = v.save_done or p_step = 'save_done',
    cg_login = v.cg_login or p_step = 'cg_login';
end;
$$;

create or replace function public.admin_signup_steps(p_days int default 30) returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare v_from date := current_date - (case when p_days in (7, 30, 90) then p_days else 30 end - 1);
begin
  perform public.require_admin();
  return (with nv as (select vid from public.visits group by vid having min(day) >= v_from),
               d as (select v.* from public.visits v join nv using (vid)),
               u as (select distinct d.vid, p.is_guest, p.played from d join public.profiles p on p.id = d.user_id)
          select jsonb_build_object(
            'visitors', (select count(*) from nv),
            'guest_start', (select count(distinct vid) from d where guest_start),
            'played', (select count(distinct vid) from u where played > 0),
            'played3', (select count(distinct vid) from u where played >= 3),
            'save_open', (select count(distinct vid) from d where save_open),
            'saved', (select count(distinct vid) from u where not is_guest),
            'cg_login', (select count(distinct vid) from d where cg_login),
            'opened', (select count(distinct vid) from d where signup_open),
            'google', (select count(distinct vid) from d where signup_google),
            'email', (select count(distinct vid) from d where signup_email),
            'confirm_needed', (select count(distinct vid) from d where confirm_needed),
            'joined', (select count(distinct vid) from d where user_id is not null)));
end;
$$;

create or replace function public.admin_joined_on() returns jsonb language plpgsql stable security definer set search_path = public as
$$ begin
  perform public.require_admin();
  return jsonb_build_object(
    'web', (select count(*) from public.profiles where joined_on = 'web'),
    'crazygames', (select count(*) from public.profiles where joined_on = 'crazygames'),
    'crazygames_7d', (select count(*) from public.profiles where joined_on = 'crazygames' and created_at > now() - interval '7 days'),
    'web_7d', (select count(*) from public.profiles where joined_on = 'web' and created_at > now() - interval '7 days'),
    'guests', (select count(*) from public.profiles where is_guest),
    'guests_7d', (select count(*) from public.profiles where is_guest and created_at > now() - interval '7 days'),
    'saved', (select count(*) from public.profiles where not is_guest),
    'cg_linked', (select count(*) from public.profiles where cg_user is not null));
end $$;

-- ============ permissions ============
revoke all on function public.handle_user_saved(), public.cg_attach(uuid, text, text), public.calendar_rewards() from public, anon, authenticated;
grant execute on function public.cg_attach(uuid, text, text) to service_role;
revoke all on function public.guest_saved(), public.login_calendar(), public.admin_set_cg_ads(boolean) from public, anon;
grant execute on function public.guest_saved(), public.login_calendar(), public.admin_set_cg_ads(boolean) to authenticated;
revoke all on function public.my_ad_status(), public.claim_ad_reward(text) from public, anon;
grant execute on function public.my_ad_status(), public.claim_ad_reward(text) to authenticated;
revoke all on function public.track_step(uuid, text) from public;
grant execute on function public.track_step(uuid, text) to anon, authenticated;
revoke all on function public.admin_signup_steps(int), public.admin_joined_on() from public, anon;
grant execute on function public.admin_signup_steps(int), public.admin_joined_on() to authenticated;

-- health check also looks for the 0.24 pieces
create or replace function public.admin_health() returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare f text; out jsonb := '[]';
  fns text[] := array['admin_overview','admin_players','admin_player_detail','admin_adjust_coins','admin_set_banned','admin_save_config','admin_save_item',
    'admin_save_mission','admin_events','admin_save_event','admin_set_event_status','admin_delete_event','admin_finalize_event','admin_pay_league',
    'admin_save_stage','admin_journey_stats','admin_audit','event_leaderboard','league_board','matchmake_tx','settle_stage_tx','claim_album',
    'settle_daily_tx','create_challenge_tx','mastery','export_my_data','accept_terms','set_guide_seen','create_crew','crew_info','claim_crew_chest','admin_pay_crews','season_info','claim_season_tier','admin_save_liveop','admin_save_season','valid_reward','contact_support','reply_support','admin_reply','admin_send_message','wave_hello','inbox_summary','new_players','settle_drill_tx','grant_purchase','buy_test','my_economy','club_claim','gem_spend','admin_store','claim_ad_reward','my_ad_status','admin_ads','track_visit','track_step','admin_analytics','admin_geo','auto_run','auto_tick','admin_auto','admin_online','presence_ping','league_info','live_races','finalize_event_tx','relay_put','relay_take','admin_joined_on','arena_status','send_invite','answer_invite','online_players','admin_save_links','guest_saved','cg_attach','login_calendar','admin_set_cg_ads'];
  tbls text[] := array['events','matches','match_queue','league_payouts','worlds','stages','stamps','user_stages','daily_boards','challenges','mastery_tiers','liveops','crews','seasons','season_tiers','support_threads','support_messages','notifications','visits','auto_settings','event_templates','liveop_templates','auth_relay','match_invites','app_links'];
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
