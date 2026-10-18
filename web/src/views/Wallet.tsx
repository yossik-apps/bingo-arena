import { useEffect, useMemo, useState } from "react";
import { me, supabase } from "../lib/supabase";
import { Ic } from "../lib/ui";
import { price, type Economy, type PurchaseRow } from "../lib/store";

type Row = { id: number; amount: number; reason: string; created_at: string };
type Filter = "all" | "in" | "out";

// an icon for each kind of coin activity, so the list can be scanned at a glance
const KINDS: [RegExp, string][] = [
  [/drill/i, "zap"], [/login|streak/i, "flame"], [/daily challenge/i, "star"], [/quest/i, "quest"],
  [/bought|shop|deal|season pass/i, "shop"], [/entry fee/i, "play"], [/refund/i, "up"],
  [/prize|league|event/i, "trophy"], [/album|stamp|pack/i, "album"], [/journey/i, "map"], [/crew/i, "users"],
  [/registration|welcome/i, "gift"], [/admin/i, "gear"],
];
const kindIcon = (r: Row) => KINDS.find(([re]) => re.test(r.reason))?.[1] ?? (r.amount > 0 ? "up" : "down");
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const dayLabel = (d: Date) => {
  const t = new Date(), y = new Date(Date.now() - 864e5);
  if (dayKey(d) === dayKey(t)) return "Today";
  if (dayKey(d) === dayKey(y)) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
};

