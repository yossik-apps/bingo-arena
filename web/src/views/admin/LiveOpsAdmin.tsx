import { useCallback, useEffect, useState } from "react";
import { adminRpc, dt } from "../../lib/admin";
import Notice from "../../lib/Notice";
import { OP_LABEL, opText } from "../../lib/time";
import type { LiveOp } from "../../lib/supabase";

const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
const inH = (h: number) => local(new Date(Date.now() + h * 36e5));
const blank = () => ({ id: "", kind: "xp_boost", title: "", descr: "", starts: inH(0), ends: inH(1), mult: "2", pct: "50", active: true });
const PRESETS: [string, Partial<ReturnType<typeof blank>>][] = [
  ["Lucky Hour (2x XP, 1 hour)", { kind: "xp_boost", title: "Lucky Hour", descr: "Double XP on every round.", mult: "2", ends: inH(1) }],
  ["Weekend boost (1.5x XP, 2 days)", { kind: "xp_boost", title: "Weekend boost", descr: "1.5x XP all weekend.", mult: "1.5", ends: inH(48) }],
  ["Coin rush (2x prizes, 3 hours)", { kind: "coin_boost", title: "Coin rush", descr: "Double coin prizes in Practice and Beat the Ghost.", mult: "2", ends: inH(3) }],
  ["Happy entries (50% off, 3 hours)", { kind: "fee_discount", title: "Happy entries", descr: "Half-price entry for Beat the Ghost.", pct: "50", ends: inH(3) }],
  ["Announcement (1 day)", { kind: "banner", title: "News", descr: "", ends: inH(24) }],
];

export default function LiveOpsAdmin() {
  const [list, setList] = useState<LiveOp[]>([]);
  const [f, setF] = useState(blank());
  const [msg, setMsg] = useState("");
  const [armed, setArmed] = useState("");
  const load = useCallback(() => { adminRpc<LiveOp[]>("admin_liveops").then(setList).catch((e) => setMsg(e.message)); }, []);
  useEffect(load, [load]);
  const set = (k: keyof ReturnType<typeof blank>, v: string | boolean) => setF({ ...f, [k]: v });

  const save = async () => {
    setMsg("");
    try {
      await adminRpc("admin_save_liveop", {
        p_id: f.id || null, p_kind: f.kind, p_title: f.title, p_descr: f.descr, p_starts: new Date(f.starts).toISOString(), p_ends: new Date(f.ends).toISOString(),
        p_mult: Number(f.mult) || 1, p_pct: Math.floor(Number(f.pct)) || 0, p_active: f.active,
      });
      setMsg(f.id ? "Event updated." : "Event scheduled. Players see it in the Calendar, and the boost switches on by itself at the start time."); setF(blank()); load();
    } catch (e) { setMsg((e as Error).message); }
  };
  const edit = (o: LiveOp) => { setF({ id: o.id, kind: o.kind, title: o.title, descr: o.descr, starts: local(new Date(o.starts_at)), ends: local(new Date(o.ends_at)), mult: String(o.mult), pct: String(o.pct), active: o.active }); window.scrollTo(0, 0); };
  const del = async (id: string) => {
    if (armed !== id) { setArmed(id); return; }
    setArmed("");
    try { await adminRpc("admin_delete_liveop", { p_id: id }); setMsg("Event deleted."); load(); } catch (e) { setMsg((e as Error).message); }
  };
  const status = (o: LiveOp) => !o.active ? "Off" : Date.now() < new Date(o.starts_at).getTime() ? "Scheduled" : Date.now() < new Date(o.ends_at).getTime() ? "Live" : "Ended";
  const boost = f.kind === "xp_boost" || f.kind === "coin_boost";

  return (
    <div className="cols2">
      <div>
        <Notice text={msg} />
        <h2 className="sec" style={{ marginTop: 8 }}>Quick start</h2>
        <div className="row2" style={{ marginBottom: 8 }}>{PRESETS.map(([n, p]) => <button key={n} className="btn alt" style={{ minHeight: 40, fontSize: 14 }} onClick={() => setF({ ...blank(), ...p })}>{n}</button>)}</div>
        <div className="box">
          <h2>{f.id ? "Edit event" : "New event"}</h2>
          <div className="fgrid">
            <label>Type<select value={f.kind} onChange={(e) => set("kind", e.target.value)}>{Object.entries(OP_LABEL).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
            <label>Title<input maxLength={60} value={f.title} onChange={(e) => set("title", e.target.value)} /></label>
            <label>Starts<input type="datetime-local" value={f.starts} onChange={(e) => set("starts", e.target.value)} /></label>
            <label>Ends<input type="datetime-local" value={f.ends} onChange={(e) => set("ends", e.target.value)} /></label>
            {boost && <label>Multiplier (1.1 to 5)<input type="number" step="0.1" min="1.1" max="5" value={f.mult} onChange={(e) => set("mult", e.target.value)} /></label>}
            {f.kind === "fee_discount" && <label>Discount percent (5 to 90)<input type="number" min="5" max="90" value={f.pct} onChange={(e) => set("pct", e.target.value)} /></label>}
          </div>
          <label>Message for players<input maxLength={160} value={f.descr} onChange={(e) => set("descr", e.target.value)} /></label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} /> Switched on</label>
          <button className="btn" onClick={() => void save()}>{f.id ? "Save changes" : "Schedule event"}</button>
          {f.id && <button className="btn alt" onClick={() => setF(blank())}>Cancel edit</button>}
          <p className="dim">Times are in your local time. Boosts do not stack: if two overlap, players get the stronger one. XP boosts also raise league, crew and season progress.</p>
        </div>
      </div>
      <div>
        <h2 className="sec" style={{ marginTop: 8 }}>Calendar</h2>
        {list.length === 0 && <p className="dim">Nothing scheduled yet.</p>}
        {list.map((o) => (
          <div className="qcard" key={o.id}>
            <div className="qtop"><b>{o.title}</b><span className={`tag ${status(o) === "Live" ? "ok" : ""}`}>{status(o)}</span></div>
            <p className="dim" style={{ margin: "4px 0" }}>{OP_LABEL[o.kind]}{opText(o) ? ` · ${opText(o)}` : ""}<br />{dt(o.starts_at)} to {dt(o.ends_at)}</p>
            <div className="row2"><button className="btn alt" onClick={() => edit(o)}>Edit</button><button className="btn alt" onClick={() => void del(o.id)}>{armed === o.id ? "Confirm delete" : "Delete"}</button></div>
          </div>
        ))}
      </div>
    </div>
  );
}
