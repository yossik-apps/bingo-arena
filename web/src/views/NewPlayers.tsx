import { useCallback, useEffect, useState } from "react";
import { rpcError, supabase } from "../lib/supabase";
import { ago } from "../lib/NewPlayers";
import Notice from "../lib/Notice";

type P = { user_id: string; name: string; level: number; joined_at: string; is_me: boolean; waved: boolean };

export default function NewPlayers() {
  const [players, setPlayers] = useState<P[] | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState(false);
  const load = useCallback(async () => {
    const { data } = await supabase.rpc("new_players", { p_limit: 30 });
    setPlayers(((data as { players: P[] } | null)?.players) ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const wave = async (p: P) => {
    setMsg(""); setErr(false);
    const { error } = await supabase.rpc("wave_hello", { p_user: p.user_id });
    if (error) { setMsg(rpcError(error)); setErr(true); } else { setMsg(`Your welcome was sent to ${p.name}.`); await load(); }
  };

  if (!players) return <div className="skel" />;
  return (
    <>
      <Notice text={msg} error={err} />
      <h2 className="sec" style={{ marginTop: 8 }}>Players who joined this week</h2>
      <p className="dim" style={{ margin: "0 2px 8px" }}>A friendly welcome appears in their inbox and helps new players feel at home. You can send up to 5 a day.</p>
      {players.length === 0 && <div className="box"><b>No new players this week.</b><p className="dim" style={{ marginBottom: 0 }}>Invite friends and they will show up here.</p></div>}
      {players.map((p) => (
        <div className={`lrow ${p.is_me ? "me" : ""}`} key={p.user_id}>
          <span className="lt"><b>{p.name}{p.is_me ? " (you)" : ""} <span className="tag new">NEW</span></b><span className="dim" style={{ fontSize: 13 }}>Level {p.level} · {ago(p.joined_at)}</span></span>
          {!p.is_me && <button className="btn alt" style={{ minHeight: 40, padding: "6px 14px" }} disabled={p.waved} onClick={() => void wave(p)}>{p.waved ? "Welcomed" : "Say welcome"}</button>}
        </div>
      ))}
    </>
  );
}
