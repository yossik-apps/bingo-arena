# Money and the game economy

Bingo Arena is a free social game. **Nobody can win or cash out real money.** You earn when players choose to pay for more fun, status or convenience (like Bingo Blitz), and later from optional reward ads.

## Currencies
- **Coins:** earned by playing; spent on entry fees, boosters and looks.
- **Gems:** the second currency. Earned slowly (first drill of the day: 1 gem; Bingo Club: 5 a day) and in gem packs. Spent on coin swaps (10 → 600, 50 → 3,500) and Streak Shields (20).
- Neither has any cash value, and neither can be transferred.

## Products (prices are set in Admin → Store)
| Product | Default price | What the player gets |
|---|---|---|
| Starter pack (once) | $1.99 | 3,000 coins + 30 gems |
| Coin packs | $1.99 to $49.99 | 1,000 to 35,000 coins (bigger packs give up to 40% extra) |
| Gem packs | $1.99 to $9.99 | 50 to 300 gems |
| Bingo Club, 30 days | $4.99 | 150 coins + 5 gems a day, Club badge, last 50 games in Bingo DNA. Does not renew by itself. |
| Coin Vault | $2.99 | All coins collected in the vault (10% extra on every win, up to 3,000) |
| Season Pass Premium | $4.99 | The premium track of the current season |
| Crew Treat | $2.99 | 200 coins for every crew member, with the buyer's name |

## Store modes (Admin → Store)
- **Off:** the store is hidden.
- **Preview (default):** players see products and prices with "Coming soon".
- **Test:** only admins can buy, for free, to try every flow. Test purchases are never counted as revenue.
- **Live:** real payments. This needs the payment provider update and cannot be switched on before it.

## Player protection (keep these)
- No paid random packs. Contents and prices are always shown.
- A monthly spending limit in Profile → Settings, checked on every purchase (test purchases too).
- Purchase history on the Coins screen.
- 18+ only.

## Before real money goes live
1. Talk to a lawyer about virtual currency and consumer law in Israel and every country you target, and finish the [bracketed] parts of Terms section 4.
2. Register a business that can receive payments.
3. Open an account with a payment provider (for example Xsolla, which is built for games and handles VAT worldwide). Then the next update adds the payment webhook, and you switch the store to Live.

## Ads (0.18)
Optional reward videos and an optional short break between rounds, using Google H5 Games Ads. Set them up with docs/ADS_GUIDE.md and Admin → Store → Ads.
