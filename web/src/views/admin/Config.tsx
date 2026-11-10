import { useEffect, useState } from "react";
import Notice from "../../lib/Notice";
import { adminRpc } from "../../lib/admin";
import { parseMode, type FlagMode } from "../../lib/flags";
import { levelKeys, supabase } from "../../lib/supabase";

type Cfg = { levels: Record<string, Record<string, number | boolean>>; g: Record<string, number | boolean | string> };
const LEVEL_FIELDS: [string, string, string][] = [
  ["every", "Time per number (ms)", "1000 to 10000"], ["win", "Daubable numbers", "1 to 8"], ["pt", "Score multiplier", "0.5 to 5"],
  ["pen", "Wrong-tap penalty", "0 to 100"], ["xm", "XP multiplier", "0.5 to 5"], ["fee", "Entry fee (coins)", "0 to 1000"],
  ["gl", "Ghost base score", "0 to 3000"], ["gr", "Ghost random range", "1 to 3000"],
];
const GLOBAL_FIELDS: [string, string][] = [
  ["total", "Round length (seconds, 30 to 300)"], ["pay", "Win payout (× entry fee, 1 to 1.95)"], ["rake", "Event fee kept by platform (0 to 0.5)"],
  ["login", "Daily login bonus per streak day (0 to 200)"], ["welcome", "Registration bonus (0 to 1000)"],
];
const DEFAULTS: Cfg = {
  levels: {
    beginner: { every: 4000, win: 4, pt: 1, pen: 5, hint: false, xm: 1, fee: 10, gl: 150, gr: 100 },
    medium: { every: 3000, win: 3, pt: 1.5, pen: 8, hint: false, xm: 1.5, fee: 20, gl: 250, gr: 130 },
    hard: { every: 2200, win: 2, pt: 2, pen: 15, hint: false, xm: 2, fee: 40, gl: 380, gr: 200 },
  },
  g: { pay: 1.8, login: 10, welcome: 50, total: 100, rake: 0.1, maint: false, paid: true, pvp: true, note: "" },
};

function LinksBox() {
  const [fb, setFb] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  useEffect(() => { void supabase.from("app_links").select("facebook").eq("id", 1).maybeSingle().then(({ data, error }) => setFb(error ? "" : ((data as { facebook?: string } | null)?.facebook ?? ""))); }, []);
  const save = async () => {
    setMsg("");
    try { await adminRpc("admin_save_links", { p_facebook: (fb ?? "").trim() }); setMsg((fb ?? "").trim() ? "Saved. The “Follow us on Facebook” button now shows in the menu and in Help (not inside CrazyGames)." : "Removed. The Facebook button is hidden."); }
    catch (e) { setMsg((e as Error).message); }
  };
  return (
    <>
      <h2 className="sec">Links</h2>
      <div className="box">
        <Notice text={msg} />
        <label>Facebook page (for example https://www.facebook.com/YourPage)<input type="url" inputMode="url" placeholder="https://www.facebook.com/…" value={fb ?? ""} disabled={fb === null} onChange={(e) => setFb(e.target.value)} /></label>
        <p className="dim" style={{ margin: "6px 0" }}>Leave empty to hide the button. Inside CrazyGames the button is always hidden, because CrazyGames does not allow links to other sites.</p>
        <button className="btn" disabled={fb === null} onClick={() => void save()}>Save link</button>
      </div>
    </>
  );
}

const DESIGN_MODES: [FlagMode, string, string][] = [["off", "Off", "Everyone sees Classic"], ["admins", "Admins only", "Only signed-in admins see New"], ["all", "All", "Every player sees New"]];

function DesignBox() {
  const [mode, setMode] = useState<FlagMode | null>(null);
  const [missing, setMissing] = useState(false);
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    void supabase.from("feature_flags").select("mode").eq("key", "design_new").maybeSingle().then(({ data, error }) => {
      if (error || !data) { setMissing(true); return; }
      setMode(parseMode((data as { mode?: unknown }).mode));
    });
  }, []);
  const pick = async (m: FlagMode) => {
    if (m === mode) { setArmed(false); return; }
    if (m === "all" && !armed) { setArmed(true); setMsg(""); return; }
    setArmed(false); setBusy(true); setMsg("");
    try { await adminRpc("admin_set_flag", { p_key: "design_new", p_mode: m }); setMode(m); setMsg("Saved. Each player gets it the next time the game is loaded. Open tabs keep their design until they reload."); }
    catch (e) { setMsg((e as Error).message); }
    setBusy(false);
  };
  return (
    <>
      <h2 className="sec">Design</h2>
      <div className="box">
        <Notice text={msg} />
        <p className="dim" style={{ margin: "0 0 8px" }}>Every player now gets the new design. The game no longer reads this setting; it is kept here only as a record.</p>
        {missing ? <p className="dim" style={{ margin: 0 }}>This needs database update 023. Until then everyone sees Classic.</p> : (
          <>
            <p style={{ margin: "0 0 8px" }}>New design: <b>{DESIGN_MODES.find(([k]) => k === mode)?.[1] ?? "…"}</b></p>
            <div className="seg" role="group" aria-label="New design">
              {DESIGN_MODES.map(([k, name, desc]) => (
                <button key={k} className="lvlb" aria-pressed={mode === k} disabled={mode === null || busy} onClick={() => void pick(k)}>
                  <b>{name}</b><span className="dim">{desc}</span>
                </button>
              ))}
            </div>
            {armed && <div className="row2" role="alert" style={{ marginTop: 8 }}>
              <button className="btn" disabled={busy} onClick={() => void pick("all")}>Confirm: show to all players</button>
              <button className="btn alt" disabled={busy} onClick={() => setArmed(false)}>Cancel</button>
            </div>}
            <p className="dim" style={{ margin: "8px 0 0" }}>Screens without a new version stay Classic in every setting.</p>
          </>
        )}
      </div>
    </>
  );
}

