# How to update your live game (every phase works the same way)

Do the parts **in this order**. About 20 minutes.

## A. Database: run 019_instant.sql
Supabase → **SQL Editor → New query**. Open `supabase/migrations/019_instant.sql`, copy everything, paste, click **Run**. It should say "Success". (If you skipped 018, run `018_arena.sql` first.)

## B. Switch on instant play (one setting, 30 seconds)
Supabase → **Authentication → Sign In / Providers**. Under **User Signups**, turn on **Allow anonymous sign-ins** → **Save**.
This lets visitors play at once with a guest account. Without it, the game falls back to the old "3 free rounds, then sign up".

Recommended in the same place: turn on **Allow manual linking** (lets guests save their progress with Google; email works without it).

Supabase already limits how many guest accounts one internet address can create per hour (Authentication → Rate Limits). If you ever see lots of fake guest accounts, tell me and I'll add bot protection (do not switch on CAPTCHA by itself: the game has to send it, otherwise Play stops working).

## C. Copy the new files into your GitHub folder
Extract the new zip and copy everything into your cloned `bingo-arena` folder. Choose **Replace**.

## D. Server function: deploy cg-login
In the terminal, inside your `bingo-arena` folder:
```
npx supabase@latest functions deploy cg-login --use-api --no-verify-jwt
```
(`--no-verify-jwt` is needed because visitors call it before they have an account; the function checks the CrazyGames token itself.)

## E. Website
1. GitHub Desktop → type `0.24.0` → **Commit to main** → **Push origin**.
2. When Vercel says **Ready**, open your site and press **Ctrl+F5**.

## Check it worked
- [ ] **Admin → Health** is all green, including "Instant play (guest accounts) is switched on" and `cg-login` = Deployed (press **Check server functions**). The top shows version 0.24.0.
- [ ] Open your site in a private window: you see **Play now**. Press it: a round starts within a second or two, no form.
- [ ] After the round: the lobby shows the **Daily rewards** calendar and a **Save** button at the top. Press Save → add an email and password → "Saved!". Log out and log back in with that email: same coins and level.
- [ ] On CrazyGames (after you upload the new build there): when you are logged in to CrazyGames, the game opens already logged in, with your CrazyGames name.

## Sending it to CrazyGames
This version is built for their rules: automatic login with the CrazyGames account, no Google/email inside CrazyGames, gameplay start/stop events, only CrazyGames ads, no external links, no purchases. In the CrazyGames developer portal you can now answer:
- **Does your game use the CrazyGames SDK?** Yes (v3: user accounts, gameplay events, video ads).
- **Account / login:** Yes, CrazyGames user accounts (automatic login). Progress is saved for guests too.
- **External login / links:** none inside CrazyGames.
Use the CrazyGames **QA tool** (preview link in the portal) before submitting: it shows whether the SDK, login and gameplay events are detected.

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
