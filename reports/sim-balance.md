# WP4 balance simulation: ghost, lines, speed and ranks

Research only. No game code, data or live settings were changed. Tool: `tools/sim-balance.mjs` (runs the real engine: `makeBoard`, `botTaps`, `scoreTaps`, `ghostTarget`, `applyMods`). Full tables: run it and open `tools/sim-out/<dir>/report.md` (git-ignored).

```bash
node tools/sim-balance.mjs --config live-config.json --tiers tiers.json --stages stages.json \
  --seeds 10000 --speed 3,5,10 --variants now,b40,b50,b60 --out tools/sim-out/live
```

## Inputs (all live)

- **Level values**, read on 10 Nov 2026 with a read-only anon select of `game_config` (no writes), after Beginner `every` was set to 4000 in Admin. Beginner `hint` is now false; hints don't affect scoring.

  | Level | every | win | pt | pen | gl | gr |
  |---|---|---|---|---|---|---|
  | Beginner | 4000 | 4 | 1 | 5 | 150 | 100 |
  | Medium | 3000 | 3 | 1.5 | 8 | 250 | 130 |
  | Hard | 2200 | 2 | 2 | 15 | 380 | 200 |

  These are now identical to the `001_schema.sql` defaults, apart from the Beginner hint flag. A round is 100 s, so Beginner has 26 calls, Medium 34 and Hard 46.
- **Mastery tiers** (15 rows) and **Journey stages** (24 rows), pasted from the live tables. Both are identical to the migrations (`006_phase6.sql`, `005_phase5.sql`), checked row by row.
- **Daily quests**, pasted from the live `mission_defs`: `adv`, `combo` (x3 combo), `daub25`, `line3` (Complete 3 lines), `play3`, `pvp`, `win1`. The badge `lines3` ("3 lines in one round") is from the migrations.
- **Players:**
  - *Perfect:* `botTaps` at 700 ms (the reference used for star goals).
  - *Good:* 900 ms ±25% reaction, 10% of card numbers missed.
  - *Average:* 1,300 ms ±25% reaction, 25% missed.
- **Sensitivity run (wrong taps):** good players mis-tap on 5% of taps, average players on 10%.
- **Seeds and rules:** 10,000 random seeds per level. A ghost win is score > target (as in `submit-round`).

> **Correction to the previous version of this report.** It was run with Beginner `every` = 5000. At that setting, w1s1 and w1s4 could not reach 3★ and a perfect Beginner round beat the ghost only 5% of the time. With the live value back at 4000, none of that applies, and the Journey stage goals are consistent with the live rules. All numbers below use `every` = 4000.

## 1–3. Today (live values)

| Level | Calls | Card numbers called | Perfect mean (p10–p90) | Good | Average | Ghost (mean) | Perfect / good / avg beat it | Good: lines/round, 1+, 3+ | Avg: 1+ |
|---|---|---|---|---|---|---|---|---|---|
| Beginner | 26 | 8.0 of 24 | 148 (90–230) | 125 | 95 | 199 | **20%** / 12% / 4% | 0.05, 4%, 0% | 2% |
| Medium | 34 | 10.9 | 361 (210–510) | 301 | 220 | 315 | 62% / 42% / 17% | 0.17, 15%, 0% | 7% |
| Hard | 46 | 14.7 | 801 (560–1080) | 659 | 480 | 480 | 96% / **82%** / 47% | 0.70, 48%, 4% | 25% |

QA's finding holds on Beginner, where even a perfect round wins only 20%. Hard has the opposite problem: it is too easy.

## 4. Ghost fix: target = share × that board's perfect score

Calls unchanged, no speed bonus:

| Level | Share | Good wins | Average wins | Good win chance per board, p10–p90 | Boards where good wins <25% |
|---|---|---|---|---|---|
| Beginner | 0.815 | 58% | 18% | 42–77% | 0% |
| Medium | 0.850 | 48% | 9% | 29–68% | 5% |
| Hard | 0.885 | 40% | 5% | 25–58% | 13% |

