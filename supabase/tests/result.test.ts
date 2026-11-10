import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  backText, backView, badgeText, boostText, canChallenge, coachInitial, coachTips, freeText, levelBar, levelOf, liveMatchLine, milestoneOf, saveCardText,
  scoreTag, shareText, shareTitle, showsNext, showsPrize, showsSaveCard, titleOf, tomorrowText,
} from "../../web/src/newui/screens/Result.logic.ts";
import type { RoundResult, RoundStart } from "../../web/src/views/Play.tsx";

const p = { every: 4000, boosters: [] } as unknown as RoundStart["params"];
const r = (o: Partial<RoundResult> = {}): RoundResult => ({
  score: 200, daubs: 10, wrong: 0, late: 0, lines: 0, maxMult: 3, accuracy: 1, avgReactionMs: 999, win: false, prize: 7, xp: 44, ghost: null, best: 150,
  balance: 57, level: 2, achievements: [], mode: "solo", roundId: "r1", ...o,
});

test("the heading matches Classic for every kind of round", () => {
  assert.equal(titleOf(r({ win: true }), p, null), "New personal best!");
  assert.equal(titleOf(r(), p, null), "Round complete");
  assert.equal(titleOf(r({ mode: "ghost", ghost: 180, win: true }), p, null), "You beat the ghost!");
  assert.equal(titleOf(r({ mode: "ghost", ghost: 260 }), p, null), "Ghost wins this round");
  assert.equal(titleOf(r({ mode: "pvp" }), p, null), "Waiting for your opponent…");
  assert.equal(titleOf(r({ mode: "pvp" }), p, { status: "settled", result: "tie" }), "Tie! Entry refunded");
  assert.equal(titleOf(r({ mode: "pvp" }), p, { status: "settled", result: "odd" }), "Match finished");
  assert.equal(titleOf(r({ mode: "tour" }), p, null), "Event score submitted");
  assert.equal(titleOf(r({ mode: "drill" }), { ...p, label: "Fast Calls" }, null), "Drill done: Fast Calls");
  assert.equal(titleOf(r({ mode: "stage", stage: { stars: 2 } as never }), p, null), "Stage cleared! 2 stars");
  assert.equal(titleOf(r({ mode: "stage", stage: { stars: 0 } as never }), p, null), "Not quite. Try again");
  assert.equal(titleOf(r({ mode: "daily", daily: { tier: 3 } as never }), p, null), "Daily gold");
  assert.equal(titleOf(r({ mode: "duel", duel: { creator: "Sam", win: false, tie: true } as never }), p, null), "A tie with Sam");
});

test("milestones come in Classic's order, with its share words", () => {
  assert.deepEqual(milestoneOf(r({ win: true }), null, ["First win"]), { head: "New personal best: 200 points", share: "New personal best in Bingo Arena: 200 points!" });
  assert.equal(milestoneOf(r(), null, ["First win"])?.head, "New badge: First win");
  assert.equal(milestoneOf(r({ mode: "pvp" }), { status: "settled", result: "forfeit_win", opponent: "Kim" }, [])?.head, "You beat Kim");
  assert.equal(milestoneOf(r(), null, []), null);
});

test("a challenge link only for Practice and the Ghost without boosters", () => {
  assert.equal(canChallenge(r(), p), true);
  assert.equal(canChallenge(r({ mode: "ghost" }), p), true);
  assert.equal(canChallenge(r(), { ...p, boosters: ["hint"] }), false);
  assert.equal(canChallenge(r({ mode: "stage" }), p), false);
  assert.equal(canChallenge(r({ roundId: undefined }), p), false);
  assert.equal(shareTitle(r(), p, null), "Challenge a friend");
  assert.equal(shareText(r(), p, null), "I scored 200 points in Bingo Arena. Can you beat me?");
  assert.equal(shareTitle(r({ mode: "tour" }), p, null), "Share your result");
  assert.equal(shareText(r({ mode: "tour" }), p, null), "I scored 200 points in Bingo Arena!");
});

test("Coach Nova says what Classic says", () => {
  assert.deepEqual(coachTips(r(), p, null), ["Good attention: very few numbers slipped away.", "Few wrong taps, so your combo stayed healthy.", "Average reaction 1.0s fits this level well."]);
  const t = coachTips(r({ late: 3, wrong: 1, avgReactionMs: 6000 }), p, null);
  assert.match(t[0], /^You let 3 matching numbers/);
  assert.match(t[1], /^4 wrong taps reset your combo/);
  assert.match(t[2], /is slow for this level/);
  assert.equal(coachInitial("Coach Nova"), "N");
  assert.equal(coachInitial("Ziggy"), "Z");
});

