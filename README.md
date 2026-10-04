# Bingo Arena

Skill-based bingo for web and mobile. This repository is the production foundation (Phase 5: Journey and Album, plus Phase 4: play, wallet, shop, boosters, quests, badges, events, real-player matches, weekly league, admin area, Google/Facebook sign-in).

| Folder | What it is |
|---|---|
| `web/` | The website/app the players see (React + TypeScript + Vite) |
| `supabase/migrations/` | The database: tables, security rules, wallet functions |
| `supabase/functions/` | The server: starts rounds, checks scores, pays prizes (Deno/TypeScript) |
| `supabase/functions/_shared/engine.ts` | The game rules, shared by the website and the server |
| `docs/LAUNCH_GUIDE.md` | **Start here.** Step-by-step launch instructions for non-developers |
| `docs/PRODUCT_ROADMAP.md` | Engagement and economy design, and the plan from here |
| `docs/SOCIAL_LOGIN_GUIDE.md` | Switch on Google and Facebook sign-in |
| `docs/ADMIN_GUIDE.md` | What each admin screen does |
| `docs/MOBILE_APP.md` | The plan for Android and iPhone apps |
| `docs/UPDATE_GUIDE.md` | How to apply each new version to your live game |
| `docs/ARCHITECTURE.md` | How the pieces fit together and why |

Run the automated checks: `npm install && npm test`
Run the website locally: `npm --prefix web install && npm run web` (needs `web/.env`, see the guide)
