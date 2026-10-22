-- Bingo Arena 0.22.0: playing inside CrazyGames.
--   * Players who join on CrazyGames accept the Terms without the 18+ question (play money only, nothing to buy there).
--     Players on your own website still confirm they are 18+. Each profile records where it joined and whether it confirmed 18+.
--   * Google sign-in inside the CrazyGames frame: Google does not open inside another website, so the game opens it in a
--     small window. That window hands the login back to the game through a one-time code (the "auth relay" below):
--     random, stored only as a hash, valid for 5 minutes and usable once.

alter table public.profiles add column if not exists age_18 boolean not null default false;
alter table public.profiles add column if not exists joined_on text not null default 'web' check (joined_on in ('web', 'crazygames'));
-- everyone who accepted before this update confirmed 18+
update public.profiles set age_18 = true where adult_confirmed and not age_18;

-- adult_confirmed keeps its old job: "has accepted the Terms and may play". age_18 says whether the player confirmed 18+.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as
$$
declare v_name text; v_bonus int; v_adult boolean; v_terms_only boolean; v_cg boolean;
begin
  v_name := left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
                          nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
                          split_part(coalesce(new.email, ''), '@', 1)), 20);
  if char_length(v_name) < 2 then v_name := 'Player'; end if;
  v_cg := coalesce(new.raw_user_meta_data ->> 'joined_on', '') = 'crazygames';
  v_adult := coalesce((new.raw_user_meta_data ->> 'adult') = 'true', false) and coalesce(new.raw_app_meta_data ->> 'provider', 'email') = 'email';
  v_terms_only := v_cg and coalesce((new.raw_user_meta_data ->> 'terms') = 'true', false) and coalesce(new.raw_app_meta_data ->> 'provider', 'email') = 'email';
  insert into public.profiles (id, display_name, adult_confirmed, age_18, joined_on, terms_at, terms_version)
    values (new.id, v_name, v_adult or v_terms_only, v_adult, case when v_cg then 'crazygames' else 'web' end,
            case when v_adult or v_terms_only then now() end,
            case when v_adult or v_terms_only then left(new.raw_user_meta_data ->> 'terms_version', 20) end);
  select coalesce((data -> 'g' ->> 'welcome')::int, 0) into v_bonus from public.game_config;
  if v_bonus > 0 then insert into public.ledger (user_id, amount, reason) values (new.id, v_bonus, 'Registration bonus'); end if;
  return new;
end;
$$;

-- accepting the Terms: on your website with 18+ (as before), on CrazyGames without it
drop function if exists public.accept_terms(text);
create function public.accept_terms(p_version text, p_age18 boolean default true, p_where text default 'web') returns void
language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if char_length(coalesce(p_version, '')) not between 1 and 20 then raise exception 'invalid_version'; end if;
  update public.profiles set adult_confirmed = true, age_18 = age_18 or coalesce(p_age18, false), terms_at = now(), terms_version = p_version,
    joined_on = case when p_where = 'crazygames' and not age_18 and terms_version is null then 'crazygames' else joined_on end
  where id = auth.uid();
end;
$$;
revoke all on function public.accept_terms(text, boolean, text) from public, anon;
grant execute on function public.accept_terms(text, boolean, text) to authenticated;

-- ============ auth relay (Google sign-in from inside CrazyGames) ============
create table public.auth_relay (
  code_hash text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  refresh_token text not null,
  created_at timestamptz not null default now()
);
alter table public.auth_relay enable row level security; -- no policies: only the two functions below touch it

-- the sign-in window (logged in) leaves its login under a one-time code
create function public.relay_put(p_code text, p_refresh text) returns void language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if coalesce(p_code, '') !~ '^[a-f0-9]{32,128}$' or char_length(coalesce(p_refresh, '')) not between 8 and 512 then raise exception 'bad_request'; end if;
  delete from public.auth_relay where created_at < now() - interval '10 minutes';
  insert into public.auth_relay (code_hash, user_id, refresh_token) values (md5(p_code), auth.uid(), p_refresh)
    on conflict (code_hash) do update set user_id = excluded.user_id, refresh_token = excluded.refresh_token, created_at = now();
