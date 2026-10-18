import { useCallback, useEffect, useState } from "react";
import { adminRpc, dt } from "../../lib/admin";
import Notice from "../../lib/Notice";
import { price, type Product, type StoreMode } from "../../lib/store";

type Store = {
  mode: StoreMode; vault_pct: number; vault_cap: number; products: Product[]; paid_30d_cents: number; paid_all_cents: number; buyers_30d: number;
  tests: number; club_active: number; gems_total: number; by_product: { product_id: string; n: number; cents: number }[];
  recent: { created_at: string; product_id: string; price_cents: number; status: string; player: string }[];
};
type Hit = { id: string; display_name: string; email: string };
const MODES: [StoreMode, string][] = [["off", "Off: store hidden"], ["preview", "Preview: players see prices, 'Coming soon'"], ["test", "Test: admins can make free test purchases"]];

function Row({ p, onSave }: { p: Product; onSave: (p: Product) => Promise<void> }) {
  const [x, setX] = useState(p);
  useEffect(() => setX(p), [p]);
  const n = (k: keyof Product) => (e: React.ChangeEvent<HTMLInputElement>) => setX({ ...x, [k]: Math.max(0, Math.round(Number(e.target.value) || 0)) });
  return (
    <tr>
      <td><input value={x.name} onChange={(e) => setX({ ...x, name: e.target.value })} aria-label={`${p.id} name`} /><span className="dim" style={{ fontSize: 12 }}>{p.id} · {p.kind}</span></td>
      <td><input type="number" step="0.01" min={0} value={(x.price_cents / 100).toFixed(2)} onChange={(e) => setX({ ...x, price_cents: Math.round(Number(e.target.value) * 100) || 0 })} aria-label={`${p.id} price in dollars`} style={{ width: 90 }} /></td>
      <td><input type="number" min={0} value={x.coins} onChange={n("coins")} aria-label={`${p.id} coins`} style={{ width: 90 }} /></td>
      <td><input type="number" min={0} value={x.gems} onChange={n("gems")} aria-label={`${p.id} gems`} style={{ width: 70 }} /></td>
      <td><input type="number" min={0} value={x.days} onChange={n("days")} aria-label={`${p.id} days`} style={{ width: 60 }} /></td>
      <td><input value={x.badge} maxLength={30} onChange={(e) => setX({ ...x, badge: e.target.value })} aria-label={`${p.id} badge`} style={{ width: 110 }} /></td>
      <td><input type="checkbox" checked={x.active} onChange={(e) => setX({ ...x, active: e.target.checked })} aria-label={`${p.id} on sale`} /></td>
      <td><button className="btn alt" onClick={() => void onSave(x)}>Save</button></td>
    </tr>
  );
}

