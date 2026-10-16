# How to update your live game (every phase works the same way)

Do the three parts **in this order**. About 15 minutes.

## A. Database: run each new migration file once
Migrations are the files in `supabase/migrations/`. Run only the ones you have **not** run yet, in number order.

| File | What it adds | Status |
|---|---|---|
| `001` to `005` | Accounts, shop, admin, matches, league, Journey, Album | already done |
| `006_phase6.sql` | Daily Challenge, Streak Shield, Mastery ranks, Beat my run, data download, admin Health check, admin data fix | already done |
| `007_guide.sql` | Remembers each player's intro-tour progress on every device | already done |
| `008_phase7.sql` | Crews, Season track, Live ops calendar | already done |
| `009_inbox.sql` | Inbox, contact us, messages from the admin, welcome waves | already done |
| `010_guest.sql` | **Visitors can look around before registering** | **run this one now** |

1. Supabase → **SQL Editor → New query**.
2. Open `supabase/migrations/010_guest.sql`, copy everything, paste, click **Run**. It should say "Success".
(An "already exists" error means you ran it before. That is safe.)

## B. Server functions
Nothing changed in the server this time. Skip this step.

## C. Website
1. Extract the new zip. Copy everything inside it over your cloned `bingo-arena` folder (the folder GitHub Desktop shows with **Show in Explorer**). Choose **Replace**.
2. GitHub Desktop → type `0.10.0` → **Commit to main** → **Push origin**.
3. Vercel rebuilds by itself (1–2 minutes). When the newest deployment says **Ready**, open your site and press **Ctrl+F5**.

## D. Terms and Privacy Policy (once, before inviting the public)
If you have not yet filled in the [brackets] in `web/public/terms.html` and `web/public/privacy.html`, follow `docs/LEGAL_CHECKLIST.md` section 1.

## Check it worked
- [ ] Open your site in a **private window** (not logged in). You see the lobby with the menu, not the login screen. The header has **Log in** and **Sign up free**.
- [ ] Press **Start practice** (or Play). A pop-up says "To play, create your free account", with Google, Facebook and email. **Not now** closes it.
- [ ] As a visitor, **Journey** shows the worlds and stage goals, the **Shop** shows items and today's deals, and **Compete** and **Collect** explain what you get with an account.
- [ ] Register from the pop-up. You land in the game, logged in, with your starting coins.
- [ ] Log out. You return to the visitor lobby.

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
