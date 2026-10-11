import { useCallback, useEffect, useState } from "react";
import { rpcError, supabase, type CrewHit, type CrewInfo } from "../lib/supabase";
import { Ic } from "../lib/ui";
import InfoTip from "../lib/InfoTip";
import Notice from "../lib/Notice";

type BoardRow = { rank: number; crew_id: string; name: string; tag: string; members: number; points: number };

export default function Crew({ userId, onChange }: { userId: string; onChange: () => Promise<void> }) {
  const [crew, setCrew] = useState<CrewInfo | null | undefined>(undefined);
  const [board, setBoard] = useState<BoardRow[]>([]);
  const [hits, setHits] = useState<CrewHit[]>([]);
  const [q, setQ] = useState("");
  const [code, setCode] = useState("");
  const [f, setF] = useState({ name: "", tag: "", descr: "", open: true });
  const [descr, setDescr] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("crew_info");
    const c = (data as CrewInfo | null) ?? null;
    setCrew(c); if (c) setDescr(c.descr);
    const b = await supabase.rpc("crew_board"); setBoard((b.data as BoardRow[]) ?? []);
    if (!c) { const s = await supabase.rpc("search_crews", { p_q: "" }); setHits((s.data as CrewHit[]) ?? []); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const run = async (fn: () => PromiseLike<{ error: { message: string } | null; data?: unknown }>, ok: string) => {
    setMsg(""); setErr(false);
    const { error } = await fn();
    if (error) { setMsg(rpcError(error)); setErr(true); } else { setMsg(ok); await load(); await onChange(); }
  };
  const search = async () => { const { data } = await supabase.rpc("search_crews", { p_q: q }); setHits((data as CrewHit[]) ?? []); };
  const share = async () => {
    if (!crew) return;
    const text = `Join my crew "${crew.name}" on Bingo Arena! Crew code: ${crew.invite_code}`;
    try { if (navigator.share) await navigator.share({ title: "Bingo Arena crew", text }); else { await navigator.clipboard.writeText(text); setMsg("Invite copied. Send it to a friend."); setErr(false); } } catch { /* cancelled */ }
  };

  if (crew === undefined) return <div className="skel" />;

  const boardView = (
    <>
      <h2 className="sec">Top crews this week</h2>
      {board.length === 0 && <p className="dim">No crew has earned XP this week yet.</p>}
      {board.slice(0, 8).map((r) => (
        <div className={`lrow ${crew && r.crew_id === crew.id ? "me" : ""}`} key={r.crew_id}>
          <span className={`rk ${r.rank <= 3 ? "g" + r.rank : ""}`}>{r.rank}</span>
          <span className="lt"><b>{r.name} <span className="tag">{r.tag}</span></b><span className="dim" style={{ fontSize: 13 }}>{r.members} players</span></span><b>{r.points}</b>
        </div>
      ))}
    </>
  );

  if (!crew) {
    return (
      <div className="cols2">
        <div>
          <Notice text={msg} error={err} />
          <h2 className="sec" style={{ marginTop: 8 }}>Join a crew <InfoTip label="crews" text="A crew is a team of up to 20 players. Everyone's XP counts toward a weekly crew goal. Reach it and the crew chest opens for everyone who helped." /></h2>
          <div className="row2" style={{ marginBottom: 8 }}>
            <label style={{ flex: 1, minWidth: 160, margin: 0 }}>Find a crew<input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void search()} placeholder="Crew name" /></label>
            <button className="btn alt" style={{ alignSelf: "end" }} onClick={() => void search()}>Search</button>
          </div>
          {hits.length === 0 && <p className="dim">No open crews found. Create the first one!</p>}
          {hits.map((h) => (
            <div className="qcard" key={h.id}>
              <div className="qtop"><b>{h.name} <span className="tag">{h.tag}</span></b><span className="dim">{h.members}/20</span></div>
              {h.descr && <p className="dim" style={{ margin: "4px 0" }}>{h.descr}</p>}
              <div className="qbot"><span className="dim">{h.points} XP this week</span><button className="btn" onClick={() => void run(() => supabase.rpc("join_crew", { p_crew: h.id }), `Welcome to ${h.name}!`)}>Join</button></div>
            </div>
          ))}
          <h2 className="sec">Have an invite code?</h2>
          <div className="row2">
            <label style={{ flex: 1, minWidth: 160, margin: 0 }}>Crew code<input value={code} maxLength={8} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC123" /></label>
            <button className="btn alt" style={{ alignSelf: "end" }} disabled={code.length < 4} onClick={() => void run(() => supabase.rpc("join_crew", { p_crew: null, p_code: code }), "You joined the crew!")}>Join with code</button>
          </div>
        </div>
        <div>
          <h2 className="sec" style={{ marginTop: 8 }}>Start your own</h2>
          <div className="box">
            <label>Crew name<input maxLength={20} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
            <label>Tag (2 to 4 letters or numbers)<input maxLength={4} value={f.tag} onChange={(e) => setF({ ...f, tag: e.target.value.toUpperCase() })} /></label>
            <label>About your crew (optional)<input maxLength={120} value={f.descr} onChange={(e) => setF({ ...f, descr: e.target.value })} /></label>
            <label style={{ display: "flex", gap: 10, alignItems: "center" }}><input type="checkbox" checked={f.open} onChange={(e) => setF({ ...f, open: e.target.checked })} /> Anyone can join (turn off for invite-only)</label>
            <button className="btn big" onClick={() => void run(() => supabase.rpc("create_crew", { p_name: f.name, p_tag: f.tag, p_descr: f.descr, p_open: f.open }), "Your crew is ready. Invite friends with your crew code!")}>Create crew</button>
          </div>
          {boardView}
        </div>
      </div>
    );
  }

  const pct = Math.min(100, Math.round((crew.week_points / crew.goal) * 100));
  const small = crew.size < crew.min_members;
  const tier = (t: 1 | 2) => {
    const need = t === 1 ? crew.tier1 : crew.goal, got = crew.week_points >= need, done = crew.claimed.includes(t);
    const why = small ? `Needs ${crew.min_members} players` : !got ? `${need} crew XP` : crew.my_points < crew.min_points ? `You need ${crew.min_points} XP yourself` : "";
    return (
      <div className="qcard" key={t}>
        <div className="qtop"><b>{t === 1 ? "Small chest" : "Big chest"}</b><span className="dim">at {need} XP</span></div>
        <p className="dim" style={{ margin: "4px 0" }}>{t === 1 ? "30 coins" : "60 coins and a stamp pack"}</p>
        <button className="btn" disabled={done || !got || small || crew.my_points < crew.min_points}
          onClick={() => void run(() => supabase.rpc("claim_crew_chest", { p_tier: t }), "Chest opened!")}>{done ? "Claimed" : why ? why : "Open chest"}</button>
      </div>
    );
  };
  return (
    <div className="cols2">
      <div>
        <Notice text={msg} error={err} />
        <section className="hero" style={{ marginTop: 8 }}>
          <span className="eyebrow">Your crew · rank #{crew.rank} this week</span>
          <h2>{crew.name} <span className="tag" style={{ color: "var(--ink)" }}>{crew.tag}</span></h2>
          <p>{crew.descr || "No description yet."}</p>
        </section>
        <h2 className="sec">Weekly goal <InfoTip label="the crew goal" text="Every member's XP this week adds up. The goal grows with your crew: 150 XP per player. XP you earned before joining does not count. It resets every Monday (UTC)." /></h2>
        <div className="box">
          <div className="qtop"><b>{crew.week_points} / {crew.goal} XP</b><span className="dim">You: {crew.my_points} XP</span></div>
          <div className="prog" role="progressbar" aria-label="Crew goal" aria-valuemin={0} aria-valuemax={crew.goal} aria-valuenow={crew.week_points}><i style={{ width: `${pct}%` }} /></div>
          {small && <p className="dim" style={{ margin: 0 }}>Chests unlock with {crew.min_members} or more players. Invite friends with the code below.</p>}
        </div>
        {tier(1)}{tier(2)}
        <h2 className="sec">Invite friends</h2>
        <div className="box">
          <p style={{ margin: "0 0 6px" }}>Crew code: <b style={{ fontSize: 22, letterSpacing: 2 }}>{crew.invite_code}</b></p>
          <div className="row2"><button className="btn" onClick={() => void share()}>Share invite</button><button className="btn alt" onClick={() => void run(() => supabase.rpc("leave_crew"), "You left the crew.")}>Leave crew</button></div>
        </div>
        {crew.is_leader && (
          <div className="box">
            <h2>Leader tools</h2>
            <label>About your crew<input maxLength={120} value={descr} onChange={(e) => setDescr(e.target.value)} /></label>
            <label style={{ display: "flex", gap: 10, alignItems: "center" }}><input type="checkbox" checked={crew.open} onChange={(e) => void run(() => supabase.rpc("update_crew", { p_descr: descr, p_open: e.target.checked }), e.target.checked ? "Anyone can join now." : "Now invite-only.")} /> Anyone can join</label>
            <button className="btn alt" onClick={() => void run(() => supabase.rpc("update_crew", { p_descr: descr, p_open: crew.open }), "Saved.")}>Save description</button>
          </div>
        )}
      </div>
      <div>
        <h2 className="sec" style={{ marginTop: 8 }}>Members ({crew.size}/20)</h2>
        {crew.members.map((m) => (
          <div className={`lrow ${m.user_id === userId ? "me" : ""}`} key={m.user_id}>
            <span className="lic" aria-hidden="true"><Ic n={m.role === "leader" ? "star" : "user"} c={m.role === "leader" ? "star" : ""} /></span>
            <span className="lt"><b>{m.name}{m.user_id === userId ? " (you)" : ""}</b><span className="dim" style={{ fontSize: 13 }}>{m.role === "leader" ? "Leader" : "Member"}</span></span>
            <b>{m.points} XP</b>
            {crew.is_leader && m.user_id !== userId && <button className="btn alt" style={{ minHeight: 36, padding: "4px 10px", fontSize: 13 }} onClick={() => void run(() => supabase.rpc("kick_crew_member", { p_user: m.user_id }), `${m.name} was removed.`)}>Remove</button>}
          </div>
        ))}
        {boardView}
      </div>
    </div>
  );
}
