# Bingo Arena

Skill-based bingo for web and mobile. This repository is the production foundation (0.17.0: the economy with gems, store, Bingo Club and Coin Vault in test mode, plus 0.16.0: Facebook sign-in removed and a demo profile for visitors, plus 0.15.0: DNA score explained and Last 10 games, plus 0.14.0: new Profile with My stats and Settings tabs, plus 0.13.0: grouped side menu and new coins screen, plus 0.12.0: friendlier game board, plus 0.11.0: Bingo DNA, daily drills, Coach Nova, milestones and a free guest round, plus 0.10.0: visitors can look around before registering, plus 0.9.0: inbox, contact us, admin messages, welcome waves, plus Phase 7: crews, season track, live ops calendar, plus Phase 6: Daily Challenge, challenges, mastery, privacy tools, plus Phase 5: Journey and Album, plus Phase 4: play, wallet, shop, boosters, quests, badges, events, real-player matches, weekly league, admin area, Google/Facebook sign-in).

| Folder | What it is |
|---|---|
| `web/` | The website/app the players see (React + TypeScript + Vite) |
| `supabase/migrations/` | The database: tables, security rules, wallet functions |
| `supabase/functions/` | The server: starts rounds, checks scores, pays prizes (Deno/TypeScript) |
| `supabase/functions/_shared/engine.ts` | The game rules, shared by the website and the server |
| `docs/LAUNCH_GUIDE.md` | **Start here.** Step-by-step launch instructions for non-developers |
| `docs/FACEBOOK_LOGIN_GUIDE.md` | Finish Facebook sign-in (Meta app and Supabase) |
| `docs/GUIDE_MAINTENANCE.md` | How the player guide works and how to keep it up to date |
| `CHANGELOG.md` | Version history, and how to release a new version number |
| `docs/LEGAL_CHECKLIST.md` | What to fill in and when to call a lawyer |
| `docs/PRODUCT_ROADMAP.md` | Engagement and economy design, and the plan from here |
| `docs/SOCIAL_LOGIN_GUIDE.md` | Switch on Google and Facebook sign-in |
| `docs/ADMIN_GUIDE.md` | What each admin screen does |
| `docs/MOBILE_APP.md` | The plan for Android and iPhone apps |
| `docs/UPDATE_GUIDE.md` | How to apply each new version to your live game |
| `docs/ARCHITECTURE.md` | How the pieces fit together and why |

Run the automated checks: `npm install && npm test`
Run the website locally: `npm --prefix web install && npm run web` (needs `web/.env`, see the guide)
