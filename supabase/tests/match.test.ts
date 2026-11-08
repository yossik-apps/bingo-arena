import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  elsewhere, eyebrow, GHOST_AT, NOBODY, onlineText, ONLINE_MS, playerSub, POLL_MS, readyRound, SEARCHING, sentStatus, showsGhost, STILL, STILL_AT, stepOf, TIMED_OUT,
} from "../../web/src/newui/screens/Match.logic.ts";
import type { Arena } from "../../web/src/lib/arena.ts";

const arena: Arena = {
  online: 3, invites: [],
  waiting: [{ id: "a", name: "Kim", level: "medium", waited: 5, player_level: 4 }, { id: "b", name: "Lee", level: "hard", waited: 9, player_level: 9 }],
  sent: [{ to: "Kim", status: "declined" }, { to: "Lee", status: "accepted" }],
};

test("Classic's timings and words", () => {
  assert.equal(POLL_MS, 1500);
  assert.equal(ONLINE_MS, 10_000);
  assert.equal(GHOST_AT, 20);
  assert.equal(STILL_AT, 25);
  assert.equal(SEARCHING, "Searching for an opponent…");
  assert.equal(STILL, "Still searching. Invite someone who is online, or play against the ghost.");
  assert.equal(TIMED_OUT, "The search timed out. Please try again.");
  assert.match(NOBODY, /^Nobody else is online right now\./);
  assert.equal(eyebrow("hard"), "Real-player match · Hard");
  assert.equal(showsGhost(19), false);
  assert.equal(showsGhost(20), true);
});

test("the online line, the switch rows and invite answers", () => {
  assert.equal(onlineText(0), null);
  assert.equal(onlineText(null), null);
  assert.equal(onlineText(1), "1 player is online. Everyone in the game now sees that you are waiting.");
  assert.equal(onlineText(4), "4 players are online. Everyone in the game now sees that you are waiting.");
  assert.deepEqual(elsewhere(arena, "medium").map((w) => w.name), ["Lee"]);
  assert.deepEqual(elsewhere(null, "medium"), []);
  assert.equal(sentStatus(arena, "Kim"), "declined");
  assert.equal(sentStatus(arena, "Lee"), "accepted");
  assert.equal(sentStatus(arena, "Sam"), undefined);
  assert.equal(playerSub({ level: 7, playing: true }), "level 7 · in a round");
  assert.equal(playerSub({ level: 7, playing: false }), "level 7");
});

test("each my_match answer means what it means in Classic", () => {
  assert.deepEqual(stepOf({ status: "queued", waited: 12 }), { kind: "wait", waited: 12 });
  assert.deepEqual(stepOf({ status: "queued" }), { kind: "wait", waited: 0 });
  assert.deepEqual(stepOf({ status: "none" }), { kind: "timeout" });
  assert.deepEqual(stepOf({ status: "ready", round_id: "r" }), { kind: "ready" });
  assert.deepEqual(stepOf({ status: "ready" }), { kind: "none" }, "ready without a round waits for the next check");
});

test("the round starts at the server's time, on this device's clock", () => {
  const r = readyRound({ status: "ready", round_id: "r1", seed: 42, match_id: "m1", opponent: "Kim", params: { every: 3000 }, server_now: "2026-01-01T00:00:10.000Z", start_at: "2026-01-01T00:00:15.000Z" }, Date.parse("2026-01-01T00:00:12.000Z"));
  assert.equal(r.roundId, "r1");
  assert.equal(r.seed, 42);
  assert.equal(r.matchId, "m1");
  assert.equal(r.opponent, "Kim");
  assert.equal(r.balance, 0);
  // the server is 2 s behind this device, so the round starts 5 s after the server's now, on this device's clock
  assert.equal(r.startAt, Date.parse("2026-01-01T00:00:17.000Z"));
});

test("the screen uses ctx only, with Classic's calls", () => {
  const src = readFileSync(new URL("../../web/src/newui/screens/Match.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(src, /from ["'][^"']*lib\/supabase["']/);
  assert.doesNotMatch(src, /callFn/);
  for (const call of ["match.find(level)", "match.state()", "match.cancel()", "match.online()", "match.invite(p.id, level)", "rounds.fail(", 'rounds.start("ghost", level, [])', 'rounds.start("pvp", to, [])', "m.ready(readyRound("]) {
    assert.ok(src.includes(call), call);
  }
});

test("level names match lib/arena.ts", () => {
  const src = readFileSync(new URL("../../web/src/lib/arena.ts", import.meta.url), "utf8");
  assert.match(src, /LEVEL_NAME: Record<string, string> = \{ beginner: "Beginner", medium: "Medium", hard: "Hard" \}/);
});
