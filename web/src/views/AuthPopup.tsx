import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { finishPopup } from "../lib/authRelay";

/** The small Google sign-in window opened from inside CrazyGames. It never shows the game itself. */
export default function AuthPopup({ code }: { code: string }) {
  const [state, setState] = useState<"start" | "done" | "error">("start");
  const [msg, setMsg] = useState("");
  useEffect(() => {
    let done = false;
    const finish = async () => {
      if (done) return; done = true;
      const ok = await finishPopup(code);
      setState(ok ? "done" : "error");
      if (ok) setTimeout(() => window.close(), 900);
      else setMsg("We could not pass the login back to the game. Close this window and try again, or sign up with email.");
    };
    const q = new URLSearchParams(location.search + "&" + location.hash.slice(1));
    const err = q.get("error_description") ?? q.get("error");
    if (err) { setState("error"); setMsg(/cancel|denied/i.test(err) ? "Sign-in was cancelled. You can close this window." : err.replace(/\+/g, " ")); return; }
    const { data } = supabase.auth.onAuthStateChange((_e, s) => { if (s) void finish(); });
    void supabase.auth.getSession().then(({ data: d }) => {
      if (d.session) void finish();
      else if (!q.has("code")) {
        void supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin } }).then(({ error }) => {
          if (error) { setState("error"); setMsg(error.message); }
        });
      }
    });
    return () => data.subscription.unsubscribe();
  }, [code]);
  return (
    <div className="shell"><div className="content">
      <section className="popup-auth">
        <h1>{state === "done" ? "You're signed in!" : state === "error" ? "Sign-in did not finish" : "Opening Google…"}</h1>
        <p className="dim">{state === "done" ? "Going back to the game. You can close this window if it stays open." : state === "error" ? msg : "Choose your Google account. This window closes by itself afterwards."}</p>
        {state !== "start" && <button className="btn alt" onClick={() => window.close()}>Close this window</button>}
      </section>
    </div></div>
  );
}
