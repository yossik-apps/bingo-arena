import { useCallback, useEffect, useState } from "react";
import { adminRpc } from "../../lib/admin";
import { supabase } from "../../lib/supabase";

type Row = { rank: number; user_id: string; display_name: string; points: number };
type Payout = { week: string; paid_at: string; prizes: number[]; winners: { rank: number; name: string; points: number; prize: number }[] };

const mondayOf = (offsetWeeks: number) => {
  const d = new Date();
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7) - 7 * offsetWeeks);
  return x.toISOString().slice(0, 10);
};

export default function LeagueAdmin() {
  const [week, setWeek] = useState(mondayOf(1));
  const [rows, setRows] = useState<Row[]>([]);
  const [paid, setPaid] = useState<Payout[]>([]);
  const [prizes, setPrizes] = useState("200,100,50");
  const [msg, setMsg] = useState("");
  const [armed, setArmed] = useState(false);

  const load = useCallback(() => {
    adminRpc<Row[]>("league_board", { p_week: week }).then((r) => setRows(r.slice(0, 10))).catch((e) => setMsg(e.message));
    void supabase.from("league_payouts").select("week,paid_at,prizes,winners").order("week", { ascending: false }).limit(8).then(({ data }) => setPaid((data as Payout[]) ?? []));
  }, [week]);
  useEffect(load, [load]);

  const done = paid.some((p) => p.week === week);
  const pay = async () => {
    if (!armed) { setArmed(true); return; }
    setArmed(false); setMsg("");
    try {
      const list = prizes.split(",").map((x) => Math.floor(Number(x))).filter((x) => Number.isFinite(x));
      await adminRpc("admin_pay_league", { p_week: week, p_prizes: list });
      setMsg("League prizes paid."); load();
    } catch (e) { setMsg((e as Error).message); }
  };

  return (
    <div className="cols2">
      <div>
        {msg && <p className="toast" role="status">{msg}</p>}
        <h2 className="sec" style={{ marginTop: 8 }}>Pay a finished week</h2>
        <div className="box">
          <div className="fgrid">
            <label>Week (Monday, UTC)<select value={week} onChange={(e) => { setWeek(e.target.value); setArmed(false); }}>{[1, 2, 3, 4].map((w) => <option key={w} value={mondayOf(w)}>{mondayOf(w)}</option>)}</select></label>
            <label>Prizes (1st, 2nd, 3rd…)<input value={prizes} onChange={(e) => setPrizes(e.target.value)} /></label>
          </div>
          <div className="tw" style={{ margin: "10px 0" }}><table className="t"><tbody>
            {rows.length === 0 && <tr><td className="dim">Nobody scored that week.</td></tr>}
            {rows.map((r) => <tr key={r.user_id}><td>{r.rank}</td><td>{r.display_name}</td><td>{r.points} pts</td></tr>)}
          </tbody></table></div>
          <button className="btn" disabled={done || rows.length === 0} onClick={() => void pay()}>{done ? "Already paid" : armed ? "Confirm: pay prizes now" : "Pay league prizes"}</button>
          <p className="dim">Points are XP earned from scored rounds. Each week can be paid once. Banned players are excluded.</p>
        </div>
      </div>
      <div>
        <h2 className="sec" style={{ marginTop: 8 }}>Payment history</h2>
        {paid.length === 0 && <p className="dim">No weeks paid yet.</p>}
        {paid.map((p) => (
          <div className="qcard" key={p.week}>
            <div className="qtop"><b>Week of {p.week}</b><span className="dim">{new Date(p.paid_at).toLocaleDateString()}</span></div>
            {p.winners.map((w) => <p key={w.rank} className="dim" style={{ margin: "4px 0" }}>{w.rank}. {w.name} · {w.points} pts · +{w.prize} coins</p>)}
          </div>
        ))}
      </div>
    </div>
  );
}
