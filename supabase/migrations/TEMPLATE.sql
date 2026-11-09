-- Template for a new migration. Copy it to the next free number (for example 026_my_feature.sql) and replace the example.
-- Say in this first comment what it does and that it is safe to run twice. Migrations are additive: no DROP, no renames,
-- no deletes. Since 025, a new table, view, sequence or function gives anon and authenticated nothing, so grant below exactly
-- what the app needs. CI fails if something is created without a grant or revoke for anon/authenticated, or the comment
-- "-- no client access" on (or just above) its create line.

begin;

-- 1. The table. "if not exists" makes a second run harmless.
create table if not exists public.example_notes (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id),
  body text not null check (char_length(body) <= 500),
  created_at timestamptz not null default now()
);

-- 2. Row security: without a policy, nobody but the server can see a row.
alter table public.example_notes enable row level security;

-- 3. Policies: who sees which rows. CREATE POLICY has no "if not exists", so check first.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'example_notes' and policyname = 'example_notes_own') then
    create policy example_notes_own on public.example_notes for select to authenticated using (user_id = auth.uid());
  end if;
end $$;

-- 4. Grants: what each role may do at all. Policies only narrow it to rows. Visitors (anon) get nothing here.
--    Writes that touch coins, gems or scores go through a server function, never a client insert or update.
revoke all on public.example_notes from public, anon, authenticated;
grant select on public.example_notes to authenticated;

-- 5. A function the app calls with rpc(). "security definer" runs with the owner's rights, so it checks the caller itself.
create or replace function public.example_add_note(p_body text) returns bigint
language plpgsql security definer set search_path = public as
$$
declare v_id bigint;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  insert into public.example_notes (user_id, body) values (auth.uid(), p_body) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.example_add_note(text) from public, anon, authenticated;
grant execute on function public.example_add_note(text) to authenticated;

-- 6. Something only the server (edge functions, service role) uses: mark it so CI knows it is on purpose.
-- no client access
create or replace function public.example_note_count() returns bigint language sql security definer set search_path = public as
$$ select count(*) from public.example_notes $$;
revoke all on function public.example_note_count() from public;

commit;
