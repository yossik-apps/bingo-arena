import { useEffect, useRef, useState } from "react";
import type { GuideStep } from "../guide/content";
import { Ic, label } from "../lib/ui";

type V = NonNullable<GuideStep["view"]>;

/** A tiny practice board so new players can try the one thing that matters: tapping the called number. */
function TapDemo() {
  const cells = [7, 22, 31, 45, 52, 60, 12, 38, 71];
  const target = 45;
  const [done, setDone] = useState(false);
  const [miss, setMiss] = useState(-1);
  const tap = (i: number) => {
    if (cells[i] === target) { setDone(true); setMiss(-1); } else { setMiss(i); setTimeout(() => setMiss(-1), 350); }
  };
  return (
    <div className="demo" aria-label="Practice board">
      <div className="demo-top"><span className="ball demo-ball" aria-hidden="true">{label(target)}</span>
        <p role="status" aria-live="polite" style={{ margin: 0 }}>{done ? "Nice! That is how every tap works." : `The ball says ${label(target)}. Tap ${target} on the card.`}</p></div>
      <div className="demo-grid">
        {cells.map((v, i) => (
          <button key={i} className={`cell ${done && v === target ? "m" : ""} ${miss === i ? "shake" : ""}`} onClick={() => tap(i)} aria-label={`${v}${done && v === target ? ", tapped" : ""}`}>{v}</button>
        ))}
      </div>
      {done && <button className="btn alt" style={{ minHeight: 40 }} onClick={() => setDone(false)}>Try again</button>}
    </div>
  );
}

export default function Tour({ steps, heading, onClose, onGo }: { steps: GuideStep[]; heading: string; onClose: () => void; onGo: (v: V) => void }) {
  const [i, setI] = useState(0);
  const next = useRef<HTMLButtonElement>(null);
  const s = steps[i];
  const last = i === steps.length - 1;
  useEffect(() => { next.current?.focus(); }, [i]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className="tour-card">
        <div className="tour-top">
          <span className="dim">{heading} · {i + 1} of {steps.length}</span>
          <button className="btn alt" style={{ minHeight: 40, padding: "6px 14px" }} onClick={onClose}>Skip</button>
        </div>
        <div className="tour-icon" aria-hidden="true"><Ic n={s.icon} /></div>
        <h2 id="tour-title">{s.title}</h2>
        {s.body.map((b) => <p key={b} className="tour-p">{b}</p>)}
        {s.demo === "tap" && <TapDemo />}
        {s.view && last === false && (
          <button className="linkbtn" onClick={() => onGo(s.view!)}>Open it now</button>
        )}
        <div className="tour-dots" aria-hidden="true">{steps.map((_, k) => <i key={k} className={k === i ? "on" : ""} />)}</div>
        <div className="row2">
          <button className="btn alt" disabled={i === 0} onClick={() => setI(i - 1)}>Back</button>
          <button ref={next} className="btn" onClick={() => (last ? onClose() : setI(i + 1))}>{last ? "Start playing" : "Next"}</button>
        </div>
      </div>
    </div>
  );
}
