import { useEffect, useState } from "react";
import { callFn, errorText, supabase, type MasteryRow } from "../lib/supabase";
import type { Settings } from "../lib/settings";
import { Ic } from "../lib/ui";
import DnaCard from "./DnaCard";
import type { Dna } from "../lib/dna";

const LEVEL: Record<string, string> = { beginner: "Beginner", medium: "Medium", hard: "Hard" };

export default function Profile({ name, level, title, xpText, streak, shields, dailyDone, settings, onSettings, minutes, onReplay, onContact, onHelp, dna, played, drillDone, onDrill }: {
  name: string; level: number; title?: string; xpText: string; streak: number; shields: number; dailyDone: number;
  settings: Settings; onSettings: (s: Settings) => void; minutes: number; onReplay: () => void; onContact: () => void; onHelp?: () => void;
  dna: Dna | null; played: number; drillDone: boolean; onDrill: () => void;
}) {
  const [mastery, setMastery] = useState<MasteryRow[] | null>(null);
  const [msg, setMsg] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [delOpen, setDelOpen] = useState(false);
  useEffect(() => { void supabase.rpc("mastery").then(({ data }) => setMastery((data as MasteryRow[]) ?? [])); }, []);

  const changePassword = async () => {
    setPwMsg("");
    if (pw.length < 8) return setPwMsg("The password must be at least 8 characters.");
    if (pw !== pw2) return setPwMsg("The two passwords do not match.");
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) setPwMsg(error.message); else { setPw(""); setPw2(""); setPwMsg("Your password was changed."); }
  };
  const remove = async () => {
    setMsg("");
    try { await callFn("delete-account", { confirm }); await supabase.auth.signOut(); }
    catch (e) { setMsg(errorText((e as Error).message)); }
  };

  return (
    <div className="cols2">
      <div>
        <section className="hero" style={{ marginTop: 0 }}>
          <span className="eyebrow">Your profile</span>
          <h2>{name}</h2>
          <p>Level {level}{title ? ` · ${title}` : ""} · {xpText}</p>
        </section>
        <DnaCard dna={dna} played={played} drillDone={drillDone} onDrill={onDrill} />
        <h2 className="sec">Mastery ranks</h2>
        <p className="dim" style={{ margin: "0 2px 8px" }}>Your best score on each level (not Journey or Daily), from Bronze up to Legend.</p>
        {!mastery && <div className="skel" />}
        {(mastery ?? []).map((m) => (
          <div className="qcard" key={m.level}>
            <div className="qtop"><b>{LEVEL[m.level] ?? m.level}</b><span className="tag">{m.name}</span></div>
            <div className="prog" role="progressbar" aria-label={`${LEVEL[m.level]} progress`} aria-valuemin={0} aria-valuemax={m.next_min ?? m.best} aria-valuenow={m.best}><i style={{ width: `${m.next_min ? Math.min(100, (m.best / m.next_min) * 100) : 100}%` }} /></div>
            <span className="dim">Best {m.best}{m.next_name ? ` · ${m.next_min} for ${m.next_name}` : " · top rank reached"}</span>
          </div>
        ))}
        <h2 className="sec">Streaks</h2>
        <div className="kpis">
          <div className="kpi"><b>{streak}</b><span>login streak (days)</span></div>
          <div className="kpi"><b>{dailyDone}</b><span>daily challenges done</span></div>
          <div className="kpi"><b><Ic n="shield" /> {shields}/2</b><span>Streak Shields</span></div>
        </div>
        <p className="dim">A Streak Shield saves your login streak if you miss one day. You earn one for every 5 Daily Challenges you finish.</p>
      </div>
      <div>
        <h2 className="sec" style={{ marginTop: 8 }}>Healthy play</h2>
        <div className="box">
          <p className="dim" style={{ marginTop: 0 }}>You have played <b>{minutes} min</b> today on this device.</p>
          <div className="fgrid">
            <label>Break reminder<select value={settings.pulse} onChange={(e) => onSettings({ ...settings, pulse: Number(e.target.value) })}>
              <option value={0}>Off</option><option value={30}>Every 30 minutes</option><option value={45}>Every 45 minutes</option><option value={60}>Every 60 minutes</option></select></label>
            <label>Daily time limit<select value={settings.limit} onChange={(e) => onSettings({ ...settings, limit: Number(e.target.value) })}>
              <option value={0}>No limit</option><option value={30}>30 minutes</option><option value={60}>1 hour</option><option value={90}>1.5 hours</option><option value={120}>2 hours</option></select></label>
          </div>
          <p className="dim" style={{ marginBottom: 0 }}>When you reach your limit, new rounds are paused until tomorrow.</p>
          <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}><input type="checkbox" checked={settings.tips} onChange={(e) => onSettings({ ...settings, tips: e.target.checked })} /> Show helpful tips in my first rounds</label>
          <label style={{ display: "flex", gap: 10, alignItems: "center" }}><input type="checkbox" checked={settings.bigText} onChange={(e) => onSettings({ ...settings, bigText: e.target.checked })} /> Larger text</label>
          <label>Your coach's name<input maxLength={24} value={settings.coach} onChange={(e) => onSettings({ ...settings, coach: e.target.value })} onBlur={() => { if (!settings.coach.trim()) onSettings({ ...settings, coach: "Coach Nova" }); }} /></label>
          <button className="btn alt" style={{ marginTop: 8 }} onClick={onReplay}>Show the intro tour again</button>
        </div>
        <h2 className="sec">Your account</h2>
        <div className="box">
          <h2>Password</h2>
          {pwMsg && <p className="toast" role="status">{pwMsg}</p>}
          <label>New password (8+ characters)<input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
          <label>Repeat it<input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
          <button className="btn alt" onClick={() => void changePassword()}>Change password</button>
          <button className="btn alt" onClick={onContact}>Contact us</button>
          {onHelp && <button className="btn alt" onClick={onHelp}>Help and guide</button>}
          <button className="btn alt" onClick={() => void supabase.auth.signOut()}>Log out</button>
        </div>
        <h2 className="sec">Your data</h2>
        <div className="box">
          {msg && <p className="toast" role="status">{msg}</p>}
                    <button className="btn alt" onClick={() => setDelOpen(!delOpen)}>Delete my account</button>
          {delOpen && (
            <div style={{ marginTop: 8 }}>
              <p className="dim">This permanently deletes your account, coins, items and progress. It cannot be undone. Type <b>DELETE</b> to confirm.</p>
              <label>Confirmation<input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" /></label>
              <button className="btn" disabled={confirm !== "DELETE"} onClick={() => void remove()}>Delete everything</button>
            </div>
          )}
          <p className="dim" style={{ marginBottom: 0 }}><a href="/terms.html" target="_blank" rel="noreferrer">Terms of Service</a> · <a href="/privacy.html" target="_blank" rel="noreferrer">Privacy Policy</a></p>
        </div>
      </div>
    </div>
  );
}
