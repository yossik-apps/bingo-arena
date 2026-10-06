// Builds supabase/migrations/006_phase6.sql: the template plus mastery rank thresholds.
// Thresholds come from a flawless reference player on each level's normal rules, so every rank is reachable.
// Run: npx tsx supabase/tools/gen_phase6.ts
import { readFileSync, writeFileSync } from "node:fs";
import { botTaps, scoreTaps, type Params } from "../functions/_shared/engine.ts";

const LEVELS: Record<string, Params> = {
  beginner: { every: 4000, win: 4, pt: 1, pen: 5, hint: false, xm: 1, fee: 10, gl: 150, gr: 100 },
  medium: { every: 3000, win: 3, pt: 1.5, pen: 8, hint: false, xm: 1.5, fee: 20, gl: 250, gr: 130 },
  hard: { every: 2200, win: 2, pt: 2, pen: 15, hint: false, xm: 2, fee: 40, gl: 380, gr: 200 },
};
const TIERS: [string, number][] = [["Silver", 0.25], ["Gold", 0.4], ["Platinum", 0.55], ["Legend", 0.7]];
const rows: string[] = [], report: string[] = [];
for (const [level, p] of Object.entries(LEVELS)) {
  let sum = 0;
  for (let seed = 1; seed <= 60; seed++) sum += scoreTaps(seed, p, botTaps(seed, p, 700, 100000)).score;
  const mean = sum / 60;
  rows.push(`  ('${level}', 0, 'Bronze', 0)`);
  TIERS.forEach(([name, f], i) => rows.push(`  ('${level}', ${i + 1}, '${name}', ${Math.max(10, Math.round((mean * f) / 5) * 5)})`));
  report.push(`${level}: reference average ${Math.round(mean)}, ranks ${TIERS.map(([n, f]) => n + " " + Math.round((mean * f) / 5) * 5).join(", ")}`);
}
const sql = readFileSync(new URL("./phase6.template.sql", import.meta.url), "utf8")
  + "\n-- ===================== generated content (supabase/tools/gen_phase6.ts) =====================\n"
  + "insert into public.mastery_tiers (level, tier, name, min_score) values\n" + rows.join(",\n") + ";\n";
writeFileSync(new URL("../migrations/006_phase6.sql", import.meta.url), sql);
console.log(report.join("\n"));
