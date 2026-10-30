# Design E: retention changes (playground only)

All changes are in the design playground (`web/design.html`, `web/src/design-e/`, `web/src/lib/levels.ts`). The live game is not touched. Nothing here talks to Supabase: sign-in, reminders and friends are simulated on this device so the flow can be judged before the backend work.

Open it with `npm run dev` and go to `/design.html`.

## Why

The worry was that a very lean level 1 will not bring players back, because they cannot play others and do not have "everything". The plan below keeps level 1 lean (one big Play button) but moves the three things that create a return visit much earlier:

1. a reason to come back tomorrow (daily reward, streak, quests) at **level 2**, after one round;
2. a bar that fills every round (season track) at **level 4**;
3. something social (weekly league, friend duels, invites) at **level 5**, after roughly 15 to 25 rounds instead of 36 to 59.

Heavy features (crew, live matches, Bingo DNA) still wait, until a player has a reason to want them.

## Two unlock ladders

Switch in the playground sidebar ("Unlock ladder"). The choice is remembered and the page reloads. Both tables are in `web/src/lib/levels.ts` (`RETENTION`, `ORIGINAL`). Change a level number there and every screen follows.

| Level | Retention (default) | Original (first draft) |
|---|---|---|
| 1 | Play | Play |
| 2 | Daily rewards, streak, quests, Normal speed | Daily rewards, Normal speed |
| 3 | Daily card, Journey, combos | Quests, Daily challenge, combos |
| 4 | Ghost, Season, Fast speed | Journey, Fast speed |
| 5 | League, friend duels, boosters | Ghost, boosters |
| 6 | Album, Shop, gems | Album, Shop, gems |
| 8 | Crew, live matches, Bingo DNA | Live matches, league |
| 10 | Events, Mastery | Crew, friend duels |
| 12 / 15 | (none) | Events and Season / DNA and Mastery |

## What was added or changed

- **Locked things stay visible.** Locked tabs show a lock in the bottom bar. Tapping one opens a sheet with what it is, the level it needs and "about N rounds to go". Locked cards in the lobby say "Unlocks at level N".
- **Level-up screen** lists everything that opened (also several levels at once) with a "Try it" button each, and tells you the next unlock and how many rounds it needs.
- **Streak and freeze.** Daily reward is a 7-day cycle with a streak count. A streak freeze costs 50 coins (max 2) and is used up automatically on a missed day. "Next day" in the sidebar lets you test a miss.
- **Double XP on the first round of the day**, shown in the lobby and on the results screen.
- **Shared daily card.** Everyone gets the same board each day. Only the first try counts. The result can be shared as an emoji grid plus a challenge link.
- **Friend challenge links.** `?c=seed.score.speed.name` opens a "X challenged you" screen. Same board, same numbers, highest score wins, no account needed.
- **Protected league week.** The first week has no demotion. The lobby and the League tab show "N points to pass Ben" using time-based bots.
- **Invite friends.** Code plus a reward ladder (friend saves account, plays 3 rounds, returns another day, plays on 7 days). "Friend joins / moves up" in the sidebar simulates it. Friends can be duelled on the same board.
- **Guest save sheet** (Google, Apple, email; no Facebook, as in the live game since 0.16). Shown once after 3 rounds, after the first streak day, and when entering the league. Always dismissible ("Maybe later"). Also on the Profile screen.
- **Reminder prompt** shown once, after the first streak day or when entering the league. The playground only requests the browser permission; nothing is sent.
- **Journey** is 36 stages in 4 chapters with 3-star goals calibrated against the real engine, so a stage is neither trivial nor impossible. Chapters open with stars.
- **Album** collects stamps in sets of 6 with a gem reward per finished set.
- **Ghost** costs coins after the first free plays, and refunds plus a bonus when you win. Rival scores depend on speed (chill 100, normal 190, fast 380).
- **Coach tip** on the results screen (wrong taps, speed advice, and so on) based on the round.
- **Sound and vibration** with toggles in Profile.
- **Event log** (`track.ts`): every key moment (`app_open`, `round_start`, `round_end`, `level_up`, `feature_unlocked`, `daily_reward_claimed`, `streak_changed`, `save_progress_shown/completed/dismissed`, `notification_prompt_shown/result`, `lock_sheet_shown`, `daily_card_played`, `challenge_created`, `challenge_opened`, `invite_friend_joined`, `league_joined`, `stage_completed`, `shop_purchase`, and so on) is stored in a ring buffer and shown in the sidebar. "Copy as JSON" copies it. This is the list to send to analytics once there is a backend.

