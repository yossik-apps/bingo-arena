# How to update your live game (every phase works the same way)

Do the parts **in this order**. About 15 minutes.

## A. Database: run 016_auto.sql
Supabase → **SQL Editor → New query**. Open `supabase/migrations/016_auto.sql`, copy everything, paste, click **Run**. It should say "Success". (If you skipped 015, run `015_geo.sql` first.)

## B. Check the timer (1 minute)
Open **Admin → Automation**. If the top says "runs every 5 minutes on the database", you are done: step A switched the timer on by itself.
If it says "runs when players open the game", switch it on by hand:
1. Supabase → **Database → Extensions** → search **pg_cron** → switch it **on**.
2. SQL Editor → New query → paste this one line → **Run**:
```
select cron.schedule('bingo-auto-run', '*/5 * * * *', 'select public.auto_run()');
```
Without the timer the automation still runs, but only when someone opens the game, so it can be late at quiet hours.

## C. Fix email sign-ups (most important for registrations)
Supabase → **Authentication → Sign In / Providers → Email** → switch **off "Confirm email"** → **Save**.
Why: with "Confirm email" on, a new player must click a link in an email before they can play, and Supabase's built-in email sender only delivers to your own team's addresses (a few per hour). Most visitors never get the link, so they never finish signing up.
Later, if you want email confirmation back, first set up your own sender: Authentication → **Emails → SMTP Settings** (for example with Resend or Brevo, both have free plans), then switch "Confirm email" on again.
Admin → Health → **Sign-up** shows a green OK when this is right.

## D. Copy the new files into your GitHub folder
Extract the new zip and copy everything into your cloned `bingo-arena` folder. Choose **Replace**.

## E. Server functions
Nothing changed in the server this time.

## F. Website
1. GitHub Desktop → type `0.21.0` → **Commit to main** → **Push origin**.
2. When Vercel says **Ready**, open your site and press **Ctrl+F5**.

## Check it worked
- [ ] **Admin → Health** is all green (including `auto_run`) and **Sign-up** shows OK for email. The top shows version 0.21.0.
- [ ] **Admin → Automation** says "Automation is on" with a recent "Last run". Press **Run now** once: the activity list shows the events it opened and the boosts it planned.
- [ ] **Compete → Events** shows today's *Daily Sprint*. **Compete → Weekly league** shows "Prizes this week".
- [ ] The Admin header shows "● N players online"; tap it for the list.
- [ ] In a private window (not logged in) you can play 3 free rounds, and the sign-up sheet opens with "Sign up with Google · 1 tap".

## Good to know
- Times in the schedules are UTC. Israel is UTC+3 in summer and UTC+2 in winter (the Automation tab also shows your local time).
- Prizes follow the activity: with few players the pools stay small, and they grow (up to your maximum) as more people play. Change the numbers in Admin → Automation at any time.
- The old buttons still work: you can still create events by hand (Events tab) and pay the league by hand (League tab). Automatic payment never pays the same week or event twice.

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
