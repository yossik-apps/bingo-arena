import Radar from "../lib/Radar";
import ShareBar from "../lib/ShareBar";
import { DRILL_NAMES, MIN_ROUNDS, SKILLS, SKILL_INFO, todaysDrill, type Dna } from "../lib/dna";

/** The Bingo DNA panel: spider chart, the six skills, play style, trend and today's drill. */
export default function DnaCard({ dna, played, drillDone, onDrill }: { dna: Dna | null; played: number; drillDone: boolean; onDrill: () => void }) {
  if (!dna) {
    return (
      <div className="box dna">
        <h2>Your Bingo DNA</h2>
        <p className="dim" style={{ marginTop: 0 }}>Play {Math.max(1, MIN_ROUNDS - played)} more round{MIN_ROUNDS - played === 1 ? "" : "s"} to see your six skills: Speed, Accuracy, Awareness, Combo, Lines and Pressure.</p>
        <div className="prog" role="progressbar" aria-label="Rounds until your Bingo DNA is ready" aria-valuemin={0} aria-valuemax={MIN_ROUNDS} aria-valuenow={Math.min(played, MIN_ROUNDS)}><i style={{ width: `${(Math.min(played, MIN_ROUNDS) / MIN_ROUNDS) * 100}%` }} /></div>
      </div>
    );
  }
  const drill = todaysDrill(dna);
  return (
    <>
      <div className="box dna">
        <h2>Your Bingo DNA</h2>
        <p className="dim" style={{ marginTop: 0 }}>From your last {dna.rounds} rounds.{dna.trend !== null ? ` ${dna.trend > 0 ? `Up ${dna.trend}` : dna.trend < 0 ? `Down ${-dna.trend}` : "No change"} since last week.` : ""}</p>
        {dna.style && <p className="dnastyle"><span className="tag">Play style</span> <b>{dna.style.name}</b> <span className="dim">{dna.style.text}</span></p>}
        <div className="dnagrid">
          <Radar dna={dna} />
          <div>
            {SKILLS.map((k) => (
              <div key={k} className={`skrow ${dna.weakest === k ? "weak" : ""}`} title={SKILL_INFO[k].what}>
                <span>{SKILL_INFO[k].name}{dna.weakest === k ? " · weakest" : ""}</span>
                <div className="prog" role="progressbar" aria-label={SKILL_INFO[k].name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={dna.skills[k] ?? 0}><i style={{ width: `${dna.skills[k] ?? 0}%` }} /></div>
                <b>{dna.skills[k] ?? "?"}</b>
              </div>
            ))}
            {dna.skills.pressure === null && <p className="dim" style={{ fontSize: 13 }}>Pressure appears after a Hard round or a fast stage.</p>}
          </div>
        </div>
        {dna.weakest && <p style={{ marginBottom: 6 }}><b>Work on {SKILL_INFO[dna.weakest].name}:</b> {SKILL_INFO[dna.weakest].tip}</p>}
        <button className="btn" onClick={onDrill}>Today's drill: {DRILL_NAMES[drill]} (60 s)</button>
        <p className="dim" style={{ fontSize: 13, margin: "6px 0 0" }}>{drillDone ? "You did today's drill. You can train again, the coins come back tomorrow." : "Free. Your first drill each day gives 20 coins."}</p>
      </div>
      {dna.style && <ShareBar title="Share your play style" text={`My Bingo DNA says I'm a ${dna.style.name} in Bingo Arena. What are you?`} link={window.location.origin} />}
    </>
  );
}
