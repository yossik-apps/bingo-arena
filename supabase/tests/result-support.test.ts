import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chooseDesign, shellAllowed, visitorScreen } from "../../web/src/lib/design.ts";

// What the new Result screen needs from the shared code: the XP before the round, and a visitor's free-round result.
const web = new URL("../../web/src/", import.meta.url);
const app = readFileSync(new URL("App.tsx", web), "utf8").replace(/\r\n/g, "\n");

const allowedFor = (mode: "off" | "admins" | "all", screens: string[], a: { dev?: boolean; override?: "new" | null } = {}) => (screen: string) =>
  shellAllowed({ screen, design: chooseDesign({ mode, isAdmin: false, override: null }), isAdmin: false, override: a.override ?? null, dev: !!a.dev, screens: new Set(screens) });

test("a visitor's free-round result stays Classic until the new Result is allowed", () => {
  const today = ["lobby", "play", "journey", "collect", "profile", "shop"];
  // flag All, Result not listed: the result waits in Classic's GuestResult, as with !guestRes
  assert.equal(visitorScreen({ screen: "lobby", playing: false, freeResult: true, allowed: allowedFor("all", today) }), null);
  assert.equal(visitorScreen({ screen: "lobby", playing: false, freeResult: false, allowed: allowedFor("all", today) }), "lobby");
  assert.equal(visitorScreen({ screen: "lobby", playing: true, freeResult: false, allowed: allowedFor("all", today) }), "play");
  // once Result is listed, the new Result draws it
  assert.equal(visitorScreen({ screen: "lobby", playing: false, freeResult: true, allowed: allowedFor("all", [...today, "result"]) }), "result");
  // local preview: a visitor previews screens, but never a round or its result
  assert.equal(visitorScreen({ screen: "lobby", playing: false, freeResult: true, allowed: allowedFor("off", today, { dev: true, override: "new" }) }), null);
});

test("with the flag Off or Admins only, a visitor always gets Classic", () => {
  const all = ["lobby", "play", "result", "journey", "collect", "profile", "shop"];
  for (const mode of ["off", "admins"] as const)
    for (const [playing, freeResult] of [[false, false], [true, false], [false, true]])
      assert.equal(visitorScreen({ screen: "lobby", playing, freeResult, allowed: allowedFor(mode, all) }), null, `${mode} ${playing} ${freeResult}`);
});

test("App passes the free-round result through ctx, with Classic GuestResult's choices", () => {
  assert.match(app, /const gnew = visitorScreen\(\{ screen: gview, playing: newRound, freeResult: !!guestRes,/);
  assert.match(app, /result: guestRes \? \{ r: guestRes\.r, p: guestRes\.p, xpBefore: null \} : null/);
  assert.match(app, /freeResult: guestRes \? \{ level: guestRes\.level, left: guestLeft, again: guestLeft > 0 \? \(\) => startGuest\(guestRes\.level\) : null,/);
  // Classic's GuestResult is still there for when the new design is not used
  assert.match(app, /\{guestRes && <GuestResult /);
});

test("the XP before a round is captured when every kind of round starts, and given to the result", () => {
  const starts = [...app.matchAll(/setRound\(r\)/g)].length;
  const captured = [...app.matchAll(/xpAtStart\.current = xpOf\(profile\);\s*setRound\(r\)/g)].length;
  assert.ok(starts >= 2, "start-round and a live match");
  assert.equal(captured, starts, "every setRound(r) records the XP first");
  assert.match(app, /setResult\(\{ r, p, xpBefore: xpAtStart\.current \}\)/);
  assert.match(app, /const xpOf = \(p: Profile \| null\): XpBefore \| null => \(p \? \{ xp: p\.xp, level: lvl\(p\.xp\) \} : null\)/);
  // no server change: nothing new is sent
  assert.doesNotMatch(app, /xpBefore[^\n]*callFn|callFn[^\n]*xpBefore/);
});
