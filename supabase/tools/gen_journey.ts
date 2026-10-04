// Builds supabase/migrations/005_phase5.sql: the template plus the worlds, stages, stamps and reward items.
// Star goals are computed from a reference player so every goal is reachable. Run: npx tsx supabase/tools/gen_journey.ts
import { readFileSync, writeFileSync } from "node:fs";
import { applyMods, botTaps, scoreTaps, type Params, type StageMods } from "../functions/_shared/engine.ts";

const LEVELS: Record<string, Params> = {
  beginner: { every: 4000, win: 4, pt: 1, pen: 5, hint: false, xm: 1, fee: 10, gl: 150, gr: 100 },
  medium: { every: 3000, win: 3, pt: 1.5, pen: 8, hint: false, xm: 1.5, fee: 20, gl: 250, gr: 130 },
  hard: { every: 2200, win: 2, pt: 2, pen: 15, hint: false, xm: 2, fee: 40, gl: 380, gr: 200 },
};
const L = (label: string, m: StageMods): StageMods => ({ ...m, label });
const FRENZY = L("Line Frenzy", { line_mul: 2 }), RUSH = L("Combo Rush", { combo_step: 2, max_mult: 4 }), BLITZ = L("Blitz", { every_mul: 0.85 });
const TIGHT = L("Tight Window", { win_add: -1 }), HANDS = L("Steady Hands", { pen_mul: 2 }), MARATHON = L("Marathon", { total_add: 20 });

type S = [string, string, StageMods];
const WORLDS: { id: number; name: string; blurb: string; need: number; reward: string; stages: S[]; stamps: [string, "common" | "rare" | "epic"][] }[] = [
  { id: 1, name: "Neon Harbor", blurb: "Warm up on the docks. Learn the rhythm of the numbers.", need: 0, reward: "bd_harbor",
    stages: [["First Dock", "beginner", {}], ["Crate Count", "beginner", {}], ["Lamp Line", "beginner", FRENZY], ["Night Shift", "beginner", RUSH],
      ["Harbor Rush", "beginner", BLITZ], ["Steady Pier", "medium", {}], ["Neon Run", "medium", FRENZY], ["Harbor Boss", "medium", L("Blitz + Combo Rush", { every_mul: 0.85, combo_step: 3, max_mult: 4 })]],
    stamps: [["Anchor Pin", "common"], ["Buoy Bell", "common"], ["Crab Claw", "common"], ["Fish Crate", "common"], ["Lantern Fish", "common"], ["Harbor Cat", "rare"], ["Tide Clock", "rare"], ["Captain's Wheel", "rare"], ["Neon Kraken", "epic"]] },
  { id: 2, name: "Frost Lanterns", blurb: "Cold hands, quick eyes. Tighter windows and faster calls.", need: 14, reward: "bd_frost",
    stages: [["Thin Ice", "medium", {}], ["Lantern Lane", "medium", TIGHT], ["Snow Globe", "medium", FRENZY], ["Cold Snap", "medium", BLITZ],
      ["Aurora", "medium", RUSH], ["Frozen Hands", "hard", L("Steady Hands", { pen_mul: 1.5 })], ["Ice Maze", "hard", TIGHT], ["Frost Boss", "hard", L("Blitz + Line Frenzy", { every_mul: 0.9, line_mul: 2 })]],
    stamps: [["Snow Cap", "common"], ["Ice Skate", "common"], ["Warm Mitten", "common"], ["Pine Cone", "common"], ["Hot Cocoa", "common"], ["Paper Lantern", "rare"], ["Ice Fox", "rare"], ["Frost Clock", "rare"], ["Aurora Owl", "epic"]] },
  { id: 3, name: "Sunset Bazaar", blurb: "The big market. Everything is fast, and every mistake costs.", need: 34, reward: "bd_bazaar",
    stages: [["Spice Row", "medium", MARATHON], ["Silk Street", "hard", {}], ["Lamp Market", "hard", FRENZY], ["Haggle", "hard", HANDS],
      ["Rooftops", "hard", BLITZ], ["Golden Hour", "hard", RUSH], ["Midnight Souk", "hard", L("Tight Window + Line Frenzy", { win_add: -1, line_mul: 2 })], ["Bazaar Boss", "hard", L("Everything", { every_mul: 0.85, win_add: -1, combo_step: 3, max_mult: 4 })]],
    stamps: [["Spice Jar", "common"], ["Silk Scarf", "common"], ["Brass Lamp", "common"], ["Date Palm", "common"], ["Tea Glass", "common"], ["Bazaar Parrot", "rare"], ["Mosaic Tile", "rare"], ["Sand Clock", "rare"], ["Golden Camel", "epic"]] },
];

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const out: string[] = ["\n-- ===================== generated content (supabase/tools/gen_journey.ts) =====================",
  "insert into public.shop_items (id, slot, key, grp, name, descr, price, min_level, meta, sort) values",
  "  ('bd_harbor','board','harbor','world','Harbor board','Reward: complete the Neon Harbor album',9999,0,'{\"reward\":true,\"card\":\"#082f49\",\"cell\":\"#0c4a6e\",\"ink\":\"#e0f2fe\"}',80),",
  "  ('bd_frost','board','frost','world','Frost board','Reward: complete the Frost Lanterns album',9999,0,'{\"reward\":true,\"card\":\"#e0f2fe\",\"cell\":\"#f0f9ff\",\"ink\":\"#0c4a6e\"}',81),",
  "  ('bd_bazaar','board','bazaar','world','Bazaar board','Reward: complete the Sunset Bazaar album',9999,0,'{\"reward\":true,\"card\":\"#431407\",\"cell\":\"#7c2d12\",\"ink\":\"#ffedd5\"}',82);"];
