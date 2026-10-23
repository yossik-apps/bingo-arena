# How to update your live game (every phase works the same way)

Do the parts **in this order**. About 15 minutes.

## A. Database: run 018_arena.sql
Supabase → **SQL Editor → New query**. Open `supabase/migrations/018_arena.sql`, copy everything, paste, click **Run**. It should say "Success". (If you skipped 017, run `017_crazygames.sql` first.)

## B. Copy the new files into your GitHub folder
Extract the new zip and copy everything into your cloned `bingo-arena` folder. Choose **Replace**.

## C. Server functions
Nothing changed in the server this time.

## D. Website
1. GitHub Desktop → type `0.23.0` → **Commit to main** → **Push origin**.
2. When Vercel says **Ready**, open your site and press **Ctrl+F5**.

## E. Add your Facebook page
Admin → **Config** → scroll to **Links** → paste your page address (for example `https://www.facebook.com/YourPage`) → **Save link**.

## Check it worked
- [ ] **Admin → Health** is all green (including `arena_status`) and the top shows version 0.23.0.
- [ ] Try it with a friend (or two browsers with two accounts): one presses **Play a person**; within 15 seconds the other sees "… is waiting for a live match · Play now" at the top. Tap it: the match starts.
- [ ] While waiting, the screen lists online players with **Invite**; the invited player sees Accept / Not now.
- [ ] "Our Facebook" shows in the menu (computers) and in Help (all screens), and opens your page.

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
