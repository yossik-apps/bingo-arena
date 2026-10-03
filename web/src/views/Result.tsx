import type { RoundResult, RoundStart } from "./Play";
import { Coins } from "../lib/ui";

export default function Result({ r, p, achNames, onAgain, onReplay }: { r: RoundResult; p: RoundStart["params"]; achNames: string[]; onAgain: () => void; onReplay: (() => void) | null }) {
  const missed = Math.max(0, r.late);
  const tips: string[] = [];
  tips.push(missed >= 3 ? `You let ${missed} matching numbers slip off the board. Scan your card every time a new ball drops, starting with the column letter.` : "Good attention: very few numbers slipped away.");
  tips.push(r.wrong + r.late >= 3 ? `${r.wrong + r.late} wrong taps reset your combo. Check the letter and number before tapping.` : "Few wrong taps, so your combo stayed healthy.");
  if (r.avgReactionMs !== null) tips.push(r.avgReactionMs > p.every * 1.4 ? `Average reaction ${(r.avgReactionMs / 1000).toFixed(1)}s is slow for this level. Aim to daub before the next ball lands.` : `Average reaction ${(r.avgReactionMs / 1000).toFixed(1)}s fits this level well.`);
  const title = r.mode === "tour" ? "Event score submitted" : r.ghost == null ? (r.win ? "New personal best!" : "Round complete") : r.win ? "You beat the ghost!" : "Ghost wins this round";
  return (
    <section>
      <h1>{title}</h1>
      <table><tbody>
        <tr><td>Score</td><td><b>{r.score}</b>{r.ghost != null ? ` (ghost ${r.ghost})` : r.best != null ? ` (best ${r.best})` : ""}</td></tr>
        <tr><td>Daubed</td><td>{r.daubs}</td></tr>
        <tr><td>Wrong taps</td><td>{r.wrong + r.late}</td></tr>
        <tr><td>Lines</td><td>{r.lines}</td></tr>
        <tr><td>Best combo</td><td>x{r.maxMult}</td></tr>
        <tr><td>Accuracy</td><td>{Math.round(r.accuracy * 100)}%</td></tr>
      </tbody></table>
      <p style={{ fontWeight: 700 }}>+{r.xp} XP{r.mode === "tour" ? "" : <> · prize <Coins n={r.prize} /></>} · level {r.level}</p>
      {r.mode === "tour" && <p className="dim">Your best score in the event counts. See the Events tab for the leaderboard. Prizes are paid when the event ends.</p>}
      {achNames.length > 0 && <p style={{ fontWeight: 700 }}>New badge{achNames.length > 1 ? "s" : ""}: {achNames.join(", ")}</p>}
      <div className="box coach"><h2>Your coach</h2><ul style={{ paddingLeft: 20 }}>{tips.map((t) => <li key={t}>{t}</li>)}</ul></div>
      <div className="row2">{onReplay && <button className="btn" onClick={onReplay}>Play again</button>}<button className="btn alt" onClick={onAgain}>Back to lobby</button></div>
    </section>
  );
}
