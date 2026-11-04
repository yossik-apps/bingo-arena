// The Collect screen's rules, kept apart from its looks so they can be tested. The wording and conditions are the same as Classic's Quests.
import type { Mission, QuestsData } from "../../lib/screenData";

/** What quests.load() gives: Classic's four reads (todays_missions, daily_progress, ach_defs, user_achievements). */
export type { Mission, QuestsData };

export const QUESTS_NOTE = "Quests refresh every day.";

/** Progress is capped at the goal. Claim only when done and not yet claimed. */
export function questState(m: Mission, counters: Record<string, number>, claimed: string[]) {
  const have = Math.min(m.goal, counters[m.counter] ?? 0), done = have >= m.goal, isClaimed = claimed.includes(m.id);
  return { have, done, claimed: isClaimed, canClaim: done && !isClaimed, button: isClaimed ? "Claimed" : done ? "Claim" : "In progress", pct: m.goal > 0 ? (have / m.goal) * 100 : 0 };
}

/** The server decides the reward; this only words what it returned. */
export const claimMessage = (reward: number) => `Reward claimed: +${reward} coins and 15 XP.`;

export const TEASER = {
  title: "Collect and complete",
  intro: "Every round brings you closer to a reward.",
  points: [
    ["Stamp album", "27 stamps across three worlds. Finish a page for coins and an exclusive board."],
    ["Daily quests", "Three new goals every day, each with a coin reward."],
    ["Badges", "Unlock badges for your best moments."],
  ] as [string, string][],
  button: "Play free to unlock",
  hint: "Already have an account? The same button lets you log in.",
};
