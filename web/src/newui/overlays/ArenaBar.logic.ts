// The live-match bar's rules and words, copied from Classic (lib/ArenaBar.tsx). No supabase here, so tests can load it.
import type { Arena } from "../../lib/arena";

/** Classic's level names (lib/arena.ts LEVEL_NAME; a test checks they match). Copied, because lib/arena starts the supabase client. */
const LEVEL_NAME: Record<string, string> = { beginner: "Beginner", medium: "Medium", hard: "Hard" };
export const levelName = (l: string) => LEVEL_NAME[l] ?? l;

/** Hidden items are remembered for this browser tab under Classic's key, so hiding carries over between the two designs. */
export const SEEN_KEY = "ba_arena_dismissed";
export const SEEN_MAX = 50;
export const inviteKey = (id: string) => "i" + id;
export const waitKey = (w: { id: string; level: string }) => `w${w.id}${w.level}`;

export type Bar =
  | { kind: "invite"; id: string; from: string; level: string }
  | { kind: "wait"; id: string; name: string; level: string; online: number };

/** What the bar shows, as in Classic: nothing without arena data or when a live match cannot be played; an invite first; then someone waiting. */
export function barOf(arena: Arena | null, canPlay: boolean, seen: readonly string[]): Bar | null {
  if (!arena || !canPlay) return null;
  const inv = arena.invites.find((i) => !seen.includes(inviteKey(i.id)));
  if (inv) return { kind: "invite", id: inv.id, from: inv.from_name, level: inv.level };
  const w = arena.waiting.find((x) => !seen.includes(waitKey(x)));
  if (w) return { kind: "wait", id: w.id, name: w.name, level: w.level, online: arena.online };
  return null;
}

export const title = (b: Bar) => b.kind === "invite" ? `${b.from} invites you to a live match` : `${b.name} is waiting for a live match`;
/** "N online" only when more than one player is online, as in Classic. */
export const onlineNote = (b: Bar) => b.kind === "wait" && b.online > 1 ? `${b.online} online` : null;
/** The level answer_invite returns, or the invite's own level. */
export const playLevel = (r: { level?: string | null } | null | undefined, level: string) => r?.level ?? level;
