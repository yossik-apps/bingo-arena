# WP4 balance simulation: ghost, lines, speed and ranks

Research only. No game code, data or live settings were changed. Tool: `tools/sim-balance.mjs` (runs the real engine: `makeBoard`, `botTaps`, `scoreTaps`, `ghostTarget`, `applyMods`). Full tables: run it and open `tools/sim-out/<dir>/report.md` (git-ignored).

```bash
node tools/sim-balance.mjs --config live-config.json --seeds 10000 --speed 3,5,10 --variants now,b40,b50,b60 --out tools/sim-out/live
```

## Inputs

- **Level values: live**, read on 10 Nov 2026 with a read-only anon select of `game_config` (no writes). They match `001_schema.sql` except **Beginner `every` = 5000** (21 calls per 100 s round instead of 26).

  | Level | every | win | pt | pen | gl | gr |
  |---|---|---|---|---|---|---|
  | Beginner | 5000 | 4 | 1 | 5 | 150 | 100 |
  | Medium | 3000 | 3 | 1.5 | 8 | 250 | 130 |
  | Hard | 2200 | 2 | 2 | 15 | 380 | 200 |

- **Line quest: live**, `line3` = "Complete 3 lines" (daily counter, goal 3). Badge `lines3` = "3 lines in one round".
- **Mastery tiers and Journey stages: from the migrations** (`006_phase6.sql`, `005_phase5.sql`). Anon can't read either table, and the live tier values weren't included in the brief. If they differ, pass them with `--tiers` and `--stages`.
- **Players:**
  - *Perfect:* `botTaps` at 700 ms (the reference used for star goals).
  - *Good:* 900 ms ±25% reaction, 10% of card numbers missed.
  - *Average:* 1,300 ms ±25% reaction, 25% missed.
- **Sensitivity run (wrong taps):** good players mis-tap on 5% of taps, average players on 10%.
- **Seeds and rules:** 10,000 random seeds per level. A ghost win is score > target (as in `submit-round`).

## 1–3. Today (live values)

| Level | Calls | Card numbers called | Perfect mean (p10–p90) | Good | Average | Ghost (mean) | Perfect / good / avg beat it | Good: lines/round, 1+, 3+ | Avg: 1+ |
|---|---|---|---|---|---|---|---|---|---|
| Beginner | 21 | 6.4 of 24 | 104 (50–170) | 89 | 68 | 199 | **5%** / 3% / 1% | 0.02, 2%, 0% | 1% |
| Medium | 34 | 10.9 | 361 (210–510) | 301 | 220 | 315 | 62% / 42% / 17% | 0.17, 15%, 0% | 7% |
| Hard | 46 | 14.7 | 801 (560–1080) | 659 | 480 | 480 | 96% / **82%** / 47% | 0.70, 48%, 4% | 25% |

On live Beginner, even a perfect round beats the ghost only 5% of the time, worse than QA's estimate because of `every` = 5000. Hard has the opposite problem: it is too easy.

## 4. Ghost fix: target = share × that board's perfect score

Calls unchanged, no speed bonus:

| Level | Share | Good wins | Average wins | Good win chance per board, p10–p90 | Boards where good wins <25% |
|---|---|---|---|---|---|
| Beginner | 0.815 | 57% | 20% | 44–74% | 0% |
| Medium | 0.850 | 48% | 9% | 29–68% | 5% |
| Hard | 0.885 | 40% | 5% | 25–58% | 13% |

