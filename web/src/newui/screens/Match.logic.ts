// Matchmaking ("Finding your opponent"): Classic views/Matchmaking.tsx's timings, conditions and words. No React, so they can be tested.
// The server makes every match (find-match, my_match, cancel_queue); nothing here decides who plays whom.
import type { Arena } from "../../lib/arena";
import type { MatchState } from "../../lib/screenData";
import type { RoundStart } from "../../views/Play";

/** Classic asks the server every 1.5 s (which also says "still here"), reloads the online list every 10 s, and counts the wait every second. */
export const POLL_MS = 1500;
export const ONLINE_MS = 10_000;
/** From 20 s the ghost button shows; from 25 s the status line suggests inviting someone or playing the ghost. */
export const GHOST_AT = 20;
export const STILL_AT = 25;

export const SEARCHING = "Searching for an opponent…";
export const STILL = "Still searching. Invite someone who is online, or play against the ghost.";
export const TIMED_OUT = "The search timed out. Please try again.";
export const NOBODY = "Nobody else is online right now. Stay a little, or play against the ghost: you will still earn XP and coins.";

/** lib/arena.ts's LEVEL_NAME (that file also starts the database client, so it is not imported here) */
const LEVEL_NAME: Record<string, string> = { beginner: "Beginner", medium: "Medium", hard: "Hard" };
export const levelName =(level: string) => LEVEL_NAME[level] ?? level;
export const eyebrow = (level: string) => `Real-player match · ${levelName(level)}`;
export const showsGhost = (waited: number) => waited >= GHOST_AT;

/** "🟢 N players are online…", only when the arena says someone is. */
export const onlineText = (n: number | null | undefined) =>
  n != null && n > 0 ? `${n} ${n === 1 ? "player is" : "players are"} online. Everyone in the game now sees that you are waiting.` : null;

/** Players waiting at another level, whom this player can switch to. */
export const elsewhere = (arena: Arena | null, level: string) => (arena?.waiting ?? []).filter((w) => w.level !== level);

/** An invite's answer from the arena: "declined", "accepted", or nothing yet. */
export const sentStatus = (arena: Arena | null, name: string) => arena?.sent.find((s) => s.to === name)?.status;

/** What one my_match answer means, as in Classic's tick. */
export function stepOf(m: MatchState): { kind: "wait"; waited: number | null } | { kind: "timeout" } | { kind: "ready" } | { kind: "none" } {
  if (m.status === "queued") return { kind: "wait", waited: m.waited ?? 0 };
  if (m.status === "none") return { kind: "timeout" };
  if (m.status === "ready" && m.round_id) return { kind: "ready" };
  return { kind: "none" };
}

/** The round to start, timed to the server's clock so both players start together (Classic's onReady argument). */
export function readyRound(m: MatchState, clientNow: number): RoundStart {
  const offset = Date.parse(m.server_now!) - clientNow;
  return {
    roundId: m.round_id!, seed: Number(m.seed), balance: 0, params: m.params as RoundStart["params"],
    startAt: Date.parse(m.start_at!) - offset, matchId: m.match_id, opponent: m.opponent,
  };
}

/** The online player's line: "level N", and "in a round" while they play. */
export const playerSub = (p: { level: number; playing: boolean }) => `level ${p.level}${p.playing ? " · in a round" : ""}`;