export default function ConfigTab() {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [msg, setMsg] = useState("");
  const [armed, setArmed] = useState(false);
  useEffect(() => { void supabase.from("game_config").select("data").eq("id", 1).single().then(({ data }) => setCfg(data?.data as Cfg)); }, []);
  if (!cfg) return <div className="skel" />;

  const setL = (lv: string, f: string, v: number | boolean) => setCfg({ ...cfg, levels: { ...cfg.levels, [lv]: { ...cfg.levels[lv], [f]: v } } });
  const setG = (f: string, v: number | boolean | string) => setCfg({ ...cfg, g: { ...cfg.g, [f]: v } });
  const num = (v: string) => (v === "" ? NaN : Number(v));
  const save = async (c: Cfg) => {
    setMsg("");
    try { await adminRpc("admin_save_config", { p_data: c }); setCfg(c); setMsg("Saved. Players get the new settings the next time they start a round."); }
    catch (e) { setMsg((e as Error).message); }
  };
  const edge = Math.round((1 - Number(cfg.g.pay) * 0.5) * 100);

  return (
    <>
      <Notice text={msg} />
      <h2 className="sec" style={{ marginTop: 8 }}>Levels</h2>
      {levelKeys(cfg.levels).map((lv) => (
        <div className="box" key={lv}>
          <h2 style={{ textTransform: "capitalize" }}>{lv}</h2>
          <div className="fgrid">
            {LEVEL_FIELDS.map(([f, label, hint]) => (
              <label key={f}>{label}<input type="number" step="any" value={String(cfg.levels[lv][f])} onChange={(e) => setL(lv, f, num(e.target.value))} /><span className="dim" style={{ fontSize: 12 }}>{hint}</span></label>
            ))}
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={Boolean(cfg.levels[lv].hint)} onChange={(e) => setL(lv, "hint", e.target.checked)} /> Highlight matching squares</label>
        </div>
      ))}
      <h2 className="sec">Economy and rules</h2>
      <div className="box">
        <div className="fgrid">
          {GLOBAL_FIELDS.map(([f, label]) => <label key={f}>{label}<input type="number" step="any" value={String(cfg.g[f])} onChange={(e) => setG(f, num(e.target.value))} /></label>)}
        </div>
        <p className="dim">At a 50% win rate, vs-ghost rounds cost players about {edge}% of their entry on average. That is your expected margin.</p>
        {([["pvp", "Real-player matches enabled"], ["paid", "Paid modes enabled (ghost, events, real players)"], ["maint", "Maintenance mode (blocks all paid play)"]] as [string, string][]).map(([f, label]) => (
          <label key={f} style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={Boolean(cfg.g[f])} onChange={(e) => setG(f, e.target.checked)} /> {label}</label>
        ))}
        <label>Announcement shown on the Play tab (max 200 characters)<input maxLength={200} value={String(cfg.g.note ?? "")} onChange={(e) => setG("note", e.target.value)} /></label>
      </div>
      <button className="btn" onClick={() => void save(cfg)}>Save configuration</button>
      <button className="btn alt" onClick={() => { if (!armed) { setArmed(true); return; } setArmed(false); void save(DEFAULTS); }}>{armed ? "Confirm reset to defaults" : "Reset to defaults"}</button>
      <p className="dim">Every value is range-checked by the server. Changes never affect a round already in progress.</p>
      <DesignBox />
      <LinksBox />
    </>
  );
}
