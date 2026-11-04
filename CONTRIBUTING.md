# Contributing to Bingo Arena

Bingo Arena is live with real players. These rules keep their coins, progress and data safe. When in doubt, ask before you change anything.

## Getting started
- Tests: `npm install && npm test`. Website: `npm --prefix web install && npm run web`.
- The website needs `web/.env.local` with only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Ask the owner for the values. The file is ignored by git: never commit it.

## Branches and pull requests
- Work on your own branch, made from `redesign/next`, and open a pull request into `redesign/next`. Never push to `main`.
- Before opening a PR: update your branch from `redesign/next`, then run `npm test` and `npm run build`. CI runs both again.
- Fill in the checklist in the PR description. Only the owner merges.
- **The repository is public.** Never commit secrets: no `.env` files, keys, tokens, passwords or the service-role key. Only the anon key belongs in the website, and only in `web/.env.local`. If you commit a secret by mistake, tell the owner at once: deleting the commit is not enough, the secret must be replaced.

## Database changes (migrations)
- Each change is one file in `supabase/migrations/`, named with the next free number: `026_my_feature.sql`, then `027_…`. Start from `supabase/migrations/TEMPLATE.sql`.
- **Never run `supabase db push`.** The owner runs each migration by hand in Supabase's SQL Editor, after a backup. Your PR is where they read it first.
- Wrap the file in `begin;` … `commit;`, so a failure changes nothing. It must be safe to run twice (`create table if not exists`, `create or replace function`, a check before `create policy`).
- Additive only: no `drop`, no renames, no deletes, no edits to players' rows.
- Coins, gems and scores change only in server functions (ledger tables), never from a client insert or update.
- CI runs every migration in an in-memory Postgres (`supabase/tests/`). Add a test for what your migration does.

### Permissions: grant explicitly
Since migration 025, a new table, view, sequence or function gives the app's roles **nothing**. The roles are `anon` (a visitor) and `authenticated` (a signed-in player). Each migration must therefore grant exactly what the app needs:
- `alter table … enable row level security;` and a policy for the rows each role may see.
- `revoke all on … from public, anon, authenticated;` and then only the grants needed, for example `grant select on public.my_table to authenticated;`.
- A function the app calls: `grant execute on function public.my_fn(text) to authenticated;`. Functions that touch coins or other players run as `security definer` and check `auth.uid()` themselves.
- Something only the server uses: put the comment `-- no client access` on its create line or the line above.

CI fails the PR when a new migration creates a table, view, sequence or function without one of these (`supabase/tests/migration-grants.test.ts`).

025 changed the defaults for anon and authenticated only in the `public` schema (its one global line only stops PUBLIC from running every new function). The `storage` schema keeps Supabase's own default privileges, which 025 and its rollback leave as they are. Keep app objects in `public`. If a migration ever has to create something in `storage`, revoke and grant explicitly there too: it would otherwise start with Supabase's broad grants.

### Check queries
`supabase/checks/` holds read-only queries the owner runs in the SQL Editor before and after a migration, to confirm it did what it should (for example `024_grants_check.sql`). A check query only reads (`select`), never changes anything. If your migration changes permissions, add one named after it and say in the PR what it should show before and after.

## The Design flag and feature flags
- Every new feature, and the new design, sits behind a flag in the `feature_flags` table, changed in Admin. Modes: **Off**, **Admins only**, **All**.
- A new flag starts **Off**. Add it in your migration with `insert … on conflict do nothing`, so a second run keeps its mode.
- To try a feature on the live site, the owner sets it to **Admins only**. Only the owner sets **All**.
- If a flag can't be read, the app treats it as Off (`web/src/lib/flags.ts`).
- The Classic screens stay untouched. New screens are added next to them, and the Design flag chooses which ones players see.

## Testing on the live site
There is no staging database: Vercel previews use the live one too. Test only with the two test accounts, `zz_test_account` and `zz_test_account_2`, and play a few rounds at most. Never use or change another player's account or data, and never run bulk or destructive tests.
