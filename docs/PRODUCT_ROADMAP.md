# Bingo Arena: product roadmap and engagement design

## 1. What makes this game different
The big casual games keep people playing with luck loops: spins, slot-style rewards, packs you can buy, timers that punish you for leaving. Bingo Arena competes on three things they cannot easily copy:
1. **Skill you can see improving.** Every board is a fair, replayable puzzle. The coach explains what to do better.
2. **Honest rewards.** No paid random packs, odds shown, a guaranteed epic within 10 packs, rewards given once per achievement (no farming), no energy bars.
3. **Healthy play.** A break reminder is already built in (Play Pulse). Time and spend limits come before any real-money feature.
Players who feel respected stay longer. This is also what licence regulators and the app stores want to see.

## 2. The loops that bring people back
| Loop | What the player does | Built | Next |
|---|---|---|---|
| **Minutes** | One 100-second round: daub, combo, lines, coach tips | yes | Speed Round (45 s), 3-card Blackout for veterans |
| **Session** | Journey stages with stars, quests, a stamp or two | **Phase 5** | Daily Challenge (one shared board a day) |
| **Daily** | Login bonus, 3 quests, day-7 stamp pack | yes | Streak Shield (earned, saves a missed day) |
| **Weekly** | Weekly league, events | yes | Crew goals, weekly world event |
| **Season (6 weeks)** | Complete albums, climb mastery | albums yes | Season track with a themed world and album |

## 3. What Phase 5 adds
* **Journey:** 3 worlds, 24 stages. Each stage is a fixed board with its own rule twist (Line Frenzy, Combo Rush, Blitz, Tight Window, Steady Hands, Marathon). Three star goals per stage, set from a flawless reference player so every goal is reachable. Worlds unlock with total stars, so skill, not spending, opens content.
* **Album:** 27 stamps (common, rare, epic) across 3 world pages. Packs come from first clears, first 3-star results and every 7th streak day. Duplicates become dust, and dust crafts any missing stamp, so nobody is stuck hunting one last card. A finished page gives coins and an exclusive board.
* **Admin tuning:** the Journey tab shows clear rate, 3-star rate and average tries per stage, and lets you change the goals and rewards.

## 4. New ideas to build next (original, in priority order)
| # | Idea | Why it keeps players | Effort |
|---|---|---|---|
| 1 | **Daily Challenge:** everyone gets the same board for 24 hours, one try, global and friends leaderboard | A reason to open the game every day, and something to talk about | small |
| 2 | **Beat my run (async duels):** share a link to your recorded round on a fixed board; a friend tries to beat it, no waiting | Viral, works offline from the other player, perfect for chat apps | medium |
| 3 | **Crews:** teams of up to 20 pool stars into a weekly crew goal and a shared chest; crew leaderboard | Social obligation without pressure; strongest retention lever in this genre | medium |
| 4 | **Season track:** 30 tiers of rewards for XP, a free and a premium row, a themed world and album each season | Gives every round a visible long-term purpose | medium |
| 5 | **Hall Regulars:** collectible characters with a small perk that works only in solo and Journey, never in matches against people (e.g. "Eagle Eye: one extra number stays daubable for the first 20 seconds"). Level them by playing | A collection with personality; a reason to replay older stages | medium |
| 6 | **Streak Shield and comeback gift:** earn a shield by finishing 3 quests; a gift after 3+ days away | Keeps the streak positive instead of punishing | small |
| 7 | **Mastery ranks:** per level, Bronze to Legend from your best scores, shown on your profile | Skill identity and bragging rights | small |
| 8 | **Live ops calendar:** Lucky Hour (double XP), themed weekends, limited stages. Admin schedules them. Nothing is lost if you miss one | Predictable reasons to return, safe for players | medium |
| 9 | **Spectate and replay:** watch a live match or a top replay | Learning and entertainment between your own rounds | larger |
| 10 | **Share cards:** an image of your result and stars | Free marketing | small |

## 5. Economy design
| Currency | Earned by | Spent on | Notes |
|---|---|---|---|
| **Coins** | Rounds, quests, login, journey, events, league, album | Entry fees, shop | The main loop. Entry fees and shop are the sinks. |
| **Stars** | Journey stages (max 72) | Never spent | Pure progress; unlocks worlds |
| **Dust** | Duplicate stamps | Crafting missing stamps | Removes bad luck |
| **Stamps** | Packs, crafting | Complete pages | Never sold |
| **Gems (later)** | Season track, achievements, and real-money purchase after licensing | Premium cosmetics | Introduced only with payments |

Controls that keep the economy healthy:
* Most rewards are one-time (first clear, first 3 stars, page complete). Replays pay XP only.
* Paid modes keep about 10% (set in Config). Watch “coins in circulation” in Admin → Analytics → Economy. If it grows faster than your daily players, raise fees or add sinks.
* Boosters work only in solo and vs-ghost, never in matches against people.
* Every reward goes through the server ledger. Nothing is created on a phone.

Metrics to watch from day one: day-1/7/30 return, average rounds per day, average session minutes, Journey clear funnel (admin Journey tab), quest claim rate, coins in versus out per player, share of players who touch Compete.

## 6. Guardrails (the ethics line)
* No randomised item you can pay for. Odds are always visible. Pity timer on epics.
* No energy gates, no “last chance” countdowns, no losing a streak for one missed day (shield first).
* Break reminders on by default. Before real money: daily time limit, deposit limit, cool-off and self-exclusion, age and identity checks.
* Social features never require spending. Boosters and perks never apply against real people.

## 7. Phases from here
| Phase | Scope |
|---|---|
| **5 (done)** | Journey, Album, streak packs, Play Pulse, admin Journey tuning |
| **6 (done)** | Daily Challenge, Streak Shield, Mastery ranks, share cards, Beat my run, data download and account deletion, terms versioning |
| **7 (done)** | Crews, season track, live ops calendar in admin |
| **8 (next)** | Push reminders, Hall Regulars, Speed Round, 3-card Blackout, more worlds |
| **9** | Android and iPhone apps (Capacitor), Sign in with Apple, push notifications |
| **10** | Licensing, ID checks and payments for real-money play where allowed |
| **11** | Scale: live match view, fraud tooling, more languages |
