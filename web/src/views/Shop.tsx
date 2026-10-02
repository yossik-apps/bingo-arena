import { useEffect, useState } from "react";
import { rpcError, supabase, type Equipped, type ShopItem } from "../lib/supabase";
import { Coins, Ic } from "../lib/ui";

const CATS: [string, string][] = [["deals", "Deals"], ["dauber", "Daubers"], ["board", "Boards"], ["ball", "Balls"], ["frame", "Frames"], ["title", "Titles"], ["boost", "Boosters"]];
const OPTIONAL = ["style", "frame", "title"];
const rarity = (p: number) => (p >= 200 ? "Epic" : p >= 100 ? "Rare" : "Common");

function Preview({ it }: { it: ShopItem }) {
  if (it.slot === "theme") return <span className="swb" style={{ background: it.meta.color }} />;
  if (it.slot === "style") return <span className="pvx" style={{ background: "var(--daub)", ...it.meta.style }}>12</span>;
  if (it.slot === "board") return <span className="mini" style={{ background: it.meta.card }}>{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ background: it.meta.cell }} />)}</span>;
  if (it.slot === "ball") return <span className="pvb" style={{ background: it.meta.bg, color: it.meta.ink }}>B7</span>;
  if (it.slot === "frame") return <span className={`avatar fr-${it.key}`} style={{ width: 56, height: 56 }} aria-hidden="true">A</span>;
  if (it.slot === "title") return <span className="tag" style={{ fontSize: 14, padding: "6px 12px" }}>{it.name}</span>;
  return <span className="pvx" style={{ background: "var(--surf2)", color: "var(--ink)" }}><Ic n={it.meta.ic ?? "gift"} /></span>;
}

export default function Shop({ items, owned, boosters, equipped, balance, level, onChange }: {
  items: ShopItem[]; owned: Set<string>; boosters: Record<string, number>; equipped: Equipped; balance: number; level: number; onChange: () => Promise<void>;
}) {
  const [cat, setCat] = useState("deals");
  const [deals, setDeals] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => { void supabase.rpc("daily_deals").then(({ data }) => setDeals((data as string[]) ?? [])); }, []);

  const price = (it: ShopItem) => (deals.includes(it.id) ? Math.round(it.price * 0.75) : it.price);
  const isOwned = (it: ShopItem) => it.price === 0 || owned.has(it.id);
  const isEquipped = (it: ShopItem) => (equipped as Record<string, string>)[it.slot] === it.key;

  const run = async (id: string, fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    setBusy(id); setMsg("");
    const { error } = await fn();
    if (error) setMsg(rpcError(error)); else { setMsg(ok); await onChange(); }
    setBusy("");
  };
  const buy = (it: ShopItem) => run(it.id, () => supabase.rpc("buy_item", { p_item: it.id }), `${it.name} purchased.`);
  const equip = (it: ShopItem, on: boolean) => run(it.id, () => supabase.rpc("equip_item", { p_item: it.id, p_on: on }), on ? `${it.name} equipped.` : `${it.name} removed.`);

  const list = cat === "deals" ? deals.map((id) => items.find((i) => i.id === id)).filter(Boolean) as ShopItem[] : items.filter((i) => i.grp === cat);
  const note = cat === "deals" ? "Three items are 25% off today. They change every day."
    : cat === "boost" ? "Boosters work in solo and vs-ghost rounds only, never against real players or in events. Arm them on the Play tab."
    : cat === "frame" || cat === "title" ? "Some items unlock at higher levels." : "";

  const card = (it: ShopItem) => {
    const own = isOwned(it), eq = own && it.grp !== "boost" && isEquipped(it), pr = price(it), poor = balance < pr;
    const lock = !own && level < it.min_level, disabled = busy !== "";
    let btn;
    if (it.slot === "boost") btn = <><button className="btn" disabled={poor || disabled} onClick={() => buy(it)}>Buy <Coins n={pr} /></button><span className="dim" style={{ fontSize: 13 }}>Owned: {boosters[it.key] ?? 0}</span></>;
    else if (it.slot === "bundle") btn = own ? <button className="btn alt" disabled>Purchased</button> : <button className="btn" disabled={poor || disabled} onClick={() => buy(it)}>Buy <Coins n={pr} /></button>;
    else if (lock) btn = <button className="btn alt" disabled>Reach level {it.min_level}</button>;
    else if (!own) btn = <button className="btn" disabled={poor || disabled} onClick={() => buy(it)}>Buy <Coins n={pr} /></button>;
    else if (eq) btn = OPTIONAL.includes(it.slot) ? <button className="btn alt" disabled={disabled} onClick={() => equip(it, false)}>Unequip</button> : <button className="btn alt" disabled>Equipped</button>;
    else btn = <button className="btn alt" disabled={disabled} onClick={() => equip(it, true)}>Equip</button>;
    return (
      <div key={it.id} className={`scard ${eq ? "eq" : ""}`}>
        <Preview it={it} /><b>{it.name}</b><span className="dim" style={{ fontSize: 13 }}>{it.descr}</span>
        <span className="tag">{it.grp === "boost" ? "Booster" : rarity(it.price)}{deals.includes(it.id) && !own ? " · 25% off" : ""}</span>{btn}
      </div>
    );
  };

  return (
    <>
      <h2 className="sec" style={{ marginTop: 8 }}>Shop</h2>
      <div className="atabs" role="group" aria-label="Shop categories">
        {CATS.map(([k, n]) => <button key={k} className={`at ${cat === k ? "on" : ""}`} aria-pressed={cat === k} onClick={() => setCat(k)}>{n}</button>)}
      </div>
      {note && <p className="dim" style={{ margin: "2px 2px 10px" }}>{note}</p>}
      {msg && <p className="toast" role="status">{msg}</p>}
      <div className="sgrid">{list.map(card)}</div>
    </>
  );
}
