// "Last 10 games": a pattern read of the player's most recent rounds, across every way of playing.
// Pure rules on the player's own data (no outside service), so it is instant, free and testable.
import type { DnaRound } from "./dna";

export const MODE_NAME: Record<string, string> = {
  solo: "Practice", ghost: "Beat the Ghost", pvp: "Live match", tour: "Event", stage: "Journey stage",
  daily: "Daily Challenge", duel: "Friend challenge", drill: "Drill",
};
const LEVEL_NAME: Record<string, string> = { beginner: "Beginner", medium: "Medium", hard: "Hard" };

export type Game = {
  mode: string; modeName: string; level: string; levelName: string; when: string;
  score: number; acc: number; reaction: number | null; wrong: number;
  result: "win" | "best" | "loss" | null; // win = beat the ghost or a friend; best = new personal best in Practice
};
export type Insight = { tone: "good" | "tip" | "info"; title: string; text: string };
export type Pattern = { games: Game[]; insights: Insight[]; headline: string; avgAcc: number; wins: number; contests: number };

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (x: number) => Math.round(x * 100);

export function toGame(r: DnaRound): Game | null {
  const s = r.result as (DnaRound["result"] & { score?: number; win?: boolean; wrong?: number; late?: number }) | null;
  if (!s || typeof s.score !== "number") return null;
  const contest = r.mode === "ghost" || r.mode === "duel";
  return {
    mode: r.mode, modeName: MODE_NAME[r.mode] ?? r.mode, level: r.level, levelName: LEVEL_NAME[r.level] ?? r.level, when: r.finished_at,
    score: s.score, acc: typeof s.accuracy === "number" ? s.accuracy : 0, reaction: typeof s.avgReactionMs === "number" ? s.avgReactionMs : null,
    wrong: (s.wrong ?? 0) + (s.late ?? 0),
    result: contest ? (s.win ? "win" : "loss") : r.mode === "solo" && s.win ? "best" : null,
  };
}

