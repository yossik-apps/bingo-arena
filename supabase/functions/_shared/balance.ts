// Balance v2 (reports/balance-spec.md): which rounds play by version 2, and the validated per-level settings.
// Pure logic and one flag read, so it can be unit-tested (supabase/tests/balance.test.ts).
// The safe answer to any doubt is version 1: a missing flag row, a failed read, a missing or odd setting.
import type { Params } from "./engine.ts";

export const FLAG_KEY = "balance_v2";
export type FlagMode = "off" | "admins" | "all";
export type FlagState = { mode: FlagMode; updatedAt: string | null };
export const FLAG_OFF: FlagState = { mode: "off", updatedAt: null };

export const parseFlagMode = (m: unknown): FlagMode => (m === "admins" || m === "all" ? m : "off");

/** The balance_v2 flag. Any failure (no table, no row, no permission) reads as Off. */
// deno-lint-ignore no-explicit-any
export async function readFlag(db: any): Promise<FlagState> {
  try {
    const { data, error } = await db.from("feature_flags").select("mode,updated_at").eq("key", FLAG_KEY).maybeSingle();
    if (error || !data) return FLAG_OFF;
    return { mode: parseFlagMode(data.mode), updatedAt: typeof data.updated_at === "string" ? data.updated_at : null };
  } catch { return FLAG_OFF; }
}

/** The per-level version 2 settings: game_config.data.v2.<level> = { calls?, bonus, share, xpDiv }. */
export type V2Level = { calls?: number; bonus: number; share: number; xpDiv: number };
const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);

/** The level's version 2 settings, or null (the level then plays version 1). Values outside a sane range count as missing. */
export function v2Level(cfg: { v2?: unknown }, level: string): V2Level | null {
  const raw = (cfg?.v2 as Record<string, Record<string, unknown>> | undefined)?.[level];
  if (!raw || typeof raw !== "object") return null;
  const bonus = num(raw.bonus), share = num(raw.share), xpDiv = num(raw.xpDiv), calls = raw.calls === undefined ? undefined : num(raw.calls);
  if (bonus === null || bonus < 0 || bonus > 50) return null;
  if (share === null || share < 0.3 || share > 1.5) return null;
  if (xpDiv === null || xpDiv < 1 || xpDiv > 20) return null;
  if (calls === null || (calls !== undefined && (calls < 0.05 || calls > 1))) return null;
  return calls === undefined ? { bonus, share, xpDiv } : { calls, bonus, share, xpDiv };
}

/** The keys that only version 2 rounds carry. A level object never passes them on to a version 1 round. */
const V2_KEYS = ["cv", "calls", "bonus", "share", "xpDiv"] as const;
export function plainLevel<T extends Record<string, unknown>>(lv: T): T {
  const o: Record<string, unknown> = { ...lv };
  for (const k of V2_KEYS) delete o[k];
  return o as T;
}
/** The level's rules for a version 2 round: its plain rules plus the version 2 keys. */
export function v2Rules(lv: Params, x: V2Level): Params {
  return { ...plainLevel(lv as Record<string, unknown>) as Params, cv: 2, ...(x.calls !== undefined ? { calls: x.calls } : {}), bonus: x.bonus, xpDiv: x.xpDiv };
}

/**
 * A shared board (the Daily Challenge, a live event) is version 2 only if the flag was already All before the UTC day it
 * belongs to began. So a flag change takes effect at the next UTC midnight, and one board never mixes versions.
 * `day` is the board's UTC date, "YYYY-MM-DD".
 */
export function boardVersion(flag: FlagState, day: string): 1 | 2 {
  if (flag.mode !== "all" || !flag.updatedAt) return 1;
  const changed = Date.parse(flag.updatedAt), dayStart = Date.parse(day + "T00:00:00Z");
  return Number.isFinite(changed) && Number.isFinite(dayStart) && changed < dayStart ? 2 : 1;
}

/**
 * The version a new round plays by.
 *  - solo and ghost: Admins -> admins only, All -> everyone.
 *  - daily and tour: the version their board or event was created with (boardVersion), whatever the flag says now.
 *  - pvp: only when the flag is All (the match then freezes that version for both players).
 *  - stage, drill, duel: always version 1 (a duel replays the params its challenge stored).
 * `ready` is false when the level has no valid version 2 settings; everything is then version 1.
 */
export function roundVersion(a: { mode: string; flag: FlagMode; admin: boolean; ready: boolean; boardCv?: number | null }): 1 | 2 {
  if (!a.ready) return 1;
  switch (a.mode) {
    case "solo": case "ghost": return a.flag === "all" || (a.flag === "admins" && a.admin) ? 2 : 1;
    case "daily": case "tour": return a.boardCv === 2 ? 2 : 1;
    case "pvp": return a.flag === "all" ? 2 : 1;
    default: return 1;
  }
}
