import { useCallback, useEffect, useState } from "react";
import Notice from "../../lib/Notice";
import { adminRpc } from "../../lib/admin";

type Row = { id: string; world: number; idx: number; name: string; level: string; label: string | null; s1: number; s2: number; s3: number; reward_coins: number; players: number; cleared: number; three_star: number; avg_attempts: number };

export default function JourneyAdmin() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [msg, setMsg] = useState("");
  const load = useCallback(() => { adminRpc<Row[]>("admin_journey_stats").then(setRows).catch((e) => setMsg(e.message)); }, []);
  useEffect(load, [load]);
  if (!rows) return msg ? <p className="toast" role="alert">{msg}</p> : <div className="skel" />;
  const up = (id: string, p: Partial<Row>) => setRows(rows.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const save = async (r: Row) => {
    setMsg("");
    try { await adminRpc("admin_save_stage", { p_id: r.id, p_s1: r.s1, p_s2: r.s2, p_s3: r.s3, p_coins: r.reward_coins }); setMsg(`${r.name} saved.`); load(); } catch (e) { setMsg((e as Error).message); }
  };
  const num = (v: string) => Math.max(0, Math.floor(Number(v) || 0));
  return (
    <>
      <Notice text={msg} />
      <h2 className="sec" style={{ marginTop: 8 }}>Journey stages</h2>
      <div className="tw"><table className="t"><thead><tr><th>Stage</th><th>Level</th><th>Rule</th><th>Players</th><th>Cleared</th><th>3 stars</th><th>Avg tries</th><th>★ goal</th><th>★★ goal</th><th>★★★ goal</th><th>Coins</th><th></th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.id}>
            <td><b>{r.world}-{r.idx}</b> {r.name}</td><td>{r.level}</td><td>{r.label ?? "standard"}</td><td>{r.players}</td>
            <td>{r.players ? Math.round((r.cleared / r.players) * 100) + "%" : "–"}</td><td>{r.players ? Math.round((r.three_star / r.players) * 100) + "%" : "–"}</td><td>{r.avg_attempts}</td>
            <td><input aria-label="One star goal" type="number" style={{ width: 80 }} value={r.s1} onChange={(e) => up(r.id, { s1: num(e.target.value) })} /></td>
            <td><input aria-label="Two star goal" type="number" style={{ width: 80 }} value={r.s2} onChange={(e) => up(r.id, { s2: num(e.target.value) })} /></td>
            <td><input aria-label="Three star goal" type="number" style={{ width: 80 }} value={r.s3} onChange={(e) => up(r.id, { s3: num(e.target.value) })} /></td>
            <td><input aria-label="First clear coins" type="number" style={{ width: 70 }} value={r.reward_coins} onChange={(e) => up(r.id, { reward_coins: num(e.target.value) })} /></td>
            <td><button className="btn alt" style={{ minHeight: 40, padding: "6px 12px" }} onClick={() => void save(r)}>Save</button></td>
          </tr>))}</tbody></table></div>
      <p className="dim">Goals were set from a flawless reference player, so every one is reachable. If few players clear a stage or almost nobody earns 3 stars, lower its goals. If most players 3-star it on the first try, raise them. Goals must go up from one star to three. The stage boards themselves stay secret.</p>
    </>
  );
}
