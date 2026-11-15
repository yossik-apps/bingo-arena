// Decides the seed, entry fee and frozen rules of a new round for every mode.
// Pure logic (no database), so it can be unit-tested: supabase/tests/rounds.test.ts
import { applyMods, ghostFromShare, ghostTarget, perfectScore, type Params, type StageMods } from "./engine.ts";
import { plainLevel, v2Level, v2Rules } from "./balance.ts";

export type Cfg = { levels: Record<string, Params>; g: { total: number; pay: number }; v2?: unknown };
export type StageRow = { seed: number; mods: StageMods; s1: number; s2: number; s3: number };
export type DailyRow = { day: string; seed: number; mods: StageMods; g1: number; g2: number; g3: number; cv?: number | null };
export type DuelRow = { code: string; seed: number; params: Record<string, unknown> };

export function buildRound(a: {
  mode: string; level: string; cfg: Cfg; boosters: string[]; randomSeed: number;
  stage?: StageRow | null; daily?: DailyRow | null; duel?: DuelRow | null; eventFee?: number | null;
  feePct?: number; // live ops "cheaper entries" discount, applied to Beat the Ghost only
  drill?: { skill: string; mods: StageMods } | null; // a 60-second Bingo DNA drill
  v2?: boolean; // balance v2: the caller (roundVersion) decided this round plays by version 2. Honored for solo, ghost, tour and daily only
}): { seed: number; fee: number; params: Record<string, unknown> } {
  const lv = plainLevel(a.cfg.levels[a.level]); // a level never hands version 2 keys to a version 1 round
  if (a.mode === "duel" && a.duel) {
    // A challenge is replayed with exactly the rules and board the creator had.
    return { seed: Number(a.duel.seed), fee: 0, params: { ...a.duel.params, fee: 0, boosters: [], ghost: null } };
  }
  const x = a.v2 && ["solo", "ghost", "tour", "daily"].includes(a.mode) ? v2Level(a.cfg, a.level) : null; // null = version 1
  const levelRules: Params = x ? v2Rules(lv, x) : lv;
  const base = { ...levelRules, total: a.cfg.g.total };
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
  } else if (a.mode === "drill" && a.drill) {
    rules = applyMods(base, a.drill.mods);
    extra.label = a.drill.mods.label ?? "";
    extra.drill = a.drill.skill;
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

  // The ghost. Version 1: gl + random(gr). Version 2: a share of a perfect round on this board, from the level's normal rules
  // (no boosters, no modifiers), and the perfect score is kept in the params to recalibrate the share later.
  if (a.mode === "ghost" && x) extra.perfect = perfectScore(seed, base);
  const ghost = a.mode !== "ghost" ? null : x ? ghostFromShare(seed, base, x.share) : ghostTarget(seed, lv);
  return { seed, fee, params: { ...r, level: a.level, fee, pay: a.cfg.g.pay, boosters, ghost, ...extra } };
}

/** The frozen rules of a live match. Both players get the same params, fixed when the match is created (version 2 only when `v2`). */
export function matchParams(cfg: Cfg, level: string, v2: boolean): Record<string, unknown> {
  const lv = plainLevel(cfg.levels[level]);
  const x = v2 ? v2Level(cfg, level) : null;
  return { ...(x ? v2Rules(lv, x) : lv), total: cfg.g.total, fee: lv.fee, pay: cfg.g.pay, boosters: [], ghost: null };
}
