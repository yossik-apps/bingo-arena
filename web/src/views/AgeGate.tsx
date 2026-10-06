import { useState } from "react";
import { rpcError, supabase, TERMS_VERSION } from "../lib/supabase";

export default function AgeGate({ name, updated, onDone }: { name: string; updated: boolean; onDone: () => Promise<void> }) {
  const [ok, setOk] = useState(false);
  const [msg, setMsg] = useState("");
  const go = async () => {
    const { error } = await supabase.rpc("accept_terms", { p_version: TERMS_VERSION });
    if (error) setMsg(rpcError(error)); else await onDone();
  };
  return (
    <section>
      <h1>{updated ? "We updated our terms" : `Welcome, ${name}`}</h1>
      <p>{updated ? "Please review and accept the new Terms and Privacy Policy to keep playing." : "One last step before you play."}</p>
      <div className="box">
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} style={{ marginTop: 4 }} />
          <span>I am 18 or older, and I have read and agree to the <a href="/terms.html" target="_blank" rel="noreferrer">Terms of Service</a> and the <a href="/privacy.html" target="_blank" rel="noreferrer">Privacy Policy</a>.</span>
        </label>
        <button className="btn big" disabled={!ok} onClick={() => void go()}>Continue</button>
        <p className="msg" role="alert">{msg}</p>
      </div>
      <button className="btn alt" onClick={() => void supabase.auth.signOut()}>Log out</button>
    </section>
  );
}
