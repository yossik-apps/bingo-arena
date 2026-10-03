import { useCallback, useEffect, useState } from "react";
import { adminRpc, pct } from "../../lib/admin";

type Day = { d: string; n: number };
type Overview = {
  players: number; new7: number; active1: number; active7: number; banned: number; rounds: number; rejected: number;
  coins: number; fees: number; prizes: number; signups: Day[]; rounds_daily: Day[];
  by_mode: { mode: string; level: string; n: number; wins: number; avg_score: number; fees: number; prizes: number }[];
};
const MODE: Record<string, string> = { solo: "Alone", ghost: "Vs ghost", pvp: "Vs player", tour: "Event" };

function Bars({ data, label }: { data: Day[]; label: string }) {
  const mx = Math.max(1, ...data.map((x) => x.n));
  return (
    <div className="box">
      <div className="col" role="img" aria-label={`${label}: ${data.map((x) => x.n).join(", ")}`}>
        {data.map((x) => <i key={x.d} style={{ height: `${(x.n / mx) * 100}%` }} title={`${x.d}: ${x.n}`} />)}
      </div>
      <div className="col" style={{ height: "auto", marginTop: 4 }}>
        {data.map((x) => <span key={x.d} className="dim" style={{ flex: 1, textAlign: "center", fontSize: 11 }}>{x.d.slice(8)}<br /><b style={{ color: "var(--ink)" }}>{x.n}</b></span>)}
      </div>
    </div>
  );
}

export default function OverviewTab() {
  const [o, setO] = useState<Overview | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => { setErr(""); adminRpc<Overview>("admin_overview").then(setO).catch((e) => setErr(e.message)); }, []);
  useEffect(load, [load]);
  if (err) return <p className="toast" role="alert">{err}</p>;
  if (!o) return <div className="skel" />;
  const take = o.fees - o.prizes;
  const kp: [string, string | number][] = [
    ["Players", o.players], ["New (7 days)", o.new7], ["Active (24 h)", o.active1], ["Active (7 days)", o.active7],
    ["Rounds played", o.rounds], ["Rounds rejected", o.rejected], ["Coins in circulation", o.coins], ["Entry fees collected", o.fees],
    ["Prizes paid", o.prizes], ["Platform take", take], ["Take rate", pct(take, o.fees)], ["Suspended players", o.banned],
  ];
  return (
    <>
      <div className="kpis">{kp.map(([n, v]) => <div className="kpi" key={n}><b>{v}</b><span>{n}</span></div>)}</div>
      <h2 className="sec">New players, last 14 days</h2><Bars data={o.signups} label="New players per day" />
      <h2 className="sec">Rounds played, last 14 days</h2><Bars data={o.rounds_daily} label="Rounds per day" />
      <h2 className="sec">By mode and level</h2>
      <div className="tw"><table className="t"><thead><tr><th>Mode</th><th>Level</th><th>Rounds</th><th>Win rate</th><th>Avg score</th><th>Fees in</th><th>Prizes out</th></tr></thead>
        <tbody>{o.by_mode.length === 0 && <tr><td colSpan={7} className="dim">No rounds yet.</td></tr>}
          {o.by_mode.map((m) => <tr key={m.mode + m.level}><td>{MODE[m.mode] ?? m.mode}</td><td>{m.level}</td><td>{m.n}</td><td>{pct(m.wins, m.n)}</td><td>{m.avg_score}</td><td>{m.fees}</td><td>{m.prizes}</td></tr>)}</tbody></table></div>
      <p className="dim">All coins are play money. “Rounds rejected” are failed anti-cheat checks, abandoned or expired rounds.</p>
      <button className="btn alt" onClick={load}>Refresh</button>
    </>
  );
}
