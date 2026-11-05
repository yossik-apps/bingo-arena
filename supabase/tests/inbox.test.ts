import test from "node:test";
import assert from "node:assert/strict";
import { canReply, canSend, lastLine, MAX_LEN, noteIcon, noteTitle, senderName, showsTakeBack, threadLabel, threadStatus, TOPICS, WORDS } from "../../web/src/newui/screens/Inbox.logic.ts";

const thread = { id: "t", subject: "Help", status: "open", origin: "player", unread: false, updated_at: "", last_message: "Hi", last_sender: "player" };

test("the topics and limits are Classic's", () => {
  assert.deepEqual(TOPICS, ["Question", "Problem or bug", "Account help", "Suggestion", "Something else"]);
  assert.equal(MAX_LEN, 2000);
});

test("a thread's status reads as in Classic", () => {
  assert.equal(threadStatus({ origin: "admin", status: "answered" }), "From us", "a thread we started is From us whatever its status");
  assert.equal(threadStatus({ origin: "player", status: "answered" }), "Answered");
  assert.equal(threadStatus({ origin: "player", status: "closed" }), "Closed");
  assert.equal(threadStatus({ origin: "player", status: "open" }), "Waiting");
  assert.equal(threadStatus({ origin: "player", status: "anything" }), "Waiting");
});

test("the last line names who wrote it", () => {
  assert.equal(lastLine({ last_sender: "admin", last_message: "Done" }), "Bingo Arena: Done");
  assert.equal(lastLine({ last_sender: "player", last_message: "Hi" }), "You: Hi");
  assert.equal(lastLine({ last_sender: null, last_message: null }), "You: ");
  assert.equal(senderName("player"), "You");
  assert.equal(senderName("admin"), "Bingo Arena");
});

test("Send message needs 5 characters and Send reply one, spaces at the ends not counted", () => {
  assert.equal(canSend("abcd"), false);
  assert.equal(canSend("   abcd   "), false);
  assert.equal(canSend("abcde"), true);
  assert.equal(canReply(""), false);
  assert.equal(canReply("   "), false);
  assert.equal(canReply("k"), true);
});

test("a leading emoji is removed from a notification title, as in Classic", () => {
  assert.equal(noteTitle("🏆 League prize"), "League prize");
  assert.equal(noteTitle("⚔️ Someone passed you"), "Someone passed you");
  assert.equal(noteTitle("League 🏆 prize"), "League 🏆 prize");
});

test("Take my place back shows only on overtake notifications", () => {
  assert.equal(showsTakeBack({ kind: "overtake" }), true);
  for (const kind of ["prize", "wave", "info", "referral", "other"]) assert.equal(showsTakeBack({ kind }), false);
});

test("each kind has its shared icon, and an unknown kind the megaphone as in Classic", () => {
  assert.equal(noteIcon("prize"), "trophy");
  assert.equal(noteIcon("overtake"), "swords");
  assert.equal(noteIcon("wave"), "wave");
  assert.equal(noteIcon("info"), "megaphone");
  assert.equal(noteIcon("referral"), "users");
  assert.equal(noteIcon("brand_new_kind"), "megaphone");
});

test("a thread row tells a screen reader everything it shows", () => {
  const l = threadLabel({ ...thread, unread: true }, "Mon 2 Nov, 10:00");
  for (const part of ["Help", "new", "You: Hi", "Waiting", "Mon 2 Nov, 10:00"]) assert.ok(l.includes(part), part);
  assert.ok(!threadLabel(thread, "x").includes("new"));
});

test("Classic's wording is kept", () => {
  assert.equal(WORDS.sent, "Message sent. Our answer will arrive here in your inbox.");
  assert.equal(WORDS.contactIntro, "We read every message. Our answer arrives in this inbox.");
  assert.equal(WORDS.takeBack, "Take my place back");
  assert.equal(WORDS.back, "Back to all messages");
});
