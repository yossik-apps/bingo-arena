# How to update your live game (every phase works the same way)

Do the parts **in this order**. About 15 minutes.

## 0. Only if 0.24 is not live yet
1. SQL Editor: run `supabase/migrations/019_instant.sql` (before 020).
2. Supabase → **Authentication → Sign In / Providers** → turn on **Allow anonymous sign-ins** (and **Allow manual linking**) → Save.
3. Terminal: `npx supabase@latest functions deploy cg-login --use-api --no-verify-jwt`
Then continue with A below.

## A. Database: run 020_referrals.sql, then 021_analytics_fix.sql
Supabase → **SQL Editor → New query**. Open `supabase/migrations/020_referrals.sql`, copy everything, paste, click **Run**. It should say "Success". Then do the same with `021_analytics_fix.sql`.

> **Already on 0.25.0?** Then 0.25.1 is: run `021_analytics_fix.sql` (step A), copy the files (B), push `0.25.1` (D). No server functions.

## B. Copy the new files into your GitHub folder
Extract the new zip and copy everything into your cloned `bingo-arena` folder. Choose **Replace**.

## C. Server functions (two)
In the terminal, inside your `bingo-arena` folder:
```
npx supabase@latest functions deploy refer-claim --use-api
npx supabase@latest functions deploy daily-bonus --use-api
```
`daily-bonus` now also remembers each player's connection/device fingerprint (a one-way hash), which the invite checks compare against.

Optional, recommended: Supabase → **Edge Functions → Secrets** → add `REF_SALT` with any long random text (e.g. 40 random letters). It makes the fingerprints impossible to reverse. Set it once and never change it (changing it makes old fingerprints stop matching).

## D. Website
1. GitHub Desktop → type `0.25.1` → **Commit to main** → **Push origin**.
2. When Vercel says **Ready**, open your site and press **Ctrl+F5**.

## Check it worked
- [ ] **Admin → Health** is all green (including `referrals`), and **Check server functions** shows `refer-claim` Deployed. Version 0.25.1 at the top.
- [ ] Menu → **Invite friends** shows your link and code.
- [ ] Open the link in a private window **on the same computer**: the Play card says "… invited you". Play a round. In **Admin → Referrals** the invite shows as **Blocked: same internet connection** (that is the fraud check working).
- [ ] A friend on another phone/network opening your link shows as **Counted**, and you get rewards as they play.
- [ ] **Admin → Referrals → Rewards and limits**: change amounts if you like and press Save.

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