out.push("insert into public.worlds (id, name, blurb, stars_needed, reward_item, reward_coins, sort) values");
out.push(WORLDS.map((w) => `  (${w.id}, ${q(w.name)}, ${q(w.blurb)}, ${w.need}, ${q(w.reward)}, 200, ${w.id})`).join(",\n") + ";");
const stageRows: string[] = [], report: string[] = [];
for (const w of WORLDS) {
  w.stages.forEach(([name, level, mods], i) => {
    const seed = (w.id * 10007 + (i + 1) * 7919 + 12345) % 4294967296;
    const base = { ...LEVELS[level], total: 100 };
    const p = applyMods(base, mods);
    const perfect = scoreTaps(seed, p, botTaps(seed, p, 700, p.total * 1000)).score; // a flawless, fast reference player
    const g = (f: number) => Math.max(10, Math.round((perfect * f) / 5) * 5);
    const s1 = g(0.26), s2 = g(0.48), s3 = g(0.7);
    if (!(s1 <= s2 && s2 <= s3)) throw new Error("goals not increasing for " + name);
    report.push(`${w.id}-${i + 1} ${name.padEnd(14)} ${level.padEnd(8)} perfect=${perfect} goals=${s1}/${s2}/${s3}`);
    stageRows.push(`  ('w${w.id}s${i + 1}', ${w.id}, ${i + 1}, ${q(name)}, ${q(level)}, ${seed}, ${q(JSON.stringify(mods))}, ${s1}, ${s2}, ${s3}, ${20 + 5 * (w.id - 1) + (i >= 7 ? 15 : 0)})`);
  });
}
out.push("insert into public.stages (id, world, idx, name, level, seed, mods, s1, s2, s3, reward_coins) values\n" + stageRows.join(",\n") + ";");
out.push("insert into public.stamps (id, world, name, rarity, sort) values\n" + WORLDS.flatMap((w) => w.stamps.map(([n, r], i) => `  ('s${w.id}_${i + 1}', ${w.id}, ${q(n)}, '${r}', ${i + 1})`)).join(",\n") + ";");
writeFileSync(new URL("../migrations/005_phase5.sql", import.meta.url), readFileSync(new URL("./phase5.template.sql", import.meta.url), "utf8") + out.join("\n") + "\n");
console.log(report.join("\n"));
