# Changelog

Every release has a version number and a date. The website shows its version and exact build date in **Admin** (top of the page and the Health tab).

**How to release a new version:** change the `"version"` in `web/package.json` (for example `0.6.2`), add a section below that includes a line starting with "- Guide:" (what changed in the player guide, or "no change"), then commit and push. `npm test` checks this. The build date is stamped automatically by the build.

## 0.20.1 — 2026-10-18
- **Fixed: the end of long pages was cut off on computers when "Larger text" is on.** Larger text enlarges the page by 12%, and that also made the page area 12% taller than the window, so the last 70–100 points of every page (for example the bottom of each Analytics tab) could not be scrolled into view. The page area now always matches the window exactly.
- The screen check now scrolls every screen to its very end and confirms the last item is fully visible (above the bottom bar on phones), on all 12 window sizes.
- Guide: no change.
- No database update.

## 0.20.0 — 2026-10-18
- **Admin → Analytics → Countries:** a world map of visitors, active players, new players or revenue by country, with a top-8 list beside it, a full table (visitors, active players, new players, paying players, revenue, share) and tap-to-highlight. Small countries get a dot so they can be seen. The Summary shows the top 5 countries.
  - The country is guessed in the browser from its time zone (for example Asia/Jerusalem → Israel). No IP address is looked up or stored. A player's country is the one from their latest visit.
