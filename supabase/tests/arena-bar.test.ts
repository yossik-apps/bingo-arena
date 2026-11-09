import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { barOf, inviteKey, levelName, onlineNote, playLevel, SEEN_KEY, SEEN_MAX, title, waitKey } from "../../web/src/newui/overlays/ArenaBar.logic.ts";
import type { Arena } from "../../web/src/lib/arena.ts";

const arena: Arena = {
  online: 3, sent: [],
  waiting: [{ id: "a", name: "Kim", level: "medium", waited: 5, player_level: 4 }, { id: "b", name: "Lee", level: "hard", waited: 9, player_level: 9 }],
  invites: [{ id: "7", level: "beginner", from_name: "Ann", waiting: true, created_at: "" }],
};

test("what the bar shows, in Classic's order", () => {
  assert.equal(barOf(null, true, []), null);
  assert.equal(barOf(arena, false, []), null);
  assert.deepEqual(barOf(arena, true, []), { kind: "invite", id: "7", from: "Ann", level: "beginner" });
  assert.deepEqual(barOf(arena, true, [inviteKey("7")]), { kind: "wait", id: "a", name: "Kim", level: "medium", online: 3 });
  assert.equal(barOf(arena, true, [inviteKey("7"), waitKey(arena.waiting[0])])?.id, "b");
  assert.equal(barOf(arena, true, ["i7", "wamedium", "wbhard"]), null);
  assert.equal(barOf({ ...arena, invites: [], waiting: [] }, true, []), null);
});

test("Classic's words, keys and levels", () => {
  assert.equal(SEEN_KEY, "ba_arena_dismissed");
  assert.equal(SEEN_MAX, 50);
  assert.equal(title({ kind: "invite", id: "1", from: "Ann", level: "hard" }), "Ann invites you to a live match");
  assert.equal(title({ kind: "wait", id: "1", name: "Kim", level: "hard", online: 3 }), "Kim is waiting for a live match");
  assert.equal(onlineNote({ kind: "wait", id: "1", name: "Kim", level: "hard", online: 3 }), "3 online");
  assert.equal(onlineNote({ kind: "wait", id: "1", name: "Kim", level: "hard", online: 1 }), null);
  assert.equal(onlineNote({ kind: "invite", id: "1", from: "Ann", level: "hard" }), null);
  assert.equal(playLevel({ level: "hard" }, "beginner"), "hard");
  assert.equal(playLevel(null, "beginner"), "beginner");
  assert.equal(levelName("medium"), "Medium");
  assert.equal(levelName("odd"), "odd");
  const lib = readFileSync("web/src/lib/arena.ts", "utf8");
  for (const [k, v] of Object.entries({ beginner: "Beginner", medium: "Medium", hard: "Hard" })) assert.ok(lib.includes(`${k}: "${v}"`), k);
});

test("the overlay goes through ctx only and keeps Classic's actions", () => {
  const src = readFileSync("web/src/newui/overlays/ArenaBar.tsx", "utf8");
  assert.doesNotMatch(src, /supabase|callFn|\.rpc\(/);
  assert.match(src, /ctx\.answer\(bar\.id, yes\)/);
  const reg = readFileSync("web/src/newui/screens/registry.ts", "utf8");
  assert.match(reg, /arenaBar: \(\) => import\("\.\.\/overlays\/ArenaBar"\)/);
  assert.match(src, /ctx\.play\(playLevel\(r, bar\.level\)\)/);
  assert.match(src, /hide\(waitKey\(bar\)\); ctx\.play\(bar\.level\)/);
  assert.match(src, /role="status" aria-live="polite"/);
  for (const w of ["Accept", "Not now", "Play now", 'aria-label="Hide"']) assert.ok(src.includes(w), w);
  const fx = readFileSync("web/src/newui/overlays/ArenaBar.fixture.ts", "utf8");
  assert.doesNotMatch(fx, /supabase/);
});
