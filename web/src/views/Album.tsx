import { useCallback, useEffect, useState } from "react";
import { me, rpcError, supabase, type ShopItem, type World } from "../lib/supabase";
import { NO_ROWS } from "../lib/session";
import { Coins, Ic } from "../lib/ui";

type Stamp = { id: string; world: number; name: string; rarity: "common" | "rare" | "epic"; sort: number };
type Collect = { dust: number; packs_since_epic: number; packs_opened: number };
const COST = { common: 30, rare: 90, epic: 240 } as const;
const initials = (n: string) => n.split(/\s+/).map((x) => x[0]).join("").slice(0, 2).toUpperCase();

export default function Album({ items, onChange }: { items: ShopItem[]; onChange: () => Promise<void> }) {
  const [worlds, setWorlds] = useState<World[]>([]);
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [own, setOwn] = useState<Record<string, number>>({});
  const [col, setCol] = useState<Collect>({ dust: 0, packs_since_epic: 0, packs_opened: 0 });
  const [claimed, setClaimed] = useState<Set<number>>(new Set());
  const [wid, setWid] = useState(1);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const [w, s, o, c, a] = await Promise.all([
      supabase.from("worlds").select("*").order("sort"),
      supabase.from("stamps").select("*").order("sort"),
      me.id ? supabase.from("user_stamps").select("stamp_id,qty").eq("user_id", me.id) : NO_ROWS,
      me.id ? supabase.from("user_collect").select("dust,packs_since_epic,packs_opened").eq("user_id", me.id).maybeSingle() : NO_ROWS,
      me.id ? supabase.from("album_claims").select("world").eq("user_id", me.id) : NO_ROWS,
    ]);
    setWorlds((w.data as World[]) ?? []); setStamps((s.data as Stamp[]) ?? []);
    setOwn(Object.fromEntries(((o.data as { stamp_id: string; qty: number }[]) ?? []).map((x) => [x.stamp_id, x.qty])));
    if (c.data) setCol(c.data as Collect);
    setClaimed(new Set(((a.data as { world: number }[]) ?? []).map((x) => x.world)));
  }, []);
  useEffect(() => { void load(); }, [load]);

  const craft = async (s: Stamp) => {
    setMsg("");
    const { error } = await supabase.rpc("craft_stamp", { p_stamp: s.id });
    if (error) setMsg(rpcError(error)); else { setMsg(`${s.name} crafted.`); await load(); }
  };
  const claim = async (w: World) => {
    setMsg("");
    const { data, error } = await supabase.rpc("claim_album", { p_world: w.id });
    if (error) { setMsg(rpcError(error)); return; }
    const r = data as { coins: number; item: string | null };
    setMsg(`Album complete! +${r.coins} coins${r.item ? ` and the ${items.find((i) => i.id === r.item)?.name ?? "reward"}` : ""}.`);
    await load(); await onChange();
  };

  const world = worlds.find((w) => w.id === wid);
  if (!world) return <div className="skel" />;
  const list = stamps.filter((s) => s.world === wid);
  const have = list.filter((s) => own[s.id]).length;
  const done = have === list.length && list.length > 0;
  const reward = items.find((i) => i.id === world.reward_item);

  return (
    <>
      <div className="atabs" role="group" aria-label="Albums">
        {worlds.map((w) => <button key={w.id} className={`at ${wid === w.id ? "on" : ""}`} aria-pressed={wid === w.id} onClick={() => setWid(w.id)}>{w.name}</button>)}
      </div>
      {msg && <p className="toast" role="status">{msg}</p>}
      <div className="cols2">
        <div>
          <div className="qtop" style={{ margin: "4px 0 8px" }}><b>{world.name} album · {have}/{list.length}</b><span className="chip2"><Ic n="spark" /><b>{col.dust}</b> dust</span></div>
          <div className="stampgrid">
            {list.map((s) => {
              const n = own[s.id];
              return (
                <div key={s.id} className={`stampc ${n ? "own" : ""} ${s.rarity}`}>
                  <span className="stampart" aria-hidden="true">{n ? initials(s.name) : "?"}</span>
                  <b style={{ fontSize: 14 }}>{n ? s.name : "Not found yet"}</b>
                  <span className="tag">{s.rarity}{n && n > 1 ? ` · x${n}` : ""}</span>
                  {!n && <button className="btn alt" style={{ minHeight: 36, padding: "4px 10px", fontSize: 13 }} disabled={col.dust < COST[s.rarity]} onClick={() => void craft(s)}><Ic n="spark" /> {COST[s.rarity]}</button>}
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <div className="box">
            <h2>Page reward</h2>
            <p className="dim" style={{ margin: "4px 0" }}>Complete this page for <Coins n={world.reward_coins} />{reward ? <> and the exclusive <b>{reward.name}</b></> : ""}.</p>
            <button className="btn big" disabled={!done || claimed.has(wid)} onClick={() => void claim(world)}>{claimed.has(wid) ? "Claimed" : done ? "Claim reward" : `${list.length - have} stamps to go`}</button>
          </div>
          <div className="box">
            <h2>How stamps work</h2>
            <p className="dim" style={{ margin: "4px 0" }}>You earn a stamp pack the first time you clear a stage, the first time you earn 3 stars on it, and on every 7th day of your login streak. Packs cannot be bought.</p>
            <p className="dim" style={{ margin: "4px 0" }}><b>Odds per pack:</b> common 70%, rare 25%, epic 5%. An epic is guaranteed within 10 packs ({Math.max(1, 10 - col.packs_since_epic)} to go). A duplicate turns into dust (5, 15 or 40), and dust crafts any stamp you are missing ({COST.common} / {COST.rare} / {COST.epic}).</p>
            <p className="dim" style={{ margin: "4px 0" }}>Packs opened: {col.packs_opened}</p>
          </div>
        </div>
      </div>
    </>
  );
}
