// Sample data for the Inbox's captures, one state per name. Local development only; nothing is sent anywhere.
// Open a thread or the notifications with the harness's --click "My coins after a round" or --click "Notifications".
import type { Convo, InboxGroup, Note, Thread } from "../../lib/screenData";
import type { ScreenFixture } from "./contract";

const iso = (ms: number) => new Date(Date.now() + ms).toISOString();
const H = 36e5, DAY = 24 * H;

const THREADS: Thread[] = [
  { id: "t1", subject: "My coins after a round", status: "answered", origin: "player", unread: true, updated_at: iso(-H), last_message: "Thanks, the prize is now in your wallet.", last_sender: "admin" },
  { id: "t2", subject: "Welcome to the new season", status: "answered", origin: "admin", unread: false, updated_at: iso(-2 * DAY), last_message: "The new season starts on Monday with new stages.", last_sender: "admin" },
  { id: "t3", subject: "Problem or bug", status: "open", origin: "player", unread: false, updated_at: iso(-3 * DAY), last_message: "The card froze after the third ball.", last_sender: "player" },
  { id: "t4", subject: "Suggestion", status: "closed", origin: "player", unread: false, updated_at: iso(-12 * DAY), last_message: "Noted, thank you for the idea.", last_sender: "admin" },
];
const NOTES: Note[] = [
  { id: "n1", kind: "overtake", title: "⚔️ Someone passed you", body: "SamplePlayer passed you on this week's league board.", read: false, created_at: iso(-2 * H), from_name: null },
  { id: "n2", kind: "prize", title: "🏆 League prize", body: "You finished 7th last week: +40 coins.", read: false, created_at: iso(-DAY), from_name: null },
  { id: "n3", kind: "wave", title: "👋 A wave hello", body: "SampleFriend waved hello.", read: true, created_at: iso(-2 * DAY), from_name: "SampleFriend" },
  { id: "n4", kind: "referral", title: "🤝 Your friend joined", body: "SampleFriend played their first round: +100 coins.", read: true, created_at: iso(-4 * DAY), from_name: null },
  { id: "n5", kind: "info", title: "📣 New stages", body: "Starlight Pier has two new stages.", read: true, created_at: iso(-6 * DAY), from_name: "Bingo Arena" },
];
const CONVO: Convo = { id: "t1", subject: "My coins after a round", status: "answered", origin: "player", messages: [
  { sender: "player", body: "My prize did not show up after the last round.\nIt was a medium round, about an hour ago.", created_at: iso(-3 * H) },
  { sender: "admin", body: "Thanks, the prize is now in your wallet.", created_at: iso(-H) },
] };

const LONG = "A very long subject line that keeps going well past the width of a phone screen";
const LONG_WORD = "Averyveryverylongwordwithnospacesthatmustwrapinsteadofpushingthepagesideways";
const LONG_THREADS: Thread[] = [{ ...THREADS[0], subject: LONG, last_message: `${LONG_WORD} and then more words after it.` }, ...THREADS.slice(1)];
const LONG_NOTES: Note[] = [{ ...NOTES[0], title: `⚔️ ${LONG}`, body: `${LONG_WORD} passed you on this week's league board.` }, ...NOTES.slice(1), { ...NOTES[4], id: "n6", kind: "unknown_kind", title: "Something we have not drawn yet" }];
const LONG_CONVO: Convo = { ...CONVO, subject: LONG, messages: [...CONVO.messages, { sender: "player", body: LONG_WORD, created_at: iso(-30 * 6e4) }] };

const never = () => new Promise<never>(() => undefined);
const group = (threads: Thread[], notes: Note[], convo: Convo): InboxGroup => ({
  load: async () => ({ threads, notes }),
  open: async () => convo,
  contact: async () => "t1",
  reply: async () => undefined,
  markRead: async () => notes.map((n) => ({ ...n, read: true })),
});

export const fixture: ScreenFixture = (base, state) => {
  const ctx = { ...base, inbox: group(THREADS, NOTES, CONVO) };
  switch (state) {
    case "empty": return { ...ctx, inbox: group([], [], CONVO) };
    case "loading": return { ...ctx, inbox: { ...ctx.inbox, load: never } };
    case "error": return { ...ctx, inbox: { ...ctx.inbox, load: async () => { throw new Error("Sample data: the inbox did not load"); } } };
    case "compose": return { ...ctx, notices: { ...ctx.notices, composing: true } };
    case "sendfail": return { ...ctx, notices: { ...ctx.notices, composing: true }, inbox: { ...ctx.inbox, contact: async () => { throw new Error("Sample data: the message was not sent."); } } };
    case "long": return { ...ctx, inbox: group(LONG_THREADS, LONG_NOTES, LONG_CONVO) };
    default: return ctx;
  }
};
