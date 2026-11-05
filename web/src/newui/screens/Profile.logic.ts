// The Profile's rules, kept apart from its looks so they can be tested. The wording, conditions and numbers are the same as Classic's Profile.
// Change password, delete account and the spending limit go through ctx.account, which makes exactly Classic's calls.
import { MIN_ROUNDS, type Dna } from "../../lib/dna";
import { SCORE_BANDS } from "../../lib/pattern";
import type { MasteryRow } from "../../lib/supabase";
import type { IconName } from "../Icon";

export type ProfileTab = "stats" | "games" | "settings";
/** The tab Classic remembers in sessionStorage ("ba_ptab"). A visitor's demo has no Settings tab. */
export const firstTab = (saved: string | null, demo: boolean): ProfileTab => (saved === "settings" && !demo) || saved === "games" ? (saved as ProfileTab) : "stats";

/** The demo profile a visitor sees, with Classic's numbers. */
export const DEMO = { name: "Demo player", level: 6, xpText: "310 / 440 XP", xpPct: 70, xpLeft: 130, coins: 1250, streak: 9, shields: 1, dailyDone: 7 };
export const DEMO_NOTE = "This is a sample player, so you can see what you get. Sign up free to build your own Bingo DNA from your games.";
export const ASK_DNA = "Create your free account to get your own Bingo DNA";
export const ASK_DRILL = "Create your free account to train with daily drills";

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
export const xpLine = (xpText: string, xpLeft: number, level: number) => `${xpText} · ${xpLeft} to level ${level + 1}`;

// ---- Bingo DNA ----
export const dnaEmpty = (played: number) => {
  const n = Math.max(1, MIN_ROUNDS - played);
  return `Play ${n} more round${MIN_ROUNDS - played === 1 ? "" : "s"} to see your six skills: Speed, Accuracy, Awareness, Combo, Lines and Pressure.`;
};
export const dnaProgress = (played: number) => (Math.min(played, MIN_ROUNDS) / MIN_ROUNDS) * 100;
export const dnaSince = (dna: Dna | null) =>
  !dna ? "Six skills from your last rounds" : `From your last ${dna.rounds} rounds${dna.trend !== null ? ` · ${dna.trend >= 0 ? `up ${dna.trend}` : `down ${-dna.trend}`} since last week` : ""}`;
export const drillNote = (done: boolean) => (done ? "You did today's drill. You can train again; the coins come back tomorrow." : "Your first drill each day gives 20 coins.");
export const shareText = (style: string) => `My Bingo DNA says I'm a ${style} in Bingo Arena. What are you?`;
/** "80–100 · Name" style ranges for the explainer, as in Classic. */
export const bandRange = (i: number) => `${SCORE_BANDS[i].min}${i === 0 ? "–100" : `–${SCORE_BANDS[i - 1].min - 1}`}`;

// ---- last 10 games ----
export const gamesEmpty = (rounds: number, coach: string) => {
  const n = Math.max(1, 3 - rounds);
  return `Play ${n} more round${3 - rounds === 1 ? "" : "s"} and ${coach} will read the pattern of your games: how you do alone, against the ghost, against people, and what to work on.`;
};
export const ago = (iso: string, now = Date.now()) => {
  const m = Math.round((now - Date.parse(iso)) / 60000);
  if (m < 60) return `${Math.max(1, m)} min ago`;
  if (m < 24 * 60) return `${Math.round(m / 60)} h ago`;
  if (m < 48 * 60) return "Yesterday";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
};
export const RESULT_WORD: Record<string, string> = { win: "Won", loss: "Lost", best: "Best!" };
export const MODE_ICON: Record<string, IconName> = { solo: "user", ghost: "ghost", pvp: "users", tour: "trophy", stage: "map", daily: "star", duel: "users", drill: "bolt" };
export const coachInitial = (coach: string) => coach.replace(/^coach\s+/i, "").slice(0, 1).toUpperCase() || "N";

// ---- mastery and streaks ----
export const LEVEL: Record<string, string> = { beginner: "Beginner", medium: "Medium", hard: "Hard" };
/** The medal's metal colour (artwork, the same in light and dark), as in Classic. */
const RANK_COLOR: Record<string, string> = { bronze: "#d6965a", silver: "#cbd5e1", gold: "#fbbf24", platinum: "#7dd3fc", diamond: "#a78bfa", legend: "#f472b6" };
export const rankColor = (name: string) => RANK_COLOR[name.toLowerCase().split(" ")[0]] ?? "#8b84b8";
export const masteryPct = (m: MasteryRow) => (m.next_min ? Math.min(100, (m.best / m.next_min) * 100) : 100);
export const masteryScore = (m: MasteryRow) => (m.next_min ? `${m.best} / ${m.next_min}` : `Best ${m.best}`);
export const masteryNext = (m: MasteryRow) => (m.next_name ? `${m.next_name} next` : "Top rank");
export const MASTERY_EMPTY = "Play Practice or Beat the Ghost to earn your first rank.";

