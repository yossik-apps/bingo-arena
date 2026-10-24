import { useCallback, useEffect, useState } from "react";
import { rpcError, supabase } from "../lib/supabase";
import Notice from "../lib/Notice";
import { when } from "../lib/time";

type Thread = { id: string; subject: string; status: string; origin: string; unread: boolean; updated_at: string; last_message: string | null; last_sender: string | null };
type Convo = { id: string; subject: string; status: string; origin: string; messages: { sender: "player" | "admin"; body: string; created_at: string }[] };
type Note = { id: string; kind: string; title: string; body: string; read: boolean; created_at: string; from_name: string | null };
const TOPICS = ["Question", "Problem or bug", "Account help", "Suggestion", "Something else"];
const area = { width: "100%", font: "inherit", padding: 10, borderRadius: 10, border: "1px solid var(--line)", background: "var(--cell)", color: "var(--ink)" } as const;

const KIND_ICON: Record<string, string> = { prize: "🏆", overtake: "⚔️", wave: "👋", info: "📣", referral: "🤝" };

export default function Inbox({ startCompose, onCount, onPlay }: { startCompose: boolean; onCount: () => void; onPlay?: (where: "compete" | "lobby") => void }) {
  const [tab, setTab] = useState<"messages" | "notes">("messages");
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [open, setOpen] = useState<Convo | null>(null);
  const [compose, setCompose] = useState(startCompose);
  const [topic, setTopic] = useState(TOPICS[0]);
  const [body, setBody] = useState("");
  const [reply, setReply] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState(false);

  const load = useCallback(async () => {
    const [t, n] = await Promise.all([supabase.rpc("my_threads"), supabase.rpc("my_notifications")]);
    setThreads((t.data as Thread[]) ?? []); setNotes((n.data as Note[]) ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const fail = (e: { message: string }) => { setMsg(rpcError(e)); setErr(true); };
  const openThread = async (id: string) => {
    const { data, error } = await supabase.rpc("thread_messages", { p_thread: id });
    if (error) return fail(error);
    setOpen(data as Convo); setCompose(false); onCount(); void load();
  };
  const send = async () => {
    setMsg(""); setErr(false);
    const { data, error } = await supabase.rpc("contact_support", { p_subject: topic, p_body: body });
    if (error) return fail(error);
    setBody(""); setCompose(false); await load(); await openThread(data as string); setMsg("Message sent. Our answer will arrive here in your inbox.");
  };
  const sendReply = async () => {
    if (!open) return;
    setMsg(""); setErr(false);
    const { error } = await supabase.rpc("reply_support", { p_thread: open.id, p_body: reply });
    if (error) return fail(error);
    setReply(""); await openThread(open.id);
  };
  const showNotes = async () => {
    setTab("notes"); setOpen(null);
    await supabase.rpc("mark_notifications_read"); onCount();
    const { data } = await supabase.rpc("my_notifications"); setNotes((data as Note[]) ?? []);
  };

  return (
    <>
      <div className="atabs" role="group" aria-label="Inbox">
        <button className={`at ${tab === "messages" ? "on" : ""}`} aria-pressed={tab === "messages"} onClick={() => { setTab("messages"); setOpen(null); }}>Messages</button>
        <button className={`at ${tab === "notes" ? "on" : ""}`} aria-pressed={tab === "notes"} onClick={() => void showNotes()}>Notifications</button>
      </div>
      <Notice text={msg} error={err} />
      {tab === "messages" && compose && (
        <div className="box">
          <h2>Contact us</h2>
          <p className="dim" style={{ margin: "4px 0" }}>We read every message. Our answer arrives in this inbox.</p>
          <label>What is it about?<select value={topic} onChange={(e) => setTopic(e.target.value)}>{TOPICS.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label>Your message<textarea rows={5} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} style={area} /></label>
          <div className="row2"><button className="btn" disabled={body.trim().length < 5} onClick={() => void send()}>Send message</button><button className="btn alt" onClick={() => setCompose(false)}>Cancel</button></div>
        </div>
      )}
      {tab === "messages" && !compose && !open && (
        <>
          <div className="row2" style={{ marginBottom: 8 }}><button className="btn" onClick={() => { setCompose(true); setMsg(""); }}>Contact us</button></div>
          {threads === null && <div className="skel" />}
          {threads?.length === 0 && <div className="box"><b>No messages yet.</b><p className="dim" style={{ marginBottom: 0 }}>Press Contact us to ask a question or tell us about a problem. Our answers will show up here.</p></div>}
          {threads?.map((t) => (
            <button key={t.id} className="lrow" style={{ width: "100%", textAlign: "left", cursor: "pointer", color: "inherit", font: "inherit" }} onClick={() => void openThread(t.id)}>
              <span className="lt"><b>{t.unread ? "● " : ""}{t.subject}</b><span className="dim" style={{ fontSize: 13 }}>{t.last_sender === "admin" ? "Bingo Arena: " : "You: "}{t.last_message}</span></span>
              <span className="dim" style={{ fontSize: 12, textAlign: "right" }}>{when(t.updated_at)}<br />{t.origin === "admin" ? "From us" : t.status === "answered" ? "Answered" : t.status === "closed" ? "Closed" : "Waiting"}</span>
            </button>
          ))}
        </>
      )}
      {tab === "messages" && open && (
        <div>
          <button className="linkbtn" onClick={() => { setOpen(null); void load(); }}>Back to all messages</button>
          <h2 style={{ margin: "0 0 8px" }}>{open.subject}</h2>
          {open.messages.map((m, i) => (
            <div key={i} className={`bubble ${m.sender === "player" ? "me" : "them"}`}>
              <b style={{ fontSize: 13 }}>{m.sender === "player" ? "You" : "Bingo Arena"}</b>
              <p style={{ margin: "2px 0", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.body}</p>
              <span style={{ fontSize: 12, opacity: 0.8 }}>{when(m.created_at)}</span>
            </div>
          ))}
          <label>Reply<textarea rows={3} maxLength={2000} value={reply} onChange={(e) => setReply(e.target.value)} style={area} /></label>
          <button className="btn" disabled={reply.trim().length < 1} onClick={() => void sendReply()}>Send reply</button>
        </div>
      )}
      {tab === "notes" && (
        <>
          {notes === null && <div className="skel" />}
          {notes?.length === 0 && <div className="box"><b>No notifications yet.</b><p className="dim" style={{ marginBottom: 0 }}>Prizes you win, welcomes from other players and leaderboard news appear here.</p></div>}
          {notes?.map((n) => (
            <div className={`lrow nt nt-${n.kind} ${n.read ? "" : "unread"}`} key={n.id}>
              <span className="nt-ic" aria-hidden="true">{KIND_ICON[n.kind] ?? "📣"}</span>
              <span className="lt"><b>{n.title.replace(/^\p{Extended_Pictographic}\uFE0F?\s*/u, "")}</b><span className="dim" style={{ fontSize: 13 }}>{n.body}</span>
                {onPlay && n.kind === "overtake" && <button className="btn sm nt-go" onClick={() => onPlay("compete")}>Take my place back</button>}
              </span>
              <span className="dim nt-when">{when(n.created_at)}</span>
            </div>
          ))}
        </>
      )}
    </>
  );
}
