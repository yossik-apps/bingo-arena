import { useCallback, useEffect, useState } from "react";
import { adminRpc, dt } from "../../lib/admin";
import Notice from "../../lib/Notice";

type Thread = { id: string; subject: string; status: string; origin: string; admin_unread: boolean; updated_at: string; user_id: string; player: string; email: string; last_message: string | null; last_sender: string | null; messages: number };
type Convo = { id: string; subject: string; status: string; origin: string; player: { id: string; name: string; email: string; banned: boolean }; messages: { sender: "player" | "admin"; body: string; created_at: string }[] };
type Hit = { id: string; display_name: string; email: string };
const area = { width: "100%", font: "inherit", padding: 10, borderRadius: 10, border: "1px solid var(--line)", background: "var(--cell)", color: "var(--ink)" } as const;

export default function MessagesAdmin({ onCount }: { onCount: () => void }) {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [filter, setFilter] = useState<"unread" | "open" | "all" | "closed">("unread");
  const [open, setOpen] = useState<Convo | null>(null);
  const [reply, setReply] = useState("");
  const [msg, setMsg] = useState("");
  const [composing, setComposing] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [to, setTo] = useState<Hit | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const load = useCallback(() => { adminRpc<Thread[]>("admin_threads").then(setThreads).catch((e) => setMsg(e.message)); }, []);
  useEffect(load, [load]);
  useEffect(() => { const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);

  const openThread = async (id: string) => {
    try { setOpen(await adminRpc<Convo>("admin_thread_messages", { p_thread: id })); setComposing(false); load(); onCount(); } catch (e) { setMsg((e as Error).message); }
  };
  const sendReply = async () => {
    if (!open) return;
    try { await adminRpc("admin_reply", { p_thread: open.id, p_body: reply }); setReply(""); await openThread(open.id); setMsg("Reply sent."); } catch (e) { setMsg((e as Error).message); }
  };
  const setStatus = async (status: string) => {
    if (!open) return;
    try { await adminRpc("admin_set_thread_status", { p_thread: open.id, p_status: status }); await openThread(open.id); setMsg(status === "closed" ? "Conversation closed." : "Conversation reopened."); } catch (e) { setMsg((e as Error).message); }
  };
  const search = async (v: string) => {
    setQ(v);
    if (v.trim().length < 2) { setHits([]); return; }
    try { const r = await adminRpc<{ rows: Hit[] }>("admin_players", { p_search: v, p_limit: 8, p_offset: 0 }); setHits(r.rows); } catch { /* ignore */ }
  };
  const sendNew = async () => {
    if (!to) return;
    try {
      const id = await adminRpc<string>("admin_send_message", { p_user: to.id, p_subject: subject, p_body: body });
      const name = to.display_name;
      setTo(null); setSubject(""); setBody(""); setQ(""); setHits([]); setComposing(false); await openThread(id); setMsg(`Message sent to ${name}. They see it in their inbox.`);
    } catch (e) { setMsg((e as Error).message); }
  };

  const shown = (threads ?? []).filter((t) => filter === "all" ? true : filter === "unread" ? t.admin_unread : filter === "closed" ? t.status === "closed" : t.status !== "closed");
  const unread = (threads ?? []).filter((t) => t.admin_unread).length;

  return (
    <div className="cols2">
      <div>
        <Notice text={msg} />
        <div className="atabs" role="group" aria-label="Filter messages">
          {([["unread", `Unanswered (${unread})`], ["open", "Open"], ["all", "All"], ["closed", "Closed"]] as const).map(([k, n]) => <button key={k} className={`at ${filter === k ? "on" : ""}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>{n}</button>)}
        </div>
        <button className="btn" style={{ marginBottom: 8 }} onClick={() => { setComposing(true); setOpen(null); }}>New message to a player</button>
        {threads === null && <div className="skel" />}
        {threads && shown.length === 0 && <p className="dim">Nothing here. {filter === "unread" ? "All caught up!" : ""}</p>}
        {shown.map((t) => (
          <button key={t.id} className="lrow" style={{ width: "100%", textAlign: "left", cursor: "pointer", color: "inherit", font: "inherit", borderColor: open?.id === t.id ? "var(--daub)" : undefined }} onClick={() => void openThread(t.id)}>
            <span className="lt"><b>{t.admin_unread ? "● " : ""}{t.player}: {t.subject}</b><span className="dim" style={{ fontSize: 13 }}>{t.last_sender === "admin" ? "You: " : ""}{t.last_message}</span></span>
            <span className="dim" style={{ fontSize: 12, textAlign: "right" }}>{dt(t.updated_at)}<br />{t.origin === "admin" ? "sent by you" : t.status}</span>
          </button>
        ))}
      </div>
      <div>
        {composing && (
          <div className="box" style={{ marginTop: 10 }}>
            <h2>New message to a player</h2>
            {to ? <p>To: <b>{to.display_name}</b> <span className="dim">{to.email}</span> <button className="linkbtn" onClick={() => setTo(null)}>change</button></p> : (
              <>
                <label>Find the player (name or email)<input value={q} onChange={(e) => void search(e.target.value)} /></label>
                {hits.map((h) => <button key={h.id} className="lrow" style={{ width: "100%", textAlign: "left", cursor: "pointer", color: "inherit", font: "inherit" }} onClick={() => setTo(h)}><span className="lt"><b>{h.display_name}</b><span className="dim" style={{ fontSize: 13 }}>{h.email}</span></span></button>)}
              </>
            )}
            <label>Subject<input maxLength={80} value={subject} onChange={(e) => setSubject(e.target.value)} /></label>
            <label>Message<textarea rows={5} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} style={area} /></label>
            <button className="btn" disabled={!to || subject.trim().length < 2 || !body.trim()} onClick={() => void sendNew()}>Send</button>
            <button className="btn alt" onClick={() => setComposing(false)}>Cancel</button>
            <p className="dim">The player sees a badge on the inbox envelope and can reply to you.</p>
          </div>
        )}
        {open && (
          <div className="box" style={{ marginTop: 10 }}>
            <h2>{open.subject}</h2>
            <p className="dim" style={{ margin: "2px 0 8px" }}>{open.player.name} · {open.player.email}{open.player.banned ? " · suspended" : ""} · {open.status}</p>
            {open.messages.map((m, i) => (
              <div key={i} className={`bubble ${m.sender === "admin" ? "me" : "them"}`}>
                <b style={{ fontSize: 13 }}>{m.sender === "admin" ? "You" : open.player.name}</b>
                <p style={{ margin: "2px 0", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.body}</p>
                <span style={{ fontSize: 12, opacity: 0.8 }}>{dt(m.created_at)}</span>
              </div>
            ))}
            <label>Your reply<textarea rows={4} maxLength={2000} value={reply} onChange={(e) => setReply(e.target.value)} style={area} /></label>
            <button className="btn" disabled={!reply.trim()} onClick={() => void sendReply()}>Send reply</button>
            {open.status === "closed" ? <button className="btn alt" onClick={() => void setStatus("open")}>Reopen</button> : <button className="btn alt" onClick={() => void setStatus("closed")}>Close conversation</button>}
          </div>
        )}
        {!open && !composing && <p className="dim" style={{ marginTop: 14 }}>Pick a conversation to read it and reply. A number next to Messages shows how many wait for your answer.</p>}
      </div>
    </div>
  );
}