test("prize, back button and What next follow Classic per mode", () => {
  for (const m of ["tour", "pvp", "stage", "daily", "duel", "drill"]) assert.equal(showsPrize(m), false, m);
  assert.equal(showsPrize("solo"), true);
  assert.equal(showsPrize("ghost"), true);
  assert.equal(backView("tour"), "compete");
  assert.equal(backText("tour"), "Back to lobby");
  assert.equal(backView("stage"), "journey");
  assert.equal(backText("stage"), "Back to Journey");
  assert.equal(showsNext("stage"), false);
  assert.equal(showsNext("tour"), false);
  assert.equal(showsNext("solo"), true);
});

test("score tag, boost, badges and the live match line", () => {
  assert.deepEqual(scoreTag(r({ win: true })), { text: "NEW BEST", best: true });
  assert.deepEqual(scoreTag(r({ mode: "ghost", ghost: 180 })), { text: "Ghost 180", best: false });
  assert.deepEqual(scoreTag(r()), { text: "Best 150", best: false });
  assert.equal(scoreTag(r({ best: null })), null);
  assert.equal(boostText({ xp: 2, coins: 1 }), "Event boost applied: 2x XP.");
  assert.equal(boostText({ xp: 1, coins: 1 }), null);
  assert.equal(badgeText(["First win", "Perfect round"]), "New badges: First win, Perfect round");
  assert.equal(liveMatchLine({ status: "settled", my_score: 612, opp_score: null, opponent: "Kim", prize: 36 }), "You 612 · Kim – · prize +36 coins");
  assert.equal(liveMatchLine({ status: "waiting" }), "Your opponent is still playing. Your score is locked in.");
});

test("the level bar uses App's level formula and only the server's XP", () => {
  assert.equal(levelOf(0), 1);
  assert.equal(levelOf(40), 2);
  assert.equal(levelOf(159), 2);
  assert.equal(levelOf(160), 3);
  const up = levelBar(0, 44);
  assert.equal(up.before, 1);
  assert.equal(up.after, 2);
  assert.equal(up.up, true);
  assert.equal(up.endPct, 100);
  const same = levelBar(50, 30);
  assert.equal(same.up, false);
  assert.equal(Math.round(same.startPct), 8);
  assert.equal(Math.round(same.endPct), 33);
  assert.equal(same.toNext, 80);
});

test("the save card and tomorrow's card use App's words and conditions", () => {
  assert.equal(showsSaveCard(true, 2), false);
  assert.equal(showsSaveCard(true, 3), true);
  assert.equal(showsSaveCard(false, 30), false);
  assert.equal(saveCardText(false, 1250, 4).text, "You have 1,250 coins and level 4. Save them with Google or email: it takes 10 seconds.");
  assert.equal(tomorrowText({ claimed_today: false, day: 3, next: 50 }), null);
  assert.equal(tomorrowText({ claimed_today: true, day: 6, next: 200 })?.head, "Tomorrow: +200 coins and a stamp pack");
  assert.equal(tomorrowText({ claimed_today: true, day: 3, next: 50 })?.text, "Day 4 of your login calendar, plus a new Daily Challenge and new quests.");
});

test("the screen uses ctx only, and the same calls as Classic", () => {
  const src = readFileSync(new URL("../../web/src/newui/screens/Result.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(src, /from ["'][^"']*lib\/supabase["']/, "no supabase import");
  assert.doesNotMatch(src, /callFn/);
  assert.match(src, /ctx\.match\.result\(/, "live match result through ctx");
  assert.match(src, /ctx\.match\.challenge\(/, "challenge link through ctx");
  assert.match(src, /afterRound\(/, "the between-rounds ad");
  assert.match(src, /rewardAd\("result"\)/, "the result reward ad");
});

test("a visitor's free round uses Classic GuestResult's words", () => {
  const t = freeText(120, 2, 50);
  assert.equal(t.title, "Nice! You scored 120 points");
  assert.equal(t.dots, "Free round 1 of 3");
  assert.equal(t.left, "2 free rounds left");
  assert.equal(t.join, "Sign up free");
  assert.equal(t.again, "Play another free round (2 left)");
  assert.equal(t.gets[0][1], "50 welcome coins after your first round, plus daily gifts");
  const last = freeText(0, 0, 50);
  assert.equal(last.title, "Round over: 0 points. Try again!");
  assert.equal(last.left, "Free rounds used");
  assert.equal(freeText(5, 1, 50).left, "1 free round left");
});

test("the screen shows the level bar only from xpBefore, and the visitor's choices from ctx", () => {
  const src = readFileSync(new URL("../../web/src/newui/screens/Result.tsx", import.meta.url), "utf8");
  assert.match(src, /xpBefore \? levelBar\(xpBefore\.xp, r\.xp\)/);
  assert.match(src, /level \{r\.level\}/, "Classic's line when xpBefore is null");
  assert.match(src, /ctx\.visitor\?\.freeResult/);
});
