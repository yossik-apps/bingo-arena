-- Bingo Arena: feature flags. The Design flag starts Off. Safe to run twice.
-- Modes: off, admins (signed-in admins only), all. Players can read a flag but never change it.

begin;

create table if not exists public.feature_flags (
  key text primary key,
  mode text not null default 'off' check (mode in ('off', 'admins', 'all')),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
alter table public.feature_flags enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'feature_flags' and policyname = 'feature_flags_read') then
    create policy feature_flags_read on public.feature_flags for select to anon, authenticated using (true);
  end if;
end $$;

-- Supabase gives new tables broad default grants, so remove them explicitly.
revoke all on public.feature_flags from public, anon, authenticated;
-- Only these columns, so the admin's account id in updated_by stays private.
grant select (key, mode, updated_at) on public.feature_flags to anon, authenticated;

-- A second run keeps the current mode.
insert into public.feature_flags (key) values ('design_new') on conflict (key) do nothing;

create or replace function public.admin_set_flag(p_key text, p_mode text) returns void
language plpgsql security definer set search_path = public as
$$
begin
  perform public.require_admin();
  if p_mode is null or p_mode not in ('off', 'admins', 'all') then raise exception 'invalid_flag_mode'; end if;
  update public.feature_flags set mode = p_mode, updated_at = now(), updated_by = auth.uid() where key = p_key;
  if not found then raise exception 'unknown_flag'; end if;
  perform public.admin_log('set_flag', jsonb_build_object('key', p_key, 'mode', p_mode));
end;
$$;
revoke all on function public.admin_set_flag(text, text) from public, anon, authenticated;
grant execute on function public.admin_set_flag(text, text) to authenticated;

commit;
