import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function SetPassword({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setMsg("");
    if (pw.length < 8) return setMsg("Password must be at least 8 characters.");
    if (pw !== pw2) return setMsg("The two passwords do not match.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) setMsg(error.message); else onDone();
  };

  return (
    <section>
      <h1>Choose a new password</h1>
      <p>Pick a new password for your account.</p>
      <div className="box">
        <label>New password (8+ characters)<input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        <label>Repeat new password<input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void save()} /></label>
        <button className="btn big" disabled={busy} onClick={() => void save()}>Save new password</button>
        <p className="msg" role="alert">{msg}</p>
      </div>
    </section>
  );
}
