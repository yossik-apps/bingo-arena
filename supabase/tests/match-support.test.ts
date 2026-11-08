import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// What the new match screen and the new live-match bar need from App, doing exactly what Classic does.
const root = new URL("../../", import.meta.url);
const src = (path: string) => readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");
const app = src("web/src/App.tsx");
const contract = src("web/src/newui/screens/contract.ts");
const bar = src("web/src/lib/ArenaBar.tsx");

test("rounds.matching: the difficulty and Classic's onReady, only while the match screen shows", () => {
  assert.match(contract, /matching: \{ level: string; ready: \(round: RoundStart\) => void \} \| null;/);
  // one function for both designs, doing what Classic's onReady did
  assert.match(app, /const matchReady = \(r: RoundStart\) => \{ xpAtStart\.current = xpOf\(profile\); setRound\(r\); setView\("play"\); void refresh\(\); \};/);
  assert.match(app, /<Matchmaking [^\n]*\n\s*onReady=\{matchReady\}/);
  assert.match(app, /matching: view === "match" \? \{ level: matchLevel, ready: matchReady \} : null,/);
  // a visitor never matches
  assert.match(app, /dismissChallenge: noop, matching: null,/);
});

test("the new shell hides the live-match bar on the match screen, as Classic does", () => {
  assert.match(app, /\{!inRound && view !== "match" && view !== "admin" && \(\n\s*<ArenaBar /);
  assert.match(app, /\{view !== "match" && overlay\("arenaBar", true, /);
});

test("arenaBar.answer makes Classic's answer_invite call and fails with the text Classic shows", () => {
  const call = 'supabase.rpc("answer_invite", { p_id: id, p_accept: yes })';
  assert.ok(bar.includes(call) && app.includes(call));
  assert.match(bar, /if \(error\) \{ setMsg\(rpcError\(error\)\); return; \}/);
  assert.match(app, /if \(error\) throw new Error\(rpcError\(error\)\);\n\s*return \{ level: \(data as \{ level\?: string \} \| null\)\?\.level \};/);
  assert.match(contract, /answer: \(id: string, yes: boolean\) => Promise<\{ level\?: string \}>;/);
  assert.match(app, /play: arenaPlay, answer: arenaAnswer \}/);
});