/** The pattern read for the newest 10 games (needs at least 3). */
export function computePattern(rounds: DnaRound[], max = 10): Pattern | null {
  const all = [...rounds].sort((a, b) => b.finished_at.localeCompare(a.finished_at)).map(toGame).filter((g): g is Game => !!g).slice(0, max);
  if (all.length < 3) return null;
  const games = all.slice(0, 10); // the read always uses the newest 10; the list can show more (Bingo Club)
  const insights: Insight[] = [];
  const avgAcc = avg(games.map((g) => g.acc));

  // 1. Trend: the newer half against the older half
  const half = Math.floor(games.length / 2);
  const newer = games.slice(0, half), older = games.slice(games.length - half);
  const dAcc = pct(avg(newer.map((g) => g.acc))) - pct(avg(older.map((g) => g.acc)));
  if (dAcc >= 5) insights.push({ tone: "good", title: "You are getting sharper", text: `Your accuracy went from ${pct(avg(older.map((g) => g.acc)))}% to ${pct(avg(newer.map((g) => g.acc)))}% across these games. Keep the same rhythm.` });
  else if (dAcc <= -5) insights.push({ tone: "tip", title: "Accuracy is slipping", text: `Your accuracy dropped from ${pct(avg(older.map((g) => g.acc)))}% to ${pct(avg(newer.map((g) => g.acc)))}%. Slow down a little and check the letter before you tap.` });
  const rn = newer.map((g) => g.reaction).filter((x): x is number => x !== null), ro = older.map((g) => g.reaction).filter((x): x is number => x !== null);
  if (rn.length && ro.length && avg(ro) - avg(rn) >= 150) insights.push({ tone: "good", title: "Faster reactions", text: `You now tap about ${((avg(ro) - avg(rn)) / 1000).toFixed(1)} s sooner after a number is called than a few games ago.` });

  // 2. Where you play best and worst (modes with 2 or more games)
  const byMode = new Map<string, Game[]>();
  games.forEach((g) => byMode.set(g.mode, [...(byMode.get(g.mode) ?? []), g]));
  const modes = [...byMode.entries()].filter(([, gs]) => gs.length >= 2).map(([m, gs]) => ({ m, acc: avg(gs.map((g) => g.acc)), n: gs.length }));
  if (modes.length >= 2) {
    modes.sort((a, b) => b.acc - a.acc);
    const best = modes[0], worst = modes[modes.length - 1];
    if (best.acc - worst.acc >= 0.06) {
      insights.push(worst.m === "pvp" || worst.m === "tour"
        ? { tone: "tip", title: "Pressure shows against people", text: `You hit ${pct(best.acc)}% in ${MODE_NAME[best.m]} but ${pct(worst.acc)}% in ${MODE_NAME[worst.m]}. A Pressure Cooker drill trains exactly this.` }
        : { tone: "info", title: `Strongest in ${MODE_NAME[best.m]}`, text: `${pct(best.acc)}% accuracy there, against ${pct(worst.acc)}% in ${MODE_NAME[worst.m]}.` });
    }
  }

  // 3. Results in contests (ghost and friend challenges)
  const contests = games.filter((g) => g.result === "win" || g.result === "loss");
  const wins = contests.filter((g) => g.result === "win").length;
  if (contests.length >= 3) {
    if (wins / contests.length >= 0.75) {
      const lvl = contests[0].level;
      insights.push({ tone: "good", title: `${wins} wins out of ${contests.length}`, text: lvl === "hard" ? "You are beating your rivals on Hard. Try an Event for bigger prizes." : `You win most of your contests. Try ${lvl === "beginner" ? "Medium" : "Hard"} for bigger prizes.` });
    } else if (wins / contests.length <= 0.25) {
      insights.push({ tone: "tip", title: `${wins} wins out of ${contests.length}`, text: "The ghost is winning for now. A few Practice rounds on the same level build the speed you need." });
    }
  }

  // 4. Wrong taps and level advice
  const wr = avg(games.map((g) => g.wrong));
  if (wr >= 3) insights.push({ tone: "tip", title: "Too many wrong taps", text: `About ${Math.round(wr)} wrong or late taps per game. Each one costs points and resets your combo.` });
  const lv = games.filter((g) => ["solo", "ghost", "pvp"].includes(g.mode));
  if (lv.length >= 3 && lv.every((g) => g.level === "beginner") && avgAcc >= 0.88) insights.push({ tone: "info", title: "Ready for Medium", text: `${pct(avgAcc)}% accuracy on Beginner. Medium pays more points and XP.` });

  // 5. Variety
  if (byMode.size === 1 && games.length >= 5) {
    const only = games[0].mode;
    insights.push({ tone: "info", title: `All ${MODE_NAME[only] ?? only}`, text: only === "solo" ? "Every recent game was Practice. Beat the Ghost lets you win coins with the same skills." : "Mix in other ways to play: the Daily Challenge and Journey stages give extra rewards." });
  }
  if (!insights.length) insights.push({ tone: "info", title: "Nice and steady", text: `Your games are consistent, at about ${pct(avgAcc)}% accuracy. Your Bingo DNA shows which skill to train next.` });

  const top = insights[0];
  const headline = top.tone === "good" ? "On the way up" : top.tone === "tip" ? "One thing to work on" : "Steady play";
  return { games: all, insights: insights.slice(0, 4), headline, avgAcc, wins, contests: contests.length };
}

/** What a DNA score means, in bands. */
export const SCORE_BANDS: { min: number; name: string; text: string }[] = [
  { min: 80, name: "Expert", text: "Fast, accurate and calm under pressure. Hard rounds and Events suit you." },
  { min: 60, name: "Strong", text: "A solid all-round player with one or two skills to polish." },
  { min: 40, name: "Getting there", text: "The basics are in place. Daily drills move this number quickest." },
  { min: 0, name: "Learning", text: "Everyone starts here. Beginner rounds and drills build every skill." },
];
export const scoreBand = (score: number) => SCORE_BANDS.find((b) => score >= b.min) ?? SCORE_BANDS[SCORE_BANDS.length - 1];
