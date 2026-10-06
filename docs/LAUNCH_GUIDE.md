# Launch guide (for non-developers)

Goal: get Bingo Arena running on the internet with real accounts, a real database and a server that checks every score.
Time: about 2–3 hours the first time. Cost to start: $0 (free tiers), then roughly $25–60 a month as you grow.

**Easiest way:** install **Claude Code** (Claude desktop app → Code tab), open this folder, and say:
> "Follow docs/LAUNCH_GUIDE.md and run the technical steps for me. Stop and ask me whenever you need me to click something in a website or give you a key."

Claude Code can run the commands in steps 4, 6 and 7. Only you can create the accounts and click the buttons on other websites. Everything is written out below if you prefer to do it by hand.

---
## Step 1. Create the accounts you need (once)
1. **Supabase** (database, login, server): https://supabase.com → Sign up.
2. **Vercel** (hosts the website): https://vercel.com → Sign up with GitHub.
3. **GitHub** (stores your code): https://github.com → Sign up, create a new **private** repository called `bingo-arena`, and upload this folder to it.
4. Later: **Google Cloud** (Google login) and **Meta for Developers** (Facebook login).

## Step 2. Create the Supabase project
1. Supabase → **New project**. Name: `bingo-arena`. Pick the region closest to your players. Choose a strong database password and save it in a password manager.
2. Wait about 2 minutes until it says the project is ready.

## Step 3. Create the database
1. Supabase → **SQL Editor** → **New query**.
2. Open `supabase/migrations/001_schema.sql`, copy everything, paste it in, press **Run**. It should say "Success".
3. Check **Table Editor**: you should see `profiles`, `ledger`, `rounds`, `game_config` and `audit_log`.

## Step 4. Connect the website to the database
1. Supabase → **Project Settings → API**. Copy the **Project URL** and the **anon public** key. (Never share the `service_role` key with anyone or put it in the website.)
2. In the `web` folder, copy `.env.example` to `.env` and paste the two values.

## Step 5. Turn on sign-in
Supabase → **Authentication**:
* **Providers → Email**: keep it on and keep **Confirm email** on.
* **URL Configuration**: set **Site URL** to your website address (use `http://localhost:5173` for now; change it after step 7) and add the same to **Redirect URLs**.
* **Google**: in Google Cloud Console → *APIs & Services → Credentials → Create OAuth client ID → Web application*. Add this Authorized redirect URI: `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`. Paste the Client ID and Secret into Supabase → Providers → Google → Enable.
* **Facebook**: at developers.facebook.com create an app, add the **Facebook Login** product, add the same redirect URI, then paste the App ID and Secret into Supabase → Providers → Facebook → Enable. Facebook requires a privacy policy page and, before public launch, app review.

## Step 6. Deploy the server functions
In a terminal inside this folder:
```
npm install -g supabase
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase functions deploy start-round
supabase functions deploy submit-round
supabase functions deploy daily-bonus
```
(Your project ref is the part of the Supabase URL before `.supabase.co`.)

## Step 7. Put the website online
1. Vercel → **Add New → Project** → import your GitHub repo.
2. **Root Directory:** `web`. Keep **"Include source files outside of the Root Directory"** turned ON (the game rules file lives one folder up).
3. **Environment Variables:** add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (same values as step 4).
4. Deploy. Vercel gives you an address like `bingo-arena.vercel.app`.
5. Go back to Supabase → Authentication → URL Configuration and replace the Site URL and Redirect URL with that address.
6. Optional but recommended: Supabase → Edge Functions → Secrets → add `ALLOWED_ORIGIN` = your website address.

## Step 8. Make yourself the admin
1. Open your website and register with **kokayosi@gmail.com** (confirm the email).
2. Supabase → SQL Editor → run:
```
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'kokayosi@gmail.com');
```
3. Until the admin website is built (Phase 3) you manage players, coins and rounds in **Supabase → Table Editor**, and you tune the game by editing the one row in `game_config`.

## Step 9. Test it like a player (checklist)
- [ ] Register, confirm the email, log in, and see 50 coins plus the daily bonus.
- [ ] Play a Beginner solo round. It should score, pay a small prize and add XP.
- [ ] Play a vs-ghost round. 10 coins leave your wallet; a win pays 18.
- [ ] Wallet tab shows each coin movement.
- [ ] Log out and in again; your balance is still there.
- [ ] Try playing with 0 coins in a paid mode: it should refuse.

## Step 10. Before you invite the public
- Terms of Service, Privacy Policy and a cookie notice (a lawyer or a reputable generator).
- Keep it **play-money only**. Cash prizes need gaming-law advice, ID checks (KYC) and a licensed payment provider first.
- Turn on Supabase backups (paid plan) and set up error alerts.
- Test on real phones (Android and iPhone browsers).

## What comes next (I build these, in order)
| Phase | What | Result |
|---|---|---|
| 2 | Shop, boosters, quests, badges, daily deals | **Done.** See `docs/UPDATE_GUIDE.md` to apply it |
| 3 | Admin website, events | **Done.** See `docs/ADMIN_GUIDE.md` |
| 4 | Real-player matches, weekly league, social login | **Done.** See `docs/UPDATE_GUIDE.md` and `docs/SOCIAL_LOGIN_GUIDE.md` |
| 5 | Journey worlds, stamp Album, streak packs | **Done.** See `docs/PRODUCT_ROADMAP.md` for what comes next |
| 6 | Daily Challenge, Streak Shield, Mastery, challenges, privacy tools, legal pages | **Done.** See `docs/LEGAL_CHECKLIST.md` |
| 7 | Payments and KYC (after legal) | Real-money options where allowed |
