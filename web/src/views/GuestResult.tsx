import type { RoundResult } from "./Play";
import Radar from "../lib/Radar";
import { singleRoundDna } from "../lib/dna";

/** After a visitor's free round: their score, and a blurred Bingo DNA that signing up reveals. */
export default function GuestResult({ r, total, every, level, onJoin, onBack }: { r: RoundResult; total: number; every: number; level: string; onJoin: () => void; onBack: () => void }) {
  const dna = singleRoundDna({ mode: "solo", level, finished_at: new Date().toISOString(), params: { every, total }, result: r });
  return (
    <section>
      <h1>Nice! You scored {r.score} points</h1>
      <div className="cols2"><div>
        <table><tbody>
          <tr><td>Daubed</td><td>{r.daubs}</td></tr>
          <tr><td>Wrong taps</td><td>{r.wrong + r.late}</td></tr>
          <tr><td>Lines</td><td>{r.lines}</td></tr>
          <tr><td>Best combo</td><td>x{r.maxMult}</td></tr>
          <tr><td>Accuracy</td><td>{Math.round(r.accuracy * 100)}%</td></tr>
        </tbody></table>
      </div><div>
        <div className="box dna guestdna">
          <h2>Your Bingo DNA is ready</h2>
          <div className="blurwrap" aria-hidden="true"><Radar dna={dna} size={220} /></div>
          <div className="blurcta">
            <p style={{ fontWeight: 700, margin: "0 0 4px" }}>See your six skills and your play style</p>
            <p className="dim" style={{ margin: "0 0 8px", fontSize: 14 }}>Create a free account to reveal it, get free coins and save your progress.</p>
            <button className="btn" onClick={onJoin}>Sign up free to reveal</button>
          </div>
        </div>
        <p className="dim" style={{ fontSize: 13 }}>This free round is not saved to a new account. Your Bingo DNA builds from the rounds you play after you sign up.</p>
      </div></div>
      <div className="row2"><button className="btn" onClick={onJoin}>Sign up free</button><button className="btn alt" onClick={onBack}>Back to lobby</button></div>
    </section>
  );
}
