import { useEffect, useState } from "react";
import { callFn, supabase, type DailyInfo } from "../lib/supabase";
import { asPlayer } from "../lib/session";
import { Ic } from "../lib/ui";
import { NewTag } from "../lib/NewPlayers";

type Row = { rank: number; user_id: string; display_name: string; score: number };
const LEVEL: Record<string, string> = { beginner: "Beginner", medium: "Medium", hard: "Hard" };

export default function DailyCard({ onPlay, refreshKey, userId }: { onPlay: () => void; refreshKey: number; userId: string }) {
  const [info, setInfo] = useState<DailyInfo | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [open, setOpen] = useState(false);
  // BA-13: waits for the session and is never sent without one
  useEffect(() => { asPlayer(supabase.auth, () => callFn<DailyInfo>("daily-info")).then(setInfo).catch(() => setInfo(null)); }, [refreshKey]);
  if (!info) return null;
  const toggle = async () => {
    setOpen(!open);
    if (!open) { const { data } = await supabase.rpc("daily_leaderboard"); setRows((data as Row[]) ?? []); }
  };
  const tier = info.played?.status === "scored" ? (info.played.score >= info.goals[2] ? 3 : info.played.score >= info.goals[1] ? 2 : info.played.score >= info.goals[0] ? 1 : 0) : null;
  return (
    <section className="box daily" aria-label="Daily Challenge">
      <div className="qtop"><b>Daily Challenge</b><span className="tag">{LEVEL[info.level] ?? info.level}{info.label ? ` · ${info.label}` : ""}</span></div>
      <p className="dim" style={{ margin: "4px 0" }}>The same board for everyone today. One try, free. Streak Shields: {info.shields}/2 · done {info.done}</p>
      <div className="goals" aria-label="Rewards">{info.goals.map((g, i) => <span key={i} className={tier !== null && tier > i ? "got" : ""}><Ic n="star" c="star" />{g}</span>)}</div>
      <div className="row2">
        {info.played
          ? <button className="btn alt" disabled>{info.played.status === "scored" ? `Done: ${info.played.score} pts${info.rank ? ` · #${info.rank}` : ""}` : "Round abandoned"}</button>
          : <button className="btn" onClick={onPlay}>Play today's challenge</button>}
        <button className="btn alt" aria-expanded={open} onClick={() => void toggle()}>Leaderboard</button>
      </div>
      {open && rows && (
        <div className="tw" style={{ marginTop: 8 }}><table className="t"><tbody>
          {rows.length === 0 && <tr><td className="dim">Nobody has finished yet. Be the first!</td></tr>}
          {rows.slice(0, 5).map((r) => <tr key={r.user_id} style={r.user_id === userId ? { fontWeight: 700 } : undefined}><td>{r.rank}</td><td>{r.display_name}<NewTag id={r.user_id} /></td><td>{r.score}</td></tr>)}
        </tbody></table></div>
      )}
    </section>
  );
}
