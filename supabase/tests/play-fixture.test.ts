import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { makeBoard } from "../functions/_shared/engine.ts";
import { moments } from "../../web/src/newui/screens/Play.fixture.ts";

// The Play captures: every state has a moment, its taps are correct taps on the card, and the dev route is not in production.
test("each Play state has a moment with correct, ordered taps", () => {
  assert.deepEqual(Object.keys(moments), ["practice", "v2", "ghost", "countdown", "live", "last", "scoring", "leave", "free"]);
  for (const m of Object.values(moments)) for (let k = 1; k < (m.taps ?? []).length; k++) assert.ok(m.taps![k].t - m.taps![k - 1].t >= 100);
  assert.ok(moments.practice.taps!.length >= 5, "enough taps for a combo");
  assert.equal(moments.leave.click, "Leave round");
  assert.ok(moments.countdown.at < 0);
  assert.ok(makeBoard(1).card.length === 25);
});

test("the dev screen route only exists in local development", () => {
  const app = readFileSync(new URL("../../web/src/App.tsx", import.meta.url), "utf8");
  assert.ok(app.includes('const DevScreen = import.meta.env.DEV ? lazy(() => import("./newui/DevScreen")) : null;'));
  assert.ok(app.includes("const devScreen = import.meta.env.DEV ?"));
});