/** Daily Challenges still needed for the next Streak Shield (0 when both shields are held). */
export const toShield = (shields: number, dailyDone: number) => (shields >= 2 ? 0 : 5 - (dailyDone % 5));
export const shieldText = (shields: number, dailyDone: number) => {
  const n = toShield(shields, dailyDone);
  return n ? `${n} more Daily Challenge${n === 1 ? "" : "s"}` : "Shields full";
};
export const shieldPct = (shields: number, dailyDone: number) => (shields >= 2 ? 100 : ((dailyDone % 5) / 5) * 100);

// ---- settings ----
export const BREAK_OPTIONS = [{ value: "0", text: "Off" }, { value: "30", text: "Every 30 min" }, { value: "45", text: "Every 45 min" }, { value: "60", text: "Every 60 min" }];
export const LIMIT_OPTIONS = [{ value: "0", text: "No limit" }, { value: "30", text: "30 minutes" }, { value: "60", text: "1 hour" }, { value: "90", text: "1.5 hours" }, { value: "120", text: "2 hours" }];
export const SPEND_OPTIONS = [
  { value: "", text: "No limit" }, { value: "0", text: "No purchases" }, { value: "1000", text: "$10 a month" },
  { value: "2500", text: "$25 a month" }, { value: "5000", text: "$50 a month" }, { value: "10000", text: "$100 a month" },
];
/** What Classic sends to set_spend_limit: null for "No limit", otherwise the cents. */
export const spendCents = (v: string): number | null => (v === "" ? null : Number(v));
export const spendValue = (limitCents: number | null) => (limitCents === null ? "" : String(limitCents));
export const spentText = (monthCents: number) => `Spent this month: $${(monthCents / 100).toFixed(2)}`;
export const LIMIT_NOTE = "When you reach your daily limit, new rounds pause until tomorrow.";
/** An empty coach name goes back to Coach Nova when the box is left. */
export const coachAfterBlur = (name: string) => (name.trim() ? name : "Coach Nova");

// ---- account ----
export const saveLabel = (crazyGames: boolean) => (crazyGames ? "Log in with CrazyGames" : "Save your progress");
export const GUEST_TEXT = "Your progress is kept on this device only. Save it to keep your coins, level and stamps everywhere.";
/** A guest's placeholder address ends in .invalid: it is not shown, and such an account has no password to change. */
export const realEmail = (email: string) => !!email && !/\.invalid$/.test(email);
export const canChangePassword = (guest: boolean, email: string) => !guest && !(email && /\.invalid$/.test(email));
/** Classic's checks before auth.updateUser; null when the password may be sent. */
export function passwordProblem(pw: string, pw2: string) {
  if (pw.length < 8) return "The password must be at least 8 characters.";
  if (pw !== pw2) return "The two passwords do not match.";
  return null;
}
export const PASSWORD_CHANGED = "Your password was changed.";
export const logOutLabel = (guest: boolean) => (guest ? "Log out (lose guest progress)" : "Log out");
export const GUEST_LOGOUT = "You are playing as a guest. If you log out, this progress cannot be opened again. Log out anyway?";
export const DELETE_TEXT = "This permanently deletes your account, coins, items and progress. It cannot be undone. Type DELETE to confirm.";
/** The delete button works only when DELETE is typed exactly. */
export const canDelete = (confirm: string) => confirm === "DELETE";

// ---- the three account actions, through ctx.account (which makes Classic's calls; screen-data.test.ts checks those) ----
type Account = { setSpendLimit: (cents: number | null) => Promise<void>; changePassword: (pw: string) => Promise<void>; deleteAccount: (confirm: string) => Promise<void> };
/** The spending limit select: set_spend_limit with null for "No limit". Like Classic, a failure changes nothing on screen. */
export const setLimit = (account: Pick<Account, "setSpendLimit">, v: string) => account.setSpendLimit(spendCents(v)).catch(() => undefined);
/** Classic's checks, then auth.updateUser. Returns the message to show, and whether the password was changed. */
export async function submitPassword(account: Pick<Account, "changePassword">, pw: string, pw2: string): Promise<{ ok: boolean; msg: string }> {
  const problem = passwordProblem(pw, pw2);
  if (problem) return { ok: false, msg: problem };
  try { await account.changePassword(pw); return { ok: true, msg: PASSWORD_CHANGED }; }
  catch (e) { return { ok: false, msg: (e as Error).message }; }
}
/** delete-account with the typed confirmation (then sign-out, inside ctx.account). Returns the error to show, or "" on success. */
export async function removeAccount(account: Pick<Account, "deleteAccount">, confirm: string) {
  if (!canDelete(confirm)) return "";
  try { await account.deleteAccount(confirm); return ""; }
  catch (e) { return (e as Error).message; }
}