## Sound

- The called number is read out loud ("B, twelve"). The speaker icon in the round opens volume, mute, the voice switch and a voice picker. The same controls are in Profile.
- Voice quality depends on the device. The game uses American English (en-US) and picks the most natural voice it finds (for example "Natural" voices in Edge and Windows 11, Siri or enhanced voices on Apple devices, Google network voices on Android). Older built-in voices sound robotic.
- For a truly human caller, record or generate 75 short clips (B1 to O75, see `web/public/calls/README.txt`) and put them in `web/public/calls/`. The game uses them automatically and falls back to speech when they are missing.

## Desktop version (first pass)

- On a window 1000 px wide or more the playground shows the desktop layout. Narrower windows show the phone design. "View: Desktop / Phone" in Prototype tools forces one or the other.
- Desktop shell: left side menu (Play, Journey, Collect, Compete, Shop with the same level locks, profile with level bar, Level path), top bar with coins and the sound control.
- Lobby: the ball machine on the left; daily tiles, game modes, speed and the big Play button on the right; next unlock below.
- Round: card in the middle, the called number and "Still on the board" on the left, score, combo, race and hints on the right. The card scales to the window height (works from about 700 px high).
- Results: the points ball and stats on the left; XP bar, coach tip, rival result, Challenge a friend and Play again on the right.
- Sheets (locked feature, save progress, reminders) open as a centered dialog.
- Every other screen now has a desktop layout too. Journey, Collect, Compete, Shop and Profile are content grids that fill the width (chapters side by side, album sets side by side, league table next to Play a person, Profile in two columns). Daily rewards and Get ready are one centered column. Level path is two columns, Level up has the badge on the left and what opened on the right, and Finding a player and Friend challenge are centered. The shell shows the title, the wallet and a Back button, so the screens do not repeat them.
- Code: pages share one `Page` component in `Nav.tsx` that switches to the grid inside the desktop shell (`DeskCtx`); the grid rules are in the "desktop pages" block at the end of `e.css`.

## Pacing check

`web/tools/pacing.ts` estimates on which day a player reaches each feature. XP per round is from the real engine (chill about 22 to 34, normal 38 to 52, fast 62 to 92), not the 55 used in the first sheet. Run it with the same esbuild alias used for the playground build, or with `tsx` and an `@engine` path alias.

Day when a feature opens (model: 5 minutes a day or less, first round of the day worth double XP, daily card worth +30 XP):

| Player | Season (original → retention) | League (original → retention) | Album | Crew (original → retention) |
|---|---|---|---|---|
| Casual, 2 rounds/day, chill | day 43 → **4** | day 18 → **7** | day 10 → 10 | day 29 → 18 |
| Mixed, 4 rounds/day | day 15 → **2** | day 7 → **3** | day 4 → 4 | day 10 → 7 |
| Keen, 6 rounds/day | day 10 → **2** | day 5 → **2** | day 3 → 3 | day 7 → 5 |

Treat these as a model, not data. The point is the direction: a casual player now meets the season on day 4 and the league in the first week. Check against real retention numbers (D1, D7) after launch and adjust the numbers in `levels.ts`.

## What is simulated, and what needs the backend

| In the playground | Real implementation needs |
|---|---|
| Sign-in (Google, Apple, email) only sets a flag | The existing Supabase auth, plus linking the guest account |
| Reminders only ask the browser for permission | A push or email sender and a "ready to claim" job |
| Friends, invite code and rewards are local | Referral table (exists in the live game), reward checks for the 4 invite steps |
| League bots move with time | Real weekly league with promotion and protected first week |
| Daily card seed is derived from the date | One seed per day on the server, one scored try per player per day, server-side score check |
| Challenge link carries the score in the URL | A short link with the score stored on the server, so it cannot be edited |
| Streak and freeze live in localStorage | Server-side streak with the player's time zone |
| Coins, gems and XP are local | Server-side economy (never trust the client) |
| The store, the season pass and the checkout are local and take no payment | A payment provider (App Store / Google Play / web), receipt checks on the server, refunds, price per country |
| Friends answer challenges after your next round, with a score near yours | Real push notice and the friend's real score; a stored challenge with an expiry |
| The bonus box timer uses the device clock (Prototype tools can skip 4 hours) | A server clock, so changing the phone time does nothing |
| The Weekend Cup board is made up (20 scores) | A weekly cup table, one seed for everyone, server-side score check, prizes paid by a job |

