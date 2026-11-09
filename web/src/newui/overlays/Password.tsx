// Set a new password after a reset link, on a page of its own before the shell (Classic views/SetPassword.tsx).
// The playground has no such page, so it follows the terms gate's card; the words, the checks and the call are Classic's.
// Uses: password (save, done)
import { useState } from "react";
import { Ball } from "../Ball";
import { Button, TextField } from "../components";
import { Icon } from "../Icon";
import type { OverlayProps } from "../screens/contract";
import { check, INTRO, NEW_LABEL, REPEAT_LABEL, SAVE, TITLE } from "./Password.logic";
import "./password.css";

export default function Password({ ctx }: OverlayProps<"password">) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  // as in Classic: check on the device, then save; on success the game carries on, otherwise the server's words show under the button
  const save = async () => {
    if (busy) return;
    setMsg("");
    const problem = check(pw, pw2);
    if (problem) { setMsg(problem); return; }
    setBusy(true);
    try {
      const r = await ctx.save(pw);
      if (r.error) setMsg(r.error); else ctx.done();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    // a div, not main: App already draws the page's main element, and Classic's main rules would pad this one
    <div className="nu-pw">
      <section className="nu-pw-card" aria-labelledby="nu-pw-title">
        <Ball tone="B" size={64}><Icon name="lock" size={30} sw={2.8} color="#14254F" /></Ball>
        <h1 id="nu-pw-title">{TITLE}</h1>
        <p className="nu-pw-intro">{INTRO}</p>
        <div className="nu-pw-fields">
          <TextField label={NEW_LABEL} type="password" autoComplete="new-password" value={pw} onChange={setPw} autoFocus />
          <TextField label={REPEAT_LABEL} type="password" autoComplete="new-password" value={pw2} onChange={setPw2} onEnter={() => void save()} />
        </div>
        <div className="nu-pw-go" data-must-see="save">
          <Button size="lg" wide disabled={busy} onClick={() => void save()}>{SAVE}</Button>
        </div>
        <p className="nu-pw-msg" role="alert">{msg}</p>
      </section>
    </div>
  );
}
