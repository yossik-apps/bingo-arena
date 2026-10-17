# How to update your live game (every phase works the same way)

Do the parts **in this order**. About 15 minutes.

## A. Database: run each new migration file once
Migrations are the files in `supabase/migrations/`. Run only the ones you have **not** run yet, in number order.

| File | What it adds | Status |
|---|---|---|
| `001` to `005` | Accounts, shop, admin, matches, league, Journey, Album | already done |
| `006_phase6.sql` | Daily Challenge, Streak Shield, Mastery ranks, Beat my run, data download, admin Health check, admin data fix | already done |
| `007_guide.sql` | Remembers each player's intro-tour progress on every device | already done |
| `008_phase7.sql` | Crews, Season track, Live ops calendar | already done |
| `009_inbox.sql` | Inbox, contact us, messages from the admin, welcome waves | already done |
| `010_guest.sql` | Visitors can look around before registering | already done (run it now if you skipped it) |
| `011_dna.sql` | **Bingo DNA drills: daily drill coins** | **run this one now** |

1. Supabase → **SQL Editor → New query**.
2. Open `supabase/migrations/011_dna.sql`, copy everything, paste, click **Run**. It should say "Success".
(An "already exists" error means you ran it before. That is safe.)

## B. Copy the new files into your GitHub folder
Extract the new zip. Copy everything inside it over your cloned `bingo-arena` folder (the folder GitHub Desktop shows with **Show in Explorer**). Choose **Replace**. Do this before step C, otherwise the server update cannot find the new files.

## C. Server functions (two changed)
Open a terminal **in your `bingo-arena` folder** and run these two lines, one after the other:
```
npx supabase@latest functions deploy start-round --use-api
npx supabase@latest functions deploy submit-round --use-api
```
Each one should end with "Deployed Functions".

## D. Website
1. GitHub Desktop → type `0.11.0` → **Commit to main** → **Push origin**.
2. Vercel rebuilds by itself (1–2 minutes). When the newest deployment says **Ready**, open your site and press **Ctrl+F5**.

## E. Terms and Privacy Policy (once, before inviting the public)
If you have not yet filled in the [brackets] in `web/public/terms.html` and `web/public/privacy.html`, follow `docs/LEGAL_CHECKLIST.md` section 1.

## Check it worked
- [ ] **Admin → Health** shows everything green, including `settle_drill_tx`. The top shows version 0.11.0.
- [ ] Your **Profile** shows "Your Bingo DNA". If you have played 3 or more rounds, you see the spider chart and a play style.
- [ ] The **Play** screen shows "Today's fix". Play it: it lasts 60 seconds, and the first one today gives +20 coins.
- [ ] After a round, the coach box is called **Coach Nova**. Rename it in Profile → Healthy play and check the new name after the next round.
- [ ] In a **private window**: the question "Have you played bingo before?" appears. Choose "I'm new", follow the 3 steps and play the free round. You see a blurred Bingo DNA with "Sign up free to reveal". A second Practice round asks you to sign up.

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
