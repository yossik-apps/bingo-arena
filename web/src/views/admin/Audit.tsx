import { useEffect, useState } from "react";
import { dt } from "../../lib/admin";
import { supabase } from "../../lib/supabase";

type Row = { id: number; action: string; detail: unknown; created_at: string; profiles: { display_name: string } | null };

export default function AuditTab() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    void supabase.from("audit_log").select("id,action,detail,created_at,profiles(display_name)").order("created_at", { ascending: false }).limit(100)
      .then(({ data }) => setRows((data as unknown as Row[]) ?? []));
  }, []);
  if (!rows) return <div className="skel" />;
  return (
    <>
      <h2 className="sec" style={{ marginTop: 8 }}>Admin audit log</h2>
      {rows.length === 0 && <p className="dim">No admin actions recorded yet.</p>}
      {rows.map((r) => (
        <div className="lrow" key={r.id}>
          <span className="lt"><b>{r.action.replace(/_/g, " ")}</b><span className="dim" style={{ fontSize: 13, overflowWrap: "anywhere" }}>{JSON.stringify(r.detail).slice(0, 220)}</span></span>
          <span className="dim" style={{ fontSize: 13, textAlign: "right" }}>{r.profiles?.display_name ?? "system"}<br />{dt(r.created_at)}</span>
        </div>
      ))}
    </>
  );
}
