import { Ic } from "../lib/ui";

/** What a visitor sees on screens that need an account: what is waiting for them, and one button to join. */
export default function GuestTeaser({ title, intro, points, onJoin }: { title: string; intro: string; points: [string, string, string][]; onJoin: () => void }) {
  return (
    <div className="cols2">
      <div>
        <section className="hero" style={{ marginTop: 0 }}>
          <span className="eyebrow">Free account</span>
          <h2>{title}</h2>
          <p>{intro}</p>
        </section>
        <button className="btn big" style={{ marginTop: 10 }} onClick={onJoin}>Play free to unlock</button>
        <p className="hint">Already have an account? The same button lets you log in.</p>
      </div>
      <div>
        {points.map(([icon, head, text]) => (
          <div className="lrow" key={head}>
            <span className="lic" aria-hidden="true"><Ic n={icon} /></span>
            <span className="lt"><b>{head}</b><span className="dim" style={{ fontSize: 14 }}>{text}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}
