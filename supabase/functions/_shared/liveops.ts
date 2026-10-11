// Timed boosts from the live ops calendar. Boosts never stack: the best one of each kind applies.
export type Op = { kind: string; mult: number; pct: number };
export type Boosts = { xp: number; coins: number; feePct: number };

export function combine(ops: Op[]): Boosts {
  const b: Boosts = { xp: 1, coins: 1, feePct: 0 };
  for (const o of ops) {
    if (o.kind === "xp_boost") b.xp = Math.max(b.xp, Number(o.mult) || 1);
    if (o.kind === "coin_boost") b.coins = Math.max(b.coins, Number(o.mult) || 1);
    if (o.kind === "fee_discount") b.feePct = Math.max(b.feePct, Number(o.pct) || 0);
  }
  b.xp = Math.min(b.xp, 5); b.coins = Math.min(b.coins, 5); b.feePct = Math.min(b.feePct, 90);
  return b;
}

// deno-lint-ignore no-explicit-any
export async function activeBoosts(db: any): Promise<Boosts> {
  const now = new Date().toISOString();
  const { data } = await db.from("liveops").select("kind,mult,pct").eq("active", true).lte("starts_at", now).gt("ends_at", now);
  return combine((data ?? []) as Op[]);
}
