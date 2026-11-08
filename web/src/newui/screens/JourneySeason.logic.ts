// The Season track tab of the Journey: Classic's conditions and words (views/Season.tsx, views/JourneyHub.tsx), as pure functions.
import type { SeasonInfo, SeasonTier, ShopItem } from "../../lib/supabase";
import { rewardText } from "../../lib/reward";
import { timeLeft, when } from "../../lib/time";

/** Classic shows 30 tiers. */
export const TOP_TIER = 30;
/** Classic's tier size when the season does not give one. */
export const DEFAULT_XP_PER_TIER = 200;

export type Track = "free" | "premium";

export const MSG = { passBought: "Season pass unlocked!", claimed: "Reward claimed!" };
export const NO_SEASON = "No season right now";
export const PASS_TITLE = "Season pass";
export const PASS_TEXT = "Adds a second reward on every tier, including exclusive looks you cannot get anywhere else. Bought with coins, never with real money.";
export const HAS_PASS = "You have the season pass. Both tracks are open.";
export const TIP_LABEL = "season XP";
export const TIP_TEXT = "Season XP is the XP you earn from your rounds while the season runs. Every 200 XP (or the amount shown by your season) opens the next tier. You can claim a tier's reward at any time before the season ends, plus 3 days.";

/** What a visitor sees instead of the track (Classic's GuestTeaser in JourneyHub). */
export const TEASER = {
  title: "Climb the season track",
  intro: "Every round you play earns season XP. Each of the 30 tiers unlocks a reward, including looks you cannot get anywhere else.",
  points: [
    ["30 tiers of rewards", "Coins, stamp packs, boosters and exclusive looks."],
    ["Free track for everyone", "An optional season pass, bought with coins, adds a second reward on every tier."],
    ["New season every 6 weeks", "Fresh rewards and a new theme each time."],
  ] as [string, string][],
  button: "Play free to unlock",
  hint: "Already have an account? The same button lets you log in.",
};

export const noSeasonText = (s: SeasonInfo) =>
  s.next ? `The next season, ${s.next.name}, starts ${when(s.next.starts_at)}.` : "The next season will be announced soon.";

export const eyebrow = (s: SeasonInfo, now = Date.now()) => `Season track · ${s.over ? "ended, claim your rewards" : timeLeft(s.ends_at!, now)}`;

/** Where the player is on the track. */
export function progress(s: SeasonInfo) {
  const per = s.xp_per_tier ?? DEFAULT_XP_PER_TIER, tier = s.tier ?? 0, into = (s.xp ?? 0) - tier * per;
  const top = tier >= TOP_TIER;
  const pct = top ? 100 : Math.round((into / per) * 100);
  const text = top ? "You reached the top tier!" : `${per - into} XP to tier ${tier + 1}. You earn season XP from every round you play.`;
  return { per, tier, into, pct, top, text };
}

/** The pass card shows while there is no pass and the season still runs. */
export const showPassCard = (s: SeasonInfo) => !s.pass && !s.over;
export const passPrice = (s: SeasonInfo) => s.pass_price ?? 0;
export const canBuyPass = (s: SeasonInfo, coins: number) => coins >= passPrice(s);
export const shortHint = (s: SeasonInfo) => `You need ${s.pass_price} coins. Keep playing to earn them.`;

/** One tier's button on one track, as Classic draws it. */
export function tierButton(t: SeasonTier, track: Track, tier: number, pass: boolean, items: ShopItem[]) {
  const reached = t.tier <= tier;
  const claimed = track === "free" ? t.free_claimed : t.premium_claimed;
  const locked = track === "premium" && !pass;
  const reward = rewardText(track === "free" ? t.free : t.premium, items);
  const disabled = claimed || !reached || locked;
  // a reward that can be claimed now reads as an action, as in the playground's gold "Claim" button
  const text = claimed ? "Claimed" : disabled ? reward : `Claim · ${reward}`;
  const why = claimed ? "claimed" : locked ? "needs the pass" : "not reached yet";
  const which = `${track === "free" ? "free" : "pass"} reward`;
  const label = disabled ? `Tier ${t.tier} ${which}: ${reward}, ${why}` : `Claim tier ${t.tier} ${which}: ${reward}`;
  return { reached, claimed, locked, disabled, text, label };
}

/** Classic's name for a tier's number. */
export const tierName = (t: SeasonTier, tier: number) => `Tier ${t.tier}${t.tier <= tier ? ", reached" : ""}`;
