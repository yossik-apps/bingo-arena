import { useCallback, useEffect, useState } from "react";
import { adminRpc } from "../../lib/admin";
import Notice from "../../lib/Notice";

type Row = { id: string; name: string; tag: string; descr: string; open: boolean; members: number; leader: string | null; points: number };
const mondayOf = (w: number) => { const d = new Date(); const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7) - 7 * w); return x.toISOString().slice(0, 10); };

export default function CrewsAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [week, setWeek] = useState(mondayOf(1));
  const [prizes, setPrizes] = useState("100,60,30");
  const [armed, setArmed] = useState("");
  const [msg, setMsg] = useState("");
  const load = useCallback(() => { adminRpc<Row[]>("admin_crews").then(setRows).catch((e) => setMsg(e.message)); }, []);
  useEffect(load, [load]);
  const run = async (fn: () => Promise<unknown>, ok: string) => { setMsg(""); try { await fn(); setMsg(ok); setArmed(""); load(); } catch (e) { setMsg((e as Error).message); } };

  return (
    <div className="cols2">
      <div>
        <Notice text={msg} />
        <h2 className="sec" style={{ marginTop: 8 }}>All crews ({rows.length})</h2>
        {rows.length === 0 && <p className="dim">No crews yet.</p>}
        {rows.map((c) => (
          <div className="qcard" key={c.id}>
            <div className="qtop"><b>{c.name} <span className="tag">{c.tag}</span></b><span className="dim">{c.members}/20 · {c.points} XP this week</span></div>
            <p className="dim" style={{ margin: "4px 0" }}>Leader: {c.leader ?? "none"} · {c.open ? "open" : "invite-only"}{c.descr ? ` · ${c.descr}` : ""}</p>
            <div className="row2">
              <input aria-label={`New name for ${c.name}`} placeholder="Rename to…" maxLength={20} style={{ flex: 2, minWidth: 140 }} value={names[c.id] ?? ""} onChange={(e) => setNames({ ...names, [c.id]: e.target.value })} />
              <button className="btn alt" disabled={!(names[c.id] ?? "").trim()} onClick={() => void run(() => adminRpc("admin_rename_crew", { p_crew: c.id, p_name: names[c.id] }), "Crew renamed.")}>Rename</button>
              <button className="btn alt" onClick={() => (armed === c.id ? void run(() => adminRpc("admin_delete_crew", { p_crew: c.id }), "Crew deleted.") : setArmed(c.id))}>{armed === c.id ? "Confirm delete" : "Delete"}</button>
            </div>
          </div>
        ))}
      </div>
      <div>
        <h2 className="sec" style={{ marginTop: 8 }}>Pay weekly crew prizes</h2>
        <div className="box">
          <div className="fgrid">
            <label>Week (Monday, UTC)<select value={week} onChange={(e) => setWeek(e.target.value)}>{[1, 2, 3, 4].map((w) => <option key={w} value={mondayOf(w)}>{mondayOf(w)}</option>)}</select></label>
            <label>Prize per member (1st, 2nd, 3rd crew)<input value={prizes} onChange={(e) => setPrizes(e.target.value)} /></label>
          </div>
          <button className="btn" onClick={() => void run(() => adminRpc("admin_pay_crews", { p_week: week, p_prizes: prizes.split(",").map((x) => Math.floor(Number(x))).filter((x) => Number.isFinite(x)) }), "Crew prizes paid.")}>Pay crew prizes</button>
          <p className="dim">The top crews of a finished week are paid, and each member who earned at least 20 XP that week gets the prize. A week can be paid once.</p>
        </div>
      </div>
    </div>
  );
}
