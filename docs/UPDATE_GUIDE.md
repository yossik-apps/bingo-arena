# How to update your live game (every phase works the same way)

Do the three parts **in this order**. About 10 minutes.

## A. Database: run each new migration file once
Migrations are the files in `supabase/migrations/`. Run only the ones you have **not** run yet:

| File | What it adds | Run it if you have… |
|---|---|---|
| `001_schema.sql` | Accounts, wallet, rounds | (already done) |
| `002_phase2.sql` | Shop, boosters, quests, badges | (already done) |
| `003_phase3.sql` | **Admin tools, events/tournaments, no highlight on Beginner** | **not run it yet** |

1. Supabase → **SQL Editor → New query**.
2. Open `supabase/migrations/003_phase3.sql`, copy everything, paste, click **Run**. It should say "Success".
3. Table Editor should now show a new `events` table. (An "already exists" error means you ran it before. That is safe.)

## B. Server functions: redeploy the two that changed
In a terminal in the project folder:
```
npx supabase@latest functions deploy start-round --use-api
npx supabase@latest functions deploy submit-round --use-api
```

## C. Website
1. Extract the new zip. Copy everything inside it over your cloned `bingo-arena` folder (the folder GitHub Desktop shows with **Show in Explorer**). Choose **Replace**.
2. GitHub Desktop → type `Phase 3` → **Commit to main** → **Push origin**.
3. Vercel rebuilds by itself (1–2 minutes). When the newest deployment says **Ready**, open your site and press **Ctrl+F5**.

## Check it worked
- [ ] The Play screen has **no highlighted square** on Beginner.
- [ ] A new **Events** tab is in the menu (on a computer it is in the left sidebar).
- [ ] Your account (admin) shows a **shield icon** at the top. It opens the admin area.
- [ ] In the admin area: Overview shows your numbers, Players lists everyone, Config shows your levels.

## If something looks wrong
* Events tab or admin errors → step A was skipped.
* "Round failed" when starting a round, or events will not start → step B was skipped.
* Still seeing the old version → wait for Vercel to say Ready, then hard-refresh.
* Shield icon missing → your account is not admin yet. Run in the SQL Editor:
```
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'kokayosi@gmail.com');
```
  then log out and in again.
