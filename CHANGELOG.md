# Changelog

Every release has a version number and a date. The website shows its version and exact build date in **Admin** (top of the page and the Health tab).

**How to release a new version:** change the `"version"` in `web/package.json` (for example `0.6.2`), add a section below that includes a line starting with "- Guide:" (what changed in the player guide, or "no change"), then commit and push. `npm test` checks this. The build date is stamped automatically by the build.

## 0.9.0 — 2026-10-16
- Inbox: an envelope in the header with a red badge for new messages. Players can contact us from Help, Profile or the inbox, and see our answers there. Notifications (such as welcomes from other players) are in the same place.
- Admin: new Messages tab to read and reply to players, close conversations, and write to a player first. The admin gear icon shows how many messages wait for an answer.
- Admin: set a new password for a player (Players tab), and send a message straight from a player's card.
- New players: a NEW tag next to anyone who joined this week in leagues, crews, events and the daily leaderboard, a "say welcome" card on the Play screen, and Compete, then New players, with one-tap welcomes.
- After a game, sharing is now only WhatsApp, Telegram and Facebook (also for crew invites).
- "Download my data" removed from Profile. Players can ask for a copy through Contact us. Privacy policy and guides updated.
- Profile: change your own password.
- The admin icon is now a gear, so it no longer looks like the Streak Shield.
- Guide: revision 3. New steps "Your inbox" and "Welcome new players", the Profile step mentions the password, and the FAQ has contact, NEW tag and data-copy answers.
- Database update 009 and a new server function, admin-set-password.

## 0.8.0 — 2026-10-10
- Crews: teams of up to 20 with a weekly XP goal, a small and a big chest, invite codes, a crew leaderboard, and weekly crew prizes paid from the admin.
- Season track: 30 tiers, a free track and a coin-bought season pass, exclusive Season 1 rewards, 3 days to claim after the season ends. Admin can create seasons and edit every tier.
- Live ops calendar: timed XP boosts, coin boosts, cheaper Beat the Ghost entry and announcements, scheduled in the admin and switched on automatically. Players see them in Compete → Calendar and on the Play screen.
- Facebook sign-in finished on our side: friendlier errors, a data-deletion page and app icon for Meta, and a dedicated setup guide (docs/FACEBOOK_LOGIN_GUIDE.md).
- Guide: revision 2. Three new steps (Join a crew, Season track, Events calendar), three new FAQ answers and three glossary words. Returning players see them under "What is new".
- Database update 008 and new server code in start-round and submit-round.

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
