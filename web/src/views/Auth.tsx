import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Auth() {
  const [mode, setMode] = useState<"reg" | "log">("reg");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [adult, setAdult] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const oauth = async (provider: "google" | "facebook") => {
    setMsg("");
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } });
    if (error) setMsg(error.message);
  };

  const submit = async () => {
    setMsg("");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setMsg("Enter a valid email address.");
    if (pw.length < 8) return setMsg("Password must be at least 8 characters.");
    setBusy(true);
    if (mode === "reg") {
      if (name.trim().length < 2) { setBusy(false); return setMsg("Choose a display name (2+ characters)."); }
      if (!adult) { setBusy(false); return setMsg("You must confirm you are 18+ and accept the Terms."); }
      const { data, error } = await supabase.auth.signUp({ email, password: pw, options: { data: { name: name.trim() } } });
      if (error) setMsg(error.message);
      else if (!data.session) setMsg("Check your email to confirm your account, then log in.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) setMsg("Email or password is incorrect.");
    }
    setBusy(false);
  };

  return (
    <section>
      <h1>Bingo Arena</h1>
      <p>Create an account to save your level, coins and streak.</p>
      <div className="atabs" role="group" aria-label="Account">
        <button className={`at ${mode === "reg" ? "on" : ""}`} onClick={() => setMode("reg")}>Register</button>
        <button className={`at ${mode === "log" ? "on" : ""}`} onClick={() => setMode("log")}>Log in</button>
      </div>
      <div className="box">
        <button className="btn alt big" style={{ marginBottom: 8 }} onClick={() => oauth("google")}><b style={{ color: "#4285f4" }}>G</b> Continue with Google</button>
        <button className="btn big" style={{ background: "#1877f2" }} onClick={() => oauth("facebook")}><b>f</b> Continue with Facebook</button>
        <p className="dim" style={{ textAlign: "center" }}>or use email</p>
        {mode === "reg" && <label>Display name<input value={name} maxLength={20} autoComplete="nickname" onChange={(e) => setName(e.target.value)} /></label>}
        <label>Email<input type="email" value={email} autoComplete="email" onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Password (8+ characters)<input type="password" value={pw} autoComplete={mode === "reg" ? "new-password" : "current-password"} onChange={(e) => setPw(e.target.value)} /></label>
        {mode === "reg" && (
          <label><input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} /> I am 18+ and agree to the Terms and Privacy Policy</label>
        )}
        <button className="btn big" disabled={busy} onClick={submit}>{mode === "reg" ? "Create account" : "Log in"}</button>
      </div>
      <p className="msg" role="alert">{msg}</p>
    </section>
  );
}
