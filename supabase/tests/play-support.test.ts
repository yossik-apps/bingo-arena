import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as engine from "../functions/_shared/engine.ts";
import { makeBoard, missedCount, scoreTaps, type Params, type Tap } from "../functions/_shared/engine.ts";
import { localResult, roundCalls } from "../../web/src/lib/roundCalls.ts";
import { shellAllowed } from "../../web/src/lib/design.ts";
import { FULLSCREEN } from "../../web/src/newui/screens/registry.ts";
import type { RoundStart } from "../../web/src/views/Play.tsx";

// What the new Play screen needs from the shared code: the round calls, full-screen mode and the visitor's free round.
const web = new URL("../../web/src/", import.meta.url);
const src = (path: string) => readFileSync(new URL(path, web), "utf8").replace(/\r\n/g, "\n");

const P = { every: 3000, win: 3, pt: 1, pen: 8, hint: false, xm: 1, fee: 10, gl: 150, gr: 100 } as Params;
const round = (seed: number): RoundStart => ({ roundId: "", seed, balance: 0, local: true, params: { ...P, total: 100, pay: 1.8, ghost: null } });
const tapsFor = (seed: number) => {
  const { card, seq } = makeBoard(seed);
  const taps: Tap[] = [];
  seq.slice(0, 20).forEach((n, k) => { const i = card.indexOf(n); if (i >= 0 && i !== 12) taps.push({ i, t: k * P.every + 800 }); });
  return taps;
};

test("submit makes Classic Play's call and returns the server's result", async () => {
  const sent: [string, unknown][] = [];
  const result = { score: 120 };
  const calls = roundCalls(async <T,>(name: string, body: unknown) => { sent.push([name, body]); return result as T; }, (c) => c);
  const taps = [{ i: 3, t: 900 }];
  assert.equal(await calls.submit("r-1", taps), result);
  assert.deepEqual(sent, [["submit-round", { roundId: "r-1", taps }]]);
});

test("a failed submit gives a message ready to show", async () => {
  const calls = roundCalls(async () => { throw new Error("round_expired"); }, (c) => `readable ${c}`);
  await assert.rejects(calls.submit("r-1", []), { message: "readable round_expired" });
});

test("abandon makes Classic Play's call and ignores errors", async () => {
  const sent: [string, unknown][] = [];
  const ok = roundCalls(async <T,>(name: string, body: unknown) => { sent.push([name, body]); return null as T; }, (c) => c);
  await ok.abandon("r-2");
  assert.deepEqual(sent, [["submit-round", { roundId: "r-2", abandon: true }]]);
  const failing = roundCalls(async () => { throw new Error("server_error"); }, (c) => c);
  await assert.doesNotReject(failing.abandon("r-2"));
});

test("the calls match the ones Classic Play still makes itself", () => {
  const play = src("views/Play.tsx");
  assert.ok(play.includes('callFn<RoundResult>("submit-round", { roundId: round.roundId, taps: taps.current })'), "Classic submit unchanged");
  assert.ok(play.includes('callFn("submit-round", { roundId: round.roundId, abandon: true })'), "Classic abandon unchanged");
  assert.ok(!play.includes("roundCalls"), "Classic Play keeps its own calls");
});

test("a visitor's free round is scored on the device exactly as in Classic", () => {
  for (const seed of [7, 42, 99]) {
    const r = round(seed), taps = tapsFor(seed);
    const s = scoreTaps(seed, r.params, taps);
    assert.deepEqual(localResult(r, taps), { ...s, missed: missedCount(seed, r.params, s.marked, 100_000), win: false, prize: 0, xp: 0, ghost: null, best: null, balance: 0, level: 1, achievements: [], mode: "local" });
  }
  assert.equal(localResult(round(7), []).score, 0);
});

test("Play is full screen and the shell then draws nothing of its own", () => {
  assert.ok(FULLSCREEN.has("play"));
  const shell = src("newui/NewShell.tsx");
  const early = shell.split("\n").find((l) => l.includes("if (full) return"));
  assert.ok(early, "NewShell returns early for a full-screen screen");
  for (const part of ["nu-head", "nu-rail", "nu-tabsbar", "banners", "overlays", "Sheet"]) assert.ok(!early!.includes(part), `no ${part} in full screen`);
  assert.ok(early!.includes("{children}"));
});

test("a free round uses the new Play only when the flag gives New and Play is listed", () => {
  const withPlay = new Set(["lobby", "play"]), without = new Set(["lobby"]);
  const ask = (design: "new" | "classic", screens: Set<string>, override: "new" | null = null, dev = false) => shellAllowed({ screen: "play", design, isAdmin: false, override, dev, screens });
  assert.equal(ask("new", withPlay), true);
  assert.equal(ask("classic", withPlay), false, "flag Off: Classic");
  assert.equal(ask("new", without), false, "Play not finished: Classic");
  assert.equal(ask("classic", withPlay, "new", true), false, "a preview link does not open a round");
  const app = src("App.tsx");
  assert.ok(app.includes('const newRound = !!guestRound && shellAllowed({ screen: "play", design: gdesign, isAdmin: false, override: designOverride, dev: import.meta.env.DEV });'));
  assert.ok(app.includes("if (guestRound && !newRound) {"), "otherwise the Classic free round, as before");
});

test("PATTERN.md allows the pure engine helpers for display only", () => {
  const pattern = src("newui/screens/PATTERN.md");
  for (const name of ["makeBoard", "scoreTaps", "status"]) {
    assert.ok(pattern.includes(`\`${name}\``), `mentions ${name}`);
    assert.equal(typeof (engine as Record<string, unknown>)[name], "function", `@engine exports ${name}`);
  }
  assert.match(pattern, /The server decides every score/);
});
