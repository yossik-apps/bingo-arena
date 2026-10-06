# How to update your live game (every phase works the same way)

Do the three parts **in this order**. About 15 minutes.

## A. Database: run each new migration file once
Migrations are the files in `supabase/migrations/`. Run only the ones you have **not** run yet, in number order.

| File | What it adds | Status |
|---|---|---|
| `001` to `005` | Accounts, shop, admin, matches, league, Journey, Album | already done |
| `006_phase6.sql` | **Daily Challenge, Streak Shield, Mastery ranks, Beat my run, data download, admin Health check, and a fix for admin accounts seeing other players' data** | **run this one now** |

1. Supabase → **SQL Editor → New query**.
2. Open `supabase/migrations/006_phase6.sql`, copy everything, paste, click **Run**. It should say "Success".
(An "already exists" error means you ran it before. That is safe.)

## B. Server functions: two changed, three new
In a terminal in the folder that holds the new files:
```
npx supabase@latest functions deploy start-round --use-api
npx supabase@latest functions deploy submit-round --use-api
npx supabase@latest functions deploy daily-info --use-api
npx supabase@latest functions deploy create-challenge --use-api
npx supabase@latest functions deploy delete-account --use-api
```
**Important:** `start-round` also fixes a Phase 5 bug (Journey stages could charge the entry fee and ignore the stage's fixed board). Deploy it even if you do not use the other new features yet.

## C. Website
1. Extract the new zip. Copy everything inside it over your cloned `bingo-arena` folder (the folder GitHub Desktop shows with **Show in Explorer**). Choose **Replace**.
2. GitHub Desktop → type `Phase 6` → **Commit to main** → **Push origin**.
3. Vercel rebuilds by itself (1–2 minutes). When the newest deployment says **Ready**, open your site and press **Ctrl+F5**.

## D. Terms and Privacy Policy (once, before inviting the public)
Open `docs/LEGAL_CHECKLIST.md` and follow section 1: fill in the [brackets] in `web/public/terms.html` and `web/public/privacy.html`. Every existing player sees a one-time "We updated our terms" screen after this update.

## Check it worked
- [ ] **Admin → Health** says "Everything is installed", and **Check server functions** shows all six as Deployed.
- [ ] Your coin counter and level are correct even after other players register.
- [ ] The Play screen has a **Daily Challenge** card. Playing it gives coins and a result screen with stars.
- [ ] After a solo or ghost round you can press **Share result** and **Challenge a friend**.
- [ ] Tapping your name or avatar opens your **Profile**: mastery ranks, streaks, break reminders, daily time limit, Download my data, Delete my account.
- [ ] Admin → Players → pick a player → **Apply coins** shows a green message right under the buttons, and the player sees the coins in their wallet.

## If something looks wrong
* **Admin → Health** is the first place to look. It lists exactly which database update or server function is missing.
* Daily Challenge or stages do not start → step B was skipped.
* Profile, Daily or Health show errors → step A was skipped.
* Still seeing the old version → wait for Vercel to say Ready, then hard-refresh, and use your correct website address.

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