## Known limits

- The npm registry was not reachable when this was built, so the type check was run with stub React types. Run `npm run build` once on your machine before using this.
- Ghost, person and duel opponents play a made-up score, not another real client.
- The live game already has several of these features (guest play, Save progress, referrals, daily challenge, crews, season, share cards, async duels). This work only changes the playground, so it shows how they should be ordered and introduced, not new backend.

## Boosters: how a player gets them (playground)
- Everyone starts with 2 of each. More come from rewards: daily reward day 3 (+1 Hint) and day 6 (+1 Slow), the "Complete 2 lines" quest (+1 Double), and season tiers 5, 15 and 25 (Hint, Slow, Double).
- They can be bought in the Shop and on the Get ready screen for coins (40 / 40 / 60) or, from level 6, for gems (2 / 2 / 3). All prices are placeholders in `BOOSTERS` in `data.ts`.
- Gems are earned for free, or bought in the store (see Growth features below). Boosters stay off Play a person, the daily card and the Weekend Cup, so paying never changes a fair match.


## Growth features (retention, session length, money)
Built in the playground only. Strategy and reasons are in the Docs artifact "Bingo Arena: retention, session length and monetization". Prices and sizes are placeholders in `data.ts`.

| Feature | What it does | Where |
|---|---|---|
| Next goals + near miss | Results show the 1 or 2 nearest targets (quest, league gap, season tier, ready box) and one "so close" line instead of the seconds line | `nextGoals()` in `data.ts`, `Results.tsx` |
| Rematch | After a match against a person, "Play again" becomes "Rematch <name>" | `Results.tsx` |
| Friend inbox + head-to-head | Sharing a challenge queues it. After your next round a friend answers: a "NEW" row in Compete > Friends, a Rematch button, a running tally per friend ("Ben leads 2 to 1") | `resolvePending()`, `Compete` |
| Friends league | Friends you have replace bots on the league board and carry a FRIEND tag | `leagueBoard()` |
| Welcome gift | The first challenge link someone opens gives +100 coins and 1 Hint after their first round | `WELCOME` |
| Store | Sheet, not a tab. Opens from the "+" on the coin balance (level 5+; gems "+" on desktop), the Shop banner, and any "not enough" moment. Starter pack $2.99 (once, offered after the first booster purchase), gem packs $0.99 / $4.99 / $9.99 / $19.99 (from level 6), coin packs $0.99 / $2.99 | `StoreSheet`, `CheckoutSheet` |
| Checkout | Clearly marked prototype: no payment, no card | `CheckoutSheet` |
| Season pass | $4.99. Gold column beside the free track, 3 locked looks, a 3rd streak freeze slot, never changes scoring | `PASS`, `passReward()` |
| Bonus box | Free every 4 hours (25 coins, Hint, 40 coins, Slow, 25 coins + 1 gem, Double, repeat). Gems (3) skip the wait. Shown in the daily chip, Daily rewards and the lobby tile. Nothing blocks play | `BOX_*` |
| Weekend Cup | 100 free coins to enter, best of 3 tries on one board at Normal speed, no boosters, prizes in gems (top 3: 10, ranks 4-10: 4, rest: 20 coins) | `CUP*` |
| Quest swap | 20 coins swaps a quest for another of the same slot | `QUEST_SETS` |
| Ghost fee by level | Free for the first 3 races, then 10 coins rising to 40 by level 15 | `ghostFee()` |
| Streak repair | A streak of 5 or more that ends can be brought back for 10 gems or 150 coins before the next daily claim | `REPAIR_*` |

Rules kept: no pay-to-win (money buys time, looks and convenience, not points), the same price list for everyone, no timers that block play, "not enough" opens the store instead of a dead button (so the short buttons look disabled but stay tappable).

Events: the catalog is in `track.ts` (`EVENT_CATALOG`). New in this round: `rematch_started`, `shop_shortfall`, `store_opened`, `iap_checkout_started`, `iap_completed`, `iap_cancelled`, `challenge_answered`, `inbox_opened`, `welcome_gift`, `box_opened`, `streak_repaired`, `quest_rerolled`, `cup_entered`, `cup_try`, `cup_claimed`, `pass_claimed`.

Prototype tools added: Skip 4 hours, Friends answer now, Give a 7-day streak, Open the store.

Things to test with real players first: does "shop_shortfall" turn into "iap_completed"; do players who get an answer play another round in the same session; do the free box and the cup change the next-day return.
