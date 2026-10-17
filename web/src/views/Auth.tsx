import { useEffect, useState } from "react";
import { supabase, TERMS_VERSION } from "../lib/supabase";

const friendly = (m: string) =>
  /error getting user email|email from external provider/i.test(m) ? "Facebook did not share an email address with the game. Allow email access for Bingo Arena in Facebook, or register with your email instead."
    : /access_denied|user denied|cancel/i.test(m) ? "Sign-in was cancelled. You can try again or use your email."
    : /bad_oauth|oauth state|flow state/i.test(m) ? "The sign-in took too long or was opened in another browser. Please try again."
    : /not enabled|unsupported provider/i.test(m) ? "This sign-in method is not switched on yet. Use email for now, or finish the setup in docs/SOCIAL_LOGIN_GUIDE.md."
    : /redirect/i.test(m) ? "Sign-in could not return to the game. The website address is missing from the allowed redirect list (see the social login guide)."
    : /already registered|already been registered/i.test(m) ? "That email is already registered. Try logging in."
    : m;

export default function Auth({ reason, startMode = "reg" }: { reason?: string; startMode?: "reg" | "log" } = {}) {
  const [mode, setMode] = useState<"reg" | "log">(startMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [adult, setAdult] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");

  // Google/Facebook send errors back in the web address; show them instead of failing silently.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search.slice(1) + "&" + window.location.hash.slice(1));
    const err = q.get("error_description") ?? q.get("error");
    if (err) { setMsg(friendly(err.replace(/\+/g, " "))); window.history.replaceState({}, "", window.location.pathname); }
  }, []);

  const oauth = async (provider: "google") => {
    setMsg(""); setBusy(provider);
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } });
    if (error) { setMsg(friendly(error.message)); setBusy(""); }
  };

  const submit = async () => {
    setMsg("");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setMsg("Enter a valid email address.");
    if (pw.length < 8) return setMsg("Password must be at least 8 characters.");
    setBusy("email");
    if (mode === "reg") {
      if (name.trim().length < 2) { setBusy(""); return setMsg("Choose a display name (2+ characters)."); }
      if (!adult) { setBusy(""); return setMsg("You must confirm you are 18+ and accept the Terms."); }
      const { data, error } = await supabase.auth.signUp({ email, password: pw, options: { data: { name: name.trim(), adult: "true", terms_version: TERMS_VERSION }, emailRedirectTo: window.location.origin } });
      if (error) setMsg(friendly(error.message));
      else if (!data.session) setMsg("Check your email to confirm your account, then log in.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) setMsg("Email or password is incorrect.");
    }
    setBusy("");
  };

  const forgot = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setMsg("Enter your email above first.");
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    setMsg(error ? friendly(error.message) : "If that email has an account, a reset link is on its way.");
  };

  return (
    <section className="auth-grid">
      <div>
        {reason ? (
          <>
            <h1 id="auth-title" style={{ fontSize: 26, lineHeight: 1.25 }}>{reason}</h1>
            <p>It is free and takes about 30 seconds. You get free coins to start, and your level, stars and streak are saved.</p>
          </>
        ) : (
          <>
            <h1 id="auth-title">Bingo Arena</h1>
            <p>Skill-based bingo. Create an account to save your level, coins and streak.</p>
          </>
        )}
        <div className="atabs" role="group" aria-label="Account">
          <button className={`at ${mode === "reg" ? "on" : ""}`} onClick={() => setMode("reg")}>Register</button>
          <button className={`at ${mode === "log" ? "on" : ""}`} onClick={() => setMode("log")}>Log in</button>
        </div>
        <button className="btn alt big" style={{ marginBottom: 8 }} disabled={busy !== ""} onClick={() => void oauth("google")}><b style={{ color: "#4285f4" }}>G</b> {busy === "google" ? "Opening Google…" : "Continue with Google"}</button>
        <p className="dim" style={{ fontSize: 13 }}>New with Google? You will confirm you are 18+ on the next screen.</p>
        {mode === "log" && <p className="dim" style={{ fontSize: 13 }}>Signed up with Facebook before? Log in with your email: press "Forgot password?" below and use the same email address as your Facebook account.</p>}
      </div>
      <div className="box">
        <p className="dim" style={{ marginTop: 0, textAlign: "center" }}>or use your email</p>
        {mode === "reg" && <label>Display name<input value={name} maxLength={20} autoComplete="nickname" onChange={(e) => setName(e.target.value)} /></label>}
        <label>Email<input type="email" value={email} autoComplete="email" onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Password (8+ characters)<input type="password" value={pw} autoComplete={mode === "reg" ? "new-password" : "current-password"} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void submit()} /></label>
        {mode === "reg" && (
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}><input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} style={{ marginTop: 4 }} />
            <span>I am 18+ and agree to the <a href="/terms.html" target="_blank" rel="noreferrer">Terms</a> and <a href="/privacy.html" target="_blank" rel="noreferrer">Privacy Policy</a></span></label>
        )}
        <button className="btn big" disabled={busy !== ""} onClick={() => void submit()}>{mode === "reg" ? "Create account" : "Log in"}</button>
        {mode === "log" && <button className="btn alt" style={{ marginTop: 8 }} onClick={() => void forgot()}>Forgot password?</button>}
        <p className="msg" role="alert">{msg}</p>
      </div>
    </section>
  );
}
