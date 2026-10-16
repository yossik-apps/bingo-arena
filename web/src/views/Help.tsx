import { FAQ, GLOSSARY, GUIDE, GUIDE_VERSION } from "../guide/content";
import { Ic } from "../lib/ui";

export default function Help({ onReplay, onContact }: { onReplay: () => void; onContact: () => void }) {
  return (
    <div className="cols2">
      <div>
        <section className="hero" style={{ marginTop: 0 }}>
          <span className="eyebrow">Help</span>
          <h2>New here? Take the 1-minute tour.</h2>
          <p>It shows how a round works, how to score, and where everything is.</p>
        </section>
        <button className="btn big" style={{ marginTop: 10 }} onClick={onReplay}><Ic n="play" /> Show the intro tour again</button>
        <button className="btn alt big" style={{ marginTop: 8 }} onClick={onContact}><Ic n="mail" /> Contact us</button>
        <h2 className="sec">How the game works</h2>
        {GUIDE.map((s) => (
          <details className="faq" key={s.id}>
            <summary>{s.title}</summary>
            {s.body.map((b) => <p key={b}>{b}</p>)}
          </details>
        ))}
      </div>
      <div>
        <h2 className="sec" style={{ marginTop: 8 }}>Questions people ask</h2>
        {FAQ.map((f) => (
          <details className="faq" key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>
        ))}
        <h2 className="sec">Words used in the game</h2>
        <div className="box">
          {GLOSSARY.map((g) => <p key={g.term} style={{ margin: "6px 0" }}><b>{g.term}</b> <span className="dim">{g.meaning}</span></p>)}
        </div>
        <p className="dim">Guide version {GUIDE_VERSION}. The guide is updated whenever the game gets new features.</p>
      </div>
    </div>
  );
}
