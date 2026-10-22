# Admin guide

Open the game while logged in as admin and press the **shield icon** (top right). Players never see it, and the database refuses admin actions from anyone else. Every change you make is written to the **Audit log**.

| Tab | What you can do |
|---|---|
| **Automation** | The engine that runs the game every 5 minutes: opens and finishes events from schedules, pays the weekly league and crews every Monday, starts new seasons, plans boosts (live ops) 7 days ahead and pays XP races. Prize pools follow the activity (base + coins per player, up to a maximum). Switch parts on or off, change the schedules, press Run now, and see the activity list. Winners get an inbox message with the amount; players get a message when someone passes them. |
| **Online (header)** | “● N players online”: players and guests active in the last 10 minutes; tap for the list. |
| **Analytics** | Pick 7, 30 or 90 days; every number is compared with the period before. **Summary** (key numbers, active players per day, right-now totals, visitor-to-player funnel, returning players). **Players** (new, active, daily average, returning share, kept/lost/won back, weekly sign-up groups, how often players come, most active players). **Visitors** (visitors, new visitors, guests' free rounds, the sign-up funnel step by step, devices, where visitors come from, first screen). **Countries** (world map of visitors, active players, new players or revenue, top 8, full table; country guessed from the browser time zone). **Revenue** (revenue, purchases, paying players and share, per paying player, per player per day, first-time and repeat buyers, sales by product, reward videos with an income estimate, top spenders). **Games** (rounds per day, when people play by weekday and hour, results by mode and level). **Economy** (coins given out and spent, where coins come from and go). Tick “Count test purchases” to include test buys. Export CSV downloads the daily numbers. |
| **Messages** | Read what players send through Contact us, reply, close conversations, and write to any player first (New message to a player). The number next to the tab and on the admin gear shows unanswered messages |
| **Players** | Search by name or email, open a player, give or deduct coins (with a reason the player sees), suspend or reinstate, **set a new password**, **send a message**, export CSV |
| **Events** | Create a tournament (level, entry fee, attempts, start and end, bonus pool, prize split), publish, view the leaderboard, **Finalize and pay** (pays the winners automatically), delete |
| **League** | See any finished week's top players and pay the weekly league prizes (once per week) |
| **Journey** | Every stage's clear rate, 3-star rate and average tries; change star goals and first-clear coins to tune difficulty |
| **Live ops** | Schedule timed boosts (more XP, more coin prizes, cheaper Beat the Ghost entry) and announcements. Quick-start buttons for common events. They switch on and off by themselves |
| **Season** | Create seasons (dates, XP per tier, pass price) and edit the free and pass reward of each of the 30 tiers. A new season copies the last one |
| **Crews** | See every crew, rename or delete one (moderation), and pay the weekly crew prizes |
| **Health** | Shows which database updates and server functions are installed, and what to run if something is missing. Start here if an admin button does nothing |
| **Config** | Each level's speed, scoring, penalty, fee and ghost strength; round length, win payout, event fee, login and welcome bonuses; real-player matches on/off, paid modes on/off, **maintenance mode**, announcement banner |
| **Catalog** | Shop item names, prices, level locks, on/off; daily quest goals, rewards, on/off |
| **Audit log** | Who did what and when |

## Good to know
* **Passwords:** Players tab → open a player → **Set a new password**. Tell the player the password privately (never in the game) and ask them to change it in Profile. The change is logged, the password is not.
* **Data copies:** players can ask for a copy of their data through Contact us. Reply within 30 days, as the privacy policy promises.
* **Your own account is a normal player account.** Your coins, level and shop show only your data. To look at or change another player, use **Admin → Players**. (An earlier version let admin accounts see everyone's data in the normal screens, which mixed up the wallet. That is fixed in Phase 6.)
* After **Apply coins**, the message appears under the buttons. The player sees the change in their wallet the next time their screen refreshes.
* **Real-player matches** appear in Analytics → Games as “Vs player”. A match is paid when both scores are in, or 45 seconds after the round if one player walked away (the player who finished wins). If nobody finishes, both entries are refunded.
* The weekly league runs Monday to Sunday (UTC). Pay a week after it ends from the **League** tab.
* Config changes apply to the **next round** players start. Rounds in progress are never changed.
* Every number is range-checked by the server, so a typo cannot break the game.
* An event with entries cannot change level or fee, and cannot be deleted. Finalizing is final: it pays the prizes once.
* Prize pool = bonus + (entry fees × (1 − platform fee)). Winners are ranked by best score, earliest first on ties.
* Coins are play money. Nothing here moves real money.
