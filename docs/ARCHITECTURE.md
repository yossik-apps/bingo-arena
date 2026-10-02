# Architecture

```
Player's browser / phone app (web/)
        │  1. sign in (Google, Facebook, email)         → Supabase Auth
        │  2. read own profile, wallet, history          → Supabase database (row security: own rows only)
        │  3. start a round / submit taps / daily bonus  → Edge Functions (server)
        ▼
Edge Functions (supabase/functions) ── use the service key ──► Postgres (supabase/migrations)
        └── run the SAME engine.ts as the browser to decide the real score
```

## Why this is safe
* The browser can only **read** its own data. It cannot write coins, XP, scores or roles (tested in `supabase/tests/db.test.mjs`).
* Money moves only through database functions that lock the player's wallet, check funds, and write an immutable **ledger** row. Balance = sum of the ledger. Nothing is ever edited in place.
* A round is created by the server with a secret random seed, charged once, and can be scored only once.
* The server re-plays the player's taps against the same seed and timeline. Impossible speed, wrong cells, wrong timing, or an early/late submit rejects the round.
* The rules of each round (pace, fee, payout) are copied into the round when it starts, so changing the config cannot affect a round in progress.

## Known limits of Phase 1 (planned for later phases)
* Solo and vs-ghost only. Real-player matches, events, shop, quests, ads and the admin site come next.
* No rate limiting yet beyond Supabase defaults (add per-user limits before a large launch).
* Play-money coins only. Cash prizes need licensing, KYC and a payment provider first.
