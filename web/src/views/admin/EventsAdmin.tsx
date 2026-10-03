import { useCallback, useEffect, useState } from "react";
import { adminRpc, dt } from "../../lib/admin";

type Ev = {
  id: string; name: string; descr: string; level: string; fee: number; attempts: number; starts_at: string; ends_at: string;
  bonus: number; split: number[]; status: "draft" | "live" | "ended"; pool: number | null; finalized_at: string | null;
  players: number; attempts_used?: number; est_pool: number;
} & Record<string, unknown>;
type Board = { rank: number; display_name: string; best: number; attempts: number }[];

const toLocal = (iso: string) => { const d = new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 6e4); return d.toISOString().slice(0, 16); };
const inHours = (h: number) => toLocal(new Date(Date.now() + h * 36e5).toISOString());
const blank = () => ({ id: "", name: "", descr: "", level: "medium", fee: "10", attempts: "3", starts: inHours(0), ends: inHours(24 * 7), bonus: "0", split: "50,30,20" });

export default function EventsTab() {
  const [list, setList] = useState<Ev[]>([]);
  const [f, setF] = useState(blank());
  const [msg, setMsg] = useState("");
  const [armed, setArmed] = useState("");
  const [boards, setBoards] = useState<Record<string, Board>>({});

  const load = useCallback(() => { adminRpc<Ev[]>("admin_events").then(setList).catch((e) => setMsg(e.message)); }, []);
  useEffect(load, [load]);

  const run = async (fn: () => Promise<unknown>, ok: string) => { setMsg(""); try { await fn(); setMsg(ok); setArmed(""); load(); } catch (e) { setMsg((e as Error).message); } };

  const save = () => {
    const split = f.split.split(",").map((x) => Math.floor(Number(x))).filter((x) => x > 0);
    return run(async () => {
      await adminRpc("admin_save_event", {
        p_id: f.id || null, p_name: f.name, p_descr: f.descr, p_level: f.level, p_fee: Math.floor(Number(f.fee)), p_attempts: Math.floor(Number(f.attempts)),
        p_starts: new Date(f.starts).toISOString(), p_ends: new Date(f.ends).toISOString(), p_bonus: Math.floor(Number(f.bonus)), p_split: split,
      });
      setF(blank());
    }, f.id ? "Event updated." : "Event created as a draft. Publish it when you are ready.");
  };
  const edit = (e: Ev) => { setF({ id: e.id, name: e.name, descr: e.descr, level: e.level, fee: String(e.fee), attempts: String(e.attempts), starts: toLocal(e.starts_at), ends: toLocal(e.ends_at), bonus: String(e.bonus), split: e.split.join(",") }); window.scrollTo(0, 0); };
  const board = async (id: string) => { const b = await adminRpc<Board>("event_leaderboard", { p_event: id }); setBoards({ ...boards, [id]: b }); };
  const set = (k: keyof ReturnType<typeof blank>, v: string) => setF({ ...f, [k]: v });

  return (
    <>
      {msg && <p className="toast" role="status">{msg}</p>}
      <div className="box">
        <h2>{f.id ? "Edit event" : "New event"}</h2>
        <div className="fgrid">
          <label>Name<input maxLength={60} value={f.name} onChange={(e) => set("name", e.target.value)} /></label>
          <label>Level<select value={f.level} onChange={(e) => set("level", e.target.value)}><option value="beginner">Beginner</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
          <label>Entry fee (coins)<input type="number" min={0} value={f.fee} onChange={(e) => set("fee", e.target.value)} /></label>
          <label>Attempts per player<input type="number" min={1} max={20} value={f.attempts} onChange={(e) => set("attempts", e.target.value)} /></label>
          <label>Starts<input type="datetime-local" value={f.starts} onChange={(e) => set("starts", e.target.value)} /></label>
          <label>Ends<input type="datetime-local" value={f.ends} onChange={(e) => set("ends", e.target.value)} /></label>
          <label>Bonus prize pool (coins)<input type="number" min={0} value={f.bonus} onChange={(e) => set("bonus", e.target.value)} /></label>
          <label>Prize split % (1st, 2nd, 3rd…)<input value={f.split} onChange={(e) => set("split", e.target.value)} /></label>
        </div>
        <label>Description<input maxLength={160} value={f.descr} onChange={(e) => set("descr", e.target.value)} /></label>
        <button className="btn" onClick={() => void save()}>{f.id ? "Save changes" : "Create event"}</button>
        {f.id && <button className="btn alt" onClick={() => setF(blank())}>Cancel edit</button>}
        <p className="dim">The prize pool is your bonus plus entry fees minus the platform fee set in Config. Prizes are paid automatically when you press “Finalize and pay”.</p>
      </div>

      <h2 className="sec">All events</h2>
      {list.length === 0 && <p className="dim">No events yet. Create the first one above.</p>}
      {list.map((e) => (
        <div className="qcard" key={e.id}>
          <div className="qtop"><b>{e.name}</b><span className={`tag ${e.status === "live" ? "ok" : ""}`}>{e.status}</span></div>
          <p className="dim" style={{ margin: "6px 0" }}>{e.level} · entry {e.fee} · {e.attempts} attempts · {dt(e.starts_at)} to {dt(e.ends_at)}</p>
          <p className="dim" style={{ margin: "6px 0" }}>{e.players} players · estimated pool {e.status === "ended" ? e.pool : e.est_pool} coins · split {e.split.join("/")}%{e.finalized_at ? ` · paid out ${dt(e.finalized_at)}` : ""}</p>
          {boards[e.id] && (
            <div className="tw" style={{ margin: "8px 0" }}><table className="t"><tbody>
              {boards[e.id].length === 0 && <tr><td className="dim">No scores yet.</td></tr>}
              {boards[e.id].slice(0, 10).map((r) => <tr key={r.rank}><td>{r.rank}</td><td>{r.display_name}</td><td>{r.best}</td><td className="dim">{r.attempts} attempts</td></tr>)}
            </tbody></table></div>
          )}
          <div className="row2">
            <button className="btn alt" onClick={() => void board(e.id)}>Leaderboard</button>
            {e.status !== "ended" && <button className="btn alt" onClick={() => edit(e)}>Edit</button>}
            {e.status !== "ended" && <button className="btn alt" onClick={() => void run(() => adminRpc("admin_set_event_status", { p_id: e.id, p_status: e.status === "live" ? "draft" : "live" }), e.status === "live" ? "Event unpublished." : "Event published.")}>{e.status === "live" ? "Unpublish" : "Publish"}</button>}
            {e.status !== "ended" && <button className="btn" onClick={() => armed === "f" + e.id ? void run(() => adminRpc("admin_finalize_event", { p_id: e.id }), "Event finalized and prizes paid.") : setArmed("f" + e.id)}>{armed === "f" + e.id ? "Confirm: pay prizes now" : "Finalize and pay"}</button>}
            <button className="btn alt" onClick={() => armed === "d" + e.id ? void run(() => adminRpc("admin_delete_event", { p_id: e.id }), "Event deleted.") : setArmed("d" + e.id)}>{armed === "d" + e.id ? "Confirm delete" : "Delete"}</button>
          </div>
        </div>
      ))}
    </>
  );
}
