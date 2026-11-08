// The sign-up, log-in and save-progress pop-up (Classic views/AuthGate.tsx and views/Auth.tsx), in the new design.
// The playground has only its save sheet, so the Google row and the gold button follow it; every word and every call is Classic's.
// Uses: auth (data.signUp, signIn, google, linkGoogle, addEmail, setPassword, markSaved, resend, resetPassword), popupSignIn, track
import { useEffect, useRef, useState } from "react";
import { Ball } from "../Ball";
import { Button, Sheet, TextField } from "../components";
import { Coin, Icon } from "../Icon";
import type { OverlayProps } from "../screens/contract";
import {
  check, consentStart, EMAIL_LABEL, FACEBOOK_NOTE, FORGOT, FORGOT_NEEDS_EMAIL, friendly, GUEST_LOG_NOTE, googleHint, googleLabel, heading, isSaving,
  NAME_HINT, NAME_LABEL, NAME_MAX, NOT_NOW, OR_EMAIL, PASSWORD_LABEL, perks, POPUP_FAILED, popupText, PRIVACY, RESEND, RESENT, RESET_SENT, returnedError,
  SENT_SPAM, SENT_TITLE, sentText, showGoogle, showText, submitLabel, switchLine, TAP, TERMS, topLine, USE_GOOGLE, validEmail,
  type Mode, type Perk, type PopupState,
} from "./Auth.logic";
import "./auth.css";

const GoogleLogo = () => (
  <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
    <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
    <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z" />
    <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
  </svg>
);
const PerkIcon = ({ icon }: { icon: Perk["icon"] }) => (icon === "coin" ? <Coin size={20} /> : <Icon name={icon} size={20} sw={2.6} />);

