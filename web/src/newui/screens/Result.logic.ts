// The Result screen's conditions and words, copied from Classic Result.tsx (views/Result.tsx) and App.tsx. No React, so they can be tested.
// Everything shown comes from the server's answer to submit-round: nothing here decides a score, prize, XP or reward.
import { SKILL_INFO, type Dna } from "../../lib/dna";
import type { MatchResult } from "../../lib/screenData";
import type { DailyResult, DuelResult, StageResult } from "../../lib/supabase";
import type { RoundResult, RoundStart } from "../../views/Play";

type Params = RoundStart["params"];
export type Milestone = { head: string; share: string };

export const MATCH_TITLE: Record<string, string> = {
  win: "You beat your opponent!", lose: "Your opponent wins this round", tie: "Tie! Entry refunded", forfeit_win: "Opponent left. You win!",
  forfeit_loss: "You left the match", cancelled: "Match cancelled. Entry refunded",
};
/** Classic polls a live match's result every 2 seconds, up to 80 times. */
export const MATCH_POLL_MS = 2000;
export const MATCH_POLL_TRIES = 80;

export const stageOf = (r: RoundResult): StageResult | null => (r.mode === "stage" ? r.stage ?? null : null);
export const dailyOf = (r: RoundResult): DailyResult | null => (r.mode === "daily" ? r.daily ?? null : null);
export const duelOf = (r: RoundResult): DuelResult | null => (r.mode === "duel" ? r.duel ?? null : null);

/** Coach Nova's tips, word for word as in Classic. */
export function coachTips(r: RoundResult, p: Params, dna: Dna | null): string[] {
  // numbers that were on the card and left the board untapped: the server's count (Awareness). Older results only have late taps.
  const missed = Math.max(0, r.missed ?? r.late);
  // nothing tapped, or nothing scored: no praise (BA-07)
  const idle = r.daubs <= 0 || r.score <= 0;
  const tips: string[] = [];
  tips.push(idle ? "You did not tap any matching numbers. Watch the 'On the board' strip and tap the numbers on your card as they are called."
    : missed >= 3 ? `You let ${missed} matching numbers slip off the board. Scan your card every time a new ball drops, starting with the column letter.` : "Good attention: very few numbers slipped away.");
  tips.push(idle ? "Tap a matching number to start your combo." : r.wrong + r.late >= 3 ? `${r.wrong + r.late} wrong taps reset your combo. Check the letter and number before tapping.` : "Few wrong taps, so your combo stayed healthy.");
  if (r.avgReactionMs !== null) tips.push(r.avgReactionMs > p.every * 1.4 ? `Average reaction ${(r.avgReactionMs / 1000).toFixed(1)}s is slow for this level. Aim to daub before the next ball lands.` : `Average reaction ${(r.avgReactionMs / 1000).toFixed(1)}s fits this level well.`);
  if (dna?.weakest) tips.push(`Your Bingo DNA says ${SKILL_INFO[dna.weakest].name} is your weakest skill. ${SKILL_INFO[dna.weakest].tip}`);
  return tips;
}

/** The coach's initial for the avatar: "Coach Nova" gives N. */
export const coachInitial = (coach: string) => coach.replace(/^coach\s+/i, "").slice(0, 1).toUpperCase() || "N";

/** Practice and Beat the Ghost without boosters get a challenge link; everything else shares the site. */
export const canChallenge = (r: RoundResult, p: Params) => (r.mode === "solo" || r.mode === "ghost") && !(p.boosters && p.boosters.length) && !!r.roundId;

/** Big moments get their own card and a ready-made share message, in Classic's order. */
export function milestoneOf(r: RoundResult, m: MatchResult | null, achNames: string[]): Milestone | null {
  const sr = stageOf(r), dr = dailyOf(r), du = duelOf(r);
  const won = du?.win || m?.result === "win" || m?.result === "forfeit_win";
  return r.mode === "solo" && r.win ? { head: `New personal best: ${r.score} points`, share: `New personal best in Bingo Arena: ${r.score} points!` }
    : sr && sr.stars === 3 ? { head: `3 stars on ${sr.stage_name}`, share: `I got all 3 stars on ${sr.stage_name} in Bingo Arena!` }
    : dr && dr.tier === 3 ? { head: "Daily gold", share: "I got gold in today's Bingo Arena Daily Challenge!" }
    : won ? { head: `You beat ${du ? du.creator : m?.opponent ?? "a real player"}`, share: `I just beat a real player in Bingo Arena with ${r.score} points!` }
    : achNames.length ? { head: `New badge: ${achNames[0]}`, share: `I unlocked the "${achNames[0]}" badge in Bingo Arena!` }
    : null;
}

