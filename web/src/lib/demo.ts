// Sample data for the demo profile that visitors see before they register. Clearly labelled as a demo on screen.
import type { DnaRound } from "./dna";
import type { MasteryRow } from "./supabase";

const G: [string, string, number, number, boolean, number][] = [
  // mode, level, accuracy, score, win, hours ago
  ["ghost", "medium", 0.93, 284, true, 2], ["pvp", "medium", 0.72, 196, false, 5], ["daily", "medium", 0.9, 262, false, 20],
  ["ghost", "medium", 0.91, 270, true, 26], ["drill", "medium", 0.86, 150, false, 30], ["pvp", "medium", 0.74, 205, false, 47],
  ["solo", "beginner", 0.82, 176, true, 52], ["ghost", "beginner", 0.78, 160, false, 70], ["stage", "beginner", 0.8, 182, false, 75],
  ["solo", "beginner", 0.77, 158, false, 98], ["solo", "hard", 0.7, 230, false, 120], ["solo", "beginner", 0.75, 150, false, 190],
];

/** Demo rounds, timed relative to now so "2 h ago" and the weekly trend always look right. */
export function demoRounds(now = Date.now()): DnaRound[] {
  return G.map(([mode, level, acc, score, win, h], i) => ({
    mode, level, finished_at: new Date(now - h * 3600e3).toISOString(),
    params: { every: level === "hard" ? 2200 : level === "medium" ? 3000 : 4000, total: mode === "drill" ? 60 : 100 },
    result: { score, win, accuracy: acc, avgReactionMs: 1500 - (G.length - i) * 30, daubs: 15, missed: 6 - Math.round(acc * 5), maxStreak: Math.round(acc * 10), maxMult: 3, lines: i % 3 === 0 ? 2 : 1, wrong: Math.round((1 - acc) * 8), late: 0 } as DnaRound["result"],
  }));
}

export const DEMO_MASTERY: MasteryRow[] = [
  { level: "beginner", best: 412, tier: 2, name: "Silver", next_name: "Gold", next_min: 500 },
  { level: "medium", best: 284, tier: 1, name: "Bronze", next_name: "Silver", next_min: 300 },
  { level: "hard", best: 230, tier: 1, name: "Bronze", next_name: "Silver", next_min: 400 },
];
