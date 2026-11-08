// The Inbox's wording and conditions, copied from Classic views/Inbox.tsx. Pure functions, no React, so they can be tested.
import type { Note, Thread } from "../../lib/screenData";
import type { IconName } from "../Icon";

/** Classic's topics for Contact us, in Classic's order. The first is the default. */
export const TOPICS = ["Question", "Problem or bug", "Account help", "Suggestion", "Something else"];
/** Classic's limit on a message and a reply. */
export const MAX_LEN = 2000;

export const WORDS = {
  tabs: "Inbox",
  messages: "Messages",
  notes: "Notifications",
  contact: "Contact us",
  contactIntro: "We read every message. Our answer arrives in this inbox.",
  topic: "What is it about?",
  body: "Your message",
  send: "Send message",
  cancel: "Cancel",
  sent: "Message sent. Our answer will arrive here in your inbox.",
  noThreads: "No messages yet.",
  noThreadsText: "Press Contact us to ask a question or tell us about a problem. Our answers will show up here.",
  back: "Back to all messages",
  reply: "Reply",
  sendReply: "Send reply",
  noNotes: "No notifications yet.",
  noNotesText: "Prizes you win, welcomes from other players and leaderboard news appear here.",
  takeBack: "Take my place back",
} as const;

/** Classic: "From us" when we started the thread, otherwise its status. */
export const threadStatus = (t: Pick<Thread, "origin" | "status">) =>
  t.origin === "admin" ? "From us" : t.status === "answered" ? "Answered" : t.status === "closed" ? "Closed" : "Waiting";

/** Classic's last line of a thread: who wrote it, then what they wrote. */
export const lastLine = (t: Pick<Thread, "last_sender" | "last_message">) => `${t.last_sender === "admin" ? "Bingo Arena: " : "You: "}${t.last_message ?? ""}`;

export const senderName = (sender: "player" | "admin") => (sender === "player" ? "You" : "Bingo Arena");

/** Classic removes a leading emoji from a notification's title. */
export const noteTitle = (title: string) => title.replace(/^\p{Extended_Pictographic}️?\s*/u, "");

/** Classic: Send message needs at least 5 characters, not counting spaces at the ends; Send reply needs one. */
export const canSend = (body: string) => body.trim().length >= 5;
export const canReply = (reply: string) => reply.trim().length >= 1;

/** Classic shows Take my place back on a notification that someone passed you on a leaderboard. */
export const showsTakeBack = (n: Pick<Note, "kind">) => n.kind === "overtake";

/** Each kind's shared icon, in place of Classic's emoji (🏆 ⚔️ 👋 📣 🤝). */
export const KIND_ICON: Partial<Record<string, IconName>> = { prize: "trophy", overtake: "swords", wave: "wave", info: "megaphone", referral: "users" };
/** An unknown kind gets the megaphone, as Classic falls back to 📣. */
export const noteIcon = (kind: string): IconName => KIND_ICON[kind] ?? "megaphone";

/** What a screen reader hears for a thread row. */
export const threadLabel = (t: Thread, time: string) => {
  const last = lastLine(t).trim();
  return `${t.subject}${t.unread ? ", new" : ""}. ${last}${/[.!?]$/.test(last) ? "" : "."} ${threadStatus(t)}, ${time}`;
};
