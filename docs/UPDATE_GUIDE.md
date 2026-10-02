# How to update your live game (Phase 2 and every later phase)

Every update has the same three parts. Do them in this order. Total time: about 10 minutes.

## A. Update the database (only when the update includes a new file in `supabase/migrations/`)
Phase 2 adds **`002_phase2.sql`**.
1. Supabase → **SQL Editor → New query**.
2. Open `supabase/migrations/002_phase2.sql`, copy everything, paste, click **Run**. It should say "Success".
   Run each migration file **only once**. If you run it twice you will see an error like "already exists". That is safe, just ignore it.
3. Check **Table Editor**: you should now see `shop_items` (34 rows), `inventory`, `user_boosters`, `mission_defs`, `daily_progress`, `ach_defs` and `user_achievements`.

## B. Update the server functions (only when files in `supabase/functions/` changed)
Phase 2 changes `start-round` and `submit-round`. In a terminal inside the project folder:
```
npx supabase@latest functions deploy start-round --use-api
npx supabase@latest functions deploy submit-round --use-api
```
(You do not need to redeploy `daily-bonus`.)

## C. Update the website
1. Copy the new project files over your cloned `bingo-arena` GitHub folder (choose **Replace** when asked). Your `web/.env` file is not touched.
2. Open **GitHub Desktop**. It lists the changed files. Type a summary such as `Phase 2`, click **Commit to main**, then **Push origin**.
3. Vercel notices the push and rebuilds automatically, usually in 1–2 minutes. Check **Vercel → your project → Deployments**: the newest one should say **Ready**.
4. Open your live address and press **Ctrl+F5** (Cmd+Shift+R on Mac) to load the new version.

## If something looks wrong
* **Shop, Quests or boosters show errors:** step A was skipped. Run the migration.
* **Playing a round fails after the update:** step B was skipped. Deploy both functions.
* **You still see the old version:** wait for Vercel to say **Ready**, then hard-refresh.
* Send me a screenshot of the error and I will tell you the exact fix.