- **Base the target on the level's normal rules.** Compute it from `lv`, as `ghostTarget` does today, not from the boosted rules. Otherwise the Extra time and Slow boosters would raise the target too.
- **Wrong taps hurt more than expected.** At the same shares, a good player who mis-taps on 5% of taps wins 45%, 31% and 21%, because a wrong tap resets the combo. The shares assume clean play, so calibrate them against live rounds (score ÷ that board's perfect) once there is data.
- **Allowing scores below zero has almost no effect.** Under the wrong-tap model above, no average round goes below zero and ghost win rates don't change. The rule only matters for players who tap at random.
- **Board variety is moderate.** No board is unwinnable. On Hard, about 1 board in 8 gives a good player under 25%.

## 5. Line options

### (a) Biased calls: each call is a card number with probability q

The card stays the same. Today q ≈ 32%.

| Option | Level | Perfect mean | Good mean | Good: lines/round, 1+, 2+, 3+ | Average: 1+ | Today's ghost: good wins | Ghost share (good at 60/50/40%) | Average wins at that share |
|---|---|---|---|---|---|---|---|---|
| 40% | Beginner | 212 | 179 | 0.14, 12%, 1%, 0% | 6% | 36% | 0.820 | 18% |
| **50%** | **Beginner** | 305 | 256 | 0.37, **29%**, 6%, 1% | 15% | 70% | 0.822 | 14% |
| 60% | Beginner | 421 | 349 | 0.86, 53%, 21%, 8% | 29% | 91% | 0.810 | 13% |
| **40%** | **Medium** | 536 | 441 | 0.59, **39%**, 13%, 4% | 19% | 74% | 0.847 | 9% |
| 50% | Medium | 817 | 651 | 1.60, 69%, 41%, 23% | 41% | 95% | 0.815 | 7% |
| 40% | Hard | 1290 | 1018 | 2.38, 78%, 55%, 37% | 52% | 95% | 0.845 | 4% |
| 50% | Hard | 1986 | 1505 | 5.20, 96%, 89%, 79% | 81% | 100% | 0.790 | 3% |

- **Under any bias the fixed ghost becomes trivial.** The share-based ghost absorbs the higher scores.
- **Hard at 50% or more saturates.** Many cards fill completely and perfect hits the 2,440 maximum. Don't bias Hard.
- **Any change to the call order must be versioned** (for example a `calls` field in round params), so duels and old rounds replay exactly as they were played.

### (b) Calls unchanged, quest and badge lowered

| Level | Player | "3 lines" quest within 3 rounds (today) | "1 line" within 3 rounds | 3 lines in one round | 2 lines in one round |
|---|---|---|---|---|---|
| Beginner | good | 0% | 13% | 0% | 0% |
| Medium | good | 1% | 41% | 0.1% | 1% |
| Hard | good | 36% | 86% | 4% | 16% |
| Hard | average | 7% | 57% | 0.5% | 4% |

With option (b) alone, Beginner and Medium still have practically no lines.

### 5c. Side effect on two other live quests

Biasing the calls also makes `daub25` ("Daub 25 numbers") and `combo` ("Reach a x3 combo", which needs 8 correct daubs in a row) easier, so their 30-coin rewards become easier to earn.

| Calls | Level | Good: daubs/round | Daub 25 within 3 rounds (good / avg) | Combo x3 in a round: perfect / good / average |
|---|---|---|---|---|
| today | Beginner | 7.2 | 20% / 3% | 60% / 43% / 21% |
| today | Medium | 9.7 | 90% / 43% | 95% / 86% / 59% |
| today | Hard | 13.2 | 100% / 98% | 100% / 100% / 94% |
| 50% | Beginner | 11.3 | 99% / 81% | 98% / 94% / 78% |
| 40% | Medium | 12.1 | 99% / 88% | 99% / 96% / 82% |

On Beginner today, 25 daubs in 3 rounds is hard (20% for a good player), and a perfect player reaches the x3 combo in only 60% of rounds. Bias fixes that, but it makes both quests close to automatic. If that matters for coin inflation, raise the `daub25` goal (for example to 40 on Beginner) in the same change.

## 6. Journey stages and Daily twists

- **The stored goals work on live rules today.** A good player gets 1★ 100% of the time, 2★ 86–100% and 3★ 44–96%. An average player gets 3★ 3–52% of the time (hardest: w3s3 Lamp Market, good 44% / average 3%; w3s8 Bazaar Boss, average 6%).
- **Biased calls reshuffle every stage board.** With the stored goals, a good player's 3★ rate changes completely:
  - At 40%: 15 of 24 stages are ≥97% and 6 become nearly impossible (<30%): w1s3, w2s3, w2s7, w2s8, w3s3, w3s8.
  - At 50%: 22 of 24 are ≥97% and 2 are <30%: w1s3, w3s3.
  - At 60%: 22 of 24 are ≥97% and none are <30%.

  The goals can be regenerated with the `gen_journey` formula on the new boards; then a good player gets 3★ 49–93% of the time. Alternatively, keep stages on today's call order (call-order version 1) and change nothing in Journey.
- **Daily Challenge still works under every option.** Its goals are recomputed from each day's board, so a good player gets 1★ 100% of the time under every option. 3★ (good player) is 83% on Beginner Normal today and 83–84% at 40–60% bias; 81% on Medium Normal today and 84% at 40%; 82% on Hard today and 78% at 40%.
  - Line Frenzy does almost nothing today on Beginner (0.04 lines per round) and Medium (0.16); it becomes meaningful on Beginner at 50% (0.36) and on Medium at 40% (0.56).
  - Steady Hands, Tight Window, Blitz, Combo Rush and Marathon behave as intended under every option.

## 7. Mastery ranks (rank = best score ever on the level)

Live tiers: Beginner 35/60/80/105, Medium 95/150/205/260, Hard 205/325/450/570 (Silver/Gold/Platinum/Legend).

- **The tiers are far too low.** A good player is Legend after one round 56–66% of the time, and after 20 rounds 100%. Platinum is reached by 81%, 86% and 90% of good rounds on Beginner, Medium and Hard. On Medium, 44% of all good rounds reach Platinum while losing to the ghost; that is QA's "Platinum after a lost round" (Beginner 69%, Hard 9%).
- **"Bronze at 0" is a display quirk.** Tier 0 starts at 0, so every player shows Bronze before playing a level. Show "Unranked" until the first scored round.
- **Board luck dominates the best-ever score** (p90 is about 1.5× the median). Ranking by the median share of perfect over the last 10 rounds would be fairer; that is a follow-up idea, not modelled here.

Proposed tiers:
- **Silver:** an average player's best of 5 rounds (median).
- **Gold:** a good player's best of 5.
- **Platinum:** a good player's best of 20.
- **Legend:** a good player's best of 100 (p90).

Expected holdings with these tiers: after 1 round, about 55% of good players are still Bronze. After 20 rounds, the most common rank is Platinum for good players and Silver for average players. Values for the recommended options are in the final table.

## 8. Speed bonus: +B × pt points for each correct tap within 1.5 s of the call

The bonus comes on top of base points and isn't multiplied by the combo. A good player makes about 98% of correct taps within 1.5 s; an average player about 73%.

Calls unchanged, live values:

| Level | Bonus | Good mean | Avg mean | Good ÷ avg | Ghost share | Good / avg ghost wins | Proposed Silver/Gold/Platinum/Legend |
|---|---|---|---|---|---|---|---|
| Beginner | none | 125 | 95 | 1.32× | 0.815 | 58% / 18% | 140/200/230/360 |
| Beginner | +3 | 147 | 108 | 1.36× | 0.822 | 58% / 14% | 160/230/265/395 |
| Beginner | +5 | 161 | 117 | 1.38× | 0.825 | 58% / 13% | 175/250/285/420 |
| Beginner | +10 | 197 | 139 | 1.42× | 0.832 | 58% / 9% | 210/300/340/480 |
| Medium | none | 301 | 220 | 1.37× | 0.850 | 48% / 9% | 330/420/510/705 |
| Medium | +5 (8 pts) | 378 | 267 | 1.42× | 0.860 | 48% / 5% | 395/510/615/825 |
| Medium | +10 (15 pts) | 446 | 307 | 1.45× | 0.867 | 48% / 3% | 435/585/705/945 |
| Hard | none | 659 | 480 | 1.37× | 0.885 | 40% / 5% | 680/900/1060/1440 |
| Hard | +5 (10 pts) | 791 | 559 | 1.41× | 0.890 | 40% / 2% | 770/1040/1220/1630 |
| Hard | +10 (20 pts) | 922 | 639 | 1.44× | 0.895 | 40% / 1% | 860/1200/1380/1820 |

- **The spread grows only a little.** Even +10, equal to the base points, moves good ÷ average from about 1.35× to about 1.44×. Missed numbers drive the gap far more than speed does.
- **The ghost shares move by +0.01–0.02.** The good player's win rate is held by re-solving the share, while the average player's falls: on Medium from 9% to 5% at +5.
- **Rank thresholds rise about 15–25% at +5.** Regenerate them in the same change.
- **A flat bonus within 1.5 s can't separate fast good players from slower good ones,** because nearly all their taps qualify. If speed is the selling point, use a graded bonus (for example +B within 1 s, +B/2 within 2 s). The script can model that next.

## Recommendation per level (live values)

| Level | Lines | Speed bonus | Ghost share (none / +5) | Good / avg ghost wins (none · +5) | Good: 1+ line per round | Avg: 1+ line | Mastery Silver/Gold/Platinum/Legend (none · +5) |
|---|---|---|---|---|---|---|---|
| Beginner | (a) calls 50% on the card | none / +5 | 0.822 / 0.832 | 59% / 14% · 61% / 9% | 29% | 15% | 280/370/460/640 · 330/440/525/730 |
| Medium | (a) calls 40% on the card | none / +5 | 0.847 / 0.855 | 51% / 9% · 50% / 5% | 39% | 19% | 480/645/810/1245 · 545/775/955/1415 |
| Hard | (b) calls unchanged | none / +5 | 0.885 / 0.890 | 40% / 5% · 40% / 2% | 48% | 25% | 680/900/1060/1440 · 770/1040/1220/1630 |

Thresholds carry about ±5% sampling noise; regenerate them from the final rules. At 50% Beginner gives a clean progression of lines: 29% of good rounds, then 39% on Medium and 48% on Hard. If you want lines to be common on Beginner, 60% gives 53%, at the cost of a good player beating today's ghost 91% of the time (irrelevant once the share-based ghost ships).

Also:
- **Quest:** change it to "Complete 1 line". Within 3 rounds a good player reaches it about 64% of the time on Beginner, 77% on Medium and 86% on Hard; an average player about 39%, 47% and 58%.
- **Badge:** lower it to "2 lines in one round" (a good player gets it in 6%, 13% and 16% of rounds).
- **Journey:** keep stages on call-order version 1, and nothing changes. If the bias is applied to stages too, regenerate every stage's goals.
- **Other quests:** if the bias ships, raise the `daub25` goal (see 5c) so those quest rewards don't inflate.
- **Speed bonus:** a flat +5 within 1.5 s is safe but mostly cosmetic. Prefer a graded bonus if speed should really pay.
- **Average-player win rates are low** on Medium (5–9%) and Hard (2–5%). That follows from the decided targets: average players will mostly win on Beginner.

## Caveats

- **The player models are assumptions.** Calibrate the miss rate, wrong-tap rate and reaction times against live rounds before shipping the shares.
- **Biased calls are a new call-order version.** Old rounds, duels and challenges must keep version 1.
- **Live values can change.** Beginner `every` has already changed once; rerun with a fresh `--config` before acting on the numbers.
