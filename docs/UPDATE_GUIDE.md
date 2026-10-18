# How to update your live game (every phase works the same way)

Do the parts **in this order**. About 15 minutes.

## A. Database: run 015_geo.sql
Supabase → **SQL Editor → New query**. Open `supabase/migrations/015_geo.sql`, copy everything, paste, click **Run**. It should say "Success". (If you skipped 014, run `014_analytics.sql` first.)

## B. Copy the new files into your GitHub folder
Extract the new zip and copy everything into your cloned `bingo-arena` folder. Choose **Replace**. (If `web/src/views/admin/Overview.tsx` is still in your folder from before 0.19, you can delete it.) This version adds three small map libraries; Vercel installs them by itself.

## C. Server functions
Nothing changed in the server this time.

## D. Website
1. GitHub Desktop → type `0.20.0` → **Commit to main** → **Push origin**.
2. When Vercel says **Ready**, open your site and press **Ctrl+F5**.

## E. Terms and Privacy Policy (once, before inviting the public)
If you have not yet filled in the [brackets] in `web/public/terms.html` and `web/public/privacy.html`, follow `docs/LEGAL_CHECKLIST.md` section 1. The Privacy Policy's "Visit statistics" now also mentions the country guess.

## Check it worked
- [ ] **Admin → Health** is all green (including `admin_geo`), and the top shows version 0.20.0.
- [ ] **Admin → Analytics → Countries** shows the world map. Open your site once in a private window, then press Refresh: your country appears. Countries count from today.
- [ ] On your 14" laptop (and the 27" screen) the menu is on the left, nothing is cut, and when you scroll a soft shadow shows under the header.
- [ ] Start a round on the laptop: the whole board is visible.

## Tip: see which links bring players
Add `?utm_source=` and a short name to links you share, for example `https://your-site.vercel.app/?utm_source=whatsapp-group`. They show under Analytics → Visitors → "Where visitors come from".

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
