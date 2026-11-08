// The first thing a visitor sees: one big Play button, and three short "How to play" steps (Classic views/FirstVisit.tsx).
// The playground has no such card, so it is a centred card in its style; every word and every action is Classic's.
// Its own dialog, not the shared Modal: like Classic, Escape and a tap outside do not close it, and there is no extra Close button.
// Uses: firstVisit (play, logIn, close)
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { NumberBall } from "../Ball";
import { Button } from "../components";
import { Icon } from "../Icon";
import type { OverlayProps } from "../screens/contract";
import { BACK, eyebrow, HAVE_ACCOUNT, HOW, isLast, legalStart, LOOK_AROUND, NEXT, playText, PRIVACY, SKIP_PLAY, stepCount, STEPS, SUB, TERMS, TITLE } from "./FirstVisit.logic";
import "./firstvisit.css";

const FOCUSABLE = 'button:not([disabled]), a[href]';

export default function FirstVisit({ ctx }: OverlayProps<"firstVisit">) {
  const [step, setStep] = useState(-1);
  const box = useRef<HTMLDivElement>(null);

  // the first button gets focus on the card and on every step, so the keyboard starts in the right place
  useEffect(() => {
    const el = box.current?.querySelector<HTMLElement>(step < 0 ? ".nu-fv-go button" : ".nu-fv-next button");
    (el ?? box.current)?.focus();
  }, [step]);
  // keep Tab inside the card while it is open
  const trap = (e: KeyboardEvent) => {
    if (e.key !== "Tab" || !box.current) return;
    const all = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (!all.length) return;
    const first = all[0], last = all[all.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const playButton = (
    <Button size="lg" wide disabled={ctx.busy} onClick={ctx.play}>
      {!ctx.busy && <Icon name="play" size={26} sw={2.4} />}{playText(ctx.busy)}
    </Button>
  );

  return (
    <div className="nu-fv-scrim">
      <div ref={box} className="nu-fv" role="dialog" aria-modal="true" aria-labelledby="nu-fv-title" tabIndex={-1} onKeyDown={trap}>
        {step < 0 ? (
          <>
            <span className="nu-fv-eyebrow">{eyebrow(ctx.inviter)}</span>
            <h2 id="nu-fv-title">{TITLE}</h2>
            <span className="nu-fv-ball" aria-hidden="true"><NumberBall n={7} size={96} /></span>
            <div className="nu-fv-go" data-must-see="play">{playButton}</div>
            <p className="nu-fv-sub">{SUB}</p>
            <div className="nu-fv-links">
              <button type="button" className="nu-fv-link" onClick={() => setStep(0)}>{HOW}</button>
              {ctx.logIn && <button type="button" className="nu-fv-link" onClick={ctx.logIn}>{HAVE_ACCOUNT}</button>}
              <button type="button" className="nu-fv-link" onClick={ctx.close}>{LOOK_AROUND}</button>
            </div>
            <p className="nu-fv-legal">{legalStart(ctx.crazyGames)} <a href={TERMS.href} target="_blank" rel="noreferrer">{TERMS.text}</a> and <a href={PRIVACY.href} target="_blank" rel="noreferrer">{PRIVACY.text}</a>.</p>
          </>
        ) : (
          <>
            <div className="nu-fv-top">
              <span>{stepCount(step)}</span>
              <Button kind="ghost" size="sm" onClick={ctx.play}>{SKIP_PLAY}</Button>
            </div>
            <span className="nu-fv-stepball" aria-hidden="true"><NumberBall n={[7, 42, 61][step]} size={64} /></span>
            <h2 id="nu-fv-title">{STEPS[step][0]}</h2>
            <p className="nu-fv-text">{STEPS[step][1]}</p>
            <div className="nu-fv-dots" aria-hidden="true">{STEPS.map((_, k) => <i key={k} className={k === step ? "is-on" : ""} />)}</div>
            <div className="nu-fv-row">
              {step > 0 && <Button kind="white" wide onClick={() => setStep(step - 1)}>{BACK}</Button>}
              <div className="nu-fv-next" data-must-see="next">
                {isLast(step) ? playButton : <Button wide onClick={() => setStep(step + 1)}>{NEXT}</Button>}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
