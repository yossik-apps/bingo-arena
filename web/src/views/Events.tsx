import { useCallback, useEffect, useState } from "react";
import { me, supabase } from "../lib/supabase";
import { Coins } from "../lib/ui";

type Ev = { id: string; name: string; descr: string; level: string; fee: number; attempts: number; starts_at: string; ends_at: string; bonus: number; split: number[]; status: string };
type Row = { rank: number; user_id: string; display_name: string; best: number; attempts: number };
type Info = { used: number; board: Row[] };

const left = (iso: string) => {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "ended";
  const h = Math.floor(ms / 36e5);
  return h >= 48 ? `${Math.floor(h / 24)} days left` : h >= 1 ? `${h} h left` : `${Math.max(1, Math.floor(ms / 6e4))} min left`;
};

export default function Events({ userId, balance, blocked, onEnter }: { userId: string; balance: number; blocked: boolean; onEnter: (id: string) => void }) {
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [info, setInfo] = useState<Record<string, Info>>({});

  const load = useCallback(async () => {
    const { data } = await supabase.from("events").select("*").eq("status", "live").lte("starts_at", new Date().toISOString()).gte("ends_at", new Date().toISOString()).order("ends_at");
    const evs = (data as Ev[]) ?? [];
    setEvents(evs);
    const entries = await Promise.all(evs.map(async (e) => {
      const [{ count }, { data: b }] = await Promise.all([
        supabase.from("rounds").select("id", { count: "exact", head: true }).eq("user_id", me.id).eq("event_id", e.id),
        supabase.rpc("event_leaderboard", { p_event: e.id }),
      ]);
      return [e.id, { used: count ?? 0, board: (b as Row[]) ?? [] }] as const;
    }));
    setInfo(Object.fromEntries(entries));
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (!events) return <><div className="skel" /><div className="skel" /></>;
  return (
    <>
      <h2 className="sec" style={{ marginTop: 8 }}>Live events</h2>
      {events.length === 0 && <div className="box"><b>No live events right now.</b><p className="dim" style={{ marginBottom: 0 }}>New tournaments appear here. Check back soon.</p></div>}
      {events.map((e) => {
        const i = info[e.id] ?? { used: 0, board: [] };
        const rest = e.attempts - i.used;
        const me = i.board.find((r) => r.user_id === userId);
        const disabled = blocked || rest <= 0 || balance < e.fee;
        return (
          <div className="qcard" key={e.id}>
            <div className="qtop"><b>{e.name}</b><span className="tag">{e.level}</span></div>
            {e.descr && <p className="dim" style={{ margin: "6px 0" }}>{e.descr}</p>}
            <p className="dim" style={{ margin: "6px 0" }}>{left(e.ends_at)} · {rest > 0 ? rest : 0} of {e.attempts} attempts left · prizes for the top {e.split.length}{me ? ` · you are #${me.rank} with ${me.best}` : ""}</p>
            <div className="qbot">
              <span>Entry <Coins n={e.fee} /></span>
              <button className="btn" disabled={disabled} onClick={() => onEnter(e.id)}>{rest <= 0 ? "No attempts left" : balance < e.fee ? "Not enough coins" : "Enter"}</button>
            </div>
            {i.board.length > 0 && (
              <div className="tw" style={{ marginTop: 10 }}><table className="t"><tbody>
                {i.board.slice(0, 5).map((r) => <tr key={r.user_id} style={r.user_id === userId ? { fontWeight: 700 } : undefined}><td>{r.rank}</td><td>{r.display_name}</td><td>{r.best}</td></tr>)}
              </tbody></table></div>
            )}
          </div>
        );
      })}
      <p className="dim">Only your best score counts. Entry fees are play money. Prizes are paid when the event ends.</p>
    </>
  );
}
