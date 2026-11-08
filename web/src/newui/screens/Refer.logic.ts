// Invite friends: wording, prizes and conditions copied from Classic views/Refer.tsx (and the CrazyGames line from App.tsx).
// Pure functions, no React, so they can be tested. Every number comes from the server (my_referral); nothing is computed here but sums for display.
import type { Referral, ReferralFriend, ReferralRewards } from "../../lib/screenData";

export const WORDS = {
  title: "Invite friends",
  old: "Invites are coming soon.",
  paused: "Invites are paused right now. Your friends can still join and play.",
  crazyGames: "Invites are not available inside CrazyGames.",
  linkTitle: "Your invite link",
  copy: "Copy",
  copied: "Copied!",
  code: "Your code: ",
  shareTitle: "Send it to a friend",
  stepsTitle: "What you earn per friend",
  fine: "Only real new players count. Invites from your own device, browser or internet connection, and repeat accounts, are not counted. Big numbers from one connection are checked by hand.",
  friendsTitle: "Your friends",
  none: "Nobody yet. Share your link: friends who join show up here with their progress.",
  stepsReached: "Steps reached",
} as const;

/** Classic's prize text: "1,250 coins + 15 gems", or a dash for nothing. */
export const prize = (c: number, g: number) => [c > 0 ? `${c.toLocaleString()} coins` : "", g > 0 ? `${g} gems` : ""].filter(Boolean).join(" + ") || "—";

/** Classic's reasons a friend is not counted. "ok" has none; an unknown status shows nothing. */
export const STATUS: Record<string, string> = {
  ok: "", review: "Being checked: rewards start once we confirm it", blocked: "Not counted: same device, browser or network as you",
  rejected: "Not counted", capped: "Not counted: invite limit reached",
};
export const reason = (status: string) => STATUS[status] ?? "";

/** Classic's link, as lib/refer.ts refLink: the site's own address with ?r=CODE. */
export const inviteLink = (origin: string, code: string) => `${origin}/?r=${code}`;

export const shareText = (r: ReferralRewards) => `Play Bingo Arena with me! Free skill bingo, and you get ${r.friend_coins} bonus coins with my link:`;

export const heading = (r: ReferralRewards) =>
  `Earn up to ${prize(r.reg_coins + r.play_coins + r.ret_coins + r.week_coins, r.reg_gems + r.play_gems + r.ret_gems + r.week_gems)} for every friend`;

/** The intro in three parts, so the bonus can be bold as in Classic. */
export const intro = (r: ReferralRewards) => ({
  before: "Your friend gets ",
  bold: `${r.friend_coins} bonus coins`,
  after: ` after their first round. You earn more at every step they reach in their first ${r.window_days} days.`,
});

/** What you earn at each step, in Classic's order. */
export const steps = (r: ReferralRewards): { key: string; text: string; prize: string }[] => [
  { key: "save", text: "Saves their account", prize: prize(r.reg_coins, r.reg_gems) },
  { key: "play", text: `Plays ${r.play_rounds} rounds`, prize: prize(r.play_coins, r.play_gems) },
  { key: "back", text: "Comes back on another day", prize: prize(r.ret_coins, r.ret_gems) },
  { key: "week", text: `Plays on ${r.week_days} different days`, prize: prize(r.week_coins, r.week_gems) },
];

/** The five numbers, in Classic's order. */
export const kpis = (d: Pick<Referral, "stats" | "rewards">): { value: string; label: string }[] => [
  { value: String(d.stats.invited), label: "friends joined" },
  { value: String(d.stats.played), label: `played ${d.rewards.play_rounds}+ rounds` },
  { value: String(d.stats.week), label: "regular players" },
  { value: d.stats.coins.toLocaleString(), label: "coins earned" },
  { value: String(d.stats.gems), label: "gems earned" },
];

/** A friend's four steps, with Classic's short names. */
export const friendSteps = (f: ReferralFriend, r: ReferralRewards): { key: string; text: string; done: boolean }[] => [
  { key: "register", text: "Saved", done: f.register },
  { key: "play", text: `${r.play_rounds} rounds`, done: f.play },
  { key: "return", text: "Came back", done: f.return },
  { key: "week", text: `${r.week_days} days`, done: f.week },
];

/** Classic's line under a friend's name. */
export const joinedLine = (f: ReferralFriend, now: Date = new Date()) =>
  `joined ${new Date(f.joined).toLocaleDateString()}${f.status === "ok" && !f.week && new Date(f.ends) > now ? ` · rewards until ${new Date(f.ends).toLocaleDateString()}` : ""}`;

export const earned = (f: Pick<ReferralFriend, "coins" | "gems">) => (f.coins > 0 || f.gems > 0 ? `+${prize(f.coins, f.gems)}` : null);