- **Screens on scaled laptops fixed.** Laptops with display scaling at 150–175% (for example a 14" laptop) have a window narrower than 1024 or shorter than 560 points, and the game used to fall back to the tablet layout there: a full-width header, a bottom bar and very little room. Now:
  - Windows from 900 points wide get the computer layout, and from 400 points tall (was 1024 × 560).
  - Between 900 and 1080 points wide the menu becomes a slim icon rail, so the content keeps its width.
  - The game board fits the width as well as the height, so it is never cut on the right.
  - When you scroll, a soft shadow appears under the header, so it is clear the page is scrolling under it rather than being cut.
  - Analytics adapts to the space it really has: tiles, charts and lists rearrange by the width of the admin area, not the window. On phones the section buttons wrap instead of running off the side.
- The funnel explains why accounts can be more than visitors while visitor counting is new.
- Checked on 12 window sizes (the 9 from before plus 920×520, 1100×520 and 1440×540 for scaled laptops).
- Guide: no change.
- Database update 015.

## 0.19.0 — 2026-10-18
- **Admin → Analytics** replaces the Overview tab. Choose 7, 30 or 90 days; every key number shows its change against the period before, with a small trend line. Six sections:
  - **Summary:** visitors, new players, active players, returning players, rounds, revenue, paying players, reward videos; active players per day (new and returning); right-now totals (active today, 7 and 30 days, stickiness, Club members, all-time revenue); the visitor-to-player funnel; returning players.
  - **Players:** new and active players per day, daily average, returning share, players kept, lost and won back since the last period, "back the next day / in week 2 / after a month", weekly sign-up groups (cohorts), how often players come, and the most active players.
  - **Visitors:** visitors and new visitors, free rounds played by guests, the sign-up funnel (visit → free round → sign-up form → account → first real round → came back), devices, where visitors come from and the first screen they saw. Add `?utm_source=name` to links you share to see each campaign.
  - **Revenue:** revenue, purchases, paying players, paying share, per paying player (ARPPU), per player per day (ARPDAU), first-time and repeat buyers, revenue per day, sales by product, reward videos per day and by place with an income estimate from your own rate, top spenders. "Count test purchases" shows how it will look before payments are live.
  - **Games:** rounds per day, rounds per player, when people play (weekday × hour in your time zone), and results by way of playing and level with win rate and accuracy.
  - **Economy:** coins given out and spent, net coins added, coins and gems held by players, and where coins come from and go.
  - Every chart has hover details and a "Show numbers" table. Export CSV downloads the daily numbers.
- **Visitor counting:** the game now counts visits with a random ID kept in the browser (no name, email or IP address). Logging in links earlier visits to the account, so the sign-up funnel can be measured. The Privacy Policy (sections 2, 6 and 7) explains this.
- Checked on all 9 window sizes plus phones: nothing runs off the screen.
- Guide: no change.
- Database update 014.

## 0.18.0 — 2026-10-18
- Ads (off until you switch them on in Admin → Store → Ads):
  - **Reward videos**, always optional: "Watch a short video · +50 coins" on the Play screen, the store, the Coins screen and the result screen. 5 a day per player by default, spaced at least 20 seconds apart. The coins are paid by the server.
  - **Optional short ad between rounds**, when leaving the result screen every N finished rounds (off by default).
  - Built on Google's ads for web games (H5 Games Ads / Ad Placement API). The ad script loads only when ads are on. Never during a round, never for visitors without an account, never for Bingo Club members.
  - **Admin → Store → Ads:** publisher ID, test ads, coins per video, videos per day, the between-rounds break and how often, plus how many videos were watched (today, 7 days, all time, by place).
  - New docs/ADS_GUIDE.md (AdSense account, ads.txt, applying for games ads, the consent message, switching on). Privacy Policy section 7 covers Google ads and consent.
- Every screen checked on 9 window sizes (27" monitors 1920×940 and 2560×1300, laptops 1536×730, 1366×768 and 1280×650, a tablet, two phones and a phone held sideways), with the real font and Larger text on. Nothing runs off the side of the screen anywhere. Fixes:
  - Long screens on computers now show a slim scrollbar, so it is clear when there is more below. Before, the scrollbar was hidden and the content looked cut.
  - **Store** split into Offers, Coins and Gems tabs, and made more compact, so each tab fits on common laptop screens.
  - **Result screen:** "Play again" and "Back to lobby" moved up next to your score, so they are always visible. The coach, sharing and "What next" are on the right.
  - **Coins screen:** on computers, each column scrolls on its own, so the page always fits.
  - Settings, the demo profile and the guest note are tighter on short laptop screens.
- Guide: FAQ "Why do I see Watch a short video?".
- Database update 013.

## 0.17.0 — 2026-10-18
- The economy (no real money is charged yet):
  - **Gems**, a second currency: 1 gem for the first drill each day, 5 a day for Bingo Club members, plus gem packs. Spend them on coin swaps (10 gems → 600 coins, 50 → 3,500) or a Streak Shield (20). Gems show in the header and on the Coins screen.
  - **Shop → Coins and gems**, a new store: Starter pack (once), coin packs, gem packs, **Bingo Club** (30 days: 150 coins and 5 gems a day, Club badge, last 50 games in Bingo DNA), **Coin Vault** (10% extra from every win collects in a vault, up to 3,000 coins), **Season Pass Premium** and **Crew Treat** (200 coins for every crew member). The old shop is now the "Looks and boosters" tab.
  - **Store modes in Admin → Store:** Off, Preview (the default: players see prices with "Coming soon"), and Test (only admins can make free test purchases to try every flow). Live payments come with a later update, and the database refuses Live until then.
  - **Admin → Store:** revenue (30 days and all time; test purchases never count), paying players, Club members, gems in circulation, sales by product, recent purchases, editable prices and contents for every product, Coin Vault settings, and giving or taking gems.
  - **Player protection:** a monthly spending limit in Profile → Settings, checked on every purchase. Purchase history on the Coins screen, and no random packs.
  - Terms (section 4) and the Privacy Policy cover gems and purchases, with a note that a lawyer must confirm the refund wording before payments go live. New docs/MONETIZATION.md.
- Guide: revision 6. New step "Coins, gems and Bingo Club", FAQs "What are gems?", "Can I buy coins?" and "What is the Coin Vault?", and the glossary word "Gems".
- Database update 012.

## 0.16.0 — 2026-10-17
- Facebook sign-in removed from Register and Log in. Players can use Google or email.
  - Players who signed up with Facebook before can still get in: on Log in, a note tells them to press "Forgot password?" and use the same email as their Facebook account. They then log in with email and password, and keep their progress.
  - Terms, Privacy Policy, the data-deletion page and the FAQ updated to match.
- Demo "You" area for visitors (not signed in):
  - The side menu has a **You** section with **Bingo DNA (Demo)** and **Help and guide**, plus a "Sign up free" button at the bottom. On phones, the guest note has a "See a demo profile" link.
  - The demo profile is the real Profile filled with a sample player. It is clearly labelled "Demo profile" with a "Sign up free" button. Visitors can open My stats (Bingo DNA, Mastery ranks, Streaks), Last 10 games with the coach's read, and the DNA score explanation. Settings are hidden in the demo, and buttons such as Train or Share open the sign-up pop-up.
- Guide: FAQ "Do I need an account?" now says email or Google.

## 0.15.0 — 2026-10-17
- Bingo DNA score explained: a "What does it mean?" button on the DNA card (and the DNA score in the profile card) opens a short explanation. The score is the average of the six skills from the last 20 rounds. It has four levels (0–39 Learning, 40–59 Getting there, 60–79 Strong, 80–100 Expert), with your level highlighted, plus what each skill measures and how to raise the score. The profile card now shows the level next to the score, for example "DNA score · Strong".
- New Profile tab **Last 10 games**:
  - Your last 10 games of every kind (Practice, Beat the Ghost, live matches, Events, Journey stages, Daily Challenge, friend challenges, drills), each with level, time, accuracy, score and result (Won, Lost, Best!).
  - Your coach's read (Coach Nova by default): a chart of accuracy per game, with live matches and Events in blue, and up to four findings, for example "You are getting sharper", "Faster reactions", "Pressure shows against people", "3 wins out of 4", "Too many wrong taps", "Ready for Medium". Each finding comes with a suggestion.
  - The read is worked out from your own games on your device, using fixed rules (no outside AI service, so there is no cost). It needs at least 3 games and updates after every round.
- Fix: with Larger text switched on, pop-ups (the intro tour, sign-up and the new explanation) could be taller than the window. They now always fit.
- Guide: revision 5. New step "Last 10 games", FAQ "What does my DNA score mean?" and the glossary word "DNA score".

## 0.14.0 — 2026-10-17
- New Profile, built from the approved prototype:
  - A profile card at the top: avatar, name, level, play style, XP bar ("120 to level 5"), and your DNA score, login streak and coins.
  - Two tabs, **My stats** and **Settings**, instead of one long page. The game remembers the last tab you opened.
  - **My stats:** Bingo DNA with the spider chart next to the skill bars, the weakest skill in a gold box with its drill button, and one small Share button. Mastery ranks with coloured rank badges, progress bars and the next rank. Streaks as three tiles (login days, Streak Shields, Daily Challenges) with a bar to the next Shield.
  - **Settings:** short rows with the label on the left and the control on the right. Play settings: break reminder, daily time limit (with today's minutes), tips and larger text switches, coach's name, intro tour. Account: email, password ("Change" opens the two fields only when needed), Contact us, Help and guide, Log out, Terms and Privacy, and a small Delete account button that asks you to type DELETE.
  - Desktop: two columns that fit on one screen on 27" monitors and 14" laptops (checked with the real font and Larger text on). Phones: one column, with every control next to its label.
- Guide: no change.

## 0.13.2 — 2026-10-17
- Fix for all desktop and laptop screens:
  - The top bar could be pushed off the top of the screen. The page itself can no longer scroll; only the content area scrolls.
  - The Today box in the side menu was measured before the Quicksand font finished loading, so it could still be cut. The menu now measures again whenever its size changes, including after the font loads.
  - The side menu is now exactly the height of the browser window, and its rows get a little tighter on short screens.
  - Tested with the real font at 1920×940 and 2560×1300 (27" monitors) and at 1280×650 and 1536×730 (14" laptops).
- The "Today's fix" card on the Play screen shows its title and text on two clean lines.
- Guide: no change.

## 0.13.1 — 2026-10-17
- Fix: the Today box at the bottom of the side menu could be cut off on some screens. It is now more compact (one box with three rows), and the menu measures itself: the box shows only when it fits completely, otherwise it hides.
- Guide: no change.

## 0.13.0 — 2026-10-17
- Side menu (computer screens) is split into groups:
  - **Play:** Play, Journey, Compete, Collect, Shop.
  - **You:** Bingo DNA (with your overall score), Coins (with your balance), Inbox (with the number of new messages), Help and guide, and Admin for the owner.
  - **Today** (bottom of the menu, on taller screens): the daily drill (with a tick when done), your login streak and your play style.
- Coins screen redesigned:
  - Balance card, plus earned, spent and net for the last 7 days.
  - A 7-day chart of coins earned (green, up) and spent (orange, down). Hover a day for the numbers.
  - "Ways to earn coins": today's drill, the Daily Challenge and daily quests, one tap each.
  - Recent activity grouped by day (Today, Yesterday, then the date) with each day's total, an icon for each kind of activity, the time only, filters for All, Earned and Spent, and "Show more".
- Phones: the top bar keeps the player's name readable. Help and Log out moved to the Profile on small screens (the ? and log-out buttons stay on bigger screens). On very small phones the streak chip hides; the streak is still in the Profile.
- Guide: no change.

## 0.12.0 — 2026-10-17
- New, friendlier game board (same look and colours):
  - A ring around the ball shows the time until the next number.
  - "Still on the board": each number that can still be tapped has a bar that empties as its time runs out. The newest is marked NEW and the oldest LEAVING. Numbers you tapped get a tick.
  - Clear Time left, Score (with points from your last tap) and Combo boxes. The combo shows how many more correct taps reach the next level.
  - Tapped numbers get a round stamp and stay readable.
  - Feedback on the tile itself: "+points" on a correct tap, "Not called yet" in red, "Already left" in orange. A finished line glows gold with the bonus points.
  - A "1 to go" tag on rows and columns that need one more number (Beginner and Medium).
  - Beginner only: "Look in column B" (the letter of the called number). Medium and Hard see "Is it on your card?" and get no hint.
  - Phones: time and score in one top bar, the combo at the bottom near your thumb.
- The server now sends the level with each round, so the board knows when to show the Beginner help.
- Guide: no change.

## 0.11.0 — 2026-10-16
- Bingo DNA in the Profile: six skills from 0 to 100 (Speed, Accuracy, Awareness, Combo, Lines, Pressure) from the last 20 rounds, shown as a spider chart with bars. The weakest skill is marked, there is a play style (Speedster, Sniper, Watcher, Combo Machine, Line Hunter, Ice Cool) and a change since last week. Players need 3 rounds to see it.
- Today's drill: a free 60-second round aimed at the weakest skill (Fast Calls, Steady Hands, Tight Window, Combo Rush, Line Frenzy, Pressure Cooker). The first drill each day gives 20 coins. It is on the Play screen (Today's fix), in the Profile and on the result screen.
- Coach Nova: the coach on the result screen now has a name (players can rename it in Profile) and links tips to the Bingo DNA.
- Milestone cards with a ready-made share message for a new personal best, 3 stars, daily gold, beating a real player and new badges. A toast announces a new play style.
- Visitors: a first-visit question ("Have you played bingo before?") with a short how-to for new players, and one free Practice round without an account. After it they see a blurred Bingo DNA and are invited to sign up. The free round is not saved to the new account.
- The server now records numbers missed and the longest streak for every round.
- Guide: revision 4. New steps "Your Bingo DNA" and "Today's drill and your coach", FAQ "What is Bingo DNA?", "What is a drill?" and "Can I play without an account?", and three glossary words.
- Database update 011 and updated server functions start-round and submit-round.

## 0.10.0 — 2026-10-16
- Visitors no longer start on the login screen. They land in the real lobby and can browse Play, Journey (worlds and stage goals), Compete, Collect, the Shop and Help.
- Pressing Play, a stage, the Daily Challenge, a shop item or Contact us opens a sign-up pop-up that says why an account is needed ("To play, create your free account"). The pop-up has Google, Facebook and email, a Log in tab, and a "Not now" button.
- The header for visitors has "Log in" and "Sign up free" buttons, and a line on each screen reminds them that signing up gives free coins.
- A friend's challenge link now opens the game with "A friend challenged you! Create a free account to accept."
- Database update 010 lets visitors see public game content only (worlds, stage goals, stamps, running events, the shop and today's deals). Player data stays private.
- Guide: FAQ "Do I need an account?" added. The intro tour still starts after a visitor registers.

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
