import { useEffect, useState } from "react";
import { callFn, errorText, supabase, type MasteryRow } from "../lib/supabase";
import type { Settings } from "../lib/settings";
import { Ic } from "../lib/ui";
import Radar from "../lib/Radar";
import ShareBar from "../lib/ShareBar";
import { DRILL_NAMES, MIN_ROUNDS, SKILLS, SKILL_INFO, todaysDrill, type Dna } from "../lib/dna";

const LEVEL: Record<string, string> = { beginner: "Beginner", medium: "Medium", hard: "Hard" };
const RANK_COLOR: Record<string, string> = { bronze: "#d6965a", silver: "#cbd5e1", gold: "#fbbf24", platinum: "#7dd3fc", diamond: "#a78bfa", legend: "#f472b6" };
const rankColor = (name: string) => RANK_COLOR[name.toLowerCase().split(" ")[0]] ?? "#8b84b8";

export default function Profile({ name, level, title, xpText, xpPct, xpLeft, balance, frame, streak, shields, dailyDone, settings, onSettings, minutes, onReplay, onContact, onHelp, dna, played, drillDone, onDrill }: {
  name: string; level: number; title?: string; xpText: string; xpPct: number; xpLeft: number; balance: number; frame?: string; streak: number; shields: number; dailyDone: number;
  settings: Settings; onSettings: (s: Settings) => void; minutes: number; onReplay: () => void; onContact: () => void; onHelp?: () => void;
  dna: Dna | null; played: number; drillDone: boolean; onDrill: () => void;
}) {
  const [tab, setTab] = useState<"stats" | "settings">(() => { try { return sessionStorage.getItem("ba_ptab") === "settings" ? "settings" : "stats"; } catch { return "stats"; } });
  const pick = (t: "stats" | "settings") => { setTab(t); try { sessionStorage.setItem("ba_ptab", t); } catch { /* ignore */ } };
  const [mastery, setMastery] = useState<MasteryRow[] | null>(null);
  const [email, setEmail] = useState("");
  const [share, setShare] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [delOpen, setDelOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => { void supabase.rpc("mastery").then(({ data }) => setMastery((data as MasteryRow[]) ?? [])); }, []);
  useEffect(() => { void supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? "")); }, []);

  const changePassword = async () => {
    setPwMsg("");
    if (pw.length < 8) return setPwMsg("The password must be at least 8 characters.");
    if (pw !== pw2) return setPwMsg("The two passwords do not match.");
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) setPwMsg(error.message); else { setPw(""); setPw2(""); setPwOpen(false); setPwMsg("Your password was changed."); }
  };
  const remove = async () => {
    setMsg("");
    try { await callFn("delete-account", { confirm }); await supabase.auth.signOut(); }
    catch (e) { setMsg(errorText((e as Error).message)); }
  };
  const drill = todaysDrill(dna);
  const toShield = shields >= 2 ? 0 : 5 - (dailyDone % 5);

  return (
    <div className="pf">
      <section className="pf-hero" aria-label="Your profile">
        <span className={`avatar pf-av ${frame ? "fr-" + frame : ""}`} aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
        <div className="pf-who">
          <div className="pf-name"><h1>{name}</h1><span className="pf-lv">Level {level}</span>{dna?.style && <span className="pf-tag">{dna.style.name}</span>}{title && <span className="pf-tag">{title}</span>}</div>
          <div className="pf-xp">
            <div className="pf-xpbar" role="progressbar" aria-label="XP to next level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={xpPct}><i style={{ width: `${xpPct}%` }} /></div>
            <span>{xpText} · {xpLeft} to level {level + 1}</span>
          </div>
        </div>
        <div className="pf-facts">
          <div><b>{dna ? dna.overall : "–"}</b><span>DNA score</span></div>
          <div><b>{streak} {streak === 1 ? "day" : "days"}</b><span>login streak</span></div>
          <div><b>{balance.toLocaleString()}</b><span>coins</span></div>
        </div>
      </section>

      <div className="pf-tabs" role="tablist" aria-label="Profile sections">
        <button role="tab" aria-selected={tab === "stats"} className={tab === "stats" ? "on" : ""} onClick={() => pick("stats")}>My stats</button>
        <button role="tab" aria-selected={tab === "settings"} className={tab === "settings" ? "on" : ""} onClick={() => pick("settings")}>Settings</button>
      </div>

      {tab === "stats" ? (
        <div className="pf-grid">
          <section className="pf-card pf-dna" aria-label="Your Bingo DNA">
            <div className="pf-head">
              <div>
                <h2>Your Bingo DNA</h2>
                <span className="dim">{dna ? <>From your last {dna.rounds} rounds{dna.trend !== null ? <> · <span className={dna.trend >= 0 ? "pf-up" : "pf-down"}>{dna.trend >= 0 ? `up ${dna.trend}` : `down ${-dna.trend}`}</span> since last week</> : ""}</> : "Six skills from your last rounds"}</span>
              </div>
              {dna?.style && <button className="pf-btn" onClick={() => setShare(!share)} aria-expanded={share}><Ic n="share" />Share</button>}
            </div>
            {share && dna?.style && <ShareBar title="Share your play style" text={`My Bingo DNA says I'm a ${dna.style.name} in Bingo Arena. What are you?`} link={window.location.origin} />}
            {!dna ? (
              <div className="pf-empty">
                <p>Play {Math.max(1, MIN_ROUNDS - played)} more round{MIN_ROUNDS - played === 1 ? "" : "s"} to see your six skills: Speed, Accuracy, Awareness, Combo, Lines and Pressure.</p>
                <div className="pf-bar"><i style={{ width: `${(Math.min(played, MIN_ROUNDS) / MIN_ROUNDS) * 100}%` }} /></div>
              </div>
            ) : (
              <>
                <div className="pf-dnabody">
                  <div className="pf-radar"><Radar dna={dna} size={250} /></div>
                  <div className="pf-skills">
                    {SKILLS.map((k) => (
                      <div key={k} className={`pf-sk ${dna.weakest === k ? "weak" : ""}`} title={SKILL_INFO[k].what}>
                        <span>{SKILL_INFO[k].name}{dna.weakest === k ? " · weakest" : ""}</span>
                        <div className="pf-bar" role="progressbar" aria-label={SKILL_INFO[k].name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={dna.skills[k] ?? 0}><i style={{ width: `${dna.skills[k] ?? 0}%` }} /></div>
                        <b>{dna.skills[k] ?? "?"}</b>
                      </div>
                    ))}
                    {dna.skills.pressure === null && <span className="dim pf-note">Pressure appears after a Hard round or a fast stage.</span>}
                  </div>
                </div>
                {dna.weakest && (
                  <div className="pf-weak">
                    <div><b>Weakest: {SKILL_INFO[dna.weakest].name}</b><span>{SKILL_INFO[dna.weakest].tip}</span></div>
                    <button className="btn" onClick={onDrill}>Train: {DRILL_NAMES[drill]} · 60 s</button>
                  </div>
                )}
                <span className="dim pf-note">{drillDone ? "You did today's drill. You can train again; the coins come back tomorrow." : "Your first drill each day gives 20 coins."}</span>
              </>
            )}
          </section>

          <div className="pf-side">
            <section className="pf-card" aria-label="Mastery ranks">
              <div className="pf-head"><h2>Mastery ranks</h2><span className="dim">Best score per level</span></div>
              {!mastery && <div className="skel" />}
              {mastery && mastery.length === 0 && <p className="dim">Play Practice or Beat the Ghost to earn your first rank.</p>}
              {(mastery ?? []).map((m) => {
                const c = rankColor(m.name), pct = m.next_min ? Math.min(100, (m.best / m.next_min) * 100) : 100;
                return (
                  <div className="pf-rank" key={m.level}>
                    <span className="pf-medal" style={{ background: c }} aria-hidden="true"><Ic n="medal" /></span>
                    <div className="pf-rk">
                      <div><b>{LEVEL[m.level] ?? m.level} · {m.name}</b><span className="dim">{m.next_min ? `${m.best} / ${m.next_min}` : `Best ${m.best}`}</span></div>
                      <div className="pf-bar" role="progressbar" aria-label={`${LEVEL[m.level] ?? m.level} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}><i style={{ width: `${pct}%`, background: c }} /></div>
                    </div>
                    <span className="dim pf-next">{m.next_name ? `${m.next_name} next` : "Top rank"}</span>
                  </div>
                );
              })}
            </section>

            <section className="pf-card" aria-label="Streaks">
              <h2>Streaks</h2>
              <div className="pf-tiles">
                <div><Ic n="flame" c="fl" /><b>{streak}</b><span>days logged in</span></div>
                <div><Ic n="shield" c="pf-sh" /><b>{shields} / 2</b><span>Streak Shields</span></div>
                <div><Ic n="star" c="pf-st" /><b>{dailyDone}</b><span>Daily Challenges</span></div>
              </div>
              <div className="pf-shield">
                <div><span>Next Streak Shield</span><span>{toShield ? `${toShield} more Daily Challenge${toShield === 1 ? "" : "s"}` : "Shields full"}</span></div>
                <div className="pf-bar"><i style={{ width: `${shields >= 2 ? 100 : ((dailyDone % 5) / 5) * 100}%` }} /></div>
                <span className="dim pf-note">A shield saves your login streak if you miss one day.</span>
              </div>
            </section>
          </div>
        </div>
      ) : (
        <div className="pf-grid pf-set">
          <section className="pf-card" aria-label="Play settings">
            <h2>Play settings</h2>
            <div className="pf-row">
              <div><label htmlFor="pf-brk">Break reminder</label><span>A gentle nudge to rest</span></div>
              <select id="pf-brk" value={settings.pulse} onChange={(e) => onSettings({ ...settings, pulse: Number(e.target.value) })}>
                <option value={0}>Off</option><option value={30}>Every 30 min</option><option value={45}>Every 45 min</option><option value={60}>Every 60 min</option>
              </select>
            </div>
            <div className="pf-row">
              <div><label htmlFor="pf-lim">Daily time limit</label><span>Played today: {minutes} min on this device</span></div>
              <select id="pf-lim" value={settings.limit} onChange={(e) => onSettings({ ...settings, limit: Number(e.target.value) })}>
                <option value={0}>No limit</option><option value={30}>30 minutes</option><option value={60}>1 hour</option><option value={90}>1.5 hours</option><option value={120}>2 hours</option>
              </select>
            </div>
            <div className="pf-row">
              <div><span className="pf-l">Helpful tips</span><span>Short hints in your first rounds</span></div>
              <button role="switch" aria-checked={settings.tips} aria-label="Helpful tips" className={`pf-sw ${settings.tips ? "on" : ""}`} onClick={() => onSettings({ ...settings, tips: !settings.tips })}><i /></button>
            </div>
            <div className="pf-row">
              <div><span className="pf-l">Larger text</span><span>Easier to read everywhere</span></div>
              <button role="switch" aria-checked={settings.bigText} aria-label="Larger text" className={`pf-sw ${settings.bigText ? "on" : ""}`} onClick={() => onSettings({ ...settings, bigText: !settings.bigText })}><i /></button>
            </div>
            <div className="pf-row">
              <div><label htmlFor="pf-coach">Coach's name</label><span>Gives you tips after each round</span></div>
              <input id="pf-coach" maxLength={24} value={settings.coach} onChange={(e) => onSettings({ ...settings, coach: e.target.value })} onBlur={() => { if (!settings.coach.trim()) onSettings({ ...settings, coach: "Coach Nova" }); }} />
            </div>
            <div className="pf-row">
              <div><span className="pf-l">Intro tour</span><span>See how the game works again</span></div>
              <button className="pf-btn" onClick={onReplay}>Show again</button>
            </div>
            <p className="dim pf-note">When you reach your daily limit, new rounds pause until tomorrow.</p>
          </section>

          <section className="pf-card" aria-label="Account">
            <h2>Account</h2>
            {email && <div className="pf-row"><div><span className="pf-l">Email</span><span className="pf-mail">{email}</span></div></div>}
            <div className="pf-row">
              <div><span className="pf-l">Password</span><span>{pwMsg && !pwOpen ? pwMsg : "••••••••"}</span></div>
              <button className="pf-btn" onClick={() => { setPwOpen(!pwOpen); setPwMsg(""); }} aria-expanded={pwOpen}>{pwOpen ? "Cancel" : "Change"}</button>
            </div>
            {pwOpen && (
              <div className="pf-pw">
                <label>New password (8+ characters)<input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
                <label>Repeat it<input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
                {pwMsg && <p className="pf-err" role="alert">{pwMsg}</p>}
                <button className="btn" onClick={() => void changePassword()}>Save new password</button>
              </div>
            )}
            <button className="pf-link" onClick={onContact}><span>Contact us</span><Ic n="next" /></button>
            {onHelp && <button className="pf-link" onClick={onHelp}><span>Help and guide</span><Ic n="next" /></button>}
            <button className="pf-link" onClick={() => void supabase.auth.signOut()}><span>Log out</span><Ic n="out" /></button>
            <div className="pf-row pf-foot">
              <span className="dim"><a href="/terms.html" target="_blank" rel="noreferrer">Terms of Service</a> · <a href="/privacy.html" target="_blank" rel="noreferrer">Privacy Policy</a></span>
              <button className="pf-danger" onClick={() => setDelOpen(!delOpen)} aria-expanded={delOpen}>Delete account</button>
            </div>
            {delOpen && (
              <div className="pf-pw">
                <p className="dim" style={{ margin: 0 }}>This permanently deletes your account, coins, items and progress. It cannot be undone. Type <b>DELETE</b> to confirm.</p>
                <label>Confirmation<input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" /></label>
                {msg && <p className="pf-err" role="alert">{msg}</p>}
                <button className="btn pf-delbtn" disabled={confirm !== "DELETE"} onClick={() => void remove()}>Delete everything</button>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
