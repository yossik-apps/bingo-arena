// Decides the seed, entry fee and frozen rules of a new round for every mode.
// Pure logic (no database), so it can be unit-tested: supabase/tests/rounds.test.ts
import { applyMods, ghostTarget, type Params, type StageMods } from "./engine.ts";

export type Cfg = { levels: Record<string, Params>; g: { total: number; pay: number } };
export type StageRow = { seed: number; mods: StageMods; s1: number; s2: number; s3: number };
export type DailyRow = { day: string; seed: number; mods: StageMods; g1: number; g2: number; g3: number };
export type DuelRow = { code: string; seed: number; params: Record<string, unknown> };

export function buildRound(a: {
  mode: string; level: string; cfg: Cfg; boosters: string[]; randomSeed: number;
  stage?: StageRow | null; daily?: DailyRow | null; duel?: DuelRow | null; eventFee?: number | null;
  feePct?: number; // live ops "cheaper entries" discount, applied to Beat the Ghost only
}): { seed: number; fee: number; params: Record<string, unknown> } {
  const lv = a.cfg.levels[a.level];
  if (a.mode === "duel" && a.duel) {
    // A challenge is replayed with exactly the rules and board the creator had.
    return { seed: Number(a.duel.seed), fee: 0, params: { ...a.duel.params, fee: 0, boosters: [], ghost: null } };
  }
  const base = { ...lv, total: a.cfg.g.total };
  let rules: Params & { total: number } = base;
  let seed = a.randomSeed;
  let fee = 0;
  const extra: Record<string, unknown> = {};

  if (a.mode === "stage" && a.stage) {
    seed = Number(a.stage.seed);
    rules = applyMods(base, a.stage.mods ?? {});
    extra.goals = [a.stage.s1, a.stage.s2, a.stage.s3];
    extra.label = a.stage.mods?.label ?? "";
  } else if (a.mode === "daily" && a.daily) {
    seed = Number(a.daily.seed);
    rules = applyMods(base, a.daily.mods ?? {});
    extra.goals = [a.daily.g1, a.daily.g2, a.daily.g3];
    extra.label = a.daily.mods?.label ?? "";
  } else if (a.mode === "tour") {
    fee = a.eventFee ?? 0;
  } else if (a.mode === "ghost") {
    fee = Math.max(0, Math.round((lv.fee * (100 - Math.min(90, Math.max(0, a.feePct ?? 0)))) / 100));
  }

  const boosters = a.mode === "solo" || a.mode === "ghost" ? a.boosters : [];
  const r = { ...rules };
  if (boosters.includes("slow")) r.every = Math.round(r.every * 1.3);
  if (boosters.includes("win")) r.win += 1;
  if (boosters.includes("time")) r.total += 15;
  if (boosters.includes("hint")) r.hint = true;

  return { seed, fee, params: { ...r, fee, pay: a.cfg.g.pay, boosters, ghost: a.mode === "ghost" ? ghostTarget(seed, lv) : null, ...extra } };
}
