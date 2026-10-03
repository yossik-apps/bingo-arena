import { useEffect, useState } from "react";
import { adminRpc } from "../../lib/admin";
import { supabase } from "../../lib/supabase";

type Item = { id: string; name: string; descr: string; price: number; min_level: number; active: boolean; grp: string };
type Mission = { id: string; label: string; goal: number; reward: number; active: boolean };

export default function CatalogTab() {
  const [items, setItems] = useState<Item[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [msg, setMsg] = useState("");
  const load = () => {
    void supabase.from("shop_items").select("id,name,descr,price,min_level,active,grp").order("sort").then(({ data }) => setItems((data as Item[]) ?? []));
    void supabase.from("mission_defs").select("id,label,goal,reward,active").order("id").then(({ data }) => setMissions((data as Mission[]) ?? []));
  };
  useEffect(load, []);
  const run = async (fn: () => Promise<unknown>, ok: string) => { setMsg(""); try { await fn(); setMsg(ok); load(); } catch (e) { setMsg((e as Error).message); } };
  const upI = (id: string, p: Partial<Item>) => setItems(items.map((i) => (i.id === id ? { ...i, ...p } : i)));
  const upM = (id: string, p: Partial<Mission>) => setMissions(missions.map((m) => (m.id === id ? { ...m, ...p } : m)));

  return (
    <>
      {msg && <p className="toast" role="status">{msg}</p>}
      <h2 className="sec" style={{ marginTop: 8 }}>Shop items</h2>
      <div className="tw"><table className="t"><thead><tr><th>Item</th><th>Group</th><th>Price</th><th>Min level</th><th>Active</th><th></th></tr></thead>
        <tbody>{items.map((i) => (
          <tr key={i.id}>
            <td><input aria-label="Name" style={{ minWidth: 140 }} value={i.name} onChange={(e) => upI(i.id, { name: e.target.value })} /></td>
            <td>{i.grp}</td>
            <td><input aria-label="Price" type="number" style={{ width: 90 }} value={i.price} onChange={(e) => upI(i.id, { price: Number(e.target.value) })} /></td>
            <td><input aria-label="Minimum level" type="number" style={{ width: 80 }} value={i.min_level} onChange={(e) => upI(i.id, { min_level: Number(e.target.value) })} /></td>
            <td><input aria-label="Active" type="checkbox" checked={i.active} onChange={(e) => upI(i.id, { active: e.target.checked })} /></td>
            <td><button className="btn alt" style={{ minHeight: 40, padding: "6px 12px" }} onClick={() => void run(() => adminRpc("admin_save_item", { p_id: i.id, p_name: i.name, p_descr: i.descr, p_price: i.price, p_min_level: i.min_level, p_active: i.active }), `${i.name} saved.`)}>Save</button></td>
          </tr>))}</tbody></table></div>
      <p className="dim">Price 0 makes an item free for everyone. Deactivate an item to hide it from the shop (players who own it keep it). Daily deals pick from active items.</p>
      <h2 className="sec">Daily quests</h2>
      <div className="tw"><table className="t"><thead><tr><th>Quest</th><th>Goal</th><th>Reward (coins)</th><th>Active</th><th></th></tr></thead>
        <tbody>{missions.map((m) => (
          <tr key={m.id}>
            <td><input aria-label="Label" style={{ minWidth: 180 }} value={m.label} onChange={(e) => upM(m.id, { label: e.target.value })} /></td>
            <td><input aria-label="Goal" type="number" style={{ width: 80 }} value={m.goal} onChange={(e) => upM(m.id, { goal: Number(e.target.value) })} /></td>
            <td><input aria-label="Reward" type="number" style={{ width: 90 }} value={m.reward} onChange={(e) => upM(m.id, { reward: Number(e.target.value) })} /></td>
            <td><input aria-label="Active" type="checkbox" checked={m.active} onChange={(e) => upM(m.id, { active: e.target.checked })} /></td>
            <td><button className="btn alt" style={{ minHeight: 40, padding: "6px 12px" }} onClick={() => void run(() => adminRpc("admin_save_mission", { p_id: m.id, p_label: m.label, p_goal: m.goal, p_reward: m.reward, p_active: m.active }), "Quest saved.")}>Save</button></td>
          </tr>))}</tbody></table></div>
      <p className="dim">Three active quests are chosen per day. Keep at least three active.</p>
    </>
  );
}