end;
$$;

-- the game in the frame collects it once (within 5 minutes)
create function public.relay_take(p_code text) returns text language plpgsql security definer set search_path = public as
$$
declare v_token text;
begin
  if coalesce(p_code, '') !~ '^[a-f0-9]{32,128}$' then raise exception 'bad_request'; end if;
  delete from public.auth_relay where code_hash = md5(p_code) and created_at > now() - interval '5 minutes' returning refresh_token into v_token;
  return v_token;
end;
$$;

revoke all on function public.relay_put(text, text), public.relay_take(text) from public, anon, authenticated;
grant execute on function public.relay_put(text, text) to authenticated;
grant execute on function public.relay_take(text) to anon, authenticated;


-- purchases only for players who confirmed 18+ (CrazyGames players cannot buy)
create function public.purchases_age_guard() returns trigger language plpgsql security definer set search_path = public as
$$
begin
  if not exists (select 1 from public.profiles where id = new.user_id and age_18) then raise exception 'adults_only'; end if;
  return new;
end;
$$;
create trigger purchases_age_guard before insert on public.purchases for each row execute function public.purchases_age_guard();
revoke all on function public.purchases_age_guard() from public, anon, authenticated;

-- admin: where players joined (for the Players table and Analytics)
create function public.admin_joined_on() returns jsonb language plpgsql stable security definer set search_path = public as
$$ begin
  perform public.require_admin();
  return jsonb_build_object(
    'web', (select count(*) from public.profiles where joined_on = 'web'),
    'crazygames', (select count(*) from public.profiles where joined_on = 'crazygames'),
    'crazygames_7d', (select count(*) from public.profiles where joined_on = 'crazygames' and created_at > now() - interval '7 days'),
    'web_7d', (select count(*) from public.profiles where joined_on = 'web' and created_at > now() - interval '7 days'));
end $$;
revoke all on function public.admin_joined_on() from public, anon;
grant execute on function public.admin_joined_on() to authenticated;

-- health check also looks for the CrazyGames pieces
create or replace function public.admin_health() returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare f text; out jsonb := '[]';
  fns text[] := array['admin_overview','admin_players','admin_player_detail','admin_adjust_coins','admin_set_banned','admin_save_config','admin_save_item',
    'admin_save_mission','admin_events','admin_save_event','admin_set_event_status','admin_delete_event','admin_finalize_event','admin_pay_league',
    'admin_save_stage','admin_journey_stats','admin_audit','event_leaderboard','league_board','matchmake_tx','settle_stage_tx','claim_album',
    'settle_daily_tx','create_challenge_tx','mastery','export_my_data','accept_terms','set_guide_seen','create_crew','crew_info','claim_crew_chest','admin_pay_crews','season_info','claim_season_tier','admin_save_liveop','admin_save_season','valid_reward','contact_support','reply_support','admin_reply','admin_send_message','wave_hello','inbox_summary','new_players','settle_drill_tx','grant_purchase','buy_test','my_economy','club_claim','gem_spend','admin_store','claim_ad_reward','my_ad_status','admin_ads','track_visit','track_step','admin_analytics','admin_geo','auto_run','auto_tick','admin_auto','admin_online','presence_ping','league_info','live_races','finalize_event_tx','relay_put','relay_take','admin_joined_on'];
  tbls text[] := array['events','matches','match_queue','league_payouts','worlds','stages','stamps','user_stages','daily_boards','challenges','mastery_tiers','liveops','crews','seasons','season_tiers','support_threads','support_messages','notifications','visits','auto_settings','event_templates','liveop_templates','auth_relay'];
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
revoke all on function public.admin_health() from public, anon, authenticated;
grant execute on function public.admin_health() to authenticated;
