import { useCallback, useEffect, useState } from "react";
import { me, rpcError, supabase } from "../lib/supabase";
import { NO_ROWS } from "../lib/session";
import { Coins, Ic } from "../lib/ui";

type Mission = { id: string; label: string; counter: string; goal: number; reward: number };
type Ach = { id: string; label: string };

export default function Quests({ onChange }: { onChange: () => Promise<void> }) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [counters, setCounters] = useState<Record<string, number>>({});
  const [claimed, setClaimed] = useState<string[]>([]);
  const [achs, setAchs] = useState<Ach[]>([]);
  const [got, setGot] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const day = new Date().toISOString().slice(0, 10);
    const [m, p, a, u] = await Promise.all([
      supabase.rpc("todays_missions"),
      me.id ? supabase.from("daily_progress").select("counters,claimed").eq("user_id", me.id).eq("day", day).maybeSingle() : NO_ROWS,
      supabase.from("ach_defs").select("id,label"),
      me.id ? supabase.from("user_achievements").select("ach_id").eq("user_id", me.id) : NO_ROWS,
    ]);
    setMissions((m.data as Mission[]) ?? []);
    setCounters((p.data?.counters as Record<string, number>) ?? {});
    setClaimed((p.data?.claimed as string[]) ?? []);
    setAchs((a.data as Ach[]) ?? []);
    setGot(new Set(((u.data as { ach_id: string }[]) ?? []).map((x) => x.ach_id)));
  }, []);
  useEffect(() => { void load(); }, [load]);

  const claim = async (id: string) => {
    setMsg("");
    const { data, error } = await supabase.rpc("claim_mission", { p_id: id });
    if (error) setMsg(rpcError(error)); else { setMsg(`Reward claimed: +${(data as { reward: number }).reward} coins and 15 XP.`); await load(); await onChange(); }
  };

  return (
    <div className="cols2">
      <div>
      <h2 className="sec" style={{ marginTop: 8 }}>Daily quests</h2>
      {msg && <p className="toast" role="status">{msg}</p>}
      {missions.map((m) => {
        const p = Math.min(m.goal, counters[m.counter] ?? 0), done = p >= m.goal, cl = claimed.includes(m.id);
        return (
          <div className="qcard" key={m.id}>
            <div className="qtop"><b>{m.label}</b><span className="dim">{p}/{m.goal}</span></div>
            <div className="prog" role="progressbar" aria-label={m.label} aria-valuemin={0} aria-valuemax={m.goal} aria-valuenow={p}><i style={{ width: `${(p / m.goal) * 100}%` }} /></div>
            <div className="qbot"><span>Reward <Coins n={m.reward} /></span>
              <button className={`btn ${done && !cl ? "" : "alt"}`} disabled={!done || cl} onClick={() => claim(m.id)}>{cl ? "Claimed" : done ? "Claim" : "In progress"}</button></div>
          </div>
        );
      })}
      <p className="dim">Quests refresh every day.</p>
      </div>
      <div>
      <h2 className="sec" style={{ marginTop: 8 }}>Badges</h2>
      <div className="bgrid">
        {achs.map((a) => (
          <div key={a.id} className={`badge ${got.has(a.id) ? "got" : ""}`}>
            <Ic n={got.has(a.id) ? "medal" : "lock"} /><b>{a.label}</b><span>{got.has(a.id) ? "Unlocked" : "Locked"}</span>
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}
