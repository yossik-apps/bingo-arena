// The Journey's rules, kept apart from its looks so they can be tested. The wording and conditions are the same as Classic's Journey.
import type { JourneyData, StageProgress } from "../../lib/screenData";
import type { Stage, World } from "../../lib/supabase";

/** What journey.load() gives: Classic's three reads (worlds, stages, user_stages). Progress is {} for a visitor. */
export type { JourneyData, StageProgress };
export type Progress = JourneyData["progress"];

export const LEVEL: Record<string, string> = { beginner: "Beginner", medium: "Medium", hard: "Hard" };
export const REWARD_TEXT = "Each extra star: +10 coins. Your first 3 stars: another pack. Replays are free.";

export const starsOf = (p: Progress, id: string) => p[id]?.stars ?? 0;
export const totalStars = (p: Progress) => Object.values(p).reduce((a, x) => a + x.stars, 0);
export const worldOpen = (w: World, total: number) => total >= w.stars_needed;

/** Open when its world is open, and it is the first stage or the stage before has at least one star. */
export function stageOpen(st: Stage, w: World, stages: Stage[], p: Progress) {
  if (!worldOpen(w, totalStars(p))) return false;
  if (st.idx === 1) return true;
  const prev = stages.find((x) => x.world === st.world && x.idx === st.idx - 1);
  return !!prev && starsOf(p, prev.id) >= 1;
}

export const worldStages = (stages: Stage[], wid: number) => stages.filter((s) => s.world === wid);
export const worldStars = (stages: Stage[], wid: number, p: Progress) => worldStages(stages, wid).reduce((a, s) => a + starsOf(p, s.id), 0);

/** Where Classic opens: the last open world, on its first stage with no stars (or its first stage). */
export function startPoint(worlds: World[], stages: Stage[], p: Progress): { world: number; stage: string | null } | null {
  if (worlds.length === 0 || stages.length === 0) return null;
  const total = totalStars(p);
  const w = [...worlds].reverse().find((x) => worldOpen(x, total)) ?? worlds[0];
  const next = stages.filter((s) => s.world === w.id).find((s) => starsOf(p, s.id) === 0) ?? stages.find((s) => s.world === w.id);
  return { world: w.id, stage: next?.id ?? null };
}

export const worldLockText = (w: World, total: number) => {
  const n = w.stars_needed - total;
  return `Collect ${n} more star${n === 1 ? "" : "s"} in earlier worlds.`;
};

export const rulesText = (st: Stage) => `${LEVEL[st.level] ?? st.level} · ${st.mods?.label ? st.mods.label : "standard rules"}`;

/** The goals that are reached, from the best score, as in Classic. */
export const goalsGot = (st: Stage, pr: StageProgress | undefined) => [st.s1, st.s2, st.s3].map((g) => (pr?.best_score ?? 0) >= g);

export const playLabel = (open: boolean, stars: number) => (open ? (stars > 0 ? "Play again" : "Play stage") : "Locked");
export const lockedHint = (worldIsOpen: boolean) => (worldIsOpen ? "Clear the previous stage first." : "Collect more stars to open this world.");

export const stageLabel = (st: Stage, open: boolean, stars: number, next: boolean) =>
  `Stage ${st.idx}, ${st.name}${open ? `, ${stars} of 3 stars` : ", locked"}${next ? ", up next" : ""}`;
