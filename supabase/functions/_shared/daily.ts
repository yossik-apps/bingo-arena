import { applyMods, botTaps, DAILY_LEVELS, DAILY_MODS, scoreTaps } from "./engine.ts";
import type { serviceClient } from "./http.ts";
import type { Cfg, DailyRow } from "./rounds.ts";

/** Today's Daily Challenge (UTC day). The first request of the day creates the board; everyone then shares it. */
export async function ensureDaily(db: ReturnType<typeof serviceClient>, cfg: Cfg): Promise<DailyRow & { level: string }> {
  const day = new Date().toISOString().slice(0, 10);
  let { data: b } = await db.from("daily_boards").select("*").eq("day", day).maybeSingle();
  if (!b) {
    const d = new Date(day + "T00:00:00Z");
    const level = DAILY_LEVELS[d.getUTCDay()];
    const mods = DAILY_MODS[Math.floor(d.getTime() / 864e5) % DAILY_MODS.length];
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const base = applyMods({ ...cfg.levels[level], total: cfg.g.total }, mods);
    // Star goals from a flawless reference player, so the top tier is always reachable.
    const perfect = scoreTaps(seed, base, botTaps(seed, base, 700, base.total * 1000)).score;
    const g = (f: number) => Math.max(10, Math.round((perfect * f) / 5) * 5);
    await db.rpc("ensure_daily_tx", { p_day: day, p_level: level, p_seed: seed, p_mods: mods, p_g1: g(0.26), p_g2: g(0.48), p_g3: g(0.7) });
    ({ data: b } = await db.from("daily_boards").select("*").eq("day", day).single());
  }
  return b as DailyRow & { level: string };
}
