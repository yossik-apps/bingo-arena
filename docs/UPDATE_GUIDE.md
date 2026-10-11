# How to update your live game (every phase works the same way)

Do the three parts **in this order**. About 15 minutes.

## A. Database: run each new migration file once
Migrations are the files in `supabase/migrations/`. Run only the ones you have **not** run yet, in number order.

| File | What it adds | Status |
|---|---|---|
| `001` to `005` | Accounts, shop, admin, matches, league, Journey, Album | already done |
| `006_phase6.sql` | Daily Challenge, Streak Shield, Mastery ranks, Beat my run, data download, admin Health check, admin data fix | already done |
| `007_guide.sql` | Remembers each player's intro-tour progress on every device | already done |
| `008_phase7.sql` | **Crews, Season track, Live ops calendar** | **run this one now** |

1. Supabase → **SQL Editor → New query**.
2. Open `supabase/migrations/008_phase7.sql`, copy everything, paste, click **Run**. It should say "Success".
(An "already exists" error means you ran it before. That is safe.)

## B. Server functions: two changed
The event boosts and the cheaper entries are applied by the server, so redeploy these two (from the folder with the new files):
```
npx supabase@latest functions deploy start-round --use-api
npx supabase@latest functions deploy submit-round --use-api
```

## C. Website
1. Extract the new zip. Copy everything inside it over your cloned `bingo-arena` folder (the folder GitHub Desktop shows with **Show in Explorer**). Choose **Replace**.
2. GitHub Desktop → type `0.8.0` → **Commit to main** → **Push origin**.
3. Vercel rebuilds by itself (1–2 minutes). When the newest deployment says **Ready**, open your site and press **Ctrl+F5**.

## D. Terms and Privacy Policy (once, before inviting the public)
If you have not yet filled in the [brackets] in `web/public/terms.html` and `web/public/privacy.html`, follow `docs/LEGAL_CHECKLIST.md` section 1.

## Check it worked
- [ ] **Admin → Health** says "Everything is installed" (it now also checks crews, seasons and live ops), and **Check server functions** shows all Deployed.
- [ ] **Compete** has four tabs: Events, Weekly league, **Crew**, **Calendar**. **Journey** has **Worlds** and **Season track**.
- [ ] Season 1 "Neon Nights" is running and shows 30 tiers. Playing a round adds season XP.
- [ ] Admin → **Live ops** → press the "Lucky Hour" quick start → Schedule event. The Play screen shows the boost banner, and a round gives double XP.
- [ ] Create a crew, copy the code, and join it from a second test account.
- [ ] Returning players see a short **What is new** tour about crews, the season and the calendar.

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
