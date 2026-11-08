// The terms gate: shown before the shell until the player accepts the current Terms and Privacy Policy.
// The playground has no such page, so it is designed in its style; the words and the call are Classic's (views/AgeGate.tsx).
import { useState } from "react";
import { Ball } from "../Ball";
import { Button } from "../components";
import { Icon } from "../Icon";
import type { OverlayProps } from "../screens/contract";
import { canContinue, consentStart, CONTINUE, intro, LOG_OUT, PRIVACY, TERMS, title } from "./Terms.logic";
import "./terms.css";

export default function Terms({ ctx }: OverlayProps<"terms">) {
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // as in Classic: send the acceptance; on success the profile refreshes and the game opens, otherwise show the error under the button
  const go = async () => {
    if (!canContinue(ok, busy)) return;
    setBusy(true); setMsg("");
    try {
      const r = await ctx.accept();
      if (r.error) setMsg(r.error); else await ctx.done();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    // a div, not main: App already draws the page's main element, and Classic's main rules would pad this one
    <div className="nu-tm">
      <section className="nu-tm-card" aria-labelledby="nu-tm-title">
        <Ball tone="P" size={64}><Icon name="check" size={32} sw={3.2} color="#14254F" /></Ball>
        <h1 id="nu-tm-title" title={title(ctx.name, ctx.updated)}>{title(ctx.name, ctx.updated)}</h1>
        <p className="nu-tm-intro">{intro(ctx.updated)}</p>
        <label className="nu-tm-consent">
          <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} autoFocus />
          <span>{consentStart(ctx.crazyGames)}<a href={TERMS.href} target="_blank" rel="noreferrer">{TERMS.text}</a> and the <a href={PRIVACY.href} target="_blank" rel="noreferrer">{PRIVACY.text}</a>.</span>
        </label>
        <div className="nu-tm-go" data-must-see="continue">
          <Button size="lg" wide disabled={!canContinue(ok, busy)} onClick={() => void go()}>{CONTINUE}</Button>
        </div>
        <p className="nu-tm-msg" role="alert">{msg}</p>
      </section>
      <Button kind="ghost" onClick={ctx.logOut}>{LOG_OUT}</Button>
    </div>
  );
}
