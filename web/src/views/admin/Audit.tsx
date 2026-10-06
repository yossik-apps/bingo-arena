import { useEffect, useState } from "react";
import { adminRpc, dt } from "../../lib/admin";

type Row = { id: number; action: string; detail: unknown; created_at: string; actor: string | null };

export default function AuditTab() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { adminRpc<Row[]>("admin_audit", { p_limit: 100 }).then(setRows).catch((e) => setErr(e.message)); }, []);
  if (err) return <p className="toast" role="alert">{err}</p>;
  if (!rows) return <div className="skel" />;
  return (
    <>
      <h2 className="sec" style={{ marginTop: 8 }}>Admin audit log</h2>
      {rows.length === 0 && <p className="dim">No admin actions recorded yet.</p>}
      {rows.map((r) => (
        <div className="lrow" key={r.id}>
          <span className="lt"><b>{r.action.replace(/_/g, " ")}</b><span className="dim" style={{ fontSize: 13, overflowWrap: "anywhere" }}>{JSON.stringify(r.detail).slice(0, 220)}</span></span>
          <span className="dim" style={{ fontSize: 13, textAlign: "right" }}>{r.actor ?? "system"}<br />{dt(r.created_at)}</span>
        </div>
      ))}
    </>
  );
}
