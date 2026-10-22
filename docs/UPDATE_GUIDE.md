# How to update your live game (every phase works the same way)

Do the parts **in this order**. About 15 minutes.

## A. Database: run 017_crazygames.sql
Supabase → **SQL Editor → New query**. Open `supabase/migrations/017_crazygames.sql`, copy everything, paste, click **Run**. It should say "Success". (If you skipped 016, run `016_auto.sql` first, and the timer line from the 0.21 guide.)

## B. Copy the new files into your GitHub folder
Extract the new zip and copy everything into your cloned `bingo-arena` folder. Choose **Replace**.

## C. Server functions
Nothing changed in the server this time. No Supabase settings change either: Google still returns to your normal website address, which is already allowed.

## D. Website
1. GitHub Desktop → type `0.22.0` → **Commit to main** → **Push origin**.
2. When Vercel says **Ready**, open your site and press **Ctrl+F5**.

## Check it worked
- [ ] **Admin → Health** is all green (including `relay_take`) and the top shows version 0.22.0.
- [ ] Open your game on **CrazyGames** in a private window → Sign up free → **Sign up with Google**. A small Google window opens; after you choose your account it closes, and the game shows "I have read and agree to the Terms" (no 18+). Tick it → Continue → you are playing.
- [ ] If your browser blocks the small window, the game says so: allow pop-ups for the game and press the button again.
- [ ] On your own website nothing changed: Google opens in the same tab and new players confirm 18+.

## Good to know
- Analytics → Visitors → **Where sign-ups stop** now counts the Google button on CrazyGames too. Compare a week before and after.
- CrazyGames players cannot buy anything and do not see your Google ads. If you later want CrazyGames' own login and ads, that is a separate update with their SDK.

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
