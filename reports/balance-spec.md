# Balance spec v2: what the implementation follows

Source: `tools/sim-balance.mjs`, 10,000 seeds per level, live level values read on 10 Nov 2026 (Beginner `every` = 4000), live mastery tiers, stages and quests. Background and the full tables are in `reports/sim-balance.md`. Decisions already taken by Sagi are applied here unchanged. Nothing in this file has been implemented yet.

## 1. What changes, in one table

| | Beginner | Medium | Hard |
|---|---|---|---|
| Call bias `calls` (chance that the next call is a number on the card) | **0.50** | **0.40** | none (today's order) |
| Speed bonus `bonus` (B) | **5** | **5** | **5** |
| Bonus per correct tap: within 1.0 s / within 2.0 s of the call | **5 / 3** | **8 / 4** | **10 / 5** |
| Ghost `share` of that board's perfect score | **0.812** | **0.827** | **0.867** |
| Ghost target (mean over boards) | 299 | 533 | 822 |
| Rank thresholds Silver / Gold / Platinum / Legend | **320 / 430 / 520 / 720** | **530 / 750 / 940 / 1400** | **750 / 1020 / 1200 / 1600** |
| `xpDiv` (score divisor in the XP formula) | 2.4 | 1.7 | 1.2 |

Everything else in `game_config` (every, win, pt, pen, xm, fee, gl, gr) stays as it is live today. `gl` and `gr` stay as the ghost for version 1 rounds.

## 2. Versions

- **Version 1 (`cv` absent):** exactly today's rules. Same board, same call order, same score, same ghost (`gl` + random(`gr`)). All rounds already stored replay to the same score.
- **Version 2 (`cv: 2` in the round's frozen params):** biased calls (Beginner, Medium), the graded speed bonus, the share-based ghost.
- The version travels inside `rounds.params`, so `submit-round` replays any round with the rules it started with. No version column on `rounds` is needed.

### Which rounds use which version

| Mode | Version | Notes |
|---|---|---|
| Practice (`solo`), Beat the Ghost (`ghost`) | 2 | when the flag allows it for that player (section 3) |
| Guest and visitor local round | 2 | uses the same config, so a first round feels like the real game |
| Daily Challenge | 2 | the day's board stores its version (`daily_boards.cv`, section 3), so goals and rounds always match |
| PvP match (`find-match`) | 2 | only when the flag is **All**, so both players always get the same rules |
| Tournament events (`tour`) | 2 | the event stores its version (`events.cv`); events created while the flag is All get 2 |
| Journey stages (`stage`) | **1** | stored goals stay valid; nothing to regenerate |
| Drills (`drill`) | **1** | the Bingo DNA skills are calibrated on version 1 numbers; revisit later |
| Duels / challenges | as the source round | see the note below |
| Every round played before release | **1** | |

**Note on challenges.** "Challenges stay on version 1" is applied to every challenge that exists, and to every challenge made from a version 1 round. A challenge made from a *new* round copies that round's params (`create_challenge_tx` already does) and is therefore version 2. That is the only way the creator's score and the friend's score are comparable, since version 1 and version 2 have different call orders. If Sagi wants new challenges to be version 1 anyway, challenges would have to be blocked for version 2 rounds. Tell me, and I'll change this section.

## 3. Release and rollout

New feature flag `balance_v2` (row in `feature_flags`, default **off**; modes off / admins / all).

| Flag | Effect |
|---|---|
| off | every round is built exactly as today |
| admins | signed-in admins get version 2 in `solo`, `ghost` and `daily` only. PvP, events and the daily board stay on version 1 for everyone, so no shared round ever mixes versions |
| all | version 2 for every mode in the table above |

Order of release:
1. Ship the code with the flag **off** (rounds and results are unchanged). Run the golden tests (section 9).
2. Set the flag to **admins**, play a few rounds on the two test accounts (`zz_test_account`, `zz_test_account_2`) and check the Result screen.
3. In one go: run the data migration (section 10), then set the flag to **all**. The new quests and rank thresholds only make sense with version 2 rounds, so they ship at the same moment.
4. Watch the first week of Beat the Ghost win rates (section 8) and adjust `share` in Admin if needed.

## 4. Engine changes (`supabase/functions/_shared/engine.ts`)

`Params` gets three optional fields. All are absent for version 1.

```ts
calls?: number;  // chance that the next call is a card number (0.5 Beginner, 0.4 Medium; absent = today's order)
bonus?: number;  // B, speed bonus. Absent or 0 = no bonus
cv?: 2;          // marker for version 2, set by buildRound
```

### 4.1 Call order: `makeBoard(seed, calls?)`

The card is **identical** to today's for a given seed. With `calls` undefined, the function returns today's result byte for byte (same random stream, same shuffle). With `calls` defined, the call order is rebuilt exactly like this (it is the algorithm the simulation used; do not change the order of random draws):

```ts
export function makeBoard(seed: number, calls?: number): Board {
  const r = mulberry32(seed);
  const card = Array(25).fill(0);
  for (let c = 0; c < 5; c++) {
    const col = shuffle(Array.from({ length: 15 }, (_, i) => c * 15 + i + 1), r).slice(0, 5);
    for (let row = 0; row < 5; row++) card[row * 5 + c] = col[row];
  }
  card[12] = 0;
  const seq = shuffle(Array.from({ length: 75 }, (_, i) => i + 1), r);
  if (calls === undefined) return { card, seq };
  const q = mulberry32((seed ^ 0x5bd1e995) >>> 0);
  const onCard = card.filter((v) => v > 0);
  const on = shuffle(onCard, q);
  const off = shuffle(Array.from({ length: 75 }, (_, i) => i + 1).filter((n) => !onCard.includes(n)), q);
  const biased: number[] = [];
  while (on.length || off.length) biased.push(on.length && (!off.length || q() < calls) ? on.pop()! : off.pop()!);
  return { card, seq: biased };
}
```

Everything that calls `makeBoard(seed)` must pass `p.calls`: `scoreTaps`, `botTaps`, `missedCount` (all take `p` already), and the clients (section 7.3). `status()` and `currentIndex()` do not change.

Measured effect (card numbers called out of the 24, per round): Beginner 8.0 → 12.5, Medium 10.9 → 13.6. Hard is unchanged (14.7).

### 4.2 Graded speed bonus in `scoreTaps`

For each correct (live) tap, after the base points and before the line check:

```ts
const delay = tap.t - seq.indexOf(num) * p.every;          // ms after the number was called
if (p.bonus) {
  const b = delay <= 1000 ? Math.round(p.bonus * p.pt)
          : delay <= 2000 ? Math.round(p.bonus * p.pt / 2) : 0;
  score += b; bonus += b; if (b) (delay <= 1000 ? fast1++ : fast2++);
}
```

- Not multiplied by the combo, not changed by `lineMul`, never negative.
- A wrong or late tap still costs `pen` and resets the combo as today. **Version 2 removes the floor at 0** (decided: wrong taps may take the score below zero): `score -= p.pen` instead of `Math.max(0, score - p.pen)`. Version 1 keeps the floor. `rounds.score` is a plain `int` with no check, so negative scores can be stored; make sure the Result screen, XP (`xpFor` should use `max(0, score)`) and the Practice "new best" comparison cope with them. The simulation shows rounds below zero are very rare for normal play (0% of simulated average rounds, 0–1 point effect on win rates), so this mostly matters for players who tap at random.
- `delay` is measured from the call time of that number, so the boosters (Slow, Extra window, Extra time) do not move the 1.0 s and 2.0 s thresholds.
- `ScoreResult` gets three new fields: `bonus` (points from speed), `fast1` (taps within 1.0 s), `fast2` (taps within 2.0 s). Version 1 rounds return 0, 0, 0.

Points with `pt` (rounding is `Math.round`, half rounds up):

| Level | pt | within 1.0 s | within 2.0 s |
|---|---|---|---|
| Beginner | 1 | 5 | 3 (2.5 rounds up) |
| Medium | 1.5 | 8 (7.5) | 4 (3.75) |
| Hard | 2 | 10 | 5 |

Size: the bonus is about **15% of a good round's score** (perfect 16–17%, good 14–16%, average 12–14%). A perfect player taps within 700 ms, so earns the top tier on every tap.

### 4.3 Ghost: `ghostTarget`

A version 2 round's ghost is computed **once at `start-round`**, from the level's normal rules (no boosters, no stage or daily modifiers), so boosters stay worth having:

```ts
const p0 = { ...lv, total: cfg.g.total };                       // lv carries calls, bonus, share
const perfect = scoreTaps(seed, p0, botTaps(seed, p0, 700, p0.total * 1000)).score;
ghost = Math.round(lv.share * perfect);
params.perfect = perfect;                                        // stored for analytics and recalibration
```

Version 1 rounds keep `gl + floor(random * gr)`. `submit-round` is unchanged (`win = score > ghost`). The result keeps returning `ghost`.

## 5. Config (`game_config.data.levels.<level>`)

Add these keys per level (Admin edits them like the others). A level without `share` falls back to the old ghost; without `calls` it keeps today's order; without `bonus` it has no bonus.

| Key | Beginner | Medium | Hard |
|---|---|---|---|
| `calls` | 0.5 | 0.4 | (omit) |
| `bonus` | 5 | 5 | 5 |
| `share` | 0.812 | 0.827 | 0.867 |
| `xpDiv` | 2.4 | 1.7 | 1.2 |

`buildRound` sets `cv: 2` and copies `calls`, `bonus`, `share` into the frozen params only for the version 2 modes and when the flag allows (section 3). For `stage` and `drill` it removes them. `find-match` builds its own params and must do the same.

Version 2 is gated by the flag at round start; the choice is frozen in the round, so changing the flag never alters a running round.

## 6. Quests and badge

Live quests (`mission_defs`): adv, combo, daub25, line3, play3, pvp, win1.

| Quest | Change | Why (good player / average player, finish within 3 rounds) |
|---|---|---|
| `line3` "Complete 3 lines" | replace by **"Complete 1 line"**, goal 1, reward 35 (unchanged; consider 25, since it is now much easier) | Beginner (50%) 64% / 37%, Medium (40%) 78% / 48%, Hard 86% / 56%. Today with goal 3 a good player gets 0% on Beginner, 1% on Medium and 34% on Hard |
| `daub25` "Daub 25 numbers" | replace by **"Daub 30 numbers"**, goal 30, reward 30 | the bias adds 25–57% more daubs per round (good player: Beginner 7.2 → 11.3, Medium 9.7 → 12.1). Goal 30: Beginner 84% / 40%, Medium 93% / 53%, Hard 99% / 78%. Medium matches today's goal-25 difficulty (91% / 42%). Goal 35 is the harder alternative: Beginner 44% / 7%, Medium 66% / 15% |
| `combo` "Reach a x3 combo" | **no change** | already 100% on Medium and Hard; on Beginner it goes from 82% to 100%. A harder goal does not help, since x3 is the combo cap |
| `win1` "Win a round" | no change | wins now come from the share-based ghost (good player 60 / 50 / 40%) |
| `adv`, `play3`, `pvp` | no change | not affected |

To keep ids stable and old progress valid, do not rename rows: insert `line1` and `daub30`, and set `active = false` on `line3` and `daub25`.

**Badge.** `lines3` ("3 lines in one round") stays for the players who have it. Add **`lines2` "2 lines in one round"** and award it in `finish_round` when `lines >= 2`. Good player: Beginner 6% of rounds, Medium 13%, Hard 16%; average 2% / 4% / 4%.

## 7. Mastery ranks

### 7.1 Thresholds

| Level | Bronze | Silver | Gold | Platinum | Legend |
|---|---|---|---|---|---|
| Beginner | first round | 320 | 430 | 520 | 720 |
| Medium | first round | 530 | 750 | 940 | 1400 |
| Hard | first round | 750 | 1020 | 1200 | 1600 |

How they were set: Silver is the median of an average player's best of 5 rounds, Gold a good player's best of 5, Platinum a good player's best of 20, and Legend the 90th percentile of a good player's best of 100. They are rounded to 10 and carry about ±5% sampling noise. A good player's rank after one round is Bronze (about 55–60% of the time) or Silver; Platinum is the usual result after about 20 rounds.

Today's thresholds (Beginner 35/60/80/105, Medium 95/150/205/260, Hard 205/325/450/570) are all below a good player's first round, which is why QA saw Platinum after one lost round. Update the rows with `update public.mastery_tiers set min_score = ... where level = ... and tier = ...` (shown to Sagi first).

### 7.2 Unranked and version

- `mastery()` returns tier -1, name **"Unranked"**, until the player has a scored round **at that level under version 2**. Bronze (min 0) starts from that first round. This also fixes "Bronze at 0 on Hard".
- Only version 2 rounds (`params->>'cv' = '2'`) count toward the rank, because the thresholds are on the version 2 score scale. Old version 1 bests would otherwise look like a drop in rank. Everyone therefore starts as Unranked at each level after release; ranks carry no rewards, so nothing is lost.

## 8. Expected results with this spec

10,000 seeds per level. "Good" = 900 ms, 10% missed; "average" = 1,300 ms, 25% missed; "perfect" = 700 ms.

| | Beginner | Medium | Hard |
|---|---|---|---|
| Score, perfect / good / average (mean) | 368 / 305 / 223 | 645 / 522 / 364 | 948 / 770 / 543 |
| Good ÷ average | 1.37× | 1.43× | 1.42× |
| Ghost wins, good (target 60 / 50 / 40%) | 60% | 50% | 40% |
| Ghost wins, average player | 10% | 5% | 2% |
| Lines per round, good: 1+ / 2+ / 3+ | 29% / 6% / 1% | 39% / 13% / 4% | 48% / 16% / 4% |
| Lines per round, average: 1+ | 15% | 19% | 25% |
| Good player's win chance per board, p10–p90 (simulated without the bonus; the bonus moves it by about a point) | 43–74% | 33–68% | 25–58% |

**Speed separates fast good players from slower ones** (both miss 10%; fast = 700 ms, slow = 1,100 ms), with no bonus the two win equally often:

| | Beginner | Medium | Hard |
|---|---|---|---|
| Mean score, fast good / slow good | 312 / 299 | 541 / 498 | 796 / 742 |
| Wins vs the ghost, fast good / slow good | 64% / 55% | 58% / 38% | 47% / 29% |
| Fast good outscores slow good on the same board | 63% | 66% | 64% |

Why B = 5 on all levels: B = 3 separates less (Medium 57% / 40% wins, Hard 46% / 33%). B = 8 separates more (Beginner 68% / 49%, Medium 61% / 34%, Hard 50% / 25%), but it pushes average players' wins down to 7% / 3% / 1% and the ghost share to 0.80 / 0.82 / 0.86. B = 5 gets most of the board-level separation (63–66% against 65–68% for B = 8) and keeps average players winning sometimes on Beginner. If speed should matter more, B = 8 is the next step: share 0.802 / 0.822 / 0.857, thresholds 335/460/560/765, 565/800/990/1455, 790/1090/1285/1695.

**Known weaknesses of these numbers:**
- The shares assume clean play. A good player who also mis-taps 5% of taps wins about 45 / 31 / 21% at the same shares (wrong taps reset the combo). Calibrate on live data: after one week, read the ghost win rate per level from `rounds` (`mode = 'ghost'`, `score > params.ghost`), and move `share` by about 0.01 per 2–3 points of win rate. Admin can do this without a release, since `share` is config.
- Average players rarely win on Medium and Hard (5% and 2%). That follows from the decided targets for good players.

## 9. Acceptance tests (must pass before the flag moves past admins)

1. **Version 1 is untouched:** for 1,000 seeds, `makeBoard(seed)` equals the old `makeBoard`, and `scoreTaps` with params that have no `calls`, `bonus`, `cv` equals the old score and returns `bonus = fast1 = fast2 = 0`. `supabase/tests/engine.test.ts` already covers part of this.
2. **Golden vectors** (version 2, perfect player at 700 ms, taps from `botTaps`, `total` = 100 s, level values from section 1):

   | Level | Seed | First 12 calls | Card row 1 | Base | Taps ≤1 s / ≤2 s | Bonus | Total | Ghost |
   |---|---|---|---|---|---|---|---|---|
   | Beginner | 1 | 32,10,74,50,58,54,53,26,69,38,71,34 | 4,25,42,59,68 | 140 | 8 / 0 | 40 | 180 | 146 |
   | Beginner | 12345 | 71,51,23,73,65,52,29,27,12,67,15,20 | 9,17,39,58,70 | 340 | 13 / 0 | 65 | 405 | 329 |
   | Beginner | 4000000000 | 37,75,13,42,23,4,72,55,30,50,31,16 | 2,30,34,52,68 | 230 | 11 / 0 | 55 | 285 | 231 |
   | Medium | 1 | 32,10,74,54,50,53,69,58,38,71,34,73 | 4,25,42,59,68 | 510 | 13 / 0 | 104 | 614 | 508 |
   | Medium | 12345 | 71,51,23,73,52,29,27,67,65,15,6,12 | 9,17,39,58,70 | 510 | 13 / 0 | 104 | 614 | 508 |
   | Medium | 4000000000 | 37,75,23,72,50,13,31,42,16,39,40,41 | 2,30,34,52,68 | 390 | 12 / 0 | 96 | 486 | 402 |
   | Hard | 1 | 67,71,39,64,56,57,54,2,19,21,45,47 | 4,25,42,59,68 | 1280 | 18 / 0 | 180 | 1460 | 1266 |
   | Hard | 12345 | 32,17,25,5,75,39,27,22,52,41,38,56 | 9,17,39,58,70 | 400 | 10 / 0 | 100 | 500 | 434 |
   | Hard | 4000000000 | 14,38,11,22,50,69,32,12,42,40,7,16 | 2,30,34,52,68 | 640 | 14 / 0 | 140 | 780 | 676 |

   (Hard uses today's call order, so its calls are today's; "base" is the engine score before the bonus; ghost = `round(share × total)`.)
3. **Statistics:** over seeds 1–2,000, the mean perfect total is within 3% of 369 (Beginner), 641 (Medium), 947 (Hard), and a mean of 0.61 / 0.97 / 1.18 lines for the perfect player.
4. **Parity:** the browser (Classic and new Play) and `submit-round` give the same score for the same taps, for a version 1 and a version 2 round.
5. **Replay:** a version 1 round stored before release replays to its stored score through the new `submit-round`.
6. **Journey:** all 24 stages score exactly as before (stage rounds carry no `cv`).

## 10. Data migration (shown to Sagi first, run by Sagi after a backup; additive, wrapped in `begin; … commit;`)

1. `feature_flags`: insert `balance_v2` (default off), `on conflict do nothing`.
2. `daily_boards` and `events`: add `cv smallint not null default 1`.
3. `game_config`: add the keys of section 5 to each level (an `update` of the JSON, not a rewrite).
4. `mastery_tiers`: update `min_score` of tiers 1–4 per level (section 7.1). `mastery()` redefined with `create or replace` (Unranked, `cv = 2` only).
5. `mission_defs`: insert `line1` and `daub30`; `update … set active = false` for `line3` and `daub25`.
6. `ach_defs`: insert `lines2`; `finish_round` redefined with `create or replace` to award it.
7. Solo prize and XP, so the new scale does not create free coins or XP (section 11).

Steps 3–6 only take effect for players when the flag is **all**; run them in the same release step.

## 11. Knock-on effects the implementation must handle

- **XP.** `xpFor` uses `score / 8`, and version 2 scores are higher (good player: Beginner ×2.4, Medium ×1.7, Hard ×1.2 on average). Pass `score / xpDiv` into `xpFor` for version 2 rounds (`xpDiv` = 1 for version 1), so a round pays about the same XP as today.
- **Practice (`solo`) prize.** `win` is "better than your previous best". Compare only with bests from rounds of the same version, otherwise the first version 2 round at each level is an automatic "new best" and pays 7 coins instead of 2.
- **Leaderboards.** Any query that ranks raw scores must compare rounds of the same version (daily boards and events are already per board / per event with their own `cv`). Check for any other score-ranked list during implementation; I haven't found one.
- **Mastery best** counts only version 2 (section 7.2).
- **Season and league** are not affected: they use XP and wins.

## 12. Result screen and Play screen

The server result gets `bonus`, `fast1`, `fast2` (and keeps `ghost`). Score always shows the total, including the bonus.

Result screen (Classic and new design), under the Score row:

```
Score            305            (ghost 299)
  Speed bonus    +49            6 taps under 1 s · 1 under 2 s
```

- The **Speed bonus** row shows only for version 2 rounds. When `bonus` is 0, show it as "+0" with a hint: "Tap within 1 s of a call for +5" (the number is the level's 1.0 s points: 5, 8 or 10).
- Beat the Ghost shows the margin: "You beat the ghost by 6" or "Ghost wins by 11".
- The Result screen's existing "avg reaction" line stays; it is the number the bonus rewards.
- Rounds without a bonus (version 1, Journey stages, drills) show no bonus row, exactly as today.

Play screen: when a correct tap earns a bonus, show a small `+5` (or `+8`, `+10`) pop next to the normal points, in the accent colour for ≤1.0 s and a dimmer colour for ≤2.0 s. The live score in the HUD includes the bonus (it already comes from `scoreTaps`). No timer or countdown is shown on the numbers.

Guide and Help text (`web/src/guide/content.ts`): add one sentence, "Tap within 1 second of a call for bonus points; within 2 seconds for half."

## 13. Files to change (for the implementation branch)

- `supabase/functions/_shared/engine.ts` (Params, `makeBoard`, `scoreTaps`, `botTaps`, `missedCount`, result fields, `xpFor` caller) and `rounds.ts` (`buildRound`: version, ghost share, stage and drill strip).
- `supabase/functions/start-round/index.ts` (read the flag, events' and daily boards' `cv`), `find-match/index.ts`, `submit-round/index.ts` (XP divisor, same-version best, result fields), `_shared/daily.ts` (goals from version 2 params).
- Client: `web/src/views/Play.tsx`, `web/src/newui/screens/Play.tsx`, `Play.fixture.ts`, `web/src/lib/roundCalls.ts` (pass `calls` to `makeBoard` and `missedCount`), `views/Result.tsx` and `newui/screens/Result.tsx` (bonus row), guide content.
- Tests: `supabase/tests/engine.test.ts` (section 9), `rounds.test.ts`.
- New migration (next free number, 026 unless the Stage 2 events migration took it) per section 10.

## 14. Open points for Sagi (none block the implementation)

1. Challenges made from a new round are version 2 (section 2). Confirm.
2. Reward of the "Complete 1 line" quest: 35 now, 25 if it should match its new difficulty.
3. `daub30` (recommended) or `daub35`.
4. B = 5 or B = 8 for the speed bonus (section 8).
