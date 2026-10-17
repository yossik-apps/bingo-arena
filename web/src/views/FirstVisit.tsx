import { useState } from "react";

const STEPS: [string, string][] = [
  ["Numbers are called one by one", "A ball with a letter and a number appears, like B7 or N42. The letter tells you the column on your card."],
  ["Tap it if it is on your card", "Only the last few numbers can still be tapped, so be quick. Wrong taps cost points."],
  ["Build combos and lines", "Correct taps in a row raise your combo. Complete a row, column or diagonal for bonus points."],
];

/** Asked once, on a visitor's first visit: have you played bingo before? */
export default function FirstVisit({ onPractice, onClose }: { onPractice: () => void; onClose: () => void }) {
  const [step, setStep] = useState(-1);
  if (step >= 0) {
    const [h, t] = STEPS[step];
    return (
      <div className="tour" role="dialog" aria-modal="true" aria-labelledby="fv-title">
        <div className="tour-card">
          <div className="tour-top"><span className="dim">How to play · {step + 1} of {STEPS.length}</span><button className="btn alt" style={{ minHeight: 40, padding: "6px 14px" }} onClick={onClose}>Skip</button></div>
          <h2 id="fv-title">{h}</h2>
          <p>{t}</p>
          <div className="row2">
            {step > 0 && <button className="btn alt" onClick={() => setStep(step - 1)}>Back</button>}
            {step < STEPS.length - 1 ? <button className="btn" onClick={() => setStep(step + 1)}>Next</button> : <button className="btn" onClick={onPractice}>Play a free round</button>}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="fv-title">
      <div className="tour-card">
        <span className="eyebrow">Welcome to Bingo Arena</span>
        <h2 id="fv-title">Have you played bingo before?</h2>
        <p className="dim">Either way, you can play one round for free right now. No account needed.</p>
        <div className="fvopts">
          <button className="btn big" onClick={() => setStep(0)}>I'm new: show me how</button>
          <button className="btn big alt" onClick={onPractice}>Yes: let me play</button>
          <button className="linkbtn" onClick={onClose}>Just look around</button>
        </div>
      </div>
    </div>
  );
}