export default function Wallet({ balance, onGo, onDrill, drillDone, econ = null, reward }: { econ?: Economy | null; reward?: React.ReactNode; balance: number; onGo?: (v: "lobby" | "collect" | "shop") => void; onDrill?: () => void; drillDone?: boolean }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(30);
  const [buys, setBuys] = useState<PurchaseRow[]>([]);
  useEffect(() => { if (econ) void supabase.rpc("my_purchases").then(({ data }) => setBuys((data as PurchaseRow[]) ?? [])); }, [econ?.gems, balance]);
  useEffect(() => {
    void supabase.from("ledger").select("id,amount,reason,created_at").eq("user_id", me.id).order("created_at", { ascending: false }).limit(300).then(({ data }) => setRows((data as Row[]) ?? []));
  }, [balance]);

  // the last 7 days: coins earned and spent per day
  const week = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, k) => { const d = new Date(Date.now() - (6 - k) * 864e5); return { key: dayKey(d), label: k === 6 ? "Today" : d.toLocaleDateString(undefined, { weekday: "short" }), earned: 0, spent: 0 }; });
    for (const r of rows ?? []) {
      const d = days.find((x) => x.key === dayKey(new Date(r.created_at)));
      if (!d) continue;
      if (r.amount > 0) d.earned += r.amount; else d.spent += -r.amount;
    }
    return days;
  }, [rows]);
  const earned = week.reduce((a, d) => a + d.earned, 0), spent = week.reduce((a, d) => a + d.spent, 0);
  const top = Math.max(1, ...week.map((d) => Math.max(d.earned, d.spent)));

  const list = (rows ?? []).filter((r) => filter === "all" || (filter === "in" ? r.amount > 0 : r.amount < 0));
  const groups: { label: string; net: number; items: Row[] }[] = [];
  for (const r of list.slice(0, shown)) {
    const d = new Date(r.created_at), label = dayLabel(d);
    const g = groups[groups.length - 1];
    if (g && g.label === label) { g.items.push(r); g.net += r.amount; } else groups.push({ label, net: r.amount, items: [r] });
  }

  return (
    <div className="cols2 wal2">
      <div>
        <section className="hero wal">
          <span className="eyebrow">Balance</span>
          <div className="bal"><Ic n="coin" c="coin" /><span>{balance.toLocaleString()}</span></div>
          <p className="wal-note">Play money. It cannot be cashed out.</p>
          {econ && <div className="wal-gems"><Ic n="gem" /><b>{econ.gems.toLocaleString()}</b><span>gems</span></div>}
        </section>

        <div className="wal-kpis">
          <div className="kpi"><span>Earned, 7 days</span><b className="in">+{earned.toLocaleString()}</b></div>
          <div className="kpi"><span>Spent, 7 days</span><b className="out">−{spent.toLocaleString()}</b></div>
          <div className="kpi"><span>Net</span><b className={earned - spent >= 0 ? "in" : "out"}>{earned - spent >= 0 ? "+" : "−"}{Math.abs(earned - spent).toLocaleString()}</b></div>
        </div>

        <div className="box wal-chart">
          <div className="wal-ch-top"><h2>Last 7 days</h2><span className="wal-legend"><i className="in" />Earned <i className="out" />Spent</span></div>
          <div className="wal-bars" role="img" aria-label={`Coins per day, last 7 days: ${week.map((d) => `${d.label} earned ${d.earned}, spent ${d.spent}`).join("; ")}`}>
            {week.map((d) => (
              <div className="wal-day" key={d.key} title={`${d.label}: +${d.earned} earned, −${d.spent} spent`}>
                <div className="wal-up"><i style={{ height: `${(d.earned / top) * 100}%` }} /></div>
                <div className="wal-dn"><i style={{ height: `${(d.spent / top) * 100}%` }} /></div>
                <span>{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        {buys.length > 0 && (
          <div className="box wal-earn">
            <h2>Purchases</h2>
            {buys.slice(0, 8).map((b) => (
              <div className="wal-row wal-buy" key={b.id}>
                <span className="lt"><b>{b.name}</b><span className="dim">{new Date(b.created_at).toLocaleDateString()}{b.status === "test" ? " · test, not charged" : b.status === "refunded" ? " · refunded" : ""}</span></span>
                <b className="v">{price(b.price_cents)}</b>
              </div>
            ))}
          </div>
        )}
        {onGo && (
          <div className="box wal-earn">
            <h2>Ways to earn coins</h2>
            {reward}
            {onDrill && <button className="lrow wal-way" onClick={onDrill}><span className="lic in"><Ic n="zap" /></span><span className="lt"><b>Today's drill</b><span className="dim">{drillDone ? "Done today. Back tomorrow for more." : "60 seconds, +20 coins"}</span></span><Ic n="play" /></button>}
            <button className="lrow wal-way" onClick={() => onGo("lobby")}><span className="lic in"><Ic n="star" /></span><span className="lt"><b>Daily Challenge</b><span className="dim">Coins for bronze, silver and gold</span></span><Ic n="play" /></button>
            <button className="lrow wal-way" onClick={() => onGo("collect")}><span className="lic in"><Ic n="quest" /></span><span className="lt"><b>Daily quests</b><span className="dim">Three goals, each with a reward</span></span><Ic n="play" /></button>
          </div>
        )}
      </div>

      <div>
        <div className="wal-head">
          <h2 className="sec" style={{ margin: 0 }}>Recent activity</h2>
          <div className="atabs wal-tabs" role="group" aria-label="Filter activity">
            {([["all", "All"], ["in", "Earned"], ["out", "Spent"]] as const).map(([k, n]) => <button key={k} className={`at ${filter === k ? "on" : ""}`} aria-pressed={filter === k} onClick={() => { setFilter(k); setShown(30); }}>{n}</button>)}
          </div>
        </div>
        {rows === null && <><div className="skel" /><div className="skel" /></>}
        {rows && list.length === 0 && <p className="dim">{filter === "out" ? "You have not spent any coins yet." : "Nothing yet. Play a round to get started."}</p>}
        {groups.map((g) => (
          <section key={g.label} className="wal-group" aria-label={g.label}>
            <div className="wal-gh"><span>{g.label}</span><b className={g.net >= 0 ? "in" : "out"}>{g.net >= 0 ? "+" : "−"}{Math.abs(g.net)}</b></div>
            <div className="wal-list">
              {g.items.map((x) => {
                const c = x.amount > 0 ? "in" : "out";
                return (
                  <div className="wal-row" key={x.id}>
                    <span className={`lic ${c}`}><Ic n={kindIcon(x)} /></span>
                    <span className="lt"><b>{x.reason}</b><span className="dim">{new Date(x.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span></span>
                    <b className={`v ${c}`}>{x.amount > 0 ? "+" : "−"}{Math.abs(x.amount)}</b>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        {list.length > shown && <button className="btn alt" style={{ width: "100%" }} onClick={() => setShown(shown + 30)}>Show more</button>}
      </div>
    </div>
  );
}
