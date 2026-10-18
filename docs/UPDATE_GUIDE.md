# How to update your live game (every phase works the same way)

Do the parts **in this order**. About 15 minutes.

## A. Database: run 012_economy.sql
Supabase → **SQL Editor → New query**. Open `supabase/migrations/012_economy.sql`, copy everything, paste, click **Run**. It should say "Success". (If you skipped 011, run `011_dna.sql` first.)

## B. Copy the new files into your GitHub folder
Extract the new zip and copy everything into your cloned `bingo-arena` folder. Choose **Replace**.

## C. Server functions
Nothing changed in the server this time.

## D. Website
1. GitHub Desktop → type `0.17.0` → **Commit to main** → **Push origin**.
2. When Vercel says **Ready**, open your site and press **Ctrl+F5**.

## E. Terms and Privacy Policy (once, before inviting the public)
If you have not yet filled in the [brackets] in `web/public/terms.html` and `web/public/privacy.html`, follow `docs/LEGAL_CHECKLIST.md` section 1.

## Optional: switch Facebook off in Supabase too
The button is gone from the game. To switch the Facebook login off completely: Supabase → **Authentication → Sign In / Providers → Facebook** → turn it **off** → Save. Accounts created with Facebook stay; those players log in with "Forgot password?" and their email.

## Check it worked
- [ ] **Admin → Health** is all green (including `grant_purchase`, `my_economy` and `admin_store`), and the top shows version 0.17.0.
- [ ] The header shows a gem counter next to your coins.
- [ ] **Shop → Coins and gems** shows the store with "Coming soon" buttons (Preview mode).
- [ ] **Admin → Store** → choose **Test** → Save. In the store the buttons now say "Test buy". Buy the Starter pack: your coins and gems go up, and Admin → Store shows it under recent purchases as "test, free".
- [ ] Buy **Bingo Club** (test), then press **Claim today's gift**: +150 coins and +5 gems.
- [ ] **Profile → Settings → Monthly spending limit** works, and the **Coins** screen lists your test purchases.
- [ ] When you are done testing, set the store back to **Preview**.

## If something looks wrong
* **Admin → Health** is the first place to look. It lists exactly which database update or server function is missing.
* Daily Challenge, stages or drills do not start → step C was skipped.
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
