import { TARGETS, openShare, type Target } from "./share";

const COLOR: Record<Target, string> = { whatsapp: "#0f7b63", telegram: "#1c7fb5", facebook: "#1665d0" };

/** The three share buttons. `link` can be empty while it is being prepared. */
export default function ShareBar({ title, text, link }: { title: string; text: string; link: string }) {
  return (
    <div className="box" role="group" aria-label={title}>
      <p style={{ margin: "0 0 8px", fontWeight: 700 }}>{title}</p>
      <div className="row2">
        {TARGETS.map((t) => (
          <button key={t.id} className="btn" style={{ background: COLOR[t.id], minWidth: 110 }} disabled={!link} onClick={() => openShare(t.id, text, link)}>{t.name}</button>
        ))}
      </div>
      {!link && <p className="dim" style={{ margin: "6px 0 0" }}>Preparing your link…</p>}
    </div>
  );
}
