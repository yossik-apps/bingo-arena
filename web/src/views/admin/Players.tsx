import { useCallback, useEffect, useState } from "react";
import { adminRpc, csvCell, dt, pct } from "../../lib/admin";

type Row = { id: string; display_name: string; email: string; role: string; xp: number; played: number; wins: number; banned: boolean; created_at: string; last_seen: string; balance: number };
type Detail = {
  profile: Row & { streak: number };
  stats: { mode: string; level: string; n: number; wins: number; avg_score: number }[];
  rounds: { mode: string; level: string; status: string; score: number | null; prize: number | null; fee: number; started_at: string }[];
  ledger: { amount: number; reason: string; created_at: string }[];
};
const PAGE = 25;
const lvl = (xp: number) => Math.floor(Math.sqrt(xp / 40)) + 1;

export default function PlayersTab() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<{ total: number; rows: Row[] } | null>(null);
  const [sel, setSel] = useState<Detail | null>(null);
  const [amount, setAmount] = useState("50");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    adminRpc<{ total: number; rows: Row[] }>("admin_players", { p_search: q, p_limit: PAGE, p_offset: page * PAGE }).then(setData).catch((e) => setMsg(e.message));
  }, [q, page]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const open = (id: string) => adminRpc<Detail>("admin_player_detail", { p_user: id }).then(setSel).catch((e) => setMsg(e.message));
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setMsg("");
    try { await fn(); setMsg(ok); if (sel) await open(sel.profile.id); load(); } catch (e) { setMsg((e as Error).message); }
  };
  const exportCsv = async () => {
    const all = await adminRpc<{ rows: Row[] }>("admin_players", { p_search: "", p_limit: 1000, p_offset: 0 });
    const head = ["name", "email", "level", "xp", "coins", "rounds", "wins", "suspended", "joined", "last_seen"];
    const lines = [head.map(csvCell).join(",")].concat(all.rows.map((r) => [r.display_name, r.email, lvl(r.xp), r.xp, r.balance, r.played, r.wins, r.banned, r.created_at, r.last_seen].map(csvCell).join(",")));
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "bingo-arena-players.csv"; a.click(); URL.revokeObjectURL(url);
  };

  const p = sel?.profile;
  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ flex: 1, minWidth: 200, margin: 0 }}>Search by name or email<input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} /></label>
        <button className="btn alt" onClick={() => void exportCsv()}>Export CSV</button>
      </div>
      {msg && <p className="toast" role="status">{msg}</p>}
      <div className="tw" style={{ marginTop: 10 }}>
        <table className="t"><thead><tr><th>Player</th><th>Email</th><th>Lv</th><th>Coins</th><th>Rounds</th><th>Win rate</th><th>Last seen</th><th></th></tr></thead>
          <tbody>{(data?.rows ?? []).map((r) => (
            <tr key={r.id}><td><b>{r.display_name}</b> {r.role === "admin" && <span className="tag">admin</span>} {r.banned && <span className="tag warn">Suspended</span>}</td>
              <td>{r.email}</td><td>{lvl(r.xp)}</td><td>{r.balance}</td><td>{r.played}</td><td>{pct(r.wins, r.played)}</td><td>{dt(r.last_seen)}</td>
              <td><button className="btn alt" style={{ minHeight: 40, padding: "6px 12px" }} onClick={() => void open(r.id)}>Manage</button></td></tr>
          ))}{data && data.rows.length === 0 && <tr><td colSpan={8} className="dim">No players found.</td></tr>}</tbody></table>
      </div>
      <div className="row2" style={{ marginTop: 8, alignItems: "center" }}>
        <button className="btn alt" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
        <span className="dim" style={{ textAlign: "center" }}>{data ? `${data.total} players · page ${page + 1}` : ""}</span>
        <button className="btn alt" disabled={!data || (page + 1) * PAGE >= data.total} onClick={() => setPage(page + 1)}>Next</button>
      </div>

      {sel && p && (
        <div className="box" style={{ marginTop: 14 }}>
          <h2>{p.display_name} {p.banned && <span className="tag warn">Suspended</span>}</h2>
          <p className="dim">{p.email} · joined {dt(p.created_at)} · last seen {dt(p.last_seen)} · level {lvl(p.xp)} ({p.xp} XP) · streak {p.streak} · <b>{p.balance} coins</b></p>
          <div className="fgrid">
            <label>Coins (negative deducts)<input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
            <label>Reason<input maxLength={60} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Shown in the player's wallet" /></label>
          </div>
          <div style={{ marginTop: 10 }}>
            <button className="btn" onClick={() => void act(() => adminRpc("admin_adjust_coins", { p_user: p.id, p_amount: Math.trunc(Number(amount)), p_reason: reason }), "Coins updated.")}>Apply coins</button>
            <button className="btn alt" onClick={() => void act(() => adminRpc("admin_set_banned", { p_user: p.id, p_banned: !p.banned }), p.banned ? "Player reinstated." : "Player suspended.")}>{p.banned ? "Reinstate player" : "Suspend player"}</button>
            <button className="btn alt" onClick={() => setSel(null)}>Close</button>
          </div>
          <h2 className="sec">Stats</h2>
          <div className="tw"><table className="t"><thead><tr><th>Mode</th><th>Level</th><th>Rounds</th><th>Win rate</th><th>Avg score</th></tr></thead>
            <tbody>{sel.stats.map((s) => <tr key={s.mode + s.level}><td>{s.mode}</td><td>{s.level}</td><td>{s.n}</td><td>{pct(s.wins, s.n)}</td><td>{s.avg_score}</td></tr>)}{sel.stats.length === 0 && <tr><td colSpan={5} className="dim">No rounds yet.</td></tr>}</tbody></table></div>
          <h2 className="sec">Recent rounds</h2>
          <div className="tw"><table className="t"><thead><tr><th>When</th><th>Mode</th><th>Level</th><th>Status</th><th>Score</th><th>Fee</th><th>Prize</th></tr></thead>
            <tbody>{sel.rounds.map((r, i) => <tr key={i}><td>{dt(r.started_at)}</td><td>{r.mode}</td><td>{r.level}</td><td>{r.status}</td><td>{r.score ?? "–"}</td><td>{r.fee}</td><td>{r.prize ?? "–"}</td></tr>)}</tbody></table></div>
          <h2 className="sec">Recent wallet activity</h2>
          <div className="tw"><table className="t"><tbody>{sel.ledger.map((l, i) => <tr key={i}><td>{dt(l.created_at)}</td><td>{l.reason}</td><td style={{ color: l.amount > 0 ? "var(--ok)" : "var(--warn)" }}><b>{l.amount > 0 ? "+" : "−"}{Math.abs(l.amount)}</b></td></tr>)}</tbody></table></div>
        </div>
      )}
    </>
  );
}