export function shareText(r: RoundResult, p: Params, milestone: Milestone | null): string {
  const sr = stageOf(r), dr = dailyOf(r);
  return milestone ? milestone.share : r.mode === "stage" ? `I got ${sr?.stars ?? 0} star${sr?.stars === 1 ? "" : "s"} on ${sr?.stage_name ?? "a stage"} in Bingo Arena!`
    : r.mode === "daily" ? `I finished today's Daily Challenge in Bingo Arena${dr ? ` (rank #${dr.rank})` : ""}!`
    : canChallenge(r, p) ? `I scored ${r.score} points in Bingo Arena. Can you beat me?` : `I scored ${r.score} points in Bingo Arena!`;
}

export const shareTitle = (r: RoundResult, p: Params, milestone: Milestone | null) => (milestone ? "Share this milestone" : canChallenge(r, p) ? "Challenge a friend" : "Share your result");

/** The heading, for every kind of round. */
export function titleOf(r: RoundResult, p: Params, m: MatchResult | null): string {
  const sr = stageOf(r), dr = dailyOf(r), du = duelOf(r);
  return r.mode === "drill" ? `Drill done: ${p.label ?? "training"}`
    : r.mode === "daily" ? (dr ? ["Daily Challenge done", "Daily bronze", "Daily silver", "Daily gold"][dr.tier] ?? "Daily Challenge done" : "Daily Challenge")
    : r.mode === "duel" ? (du ? (du.win ? "You beat " + du.creator + "!" : du.tie ? "A tie with " + du.creator : du.creator + " keeps the crown") : "Challenge")
    : r.mode === "stage" ? (sr && sr.stars > 0 ? `Stage cleared! ${sr.stars} star${sr.stars > 1 ? "s" : ""}` : "Not quite. Try again")
    : r.mode === "pvp" ? (m?.status === "settled" ? MATCH_TITLE[m.result ?? ""] ?? "Match finished" : "Waiting for your opponent…")
    : r.mode === "tour" ? "Event score submitted"
    : r.ghost == null ? (r.win ? "New personal best!" : "Round complete") : r.win ? "You beat the ghost!" : "Ghost wins this round";
}

/** The tag under the score: Classic's "(ghost N)" or "(best N)", and the playground's NEW BEST for a personal best. */
export function scoreTag(r: RoundResult): { text: string; best: boolean } | null {
  if (r.mode === "solo" && r.win) return { text: "NEW BEST", best: true };
  if (r.ghost != null) return { text: `Ghost ${r.ghost}`, best: false };
  if (r.best != null) return { text: `Best ${r.best}`, best: false };
  return null;
}

/** Classic shows the coin prize only for Practice and Beat the Ghost. */
export const showsPrize = (mode?: string) => !(mode === "tour" || mode === "pvp" || mode === "stage" || mode === "daily" || mode === "duel" || mode === "drill");

export const boostText = (b: RoundResult["boost"]) =>
  b && (b.xp > 1 || b.coins > 1) ? `Event boost applied: ${[b.xp > 1 ? `${b.xp}x XP` : "", b.coins > 1 ? `${b.coins}x coin prizes` : ""].filter(Boolean).join(" and ")}.` : null;

export const badgeText = (names: string[]) => (names.length ? `New badge${names.length > 1 ? "s" : ""}: ${names.join(", ")}` : null);

/** Where "Back" goes and what it says, as in Classic (an event says "Back to lobby" but goes to Compete). */
export const backView = (mode?: string) => (mode === "tour" ? "compete" : mode === "stage" ? "journey" : "lobby") as "compete" | "journey" | "lobby";
export const backText = (mode?: string) => (mode === "stage" ? "Back to Journey" : "Back to lobby");

/** "What next?" is hidden after a stage or an event, as in Classic. */
export const showsNext = (mode?: string) => mode !== "stage" && mode !== "tour";

export const liveMatchLine = (m: MatchResult) =>
  m.status === "settled" ? `You ${m.my_score} · ${m.opponent ?? "Opponent"} ${m.opp_score ?? "–"}${m.prize ? ` · prize +${m.prize} coins` : ""}` : `${m.opponent ?? "Your opponent"} is still playing. Your score is locked in.`;

export const drillText = (d: NonNullable<RoundResult["drill"]> | null | undefined) => ({
  head: d?.first_today ? `+${d.coins} coins for your first drill today` : "Training counts toward your Bingo DNA.",
  sub: d?.first_today ? "Come back tomorrow for a new drill and more coins." : "Drill coins come once a day. Keep training whenever you like.",
});

/** App.tsx's level formula: level L starts at 40·(L-1)² XP. */
export const levelOf = (xp: number) => Math.floor(Math.sqrt(Math.max(0, xp) / 40)) + 1;
const xpAt = (level: number) => 40 * (level - 1) ** 2;

/**
 * The level bar, from the XP before the round and the XP the server gave for it. Display only.
 * `startPct` and `endPct` are progress within the level the player was on; a level-up fills the bar.
 */
export function levelBar(xpBefore: number, gained: number) {
  const before = levelOf(xpBefore), after = levelOf(xpBefore + gained);
  const lo = xpAt(before), hi = xpAt(before + 1);
  const pct = (x: number) => Math.max(0, Math.min(100, ((x - lo) / (hi - lo)) * 100));
  const up = after > before;
  return { before, after, up, startPct: pct(xpBefore), endPct: up ? 100 : pct(xpBefore + gained), toNext: Math.max(0, hi - (xpBefore + gained)) };
}

/** A round this good is worth saving (BA-38): the Save prompt comes after it, not only from the third round. */
export const GOOD_ROUND = 50;
/** The guest's save reminder after a round: from the third round as in App.tsx, or right after the first good round. */
export const showsSaveCard = (guest: boolean, played: number, score = 0) => guest && (played >= 3 || (played >= 1 && score >= GOOD_ROUND));
export function saveCardText(crazyGames: boolean, coins: number, level: number) {
  return {
    head: crazyGames ? "Keep your progress on every device" : "Don't lose your progress",
    text: `You have ${coins.toLocaleString()} coins and level ${level}. ${crazyGames ? "Log in to CrazyGames and they follow you everywhere." : "Save them with Google or email: it takes 10 seconds."}`,
  };
}

/** A visitor's free round: Classic GuestResult's words. `left` free rounds remain of 3. */
export function freeText(score: number, left: number, welcome: number) {
  const used = 3 - left;
  return {
    title: score > 0 ? `Nice! You scored ${score} points` : "Round over: 0 points. Try again!",
    used,
    dots: `Free round ${used} of 3`,
    left: left > 0 ? `${left} free round${left > 1 ? "s" : ""} left` : "Free rounds used",
    join: "Sign up free",
    again: `Play another free round (${left} left)`,
    gets: [
      ["🪙", `${welcome} welcome coins after your first round, plus daily gifts`],
      ["🏆", "Daily events, the weekly league and XP races with coin prizes"],
      ["🧬", "Your Bingo DNA and a personal coach"],
      ["🔥", "Your level, streak and stars saved on every device"],
    ] as [string, string][],
  };
}

/** Classic's TomorrowCard (views/LoginCalendar.tsx): only after today's reward is claimed. */
export function tomorrowText(cal: { claimed_today: boolean; day: number; next: number } | null) {
  if (!cal?.claimed_today) return null;
  return { head: `Tomorrow: +${cal.next} coins${cal.day === 6 ? " and a stamp pack" : ""}`, text: `Day ${(cal.day % 7) + 1} of your login calendar, plus a new Daily Challenge and new quests.`, gift: cal.day === 6 };
}
