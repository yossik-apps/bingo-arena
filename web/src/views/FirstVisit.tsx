import { useState } from "react";

const STEPS: [string, string][] = [
  ["Numbers are called one by one", "A ball with a letter and a number appears, like B7 or N42. The letter tells you the column on your card."],
  ["Tap it if it is on your card", "Only the last few numbers can still be tapped, so be quick. Wrong taps cost points."],
  ["Build combos and lines", "Correct taps in a row raise your combo. Complete a row, column or diagonal for bonus points."],
];

/** The first thing a visitor sees: one big Play button. No account form: the game makes a guest account on the spot. */
export default function FirstVisit({ onPlay, onClose, onLogin, busy, crazy, inviter }: { onPlay: () => void; onClose: () => void; onLogin?: () => void; busy?: boolean; crazy?: boolean; inviter?: string | null }) {
  const [step, setStep] = useState(-1);
  if (step >= 0) {
    const [h, t] = STEPS[step];
    return (
      <div className="tour" role="dialog" aria-modal="true" aria-labelledby="fv-title">
        <div className="tour-card">
          <div className="tour-top"><span className="dim">How to play · {step + 1} of {STEPS.length}</span><button className="btn alt" style={{ minHeight: 40, padding: "6px 14px" }} onClick={onPlay}>Skip, play</button></div>
          <h2 id="fv-title">{h}</h2>
          <p>{t}</p>
          <div className="row2">
            {step > 0 && <button className="btn alt" onClick={() => setStep(step - 1)}>Back</button>}
            {step < STEPS.length - 1 ? <button className="btn" onClick={() => setStep(step + 1)}>Next</button> : <button className="btn" disabled={busy} onClick={onPlay}>{busy ? "Starting…" : "Play now"}</button>}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="fv-title">
      <div className="tour-card fv-play">
        <span className="eyebrow">{inviter ? `${inviter} invited you · bonus coins inside` : "Bingo Arena · free skill bingo"}</span>
        <h2 id="fv-title">Tap the numbers. Beat your best.</h2>
        <div className="fv-ball" aria-hidden="true"><span>B</span><b>7</b></div>
        <button className="btn big fv-go" autoFocus disabled={busy} onClick={onPlay}>{busy ? "Starting…" : "▶  Play now"}</button>
        <p className="dim fv-sub">Free · no sign-up · a round takes under 2 minutes</p>
        <div className="fv-links">
          <button className="linkbtn" onClick={() => setStep(0)}>How to play</button>
          {onLogin && <button className="linkbtn" onClick={onLogin}>I have an account</button>}
          <button className="linkbtn" onClick={onClose}>Look around first</button>
        </div>
        <p className="dim fv-legal">{crazy ? "By playing you agree to the" : "By playing you confirm you are 18+ and agree to the"}  <a href="/terms.html" target="_blank" rel="noreferrer">Terms</a> and <a href="/privacy.html" target="_blank" rel="noreferrer">Privacy Policy</a>.</p>
      </div>
    </div>
  );
}
