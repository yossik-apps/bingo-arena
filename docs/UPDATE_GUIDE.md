# How to update your live game (every phase works the same way)

Do the three parts **in this order**. About 10–15 minutes.

## A. Database: run each new migration file once
Migrations are the files in `supabase/migrations/`. Run only the ones you have **not** run yet:

| File | What it adds | Status |
|---|---|---|
| `001_schema.sql` | Accounts, wallet, rounds | already done |
| `002_phase2.sql` | Shop, boosters, quests, badges | already done |
| `003_phase3.sql` | Admin tools, events, no highlight on Beginner | already done |
| `004_phase4.sql` | **Real-player matches, weekly league, 18+ confirmation** | **run this one now** |

1. Supabase → **SQL Editor → New query**.
2. Open `supabase/migrations/004_phase4.sql`, copy everything, paste, click **Run**. It should say "Success".
3. Table Editor should now list `matches`, `match_players`, `match_queue` and `league_payouts`.
(An "already exists" error means you ran it before. That is safe.)

## B. Server functions: one new, two changed
In a terminal in the project folder:
```
npx supabase@latest functions deploy find-match --use-api
npx supabase@latest functions deploy start-round --use-api
npx supabase@latest functions deploy submit-round --use-api
```

## C. Website
1. Extract the new zip. Copy everything inside it over your cloned `bingo-arena` folder (the folder GitHub Desktop shows with **Show in Explorer**). Choose **Replace**.
2. GitHub Desktop → type `Phase 4` → **Commit to main** → **Push origin**.
3. Vercel rebuilds by itself (1–2 minutes). When the newest deployment says **Ready**, open your site and press **Ctrl+F5**.

## D. Switch on Google and Facebook (once)
Follow `docs/SOCIAL_LOGIN_GUIDE.md`. Until you do, the two buttons show a friendly "not switched on yet" message and email login keeps working.

## Check it worked
- [ ] The Play screen lists **Vs real players**. The level buttons no longer show seconds per number.
- [ ] To test a match alone, open the site in **two different browsers** (or one normal and one private window), log in with two accounts, and press **Find opponent** on the same level in both. They are matched and start together after a 5-second countdown.
- [ ] After both finish, each sees the result. The winner gets 1.8× the entry fee.
- [ ] The **Compete** tab has Events and a **Weekly league**.
- [ ] The admin area has a new **League** tab.
- [ ] On a laptop, nothing in the lobby needs the page to scroll.

## If something looks wrong
* "Find opponent" fails → step B was skipped (deploy `find-match`), or step A.
* Matches never start → both players must pick the **same level** and be logged in at the same time.
* Still seeing the old version → wait for Vercel to say Ready, then hard-refresh.
* Everyone is asked to confirm 18+ → only people who signed in with Google/Facebook (or older accounts that were not email sign-ups) see it, once.

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
