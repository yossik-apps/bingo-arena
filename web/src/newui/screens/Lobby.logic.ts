// The Lobby's rules, kept apart from its looks so they can be tested. The wording and conditions are the same as Classic's Lobby.
import type { GameCfg } from "../../lib/supabase";

export type LobbyMode = "solo" | "ghost" | "pvp";
export const LEVEL_NAME: Record<string, string> = { beginner: "Beginner", medium: "Medium", hard: "Hard" };
export const LEVEL_FEEL: Record<string, string> = { beginner: "Relaxed", medium: "Balanced", hard: "Fast" };
export const BOOSTERS: [string, string][] = [["slow", "Slow motion"], ["win", "Extra window"], ["time", "Extra time"], ["hint", "Hint glow"]];
/** The short name on each chip, so four fit on one row at 360 px. The full name is the screen-reader label. */
export const BOOSTER_SHORT: Record<string, string> = { slow: "Slow", win: "Window", time: "Time", hint: "Hint" };
export const MODE_TIP = "Practice is free. Beat the Ghost and Play a person cost a small entry fee in coins, and the winner earns more back. Coins are play money.";
export const LEVEL_TIP = "Higher levels move faster and keep fewer numbers on the board, but they pay more points and XP. If you are new, start with Beginner.";

/** New players start with the free option. A saved choice wins; anything unknown means Ghost, as in Classic. */
export const firstMode = (saved: string | null, isNew: boolean): LobbyMode => {
  const m = saved ?? (isNew ? "solo" : "ghost");
  return m === "solo" || m === "pvp" ? m : "ghost";
};

export type LobbyInput = { cfg: GameCfg; mode: LobbyMode; level: string; balance: number; banned: boolean; visitor: boolean; freeRounds: boolean };

export function lobbyStatus({ cfg, mode, level, balance, banned, visitor, freeRounds }: LobbyInput) {
  const fee = cfg.levels[level].fee;
  const paid = mode !== "solo";
  const win = Math.round(fee * cfg.g.pay);
  const pvpOff = mode === "pvp" && !cfg.g.pvp;
  const blocked = !visitor && (banned || cfg.g.maint || (paid && !cfg.g.paid) || (paid && balance < fee) || pvpOff);
  const hint = visitor && freeRounds && mode === "solo" ? "Play free Practice rounds now, no account needed."
    : visitor ? `Free account needed to play. Your ${cfg.g.welcome} free coins arrive after your first round.`
      : banned ? "Your account is suspended. Contact support."
        : cfg.g.maint ? "The game is under maintenance. Try again soon."
          : pvpOff ? "Live matches are switched off right now."
            : paid && balance < fee ? `You need ${fee} coins for this. Play Practice to earn more.`
              : mode === "ghost" ? `You pay ${fee} coins. Beat the ghost and you win ${win}.`
                : mode === "pvp" ? `You pay ${fee} coins. The winner gets ${win}.`
                  : "Free. Nothing to lose, so it is a good place to learn.";
  const cta = mode === "pvp" ? "Find an opponent" : mode === "solo" ? "Start practice" : "Play now";
  return { fee, paid, win, blocked, hint, cta };
}

/** What gets armed for a round: nothing in a live match, and only boosters the player still owns. */
export const boostersToUse = (mode: LobbyMode, armed: string[], owned: Record<string, number>) => (mode === "pvp" ? [] : armed.filter((k) => (owned[k] ?? 0) > 0));

export const ownedTotal = (owned: Record<string, number>) => BOOSTERS.reduce((n, [k]) => n + (owned[k] ?? 0), 0);

/** Daily Challenge stars earned, or null if it has not been finished. */
export const dailyTier = (played: { status: string; score: number } | null | undefined, goals: number[]) =>
  played?.status === "scored" ? (played.score >= goals[2] ? 3 : played.score >= goals[1] ? 2 : played.score >= goals[0] ? 1 : 0) : null;

/** The short note a guest sees until they save (BA-38). */
export const GUEST_NOTE = "Your progress is kept on this device until you save it.";

/** A board with nobody on it is not shown: a short line takes its place (BA-36). */
export const BE_FIRST_DAILY = "Be the first on today's board.";
export const hasBoard = (done: number) => done > 0;

/** A round still running on the server after a reload (WP5): what the lobby says about it. */
const OPEN_MODE: Record<string, string> = { solo: "Practice", ghost: "Beat the Ghost", daily: "Daily Challenge", stage: "Journey stage", tour: "Event", duel: "Friend's challenge", drill: "Drill" };
export const openRoundText = (o: { mode: string; level: string; leftMs: number }) => {
  const left = Math.max(1, Math.floor(o.leftMs / 1000));
  return {
    title: "Your round is still running",
    line: `${OPEN_MODE[o.mode] ?? "Round"} · ${LEVEL_NAME[o.level] ?? o.level} · about ${left} seconds left.`,
    // what "Start a new one" costs: the round is closed as abandoned, with no refund, and a one-try round stays used
    note: o.mode === "daily" ? "Starting a new one ends it, and it still counts as today's try."
      : o.mode === "tour" ? "Starting a new one ends it, and it still counts as one of your attempts."
      : o.mode === "ghost" ? "Starting a new one ends it. The entry fee is not refunded."
      : "Starting a new one ends it without a score.",
  };
};
