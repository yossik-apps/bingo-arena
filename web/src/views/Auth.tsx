import { useEffect, useMemo, useState } from "react";
import { supabase, TERMS_VERSION } from "../lib/supabase";
import { trackStep } from "../lib/track";

const friendly = (m: string) =>
  /error getting user email|email from external provider/i.test(m) ? "Facebook did not share an email address with the game. Allow email access for Bingo Arena in Facebook, or register with your email instead."
    : /access_denied|user denied|cancel/i.test(m) ? "Sign-in was cancelled. You can try again or use your email."
    : /bad_oauth|oauth state|flow state/i.test(m) ? "The sign-in took too long or was opened in another browser. Please try again."
    : /not enabled|unsupported provider/i.test(m) ? "This sign-in method is not switched on yet. Use email for now, or finish the setup in docs/SOCIAL_LOGIN_GUIDE.md."
    : /redirect/i.test(m) ? "Sign-in could not return to the game. The website address is missing from the allowed redirect list (see the social login guide)."
    : /already registered|already been registered/i.test(m) ? "That email is already registered. Log in instead."
    : /rate limit|too many/i.test(m) ? "Too many sign-ups right now. Please try again in a minute, or continue with Google."
    : m;

const A = ["Lucky", "Swift", "Golden", "Happy", "Sunny", "Clever", "Brave", "Cosmic", "Jolly", "Magic"];
const B = ["Star", "Ace", "Fox", "Comet", "Panda", "Tiger", "Pearl", "Rocket", "Ruby", "Owl"];
const funName = () => A[Math.floor(Math.random() * A.length)] + B[Math.floor(Math.random() * B.length)] + Math.floor(10 + Math.random() * 90);

const GoogleG = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
);

export default function Auth({ reason, startMode = "reg", welcome }: { reason?: string; startMode?: "reg" | "log"; welcome?: number } = {}) {
  const [mode, setMode] = useState<"reg" | "log">(startMode);
  const suggested = useMemo(funName, []);
  const [name, setName] = useState(suggested);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [adult, setAdult] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");
  const [sent, setSent] = useState(""); // email waiting for confirmation

  // Google/Facebook send errors back in the web address; show them instead of failing silently.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search.slice(1) + "&" + window.location.hash.slice(1));
    const err = q.get("error_description") ?? q.get("error");
    if (err) { setMsg(friendly(err.replace(/\+/g, " "))); window.history.replaceState({}, "", window.location.pathname); }
  }, []);

  const oauth = async (provider: "google") => {
    setMsg(""); setBusy(provider);
    trackStep("signup_google");
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } });
    if (error) { setMsg(friendly(error.message)); setBusy(""); }
  };

  const submit = async () => {
    setMsg("");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setMsg("Enter a valid email address.");
    if (pw.length < 8) return setMsg("Password must be at least 8 characters.");
    setBusy("email");
    if (mode === "reg") {
      if (name.trim().length < 2) { setBusy(""); return setMsg("Choose a player name (2+ characters)."); }
      if (!adult) { setBusy(""); return setMsg("Please tick the box to confirm you are 18+ and accept the Terms."); }
      trackStep("signup_email");
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: pw, options: { data: { name: name.trim(), adult: "true", terms_version: TERMS_VERSION }, emailRedirectTo: window.location.origin } });
      if (error) setMsg(friendly(error.message));
      else if (!data.session) { trackStep("confirm_needed"); setSent(email.trim()); }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
      if (error) setMsg(/confirm/i.test(error.message) ? "Please confirm your email first: open the link we sent you. Or continue with Google." : "Email or password is incorrect.");
    }
    setBusy("");
  };

  const resend = async () => {
    setMsg("");
    const { error } = await supabase.auth.resend({ type: "signup", email: sent, options: { emailRedirectTo: window.location.origin } });
    setMsg(error ? friendly(error.message) : "Sent again. Check your inbox and your spam folder.");
  };

  const forgot = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setMsg("Enter your email above first.");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    setMsg(error ? friendly(error.message) : "If that email has an account, a reset link is on its way.");
  };

  if (sent) return (
    <section className="sg-sent">
      <div className="sg-env" aria-hidden="true">✉️</div>
      <h1 id="auth-title">Almost there! Check your email</h1>
      <p>We sent a link to <b>{sent}</b>. Open it on this device to start playing{welcome ? ` and get your ${welcome} free coins` : ""}.</p>
      <p className="dim">Not there after a minute? Look in your spam or promotions folder.</p>
      <div className="row2"><button className="btn alt" onClick={() => void resend()}>Send the link again</button><button className="btn alt" disabled={busy !== ""} onClick={() => void oauth("google")}><GoogleG /> Use Google instead</button></div>
      <p className="msg" role="alert">{msg}</p>
    </section>
  );

  return (
    <section className="sg">
      <div className="sg-head">
        <h1 id="auth-title">{reason ?? (mode === "reg" ? "Create your free account" : "Welcome back")}</h1>
        {mode === "reg" && <p className="sg-perks"><span>🪙 {welcome ?? 50} free coins</span><span>🏆 Prizes every week</span><span>💾 Progress saved</span></p>}
      </div>
      <button className="btn big sg-google" disabled={busy !== ""} onClick={() => void oauth("google")}><GoogleG /> {busy === "google" ? "Opening Google…" : mode === "reg" ? <>Sign up with Google<span className="sg-tap"> · 1 tap</span></> : "Log in with Google"}</button>
      {mode === "reg" && <p className="dim sg-small">Fastest: no password to remember. You confirm you are 18+ on the next screen.</p>}
      <div className="sg-or"><span>or with email</span></div>
      <div className="sg-form">
        {mode === "reg" && <label>Player name<input value={name} maxLength={20} autoComplete="nickname" onChange={(e) => setName(e.target.value)} /><span className="dim sg-small">Shown on leaderboards. Change it any time.</span></label>}
        <label>Email<input type="email" inputMode="email" value={email} autoComplete="email" onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Password (8+ characters)
          <span className="sg-pw"><input type={show ? "text" : "password"} value={pw} autoComplete={mode === "reg" ? "new-password" : "current-password"} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void submit()} />
            <button type="button" className="linkbtn" onClick={() => setShow(!show)} aria-pressed={show}>{show ? "Hide" : "Show"}</button></span>
        </label>
        {mode === "reg" && (
          <label className="sg-check"><input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
            <span>I am 18+ and agree to the <a href="/terms.html" target="_blank" rel="noreferrer">Terms</a> and <a href="/privacy.html" target="_blank" rel="noreferrer">Privacy Policy</a></span></label>
        )}
        <button className="btn big" disabled={busy !== ""} onClick={() => void submit()}>{busy === "email" ? "One moment…" : mode === "reg" ? "Create free account" : "Log in"}</button>
        {mode === "log" && <button className="linkbtn" onClick={() => void forgot()}>Forgot password?</button>}
        <p className="msg" role="alert">{msg}</p>
      </div>
      <p className="sg-switch">{mode === "reg" ? <>Already have an account? <button className="linkbtn" onClick={() => { setMode("log"); setMsg(""); }}>Log in</button></> : <>New here? <button className="linkbtn" onClick={() => { setMode("reg"); setMsg(""); }}>Create a free account</button></>}</p>
      {mode === "log" && <p className="dim sg-small">Signed up with Facebook before? Use “Forgot password?” with the same email as your Facebook account.</p>}
    </section>
  );
}
