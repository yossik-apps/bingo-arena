// A round the player left open (WP5, QA BA-01, BA-11, BA-35): a refresh mid-round used to block new rounds for minutes.
// start-round now decides what to do with it. Pure logic, so it can be unit-tested (supabase/tests/open-round.test.ts).

/** "Past its end time plus a few seconds": after this the round is over and is closed as abandoned. */
export const GRACE_MS = 5000;
/** A round with less time than this left is not worth resuming; it is closed and a new one starts. */
export const RESUME_MIN_MS = 10000;
/** Rounds against nobody live. A live match (pvp) is never resumed or closed early: leaving it forfeits, as before. */
export const SOLO_MODES = ["solo", "ghost", "tour", "stage", "daily", "duel", "drill"];

export type OpenRow = { id: string; mode: string; level: string; seed: number | string; fee?: number; params: Record<string, unknown> & { total?: number }; started_at: string };
export type OpenDecision =
  | { action: "resume"; elapsedMs: number; leftMs: number }
  | { action: "close" }
  | { action: "wait"; waitS: number };

const endOf = (r: OpenRow) => Date.parse(r.started_at) + (Number(r.params?.total) > 0 ? Number(r.params.total) : 100) * 1000;

/**
 * - past its end plus GRACE_MS: close it (abandoned) and start the new round;
 * - a live match still running: wait (the start is refused, with the real number of seconds left);
 * - a solo-type round with at least RESUME_MIN_MS left: resume it;
 * - otherwise: close it (abandoned, the fee is not refunded) and start the new round.
 */
export function decideOpen(r: OpenRow, now: number): OpenDecision {
  const end = endOf(r);
  if (!Number.isFinite(end) || now > end + GRACE_MS) return { action: "close" };
  if (!SOLO_MODES.includes(r.mode)) return { action: "wait", waitS: Math.max(1, Math.ceil((end + GRACE_MS - now) / 1000)) };
  const left = end - now;
  if (left >= RESUME_MIN_MS) return { action: "resume", elapsedMs: Math.max(0, now - Date.parse(r.started_at)), leftMs: left };
  return { action: "close" };
}

/** What the client gets to resume a round: the same seed, the same params (cv included) and the time already played. */
export const resumeBody = (r: OpenRow, d: { elapsedMs: number; leftMs: number }, balance: number) => ({
  roundId: r.id, seed: Number(r.seed), params: r.params, balance, resumed: true, elapsedMs: d.elapsedMs, leftMs: d.leftMs,
  startedAt: r.started_at, mode: r.mode, level: r.level,
});

// deno-lint-ignore no-explicit-any
type Db = any;

/** The player's open round, if any (the newest one). */
export async function openRound(db: Db, user: string): Promise<OpenRow | null> {
  const { data } = await db.from("rounds").select("id,mode,level,seed,fee,params,started_at").eq("user_id", user).eq("status", "active")
    .order("started_at", { ascending: false }).limit(1).maybeSingle();
  return (data ?? null) as OpenRow | null;
}

/**
 * Closes a round the player left, as submit-round's abandon path does: no score, the entry fee is not refunded. A Daily
 * Challenge or event round keeps its tag, so it still counts as the day's try or one of the event's attempts.
 */
export async function abandonRound(db: Db, user: string, r: Pick<OpenRow, "id" | "level" | "mode" | "params" | "started_at">) {
  await db.from("rounds").update({ status: "rejected", finished_at: new Date().toISOString(), result: { reason: "abandoned" } })
    .eq("id", r.id).eq("status", "active");
  // Heatmaps (admin analytics, flag "heatmaps"): when in the round players give up. Never blocks the answer.
  const total = Number(r.params?.total) > 0 ? Number(r.params.total) : 100;
  const quitSlice = Math.max(0, Math.min(9, Math.floor(((Date.now() - new Date(r.started_at).getTime()) / (total * 1000)) * 10)));
  await db.rpc("hm_round", { p_user: user, p_level: r.level, p_mode: r.mode, p_cells: null, p_slices: null, p_quit_slice: quitSlice }).then(() => undefined, () => undefined);
}
