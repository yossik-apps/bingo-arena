// The Inbox: messages with us (Contact us, a thread and its reply) and notifications. Same calls and wording as Classic views/Inbox.tsx.
// Uses: inbox, notices, navigation
import { useEffect, useRef, useState } from "react";
import type { Convo, Note, Thread } from "../../lib/screenData";
import { when } from "../../lib/time";
import { Button, Card, EmptyState, ErrorState, Select, Skeleton, Tabs, TextField, Toast } from "../components";
import { Icon } from "../Icon";
import type { NoticesGroup, ScreenProps } from "./contract";
import { canReply, canSend, lastLine, MAX_LEN, noteMark, noteTitle, senderName, showsTakeBack, threadLabel, threadStatus, TOPICS, WORDS } from "./Inbox.logic";
import "./inbox.css";

// Until the shared changes are merged (main chat): TextField's `multiline` option and `notices.composing`.
// Remove these two casts when rebasing onto them; nothing else changes.
const Field = TextField as unknown as (p: Parameters<typeof TextField>[0] & { multiline?: boolean }) => ReturnType<typeof TextField>;
const composingOf = (n: NoticesGroup) => (n as NoticesGroup & { composing?: boolean }).composing ?? false;

type Msg = { text: string; error: boolean } | null;
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function Inbox({ ctx }: ScreenProps) {
  // ctx is rebuilt on every App render, so the calls are kept in a ref
  const inbox = useRef(ctx.inbox);
  inbox.current = ctx.inbox;
  const composing = composingOf(ctx.notices);

  const [tab, setTab] = useState<"messages" | "notes">("messages");
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<Convo | null>(null);
  const [compose, setCompose] = useState(composing);
  const [topic, setTopic] = useState(TOPICS[0]);
  const [body, setBody] = useState("");
  const [reply, setReply] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  /** Classic reloads both lists after most actions. A failed reload keeps what is already shown. */
  const load = async () => {
    try {
      const d = await inbox.current.load();
      setThreads(d.threads); setNotes(d.notes); setFailed(false);
    } catch { setFailed(true); }
  };
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Classic starts afresh whenever "Contact us" (or the Inbox button) is pressed: open on the form, or on the list.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setTab("messages"); setOpen(null); setCompose(composing); setMsg(null); setBody(""); setReply(""); setTopic(TOPICS[0]);
  }, [composing]);

  const fail = (e: unknown) => setMsg({ text: errText(e), error: true });
  const openThread = async (id: string) => {
    try {
      setOpen(await inbox.current.open(id)); setCompose(false);
    } catch (e) { return fail(e); }
    void load();
  };
  const send = async () => {
    setMsg(null); setBusy(true);
    try {
      const id = await inbox.current.contact(topic, body);
      setBody(""); setCompose(false); await load(); await openThread(id);
      setMsg({ text: WORDS.sent, error: false });
    } catch (e) { fail(e); } finally { setBusy(false); }
  };
  const sendReply = async () => {
    if (!open) return;
    setMsg(null); setBusy(true);
    try {
      await inbox.current.reply(open.id, reply);
      setReply(""); await openThread(open.id);
    } catch (e) { fail(e); } finally { setBusy(false); }
  };
  const showNotes = async () => {
    setTab("notes"); setOpen(null);
    try { setNotes(await inbox.current.markRead()); } catch { /* Classic ignores this */ }
  };
  const showMessages = () => { setTab("messages"); setOpen(null); };

  const list = (
    <>
      <div className="nu-ib-actions"><Button onClick={() => { setCompose(true); setMsg(null); }}>{WORDS.contact}</Button></div>
      {threads === null && failed && <ErrorState onRetry={() => void load()} />}
      {threads === null && !failed && <Skeleton rows={3} label="Loading your messages" />}
      {threads?.length === 0 && <EmptyState title={WORDS.noThreads} text={WORDS.noThreadsText} />}
      {threads && threads.length > 0 && (
        <ul className="nu-ib-list" aria-label={WORDS.messages}>
          {threads.map((t) => {
            const time = when(t.updated_at);
            return (
              <li key={t.id}>
                <button type="button" className={`nu-ib-thread${t.unread ? " is-unread" : ""}`} aria-label={threadLabel(t, time)} onClick={() => void openThread(t.id)}>
                  <span className="nu-ib-ttext">
                    <b className="nu-ib-subject" title={t.subject}>{t.unread && <span className="nu-ib-dot" aria-hidden="true" />}{t.subject}</b>
                    <span className="nu-ib-last" title={lastLine(t)}>{lastLine(t)}</span>
                  </span>
                  <span className="nu-ib-tmeta"><span>{time}</span><span className="nu-ib-status">{threadStatus(t)}</span></span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );

  const form = (
    <Card label={WORDS.contact}>
      <div className="nu-ib-form">
        <h2 className="nu-ib-formh">{WORDS.contact}</h2>
        <p className="nu-ib-intro">{WORDS.contactIntro}</p>
        <Select label={WORDS.topic} value={topic} options={TOPICS.map((t) => ({ value: t, text: t }))} onChange={setTopic} />
        <Field label={WORDS.body} value={body} onChange={setBody} maxLength={MAX_LEN} multiline />
        <div className="nu-ib-btns">
          <Button disabled={!canSend(body) || busy} onClick={() => void send()}>{WORDS.send}</Button>
          <Button kind="white" onClick={() => setCompose(false)}>{WORDS.cancel}</Button>
        </div>
      </div>
    </Card>
  );

  const thread = open && (
    <section className="nu-ib-convo" aria-label={open.subject}>
      <div><Button kind="ghost" size="sm" onClick={() => { setOpen(null); void load(); }}><Icon name="back" size={20} />{WORDS.back}</Button></div>
      <h2 className="nu-ib-h2">{open.subject}</h2>
      <ol className="nu-ib-bubbles">
        {open.messages.map((m, i) => (
          <li key={i} className={`nu-ib-bubble ${m.sender === "player" ? "is-me" : "is-them"}`}>
            <b>{senderName(m.sender)}</b>
            <p>{m.body}</p>
            <span className="nu-ib-btime">{when(m.created_at)}</span>
          </li>
        ))}
      </ol>
      <Card>
        <div className="nu-ib-form">
          <Field label={WORDS.reply} value={reply} onChange={setReply} maxLength={MAX_LEN} multiline />
          <div className="nu-ib-btns"><Button disabled={!canReply(reply) || busy} onClick={() => void sendReply()}>{WORDS.sendReply}</Button></div>
        </div>
      </Card>
    </section>
  );

  const noteList = (
    <>
      {notes === null && failed && <ErrorState onRetry={() => void load()} />}
      {notes === null && !failed && <Skeleton rows={3} label="Loading your notifications" />}
      {notes?.length === 0 && <EmptyState title={WORDS.noNotes} text={WORDS.noNotesText} />}
      {notes && notes.length > 0 && (
        <ul className="nu-ib-list" aria-label={WORDS.notes}>
          {notes.map((n) => {
            const mark = noteMark(n.kind);
            return (
              <li key={n.id} className={`nu-ib-note nu-ib-k-${n.kind}${n.read ? "" : " is-unread"}`}>
                <span className="nu-ib-mark" aria-hidden="true">{"icon" in mark ? <Icon name={mark.icon} size={22} /> : mark.emoji}</span>
                <span className="nu-ib-ntext">
                  <b>{noteTitle(n.title)}{!n.read && <span className="nu-ib-sr"> (new)</span>}</b>
                  <span className="nu-ib-nbody">{n.body}</span>
                  {showsTakeBack(n) && <span className="nu-ib-go"><Button size="sm" onClick={() => ctx.navigation.go("compete")}>{WORDS.takeBack}</Button></span>}
                </span>
                <span className="nu-ib-when">{when(n.created_at)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );

  return (
    <div className="nu-inbox">
      <Tabs label={WORDS.tabs} value={tab} onChange={(v) => (v === "notes" ? void showNotes() : showMessages())}
        options={[{ id: "messages", text: WORDS.messages }, { id: "notes", text: WORDS.notes }]} />
      {msg && <Toast inline alert={msg.error}>{msg.text}</Toast>}
      {tab === "messages" && compose && form}
      {tab === "messages" && !compose && !open && list}
      {tab === "messages" && !compose && thread}
      {tab === "notes" && noteList}
    </div>
  );
}
