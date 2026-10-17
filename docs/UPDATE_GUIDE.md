# How to update your live game (every phase works the same way)

Do the parts **in this order**. About 15 minutes.

## A. Database
Nothing new this time. If you have not yet run `011_dna.sql` (from version 0.11.0), run it now: Supabase → **SQL Editor → New query**, paste the whole file, **Run**.

## B. Copy the new files into your GitHub folder
Extract the new zip. Copy everything inside it over your cloned `bingo-arena` folder (the folder GitHub Desktop shows with **Show in Explorer**). Choose **Replace**.

## C. Server function (one changed)
Open a terminal **in your `bingo-arena` folder** and run:
```
npx supabase@latest functions deploy start-round --use-api
```
It should end with "Deployed Functions". (If you skipped 0.11.0, also deploy `submit-round` the same way.)

## D. Website
1. GitHub Desktop → type `0.12.0` → **Commit to main** → **Push origin**.
2. Vercel rebuilds by itself (1–2 minutes). When the newest deployment says **Ready**, open your site and press **Ctrl+F5**.

## E. Terms and Privacy Policy (once, before inviting the public)
If you have not yet filled in the [brackets] in `web/public/terms.html` and `web/public/privacy.html`, follow `docs/LEGAL_CHECKLIST.md` section 1.

## Check it worked
- [ ] **Admin** shows version 0.12.0.
- [ ] Start a **Beginner** Practice round. You see the ring around the ball, "Look in column …", and the "Still on the board" chips with bars that empty.
- [ ] Tap a correct number: a round stamp and "+points" appear. Tap a wrong one: the tile flashes red with "Not called yet".
- [ ] Start a **Medium** round: the text says "Is it on your card?" instead of the column.
- [ ] On your phone: time and score are at the top, the combo at the bottom, and the whole board fits on the screen.

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
