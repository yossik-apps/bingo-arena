import { useCallback, useEffect, useState } from "react";
import { adminRpc, dt } from "../../lib/admin";
import Notice from "../../lib/Notice";
import { parseReward, rewardShort } from "../../lib/reward";
import type { Reward } from "../../lib/supabase";

type Season = { id: number; name: string; blurb: string; starts_at: string; ends_at: string; xp_per_tier: number; pass_price: number };
type Tier = { tier: number; free_reward: Reward; premium_reward: Reward };
const local = (iso: string) => new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 6e4).toISOString().slice(0, 16);

export default function SeasonAdmin() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [form, setForm] = useState({ id: 0, name: "", blurb: "", starts: "", ends: "", xp: "200", price: "600" });
  const [tiers, setTiers] = useState<{ tier: number; free: string; premium: string }[]>([]);
  const [msg, setMsg] = useState("");

  const loadSeasons = useCallback(async () => {
    const s = await adminRpc<Season[]>("admin_seasons"); setSeasons(s);
    return s;
  }, []);
  const pick = useCallback(async (s: Season) => {
    setSel(s.id);
    setForm({ id: s.id, name: s.name, blurb: s.blurb, starts: local(s.starts_at), ends: local(s.ends_at), xp: String(s.xp_per_tier), price: String(s.pass_price) });
    const t = await adminRpc<Tier[]>("admin_season_tiers", { p_season: s.id });
    setTiers(t.map((x) => ({ tier: x.tier, free: rewardShort(x.free_reward), premium: rewardShort(x.premium_reward) })));
  }, []);
  useEffect(() => { void loadSeasons().then((s) => { if (s[0]) void pick(s[0]); }).catch((e) => setMsg(e.message)); }, [loadSeasons, pick]);

  const newSeason = () => {
    const last = seasons[0]; const start = last ? new Date(new Date(last.ends_at).getTime() + 36e5) : new Date();
    setSel(null); setForm({ id: 0, name: "", blurb: "", starts: local(start.toISOString()), ends: local(new Date(start.getTime() + 42 * 864e5).toISOString()), xp: "200", price: "600" });
    setMsg("A new season starts as a copy of the latest season's rewards. Save it, then edit any tiers you want to change.");
  };
  const save = async () => {
    setMsg("");
    try {
      const id = await adminRpc<number>("admin_save_season", { p_id: form.id || null, p_name: form.name, p_blurb: form.blurb, p_starts: new Date(form.starts).toISOString(), p_ends: new Date(form.ends).toISOString(), p_xp: Math.floor(Number(form.xp)), p_price: Math.floor(Number(form.price)) });
      setMsg("Season saved."); const s = await loadSeasons(); const cur = s.find((x) => x.id === id); if (cur) await pick(cur);
    } catch (e) { setMsg((e as Error).message); }
  };
  const saveTier = async (t: { tier: number; free: string; premium: string }) => {
    setMsg("");
    const free = parseReward(t.free), premium = parseReward(t.premium);
    if (!free || !premium) { setMsg(`Tier ${t.tier}: rewards look like coins:50, pack:1, item:ITEM_ID or booster:time:2.`); return; }
    try { await adminRpc("admin_save_tier", { p_season: sel, p_tier: t.tier, p_free: free, p_premium: premium }); setMsg(`Tier ${t.tier} saved.`); } catch (e) { setMsg((e as Error).message); }
  };
  const set = (k: keyof typeof form, v: string) => setForm({ ...form, [k]: v });

  return (
    <div className="cols2">
      <div>
        <Notice text={msg} />
        <h2 className="sec" style={{ marginTop: 8 }}>Seasons</h2>
        <div className="row2" style={{ marginBottom: 8 }}>
          {seasons.map((s) => <button key={s.id} className={`btn ${sel === s.id ? "" : "alt"}`} style={{ minHeight: 40 }} onClick={() => void pick(s)}>{s.name}</button>)}
          <button className="btn alt" style={{ minHeight: 40 }} onClick={newSeason}>+ New season</button>
        </div>
        <div className="box">
          <h2>{form.id ? "Edit season" : "New season"}</h2>
          <div className="fgrid">
            <label>Name<input maxLength={40} value={form.name} onChange={(e) => set("name", e.target.value)} /></label>
            <label>Starts<input type="datetime-local" value={form.starts} onChange={(e) => set("starts", e.target.value)} /></label>
            <label>Ends<input type="datetime-local" value={form.ends} onChange={(e) => set("ends", e.target.value)} /></label>
            <label>XP per tier (50 to 2000)<input type="number" value={form.xp} onChange={(e) => set("xp", e.target.value)} /></label>
            <label>Pass price in coins<input type="number" value={form.price} onChange={(e) => set("price", e.target.value)} /></label>
          </div>
          <label>Description<input maxLength={160} value={form.blurb} onChange={(e) => set("blurb", e.target.value)} /></label>
          <button className="btn" onClick={() => void save()}>Save season</button>
          <p className="dim">Seasons cannot overlap. Players can still claim rewards for 3 days after a season ends. {sel ? `Current: ${seasons.find((s) => s.id === sel) ? dt(seasons.find((s) => s.id === sel)!.starts_at) + " to " + dt(seasons.find((s) => s.id === sel)!.ends_at) : ""}` : ""}</p>
        </div>
      </div>
      <div>
        <h2 className="sec" style={{ marginTop: 8 }}>Tier rewards</h2>
        <p className="dim" style={{ marginTop: 0 }}>One reward per box. Write it as <b>coins:50</b>, <b>pack:1</b>, <b>item:ITEM_ID</b> or <b>booster:time:2</b> (boosters: slow, win, time, hint). Item IDs are in Admin → Catalog.</p>
        {sel === null && <p className="dim">Save the season first, then edit its tiers.</p>}
        <div className="tw"><table className="t"><thead><tr><th>Tier</th><th>Free reward</th><th>Pass reward</th><th></th></tr></thead>
          <tbody>{tiers.map((t, i) => (
            <tr key={t.tier}><td><b>{t.tier}</b></td>
              <td><input aria-label={`Tier ${t.tier} free reward`} style={{ width: 150 }} value={t.free} onChange={(e) => setTiers(tiers.map((x, k) => (k === i ? { ...x, free: e.target.value } : x)))} /></td>
              <td><input aria-label={`Tier ${t.tier} pass reward`} style={{ width: 150 }} value={t.premium} onChange={(e) => setTiers(tiers.map((x, k) => (k === i ? { ...x, premium: e.target.value } : x)))} /></td>
              <td><button className="btn alt" style={{ minHeight: 36, padding: "4px 10px" }} onClick={() => void saveTier(t)}>Save</button></td></tr>
          ))}</tbody></table></div>
      </div>
    </div>
  );
}
