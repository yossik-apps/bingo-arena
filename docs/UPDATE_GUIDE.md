# How to update your live game (every phase works the same way)

Do the three parts **in this order**. About 10–15 minutes.

## A. Database: run each new migration file once
Migrations are the files in `supabase/migrations/`. Run only the ones you have **not** run yet:

| File | What it adds | Status |
|---|---|---|
| `001_schema.sql` | Accounts, wallet, rounds | already done |
| `002_phase2.sql` | Shop, boosters, quests, badges | already done |
| `003_phase3.sql` | Admin tools, events, no highlight on Beginner | already done |
| `004_phase4.sql` | Real-player matches, weekly league, 18+ confirmation | already done |
| `005_phase5.sql` | **Journey (3 worlds, 24 stages), Album (27 stamps), streak packs** | **run this one now** |

1. Supabase → **SQL Editor → New query**.
2. Open `supabase/migrations/005_phase5.sql`, copy everything, paste, click **Run**. It should say "Success".
3. Table Editor should now list `worlds`, `stages`, `stamps`, `user_stages` and `user_stamps`.
(An "already exists" error means you ran it before. That is safe.)

## B. Server functions: two changed
In a terminal in the project folder:
```
npx supabase@latest functions deploy start-round --use-api
npx supabase@latest functions deploy submit-round --use-api
```

## C. Website
1. Extract the new zip. Copy everything inside it over your cloned `bingo-arena` folder (the folder GitHub Desktop shows with **Show in Explorer**). Choose **Replace**.
2. GitHub Desktop → type `Phase 5` → **Commit to main** → **Push origin**.
3. Vercel rebuilds by itself (1–2 minutes). When the newest deployment says **Ready**, open your site and press **Ctrl+F5**.

## Check it worked
- [ ] The menu has five tabs: **Play, Journey, Compete, Collect, Shop**. The wallet opens when you tap your coin counter at the top.
- [ ] **Journey** shows 3 worlds. Stage 1 of Neon Harbor is open. Play it: you get stars, coins and a stamp.
- [ ] **Collect → Album** shows your stamp. Duplicates give dust. You can craft a missing stamp with dust.
- [ ] The admin area has a **Journey** tab showing every stage with clear rates and editable goals.
- [ ] On a computer, the new screens fit without page scrolling.

## If something looks wrong
* Journey or Album show errors → step A was skipped.
* A stage will not start, or the result has no stars → step B was skipped (deploy both functions).
* Still seeing the old version → wait for Vercel to say Ready, then hard-refresh.
* Stages feel too hard or too easy → open Admin → Journey and change the star goals. No update needed.

---
## Forgot your password?
* **Fastest (works any time):** Supabase → **SQL Editor** → run (use your email and a new password of 8+ characters):
```
update auth.users
set encrypted_password = extensions.crypt('YourNewPassword123', extensions.gen_salt('bf'))
where email = 'your-email@example.com';
```
* **By email:** on the login screen click **Log in**, type your email, press **Forgot password?**, open the link in the email, and choose a new password on the screen that appears.
* Supabase's built-in email sender only delivers to the email addresses of your own Supabase team and sends very few emails per hour. Before you invite the public, set up your own email sender (Supabase → Authentication → SMTP Settings, for example with Resend or Brevo).
