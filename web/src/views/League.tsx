import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { NewTag } from "../lib/NewPlayers";

type Row = { rank: number; user_id: string; display_name: string; points: number };
type Payout = { week: string; prizes: number[]; winners: { rank: number; name: string; points: number; prize: number }[] };

const weekEnd = () => {
  const d = new Date();
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + (7 - day));
};
const fmtLeft = (ms: number) => {
  const h = Math.floor(ms / 36e5);
  return h >= 48 ? `${Math.floor(h / 24)} days left` : h >= 1 ? `${h} h left` : `${Math.max(1, Math.floor(ms / 6e4))} min left`;
};

export default function League({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [last, setLast] = useState<Payout | null>(null);
  const [info, setInfo] = useState<{ players: number; prizes: number[]; auto: boolean } | null>(null);
  useEffect(() => {
    void supabase.rpc("league_info").then(({ data }) => { if (data) setInfo(data as { players: number; prizes: number[]; auto: boolean }); });
    void supabase.rpc("league_board").then(({ data }) => setRows((data as Row[]) ?? []));
    void supabase.from("league_payouts").select("week,prizes,winners").order("week", { ascending: false }).limit(1).maybeSingle().then(({ data }) => setLast(data as Payout | null));
  }, []);
  if (!rows) return <div className="skel" />;
  const me = rows.find((r) => r.user_id === userId);
  return (
    <div className="cols2">
      <div>
        <h2 className="sec" style={{ marginTop: 8 }}>This week</h2>
        <p className="dim" style={{ margin: "0 2px 8px" }}>{fmtLeft(weekEnd() - Date.now())} · points = XP you earn from rounds. The top players win coins every week.</p>
        {info && info.prizes.length > 0 && (
          <div className="lg-prizes" aria-label="Prizes this week">
            <span className="lg-pt">🏆 Prizes this week</span>
            <div className="lg-pl">{info.prizes.map((p, i) => <span key={i} className={`lg-p ${i < 3 ? "g" + (i + 1) : ""}`}><b>{i + 1}</b>{p.toLocaleString()}</span>)}</div>
            <span className="dim lg-note">{info.players} {info.players === 1 ? "player" : "players"} so far · the prizes grow as more people play{info.auto ? " · paid automatically on Monday" : ""}</span>
          </div>
        )}
        {rows.length === 0 && <div className="box"><b>No scores yet this week.</b><p className="dim" style={{ marginBottom: 0 }}>Play a round to enter the league.</p></div>}
        {rows.slice(0, 20).map((r) => (
          <div className={`lrow ${r.user_id === userId ? "me" : ""}`} key={r.user_id}>
            <span className={`rk ${r.rank <= 3 ? "g" + r.rank : ""}`}>{r.rank}</span>
            <span className="lt"><b>{r.display_name}{r.user_id === userId ? " (you)" : ""}<NewTag id={r.user_id} /></b>{info && info.prizes[r.rank - 1] ? <span className="dim lg-win">wins {info.prizes[r.rank - 1].toLocaleString()} coins now</span> : null}</span><b>{r.points}</b>
          </div>
        ))}
        {me && me.rank > 20 && <div className="lrow me"><span className="rk">{me.rank}</span><span className="lt"><b>{me.display_name} (you)</b></span><b>{me.points}</b></div>}
      </div>
      <div>
        <h2 className="sec" style={{ marginTop: 8 }}>Last paid week</h2>
        {!last && <p className="dim">No league prizes have been paid yet.</p>}
        {last && (
          <div className="box">
            <p className="dim" style={{ marginTop: 0 }}>Week of {last.week}</p>
            {last.winners.map((w) => <div className="row" key={w.rank} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span>{w.rank}. {w.name}</span><b>+{w.prize} coins</b></div>)}
          </div>
        )}
        <p className="dim">Coins are play money. Weeks run Monday to Sunday (UTC).</p>
      </div>
    </div>
  );
}
