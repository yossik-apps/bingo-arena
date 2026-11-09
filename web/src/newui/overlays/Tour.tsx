// The first-time tour, "What is new" after an update, or a replay from Help or Profile (Classic views/Tour.tsx).
// The playground has no tour, so it is a centred card in its style; every word, step and action is Classic's.
// Its own dialog, not the shared Modal: Classic has its own Skip, so there is no extra Close button. Escape closes it, as in Classic.
// Uses: tour (steps, heading, close, go)
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Ball, NumberBall, type Tone } from "../Ball";
import { Button } from "../components";
import { Coin, Gem, Icon, type IconName } from "../Icon";
import type { OverlayProps } from "../screens/contract";
import { BACK, cellLabel, counter, DEMO_CELLS, DEMO_LABEL, DEMO_TARGET, demoText, iconFor, nextText, OPEN_NOW, showOpen, SKIP, TRY_AGAIN } from "./Tour.logic";
import "./tour.css";

const FOCUSABLE = 'button:not([disabled]), a[href]';
const TONES: Tone[] = ["B", "I", "N", "G", "O"];

/** A tiny practice board, as in Classic: tap the called number. Local only, never scored. */
function TapDemo() {
  const [done, setDone] = useState(false);
  const [miss, setMiss] = useState(-1);
  const tap = (i: number) => {
    if (DEMO_CELLS[i] === DEMO_TARGET) { setDone(true); setMiss(-1); } else { setMiss(i); setTimeout(() => setMiss(-1), 350); }
  };
  return (
    <div className="nu-tr-demo" aria-label={DEMO_LABEL} role="group">
      <div className="nu-tr-demotop">
        <span aria-hidden="true"><NumberBall n={DEMO_TARGET} size={52} /></span>
        <p role="status" aria-live="polite">{demoText(done)}</p>
      </div>
      <div className="nu-tr-grid">
        {DEMO_CELLS.map((v, i) => (
          <button key={i} type="button" className={`nu-tr-cell${done && v === DEMO_TARGET ? " is-on" : ""}${miss === i ? " is-miss" : ""}`} onClick={() => tap(i)} aria-label={cellLabel(v, done)}>{v}</button>
        ))}
      </div>
      {done && <Button kind="white" size="sm" onClick={() => setDone(false)}>{TRY_AGAIN}</Button>}
    </div>
  );
}

const StepIcon = ({ name }: { name: string }) => {
  const n = iconFor(name);
  return n === "coin" ? <Coin size={32} /> : n === "gem" ? <Gem size={32} /> : <Icon name={n as IconName} size={30} sw={2.6} color="#14254F" />;
};

export default function Tour({ ctx }: OverlayProps<"tour">) {
  const [i, setI] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(ctx.close);
  close.current = ctx.close;
  const s = ctx.steps[i];
  const last = i === ctx.steps.length - 1;

  // as in Classic: Next has focus on every step, and Escape closes the tour
  useEffect(() => { box.current?.querySelector<HTMLElement>(".nu-tr-next button")?.focus(); }, [i]);
  useEffect(() => {
    const k = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") close.current(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  const trap = (e: KeyboardEvent) => {
    if (e.key !== "Tab" || !box.current) return;
    const all = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (!all.length) return;
    const first = all[0], end = all[all.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); end.focus(); }
    else if (!e.shiftKey && document.activeElement === end) { e.preventDefault(); first.focus(); }
  };
  if (!s) return null;

  return (
    <div className="nu-tr-scrim">
      <div ref={box} className="nu-tr" role="dialog" aria-modal="true" aria-labelledby="nu-tr-title" tabIndex={-1} onKeyDown={trap}>
        <div className="nu-tr-top">
          <span>{counter(ctx.heading, i, ctx.steps.length)}</span>
          <Button kind="ghost" size="sm" onClick={ctx.close}>{SKIP}</Button>
        </div>
        {/* the step scrolls between the fixed top line and the fixed Back / Next row, so Next is always in view */}
        <div className="nu-tr-mid" key={s.id}>
          <span className="nu-tr-icon" aria-hidden="true"><Ball tone={TONES[i % TONES.length]} size={64}><StepIcon name={s.icon} /></Ball></span>
          <h2 id="nu-tr-title">{s.title}</h2>
          <div className="nu-tr-body">{s.body.map((b) => <p key={b}>{b}</p>)}</div>
          {s.demo === "tap" && <TapDemo />}
          {s.view && showOpen(true, last) && <button type="button" className="nu-tr-link" onClick={() => ctx.go(s.view!)}>{OPEN_NOW}</button>}
        </div>
        <div className="nu-tr-dots" aria-hidden="true">{ctx.steps.map((_, k) => <i key={k} className={k === i ? "is-on" : ""} />)}</div>
        <div className="nu-tr-row">
          <Button kind="white" wide disabled={i === 0} onClick={() => setI(i - 1)}>{BACK}</Button>
          <div className="nu-tr-next" data-must-see="next"><Button wide onClick={() => (last ? ctx.close() : setI(i + 1))}>{nextText(last)}</Button></div>
        </div>
      </div>
    </div>
  );
}
