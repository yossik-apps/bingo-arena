import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { callFn, configured, errorText, supabase, type GameCfg } from "./lib/supabase";
import { Coins, Ic } from "./lib/ui";
import Auth from "./views/Auth";
import Lobby from "./views/Lobby";
import Play, { type RoundResult, type RoundStart } from "./views/Play";
import Result from "./views/Result";
import Wallet from "./views/Wallet";

type Profile = { display_name: string; xp: number; streak: number; banned: boolean; role: string };
type View = "lobby" | "play" | "result" | "wallet";
const lvl = (xp: number) => Math.floor(Math.sqrt(xp / 40)) + 1;

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [cfg, setCfg] = useState<GameCfg | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [balance, setBalance] = useState(0);
  const [view, setView] = useState<View>("lobby");
  const [round, setRound] = useState<RoundStart | null>(null);
  const [result, setResult] = useState<{ r: RoundResult; p: RoundStart["params"] } | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!configured) { setReady(true); return; }
    void supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const refresh = useCallback(async () => {
    const [{ data: c }, { data: pr }, { data: w }] = await Promise.all([
      supabase.from("game_config").select("data").eq("id", 1).single(),
      supabase.from("profiles").select("display_name,xp,streak,banned,role").single(),
      supabase.from("wallet").select("balance").maybeSingle(),
    ]);
    if (c) setCfg(c.data as GameCfg);
    if (pr) setProfile(pr as Profile);
    setBalance((w as { balance: number } | null)?.balance ?? 0);
  }, []);

  useEffect(() => {
    if (!session) { setProfile(null); return; }
    void (async () => {
      try {
        const d = await callFn<{ claimed: boolean; bonus: number; streak: number }>("daily-bonus");
        if (d.claimed) setToast(`Daily login bonus: +${d.bonus} coins (day ${d.streak} streak).`);
      } catch { /* the bonus is optional */ }
      await refresh();
    })();
  }, [session, refresh]);

  const start = async (mode: "solo" | "ghost", level: string) => {
    setError("");
    try {
      const r = await callFn<RoundStart>("start-round", { mode, level });
      setRound(r); setBalance(r.balance); setView("play");
    } catch (e) { setError(errorText((e as Error).message)); }
  };

  if (!configured) {
    return <section><h1>Almost there</h1><p>The game is not connected to its database yet. Follow <b>docs/LAUNCH_GUIDE.md</b>, step 4, to add your two Supabase keys.</p></section>;
  }
  if (!ready) return <p className="dim">Loading…</p>;
  if (!session) return <Auth />;
  if (!cfg || !profile) return <p className="dim">Loading your profile…</p>;

  const l = lvl(profile.xp), lo = 40 * (l - 1) ** 2, hi = 40 * l * l, pc = Math.round(((profile.xp - lo) / (hi - lo)) * 100);
  const inRound = view === "play";

  return (
    <>
      {!inRound && (
        <header className="appbar">
          <div className="who">
            <span className="avatar" aria-hidden="true">{profile.display_name.slice(0, 1).toUpperCase()}</span>
            <div className="wtxt">
              <b id="who">{profile.display_name}</b>
              <div className="xpline"><span className="lvb">Lv {l}</span><div className="xpbar" role="progressbar" aria-label="XP to next level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pc}><i style={{ width: `${pc}%` }} /></div></div>
              <span className="dim" style={{ fontSize: 12 }}>{profile.xp - lo} / {hi - lo} XP</span>
            </div>
          </div>
          <div className="chips">
            <span className="chip2" role="group" aria-label="Coins"><Coins n={balance} /></span>
            <span className="chip2" role="group" aria-label="Day streak"><Ic n="flame" c="fl" /><b>{profile.streak}d</b></span>
            <button className="iconbtn" aria-label="Log out" onClick={() => void supabase.auth.signOut()}><Ic n="out" /></button>
          </div>
        </header>
      )}
      {toast && !inRound && <p className="toast" role="status">{toast}</p>}
      {view === "lobby" && <Lobby cfg={cfg} balance={balance} banned={profile.banned} error={error} onStart={start} />}
      {view === "play" && round && (
        <Play round={round}
          onDone={(r, p) => { setResult({ r, p }); setBalance(r.balance); setView("result"); void refresh(); }}
          onError={(m) => { setError(m); setView("lobby"); void refresh(); }} />
      )}
      {view === "result" && result && <Result r={result.r} p={result.p} onAgain={() => setView("lobby")} />}
      {view === "wallet" && <Wallet balance={balance} />}
      {!inRound && (
        <nav className="nav" aria-label="Main">
          {([["lobby", "Play", "play"], ["wallet", "Wallet", "wallet"]] as [View, string, string][]).map(([k, n, i]) => (
            <button key={k} className={`nb ${view === k || (k === "lobby" && view === "result") ? "on" : ""}`} onClick={() => { setView(k); setToast(""); }}>
              <Ic n={i} /><span>{n}</span>
            </button>
          ))}
        </nav>
      )}
    </>
  );
}
