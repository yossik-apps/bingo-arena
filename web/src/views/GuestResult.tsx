import type { RoundResult } from "./Play";
import Radar from "../lib/Radar";
import { singleRoundDna } from "../lib/dna";

/** After a visitor's free round: their score, what an account gives them, and (if any are left) another free round. */
export default function GuestResult({ r, total, every, level, left, welcome, onJoin, onAgain, onBack }: {
  r: RoundResult; total: number; every: number; level: string; left: number; welcome: number; onJoin: () => void; onAgain?: () => void; onBack: () => void;
}) {
  const dna = singleRoundDna({ mode: "solo", level, finished_at: new Date().toISOString(), params: { every, total }, result: r });
  const used = 3 - left;
  return (
    <section className="gr">
      <div className="gr-top">
        <h1>{r.score > 0 ? `Nice! You scored ${r.score} points` : "Round over: 0 points. Try again!"}</h1>
        <div className="gr-dots" aria-label={`Free round ${used} of 3`}>{[0, 1, 2].map((i) => <i key={i} className={i < used ? "on" : ""} />)}<span className="dim">{left > 0 ? `${left} free round${left > 1 ? "s" : ""} left` : "Free rounds used"}</span></div>
      </div>
      <div className="cols2"><div>
        <table><tbody>
          <tr><td>Daubed</td><td>{r.daubs}</td></tr>
          <tr><td>Wrong taps</td><td>{r.wrong + r.late}</td></tr>
          <tr><td>Lines</td><td>{r.lines}</td></tr>
          <tr><td>Best combo</td><td>x{r.maxMult}</td></tr>
          <tr><td>Accuracy</td><td>{Math.round(r.accuracy * 100)}%</td></tr>
        </tbody></table>
        <div className="gr-gets">
          <b>Free account, 20 seconds:</b>
          <ul>
            <li>🪙 <b>{welcome} coins</b> to start, plus daily gifts</li>
            <li>🏆 Daily events, the weekly league and XP races with coin prizes</li>
            <li>🧬 Your Bingo DNA and a personal coach</li>
            <li>🔥 Your level, streak and stars saved on every device</li>
          </ul>
        </div>
      </div><div>
        <div className="box dna guestdna">
          <h2>Your Bingo DNA is ready</h2>
          <div className="blurwrap" aria-hidden="true"><Radar dna={dna} size={200} /></div>
          <div className="blurcta">
            <p style={{ fontWeight: 700, margin: "0 0 4px" }}>See your six skills and your play style</p>
            <button className="btn" onClick={onJoin}>Sign up free to reveal</button>
          </div>
        </div>
      </div></div>
      <div className="row2 gr-acts">
        <button className="btn big" onClick={onJoin}>Sign up free · +{welcome} coins</button>
        {onAgain ? <button className="btn alt" onClick={onAgain}>Play another free round ({left} left)</button> : <button className="btn alt" onClick={onBack}>Back to lobby</button>}
      </div>
      {onAgain && <button className="linkbtn gr-back" onClick={onBack}>Back to lobby</button>}
    </section>
  );
}