- **Base the target on the level's normal rules.** Compute it from `lv`, as `ghostTarget` does today, not from the boosted rules. Otherwise the Extra time and Slow boosters would raise the target too.
- **Wrong taps hurt more than expected.** At the same shares, a good player who mis-taps on 5% of taps wins 47%, 31% and 21%, because a wrong tap resets the combo. The shares assume clean play, so calibrate them against live rounds (score ÷ that board's perfect) once there is data.
- **Allowing scores below zero has almost no effect.** Under the wrong-tap model above, no average round goes below zero and ghost win rates don't change. The rule only matters for players who tap at random.
- **Board variety is moderate.** No board is unwinnable. On Hard, about 1 board in 8 gives a good player under 25%.

## 5. Line options

### (a) Biased calls: each call is a card number with probability q

The card stays the same. Today q ≈ 32%.

| Option | Level | Perfect mean | Good mean | Good: lines/round, 1+, 2+, 3+ | Average: 1+ | Today's ghost: good wins | Ghost share (good at 60/50/40%) | Average wins at that share |
|---|---|---|---|---|---|---|---|---|
| 40% | Beginner | 148 | 126 | 0.05, 4%, 0%, 0% | 2% | 13% | 0.815 | 19% |
| 50% | Beginner | 211 | 178 | 0.13, 12%, 1%, 0% | 6% | 36% | 0.815 | 18% |
| **60%** | **Beginner** | 284 | 239 | 0.28, **24%**, 4%, 1% | 12% | 65% | 0.822 | 14% |
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
| Beginner | good | 0% | ~6% | 0% | 0% |
| Medium | good | 1% | 41% | 0.1% | 1% |
| Hard | good | 36% | 86% | 4% | 16% |
| Hard | average | 7% | 57% | 0.5% | 4% |

With option (b) alone, Beginner and Medium still have practically no lines.

## 6. Journey stages and Daily twists

- **Already broken on live, before any change.** Journey goals were generated with Beginner `every` = 4000. With live 5000, the first stage, **w1s1 First Dock**, and **w1s4 Night Shift** have a perfect score of 110 against a 3★ goal of 160, so 3★ is impossible. 2★ (110) needs a perfect round, and a good player reaches it 48% of the time. w1s2 and w1s5 give a good player 3★ 44–48% of the time. The Beginner stage goals need regenerating now, whatever is decided for lines.
- **Biased calls reshuffle every stage board.** With the stored goals at 40%, 11 of 24 stages give a good player 3★ at least 97% of the time, and 6 become nearly impossible (w1s3, w2s3, w2s7, w2s8, w3s3, w3s8). Regenerated with the `gen_journey` formula on the new boards, a good player gets 3★ 49–93% of the time. Alternatively, keep stages on today's call order (call-order version 1) and regenerate only the Beginner goals.
- **Daily Challenge still works under every option.** Its goals are recomputed from each day's board, so a good player gets 1★ 100% of the time under every option. 3★ (good player) is 83% today, 82–84% at 40–60% bias on Beginner, 84% at 40% on Medium, and 82% today on Hard.
  - Line Frenzy does almost nothing today on Beginner (0.02 lines) and Medium (0.16); it becomes meaningful on Medium at 40% (0.56).
  - Steady Hands, Tight Window, Blitz, Combo Rush and Marathon behave as intended under every option.

## 7. Mastery ranks (rank = best score ever on the level)

Today's tiers from the migration: Beginner 35/60/80/105, Medium 95/150/205/260, Hard 205/325/450/570.

- **The tiers are far too low.** A good player is Legend after one round 56–66% of the time, and after 20 rounds 100%. On Medium, 86% of good rounds reach Platinum and 44% reach it while losing to the ghost; that is QA's "Platinum after a lost round".
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

| Level | Bonus | Good mean | Avg mean | Good − avg (good ÷ avg) | Ghost share | Good / avg ghost wins | Proposed Silver/Gold/Platinum/Legend |
|---|---|---|---|---|---|---|---|
| Beginner | none | 89 | 68 | 21 (1.31×) | 0.815 | 57% / 20% | 110/140/170/260 |
| Beginner | +3 | 106 | 79 | 28 (1.35×) | 0.822 | 57% / 18% | 125/165/195/310 |
| Beginner | +5 | 118 | 86 | 32 (1.38×) | 0.825 | 57% / 17% | 135/180/215/320 |
| Beginner | +10 | 146 | 103 | 43 (1.42×) | 0.832 | 57% / 12% | 160/220/260/380 |
| Medium | none | 301 | 220 | 81 (1.37×) | 0.850 | 48% / 9% | 330/420/510/705 |
| Medium | +5 (8 pts) | 378 | 267 | 111 (1.42×) | 0.860 | 48% / 5% | 395/510/615/825 |
| Medium | +10 (15 pts) | 446 | 307 | 138 (1.45×) | 0.867 | 48% / 3% | 435/585/705/945 |
| Hard | none | 659 | 480 | 179 (1.37×) | 0.885 | 40% / 5% | 680/900/1060/1440 |
| Hard | +5 (10 pts) | 791 | 559 | 231 (1.41×) | 0.890 | 40% / 2% | 770/1040/1220/1630 |
| Hard | +10 (20 pts) | 922 | 639 | 283 (1.44×) | 0.895 | 40% / 1% | 860/1200/1380/1820 |

- **The spread grows only a little.** Even +10, equal to the base points, moves good ÷ average from about 1.35× to about 1.44×. Missed numbers drive the gap far more than speed does.
- **The ghost shares move by +0.01–0.02.** The good player's win rate is held by re-solving the share, while the average player's falls: on Medium from 9% to 5% at +5.
- **Rank thresholds rise about 15–25% at +5.** Regenerate them in the same change.
- **A flat bonus within 1.5 s can't separate fast good players from slower good ones,** because nearly all their taps qualify. If speed is the selling point, use a graded bonus (for example +B within 1 s, +B/2 within 2 s). The script can model that next.

## Recommendation per level (live values)

| Level | Lines | Speed bonus | Ghost share | Good / avg ghost wins | Good: 1+ line per round | Avg: 1+ line | Mastery Silver/Gold/Platinum/Legend |
|---|---|---|---|---|---|---|---|
| Beginner | (a) calls 60% on the card | none / +5 | 0.822 / 0.835 | 59% / 14% · 59% / 10% | 24% | 12% | 260/340/400/540 · 305/405/475/630 |
| Medium | (a) calls 40% on the card | none / +5 | 0.847 / 0.855 | 51% / 9% · 50% / 5% | 39% | 19% | 480/645/810/1245 · 545/775/955/1415 |
| Hard | (b) calls unchanged | none / +5 | 0.885 / 0.890 | 40% / 5% · 40% / 2% | 48% | 25% | 680/900/1060/1440 · 770/1040/1220/1630 |

Pairs read as without / with the +5 speed bonus. Thresholds carry about ±5% sampling noise; regenerate them from the final rules.

Also:
- **Quest:** change it to "Complete 1 line". Within 3 rounds a good player reaches it about 56% of the time on Beginner, 77% on Medium and 86% on Hard; an average player about 32%, 47% and 58%.
- **Badge:** lower it to "2 lines in one round" (a good player gets it in 4%, 13% and 16% of rounds).
- **Journey:** regenerate the Beginner stage goals now (live `every` = 5000). Keep stages on call-order version 1, or regenerate all goals if the bias is applied to stages too.
- **Speed bonus:** a flat +5 within 1.5 s is safe but mostly cosmetic. Prefer a graded bonus if speed should really pay.
- **Average-player win rates are low** on Medium (5–9%) and Hard (2–5%). That follows from the decided targets: average players will mostly win on Beginner.

## Caveats

- **The player models are assumptions.** Calibrate the miss rate, wrong-tap rate and reaction times against live rounds before shipping the shares.
- **Mastery tiers and Journey stages come from the migrations,** not live. Rerun with `--tiers` and `--stages` if the live tables differ.
- **Biased calls are a new call-order version.** Old rounds, duels and challenges must keep version 1.
