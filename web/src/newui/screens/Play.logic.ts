// The round's rules for display, kept apart from its looks so they can be tested. The wording and conditions are the same as Classic Play (views/Play.tsx).
// Nothing here decides a score: the server scores the round (ctx.rounds.submit). These only draw the live board.
import { currentIndex, LINES, multiplier } from "../../../../supabase/functions/_shared/engine.ts";
import type { Equipped, ShopItem } from "../../lib/supabase";
import type { RoundStart } from "../../views/Play";

type P = RoundStart["params"];

export const LEVEL_NAME: Record<string, string> = { beginner: "Beginner", medium: "Medium", hard: "Hard" };
const L = "BINGO";
/** "B7" */
export const label = (n: number) => L[Math.floor((n - 1) / 15)] + n;
export const letter = (n: number) => L[Math.floor((n - 1) / 15)];

/** Older rounds (and live matches) do not send the level; the slowest pace is Beginner. */
export const roundLevel = (p: P) => p.level ?? (p.every >= 3800 && p.win >= 4 ? "beginner" : "");
/** Rows and columns that need one more number are marked on Beginner and Medium. */
export const showsLineHints = (level: string) => level === "beginner" || level === "medium";

export const modeName = (round: RoundStart) => {
  const p = round.params;
  return round.local ? "Free round" : round.opponent ? "Live match" : p.ghost != null ? "Beat the Ghost" : p.goals ? (p.label || "Stage") : (p.label || "Practice");
};
export const levelText = (level: string) => LEVEL_NAME[level] ?? "";

/** The line under the score: the opponent, the ghost's score so far, or the last tap's points. */
export const scoreSub = (round: RoundStart, now: number, totalMs: number, lastPts: number | null) => {
  const p = round.params;
  return round.opponent ? `vs ${round.opponent}` : p.ghost != null ? `Ghost ${Math.round(p.ghost * (now / totalMs))}` : lastPts !== null ? `${lastPts >= 0 ? "+" : ""}${lastPts} last tap` : "";
};

/** The server times every round, so the clock cannot pause while the question is open (BA-24). A visitor's free round is timed on the device. */
export const leaveText = (round: RoundStart) => {
  if (round.local) return "Leave this round? It will not count.";
  const clock = "The round keeps running while you decide.";
  return round.params.fee ? `Leave this round? ${clock} The entry fee is not refunded.` : `Leave this round? ${clock} It will not count.`;
};
export const tipText = (win: number) => `Tap the number on your card that matches the ball. Only the last ${win} numbers can still be tapped. Correct taps in a row build a combo.`;
export const idleText = (beginner: boolean) => (beginner ? "Find the called number on your card and tap it." : "Tap called numbers on your card. Look before you tap.");
export const SCORING = "Scoring your round…";

/** The tip shows for a player's first two rounds, while tips are on. */
export const TIP_KEY = "ba_tip_rounds";
export const showsTip = (tips: boolean, roundsSeen: number) => tips && roundsSeen < 2;

/** The combo: multiplier, taps to the next step, and how many pips are lit. */
export function combo(streak: number, step: number, maxM: number) {
  const mult = multiplier(streak, step, maxM);
  const toNext = mult >= maxM ? 0 : (Math.floor(streak / step) + 1) * step - streak;
  const pips = mult >= maxM ? step : streak % step;
  return { mult, toNext, pips, label: toNext ? `${toNext} more correct taps for x${mult + 1}` : "Top combo" };
}

/** The message after a correct tap. */
export function goodText(streak: number, step: number, maxM: number) {
  const { mult, toNext } = combo(streak, step, maxM);
  return streak < 2 ? "Good tap!" : mult >= maxM ? `${streak} in a row. Top combo x${mult}!` : `Nice! ${streak} in a row. ${toNext} more for x${mult + 1}.`;
}
/** The message part after a tap that earned a speed bonus (balance v2 rounds only). */
export const bonusText = (b: number) => `Speed bonus +${b}.`;
/** The line bonus, as Classic words it. The server adds the real bonus. */
export const lineText = (p: P, lines: number) => `LINE! +${Math.round(50 * p.pt * (p.lineMul ?? 1)) * lines} bonus points`;
export const missText = (kind: "late" | "notYet") => (kind === "late" ? "That number already left the board. Combo reset." : "Not called yet. Combo reset.");

/** Lines completed by `marked` that were not in `done`. */
export const newLines = (marked: boolean[], done: ReadonlySet<number>) => LINES.map((ln, k) => ({ ln, k })).filter(({ ln, k }) => !done.has(k) && ln.every((x) => marked[x]));

/** Rows (even k) and columns (odd k) that need one more number. The two diagonals are never hinted. */
export const almostLines = (marked: boolean[], hints: boolean) => (hints ? LINES.map((ln, k) => ({ k, n: ln.filter((x) => marked[x]).length })).filter((x) => x.n === 4 && x.k < 10).map((x) => x.k) : []);

/** The numbers that can still be tapped, newest first, each with how much of its time is left. */
export function onBoard(seq: number[], card: number[], marked: boolean[], now: number, p: Pick<P, "every" | "win">) {
  const idx = currentIndex(now, p.every, seq.length);
  return Array.from({ length: Math.min(p.win, idx + 1) }, (_, j) => {
    const k = idx - j, n = seq[k];
    const rest = Math.max(0, Math.min(1, ((k + p.win) * p.every - now) / (p.win * p.every)));
    const ci = card.indexOf(n);
    const daubed = ci >= 0 && marked[ci];
    const tag = daubed ? "done" : j === 0 ? "new" : j === p.win - 1 ? "leaving" : "";
    return { n, rest, j, daubed, tag: tag as "done" | "new" | "leaving" | "" };
  });
}

/** Taps closer than this to the last one are ignored (the server rejects superhuman speed). */
export const DOUBLE_TAP_MS = 100;
export const ignoresTap = (a: { over: boolean; marked: boolean; t: number; prevT: number | null }) => a.over || a.marked || a.t < 0 || (a.prevT !== null && a.t - a.prevT < DOUBLE_TAP_MS);

/** The player's equipped looks from the shop, as Classic draws them on the card: dauber colour, dab style, board and ball. Missing items keep the design's own colours. */
export function lookFor(eq: Equipped | undefined, items: ShopItem[]) {
  const find = (slot: string, key?: string) => (key ? items.find((i) => i.slot === slot && i.key === key)?.meta : undefined);
  const theme = find("theme", eq?.theme), board = find("board", eq?.board), ball = find("ball", eq?.ball);
  return {
    daub: (theme?.color as string | undefined) ?? null,
    style: eq?.style || "",
    board: board ? { card: board.card as string, cell: board.cell as string, ink: board.ink as string } : null,
    ball: ball ? { bg: ball.bg as string, ink: ball.ink as string } : null,
  };
}