export default function Auth({ ctx }: OverlayProps<"auth">) {
  const { data } = ctx;
  const [mode, setMode] = useState<Mode>(ctx.mode);
  const saving = isSaving(ctx.guest, mode);
  const [name, setName] = useState(() => ctx.suggestName());
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [ticked, setTicked] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<"" | "google" | "email">("");
  const [sent, setSent] = useState(""); // the email waiting for confirmation
  const [popup, setPopup] = useState<PopupState>("");
  const stop = useRef<() => void>(() => undefined);
  useEffect(() => () => stop.current(), []);

  // Google sends errors back in the web address; show them instead of failing silently, as Classic does
  useEffect(() => {
    const err = returnedError(window.location.search, window.location.hash);
    if (err) { setMsg(err); window.history.replaceState({}, "", window.location.pathname); }
  }, []);

  const google = async () => {
    setMsg("");
    if (saving) { // a guest keeps the same account: Google is added to it
      setBusy("google"); ctx.track("signup_google");
      const r = await data.linkGoogle();
      if (r.error) { setMsg(r.error); setBusy(""); }
      return;
    }
    if (!ctx.inFrame) {
      setBusy("google"); ctx.track("signup_google");
      const r = await data.google();
      if (r.error) { setMsg(r.error); setBusy(""); }
      return;
    }
    // inside CrazyGames (or any frame) Google opens in a small window instead
    ctx.track("signup_google");
    stop.current();
    stop.current = ctx.popupSignIn((st, m) => {
      if (st === "done") { setPopup(""); return; }
      setPopup(st);
      if (st === "error") setMsg(m ? friendly(m) : POPUP_FAILED);
    });
  };

  const saveEmail = async () => {
    ctx.track("signup_email");
    const r = await data.addEmail(email);
    if (r.error) { setMsg(r.error); return; }
    if (r.confirm) { ctx.track("confirm_needed"); setSent(email.trim()); return; } // the email must be confirmed first
    const p = await data.setPassword(pw);
    if (p.error) { setMsg(p.error); return; }
    await data.markSaved();
    ctx.saved?.();
  };

  const submit = async () => {
    setMsg("");
    const problem = check({ email, password: pw, name, ticked, mode, saving, crazyGames: ctx.crazyGames });
    if (problem) { setMsg(problem); return; }
    setBusy("email");
    try {
      if (saving) await saveEmail();
      else if (mode === "reg") {
        ctx.track("signup_email");
        const r = await data.signUp({ email, password: pw, name, crazyGames: ctx.crazyGames });
        if (r.error) setMsg(r.error);
        else if (!r.session) { ctx.track("confirm_needed"); setSent(email.trim()); }
      } else {
        const r = await data.signIn(email, pw);
        if (r.error) setMsg(r.error);
      }
    } finally {
      setBusy("");
    }
  };

  const resend = async () => {
    setMsg("");
    const r = await data.resend(sent);
    setMsg(r.error ?? RESENT);
  };
  const forgot = async () => {
    if (!validEmail(email)) { setMsg(FORGOT_NEEDS_EMAIL); return; }
    const r = await data.resetPassword(email);
    setMsg(r.error ?? RESET_SENT);
  };
  const switchTo = (to: Mode) => { setMode(to); setMsg(""); };

  const title = sent ? SENT_TITLE : heading(ctx.reason, saving, mode);
  const g = googleLabel(busy === "google", saving, mode);
  const hint = googleHint(saving, mode, ctx.inFrame);
  const wait = popupText(popup);
  const sw = switchLine(saving, mode, ctx.guest);
  const reg = mode === "reg" && !saving;

  return (
    <Sheet label={title} onClose={ctx.close} closeText={NOT_NOW} tall>
      <div className="nu-au">
        <p className="nu-au-top">{topLine(ctx.guest)}</p>

        {sent ? (
          <section className="nu-au-sent" aria-labelledby="nu-au-title">
            <Ball tone="B" size={64}><Icon name="mail" size={30} sw={2.6} color="#14254F" /></Ball>
            <h1 id="nu-au-title">{SENT_TITLE}</h1>
            <p>We sent a link to <b>{sent}</b>. {sentText(ctx.guest, ctx.welcome)}</p>
            <p className="nu-au-small">{SENT_SPAM}</p>
            <div className="nu-au-pair">
              <Button kind="white" wide onClick={() => void resend()}>{RESEND}</Button>
              <Button kind="white" wide disabled={busy !== ""} onClick={() => void google()}><GoogleLogo /> {USE_GOOGLE}</Button>
            </div>
            <p className="nu-au-msg" role="alert">{msg}</p>
          </section>
        ) : (
          <section className="nu-au-main" aria-labelledby="nu-au-title">
            <header className="nu-au-head">
              <h1 id="nu-au-title">{title}</h1>
              {perks(saving, mode, ctx.welcome).length > 0 && (
                <ul className="nu-au-perks">{perks(saving, mode, ctx.welcome).map((p) => <li key={p.text}><span className="nu-au-perkicon" aria-hidden="true"><PerkIcon icon={p.icon} /></span>{p.text}</li>)}</ul>
              )}
            </header>

            {showGoogle(saving, ctx.inFrame) && (
              <div className="nu-au-google" data-should-see="google">
                <Button kind="white" size="lg" wide disabled={busy !== ""} onClick={() => void google()}>
                  <span className="nu-au-glogo"><GoogleLogo /></span>{g.text}{g.tap && <span className="nu-au-tap">{TAP}</span>}
                </Button>
              </div>
            )}
            {hint && <p className="nu-au-small">{hint}</p>}
            {ctx.guest && mode === "log" && <p className="nu-au-small">{GUEST_LOG_NOTE}</p>}
            {wait && (
              <div className="nu-au-wait" role="status">
                <b>{wait.title}</b>{wait.text && <span>{wait.text}</span>}
              </div>
            )}
            {showGoogle(saving, ctx.inFrame) && <div className="nu-au-or"><span>{OR_EMAIL}</span></div>}

            <div className="nu-au-form">
              {reg && <TextField label={NAME_LABEL} value={name} maxLength={NAME_MAX} autoComplete="nickname" hint={NAME_HINT} onChange={setName} />}
              <TextField label={EMAIL_LABEL} type="email" value={email} autoComplete="email" onChange={setEmail} />
              <div className="nu-au-pw">
                <TextField label={PASSWORD_LABEL} type={show ? "text" : "password"} value={pw} autoComplete={mode === "reg" ? "new-password" : "current-password"} onChange={setPw} onEnter={() => void submit()} />
                <button type="button" className="nu-au-show" aria-pressed={show} onClick={() => setShow(!show)}>{showText(show)}</button>
              </div>
              {reg && (
                <label className="nu-au-consent">
                  <input type="checkbox" checked={ticked} onChange={(e) => setTicked(e.target.checked)} />
                  <span>{consentStart(ctx.crazyGames)}<a href={TERMS.href} target="_blank" rel="noreferrer">{TERMS.text}</a> and <a href={PRIVACY.href} target="_blank" rel="noreferrer">{PRIVACY.text}</a></span>
                </label>
              )}
              <div data-should-see="submit">
                <Button size="lg" wide disabled={busy !== ""} onClick={() => void submit()}>{submitLabel(busy === "email", saving, mode)}</Button>
              </div>
              {mode === "log" && <button type="button" className="nu-au-link" onClick={() => void forgot()}>{FORGOT}</button>}
              <p className="nu-au-msg" role="alert">{msg}</p>
            </div>

            <p className="nu-au-switch">{sw.text} <button type="button" className="nu-au-link" onClick={() => switchTo(sw.to)}>{sw.button}</button></p>
            {mode === "log" && <p className="nu-au-small">{FACEBOOK_NOTE}</p>}
          </section>
        )}
      </div>
    </Sheet>
  );
}
