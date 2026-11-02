// The Lobby's rules, kept apart from its looks so they can be tested. The wording and conditions are the same as Classic's Lobby.
import type { GameCfg } from "../../lib/supabase";

export type LobbyMode = "solo" | "ghost" | "pvp";
export const LEVEL_NAME: Record<string, string> = { beginner: "Beginner", medium: "Medium", hard: "Hard" };
export const LEVEL_FEEL: Record<string, string> = { beginner: "Relaxed", medium: "Balanced", hard: "Fast" };
export const BOOSTERS: [string, string][] = [["slow", "Slow motion"], ["win", "Extra window"], ["time", "Extra time"], ["hint", "Hint glow"]];
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
    : visitor ? `Free account needed to play. You get ${cfg.g.welcome} free coins when you sign up.`
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
