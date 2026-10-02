-- Bingo Arena: database schema, security rules and wallet functions (Phase 1)
-- Principle: players can only READ their own data. Every change to coins, XP or scores
-- goes through server functions (service role), never directly from the app.

create table public.game_config (
  id int primary key default 1 check (id = 1),
  data jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.game_config (id, data) values (1, '{
  "levels": {
    "beginner": {"every":4000,"win":4,"pt":1,"pen":5,"hint":true,"xm":1,"fee":10,"gl":150,"gr":100},
    "medium":   {"every":3000,"win":3,"pt":1.5,"pen":8,"hint":false,"xm":1.5,"fee":20,"gl":250,"gr":130},
    "hard":     {"every":2200,"win":2,"pt":2,"pen":15,"hint":false,"xm":2,"fee":40,"gl":380,"gr":200}
  },
  "g": {"pay":1.8,"login":10,"welcome":50,"total":100,"maint":false,"paid":true,"pvp":true,"note":""}
}');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 20),
  role text not null default 'player' check (role in ('player', 'admin')),
  xp int not null default 0 check (xp >= 0),
  streak int not null default 0,
  last_login date,
  banned boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

create table public.ledger (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount int not null,
  reason text not null,
  ref text,
  created_at timestamptz not null default now()
);
create index ledger_user_idx on public.ledger (user_id, created_at desc);

create view public.wallet with (security_invoker = true) as
  select user_id, coalesce(sum(amount), 0)::int as balance from public.ledger group by user_id;

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  mode text not null check (mode in ('solo', 'ghost', 'pvp', 'tour')),
  level text not null,
  seed bigint not null,
  fee int not null default 0,
  params jsonb not null,
  status text not null default 'active' check (status in ('active', 'scored', 'rejected')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  score int,
  prize int,
  xp_gain int,
  result jsonb
);
create index rounds_user_idx on public.rounds (user_id, started_at desc);

create table public.audit_log (
  id bigserial primary key,
  actor uuid references public.profiles (id) on delete set null,
  action text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

-- ---------- helpers ----------
create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and not banned) $$;

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as
$$
declare v_name text; v_bonus int;
begin
  v_name := left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
                          nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
                          split_part(coalesce(new.email, ''), '@', 1)), 20);
  if char_length(v_name) < 2 then v_name := 'Player'; end if;
  insert into public.profiles (id, display_name) values (new.id, v_name);
  select coalesce((data -> 'g' ->> 'welcome')::int, 0) into v_bonus from public.game_config;
  if v_bonus > 0 then
    insert into public.ledger (user_id, amount, reason) values (new.id, v_bonus, 'Registration bonus');
  end if;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- wallet and round functions (server only) ----------
create function public.start_round_tx(p_user uuid, p_mode text, p_level text, p_fee int, p_seed bigint, p_params jsonb)
returns uuid language plpgsql security definer set search_path = public as
$$
declare v_id uuid; v_bal int;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  update public.rounds set status = 'rejected'
    where user_id = p_user and status = 'active'
      and started_at + (((params ->> 'total')::int + 90) * interval '1 second') < now();
  if exists (select 1 from public.rounds where user_id = p_user and status = 'active') then
    raise exception 'round_in_progress';
  end if;
  if p_fee > 0 then
    select coalesce(sum(amount), 0) into v_bal from public.ledger where user_id = p_user;
    if v_bal < p_fee then raise exception 'insufficient_funds'; end if;
    insert into public.ledger (user_id, amount, reason, ref) values (p_user, -p_fee, 'Entry fee (' || p_mode || ', ' || p_level || ')', 'round');
  end if;
  insert into public.rounds (user_id, mode, level, seed, fee, params)
    values (p_user, p_mode, p_level, p_seed, p_fee, p_params) returning id into v_id;
  return v_id;
end;
$$;

create function public.finish_round(p_round uuid, p_score int, p_prize int, p_xp int, p_result jsonb)
returns boolean language plpgsql security definer set search_path = public as
$$
declare v_user uuid;
begin
  update public.rounds set status = 'scored', finished_at = now(), score = p_score, prize = p_prize, xp_gain = p_xp, result = p_result
    where id = p_round and status = 'active' returning user_id into v_user;
  if v_user is null then return false; end if;
  if p_prize > 0 then
    insert into public.ledger (user_id, amount, reason, ref) values (v_user, p_prize, 'Prize', 'round:' || p_round);
  end if;
  update public.profiles set xp = xp + p_xp, last_seen = now() where id = v_user;
  return true;
end;
$$;

create function public.claim_daily(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare v_last date; v_streak int; v_new int; v_bonus int; v_base int;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 1));
  select last_login, streak into v_last, v_streak from public.profiles where id = p_user;
  if v_last = current_date then return jsonb_build_object('claimed', false, 'streak', v_streak, 'bonus', 0); end if;
  v_new := case when v_last = current_date - 1 then v_streak + 1 else 1 end;
  select coalesce((data -> 'g' ->> 'login')::int, 10) into v_base from public.game_config;
  v_bonus := v_base * least(v_new, 7);
  update public.profiles set last_login = current_date, streak = v_new, last_seen = now() where id = p_user;
  if v_bonus > 0 then insert into public.ledger (user_id, amount, reason) values (p_user, v_bonus, 'Daily login bonus'); end if;
  return jsonb_build_object('claimed', true, 'streak', v_new, 'bonus', v_bonus);
end;
$$;

-- ---------- security ----------
alter table public.game_config enable row level security;
alter table public.profiles enable row level security;
alter table public.ledger enable row level security;
alter table public.rounds enable row level security;
alter table public.audit_log enable row level security;

create policy config_read on public.game_config for select to anon, authenticated using (true);
create policy config_admin_update on public.game_config for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy ledger_read on public.ledger for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy rounds_read on public.rounds for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy audit_read on public.audit_log for select to authenticated using (public.is_admin());

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
grant select on public.game_config to anon, authenticated;
grant update (data, updated_at) on public.game_config to authenticated;
grant select on public.profiles, public.ledger, public.rounds, public.wallet, public.audit_log to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.start_round_tx, public.finish_round, public.claim_daily to service_role;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