export default function StoreAdmin() {
  const [s, setS] = useState<Store | null>(null);
  const [msg, setMsg] = useState("");
  const [mode, setMode] = useState<StoreMode>("preview");
  const [pct, setPct] = useState(10);
  const [cap, setCap] = useState(3000);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [to, setTo] = useState<Hit | null>(null);
  const [amount, setAmount] = useState(10);
  const [reason, setReason] = useState("");
  const load = useCallback(() => {
    adminRpc<Store>("admin_store").then((d) => { setS(d); setMode(d.mode); setPct(d.vault_pct); setCap(d.vault_cap); }).catch((e) => setMsg((e as Error).message));
  }, []);
  useEffect(load, [load]);
  const save = async () => { try { await adminRpc("admin_set_store", { p_mode: mode, p_vault_pct: pct, p_vault_cap: cap }); setMsg("Store settings saved."); load(); } catch (e) { setMsg((e as Error).message); } };
  const saveProduct = async (p: Product) => {
    try { await adminRpc("admin_save_product", { p_id: p.id, p_name: p.name, p_descr: p.descr, p_price_cents: p.price_cents, p_coins: p.coins, p_gems: p.gems, p_days: p.days, p_badge: p.badge, p_active: p.active }); setMsg(`${p.name} saved.`); load(); } catch (e) { setMsg((e as Error).message); }
  };
  const search = async (v: string) => {
    setQ(v);
    if (v.trim().length < 2) { setHits([]); return; }
    try { const r = await adminRpc<{ rows: Hit[] }>("admin_players", { p_search: v, p_limit: 8, p_offset: 0 }); setHits(r.rows); } catch { /* ignore */ }
  };
  const grant = async () => {
    if (!to) return;
    try { await adminRpc("admin_grant_gems", { p_user: to.id, p_amount: amount, p_reason: reason }); setMsg(`${amount} gems given to ${to.display_name}.`); setTo(null); setQ(""); setHits([]); setReason(""); load(); } catch (e) { setMsg((e as Error).message); }
  };

  if (!s) return <><Notice text={msg} /><div className="skel" /></>;
  return (
    <div>
      <Notice text={msg} />
      <div className="kpis">
        <div className="kpi"><b>{price(s.paid_30d_cents)}</b><span>revenue, last 30 days</span></div>
        <div className="kpi"><b>{price(s.paid_all_cents)}</b><span>revenue, all time</span></div>
        <div className="kpi"><b>{s.buyers_30d}</b><span>paying players, 30 days</span></div>
        <div className="kpi"><b>{s.club_active}</b><span>Bingo Club members now</span></div>
        <div className="kpi"><b>{s.tests}</b><span>test purchases (free)</span></div>
        <div className="kpi"><b>{s.gems_total.toLocaleString()}</b><span>gems held by players</span></div>
      </div>
      <div className="cols2">
        <div className="box">
          <h2>Store mode</h2>
          {MODES.map(([k, n]) => <label key={k} style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "flex-start", margin: "6px 0" }}><input type="radio" name="smode" style={{ width: 18, height: 18, margin: 0, flex: "none" }} checked={mode === k} onChange={() => setMode(k)} /> <span>{n}</span></label>)}
          <p className="dim" style={{ fontSize: 13 }}>Live (real money) arrives with the payment provider update. Until then, nobody is ever charged.</p>
          <div className="fgrid">
            <label>Coin Vault fill (% of wins)<input type="number" min={0} max={50} value={pct} onChange={(e) => setPct(Math.round(Number(e.target.value) || 0))} /></label>
            <label>Coin Vault size (coins)<input type="number" min={0} value={cap} onChange={(e) => setCap(Math.round(Number(e.target.value) || 0))} /></label>
          </div>
          <button className="btn" onClick={() => void save()}>Save store settings</button>
        </div>
        <div className="box">
          <h2>Give gems</h2>
          {to ? <p>To: <b>{to.display_name}</b> <span className="dim">{to.email}</span> <button className="linkbtn" onClick={() => setTo(null)}>change</button></p> : (
            <>
              <label>Find the player (name or email)<input value={q} onChange={(e) => void search(e.target.value)} /></label>
              {hits.map((h) => <button key={h.id} className="lrow" style={{ width: "100%", textAlign: "left", cursor: "pointer", color: "inherit", font: "inherit" }} onClick={() => setTo(h)}><span className="lt"><b>{h.display_name}</b><span className="dim" style={{ fontSize: 13 }}>{h.email}</span></span></button>)}
            </>
          )}
          <div className="fgrid">
            <label>Gems (minus to take away)<input type="number" value={amount} onChange={(e) => setAmount(Math.round(Number(e.target.value) || 0))} /></label>
            <label>Reason<input value={reason} maxLength={80} onChange={(e) => setReason(e.target.value)} /></label>
          </div>
          <button className="btn" disabled={!to || !amount || reason.trim().length < 2} onClick={() => void grant()}>Give gems</button>
        </div>
      </div>
      <h2 className="sec">Products and prices</h2>
      <p className="dim">Prices are in US dollars. Changes show in the store at once. Untick "On sale" to hide a product.</p>
      <div className="tw"><table className="atable">
        <thead><tr><th>Name</th><th>Price $</th><th>Coins</th><th>Gems</th><th>Days</th><th>Badge</th><th>On sale</th><th /></tr></thead>
        <tbody>{s.products.map((p) => <Row key={p.id} p={p} onSave={saveProduct} />)}</tbody>
      </table></div>
      <div className="cols2">
        <div>
          <h2 className="sec">Last 30 days by product</h2>
          {s.by_product.length === 0 && <p className="dim">No purchases yet.</p>}
          {s.by_product.map((b) => <div className="lrow" key={b.product_id}><span className="lt"><b>{s.products.find((p) => p.id === b.product_id)?.name ?? b.product_id}</b><span className="dim" style={{ fontSize: 13 }}>{b.n} purchases</span></span><b>{price(b.cents)}</b></div>)}
        </div>
        <div>
          <h2 className="sec">Recent purchases</h2>
          {s.recent.length === 0 && <p className="dim">No purchases yet.</p>}
          {s.recent.map((r, i) => <div className="lrow" key={i}><span className="lt"><b>{r.player}: {s.products.find((p) => p.id === r.product_id)?.name ?? r.product_id}</b><span className="dim" style={{ fontSize: 13 }}>{dt(r.created_at)} · {r.status === "test" ? "test, free" : r.status}</span></span><b>{price(r.price_cents)}</b></div>)}
        </div>
      </div>
    </div>
  );
}
