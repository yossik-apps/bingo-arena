# Admin guide

Open the game while logged in as admin and press the **shield icon** (top right). Players never see it, and the database refuses admin actions from anyone else. Every change you make is written to the **Audit log**.

| Tab | What you can do |
|---|---|
| **Overview** | Players, new and active players, rounds, coins in circulation, entry fees, prizes paid, platform take, rejected rounds, 14-day charts, results by mode and level |
| **Players** | Search by name or email, open a player, give or deduct coins (with a reason the player sees), suspend or reinstate, export CSV |
| **Events** | Create a tournament (level, entry fee, attempts, start and end, bonus pool, prize split), publish, view the leaderboard, **Finalize and pay** (pays the winners automatically), delete |
| **League** | See any finished week's top players and pay the weekly league prizes (once per week) |
| **Journey** | Every stage's clear rate, 3-star rate and average tries; change star goals and first-clear coins to tune difficulty |
| **Health** | Shows which database updates and server functions are installed, and what to run if something is missing. Start here if an admin button does nothing |
| **Config** | Each level's speed, scoring, penalty, fee and ghost strength; round length, win payout, event fee, login and welcome bonuses; real-player matches on/off, paid modes on/off, **maintenance mode**, announcement banner |
| **Catalog** | Shop item names, prices, level locks, on/off; daily quest goals, rewards, on/off |
| **Audit log** | Who did what and when |

## Good to know
* **Your own account is a normal player account.** Your coins, level and shop show only your data. To look at or change another player, use **Admin → Players**. (An earlier version let admin accounts see everyone's data in the normal screens, which mixed up the wallet. That is fixed in Phase 6.)
* After **Apply coins**, the message appears under the buttons. The player sees the change in their wallet the next time their screen refreshes.
* **Real-player matches** appear in the Overview table as “Vs player”. A match is paid when both scores are in, or 45 seconds after the round if one player walked away (the player who finished wins). If nobody finishes, both entries are refunded.
* The weekly league runs Monday to Sunday (UTC). Pay a week after it ends from the **League** tab.
* Config changes apply to the **next round** players start. Rounds in progress are never changed.
* Every number is range-checked by the server, so a typo cannot break the game.
* An event with entries cannot change level or fee, and cannot be deleted. Finalizing is final: it pays the prizes once.
* Prize pool = bonus + (entry fees × (1 − platform fee)). Winners are ranked by best score, earliest first on ties.
* Coins are play money. Nothing here moves real money.
