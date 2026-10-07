# Changelog

Every release has a version number and a date. The website shows its version and exact build date in **Admin** (top of the page and the Health tab).

**How to release a new version:** change the `"version"` in `web/package.json` (for example `0.6.2`), add a section below that includes a line starting with "- Guide:" (what changed in the player guide, or "no change"), then commit and push. `npm test` checks this. The build date is stamped automatically by the build.

## 0.7.0 — 2026-10-07
- Friendlier player experience: plain-language names (Practice, Beat the Ghost, Play a person), numbered steps in the lobby, "?" explanations next to unfamiliar words, short intros on every screen, a "What next?" row after rounds.
- Intro tour with a practice board for new players, and a ? Help button in the header with the full guide, FAQ and glossary. The tour can be replayed from Help or Profile.
- First-round tips, larger-text option, and tips on/off in Profile.
- Guide: new — tour, help centre and FAQ (guide revision 1). From now on every new feature adds or edits a guide step and returning players see only "What is new".
- Database update 007 remembers the guide progress on every device (the game works without it, using this device's memory).

## 0.6.1 — 2026-10-06
- Admin shows the website version and full build date.
- The game reloads itself if it finds files from an older release, and shows a Reload screen instead of a blank page if a screen crashes.

## 0.6.0 — Phase 6
- Daily Challenge, Streak Shield, Mastery ranks, Beat my run challenges, share result picture, Profile and healthy-play settings, download/delete my data, terms versioning, full Terms and Privacy pages.
- Fix: admin accounts no longer see other players' data in normal screens (wallet showed 0).
- Fix: Journey stages use their fixed board and are free.
- Admin: Health tab, clearer errors, audit log through admin functions.

## 0.5.0 — Phase 5
- Journey (3 worlds, 24 stages) and the stamp Album, streak packs, break reminders.

## 0.4.0 — Phase 4
- Real-player matches, weekly league, Google and Facebook sign-in code, 18+ confirmation, password reset.

## 0.3.0 — Phase 3
- Admin area, events (tournaments), responsive layout and installable web app.

## 0.2.0 — Phase 2
- Shop, boosters, daily quests, badges.

## 0.1.0 — Phase 1
- Accounts, wallet, server-checked rounds, solo and vs-ghost play.

(Dates for earlier versions were not recorded. Your GitHub commit history has them.)
