import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Ic } from "../lib/ui";

type Row = { id: number; amount: number; reason: string; created_at: string };

export default function Wallet({ balance }: { balance: number }) {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    void supabase.from("ledger").select("id,amount,reason,created_at").order("created_at", { ascending: false }).limit(50).then(({ data }) => setRows((data as Row[]) ?? []));
  }, [balance]);
  return (
    <div className="cols2">
      <section className="hero wal">
        <span className="eyebrow">Balance</span>
        <div className="bal"><Ic n="coin" c="coin" /><span>{balance}</span></div>
        <p>Play money. It cannot be cashed out.</p>
      </section>
      <div>
      <h2 className="sec" style={{ marginTop: 8 }}>Recent activity</h2>
      {rows.length === 0 && <p className="dim">Nothing yet. Play a round to get started.</p>}
      {rows.map((x) => {
        const c = x.amount > 0 ? "in" : "out";
        return (
          <div className="lrow" key={x.id}>
            <span className={`lic ${c}`}><Ic n={x.amount > 0 ? "up" : "down"} /></span>
            <span className="lt"><b>{x.reason}</b><span className="dim" style={{ fontSize: 13 }}>{new Date(x.created_at).toLocaleString()}</span></span>
            <b className={`v ${c}`}>{x.amount > 0 ? "+" : "−"}{Math.abs(x.amount)}</b>
          </div>
        );
      })}
      </div>
    </div>
  );
}
