import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { overlayNew, NEW_OVERLAYS as LISTED } from "../../web/src/lib/design.ts";
import { NEW_OVERLAYS, OVERLAY_NAMES } from "../../web/src/newui/screens/registry.ts";
import { OVERLAY_PAGES, OVERLAY_VIEWER, overlayFixture } from "../../web/src/newui/overlays/overlayFixture.ts";

// The overlay slot: the views App.tsx draws outside the screen host, each with a NEW_OVERLAYS line like NEW_SCREENS.
const root = new URL("../../", import.meta.url);
const src = (path: string) => readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");
const app = src("web/src/App.tsx");

test("no overlay is listed yet, so every overlay stays Classic for everyone", () => {
  assert.deepEqual(Object.keys(NEW_OVERLAYS), []);
  assert.equal(LISTED.size, 0);
  for (const name of OVERLAY_NAMES) for (const newDesign of [false, true]) assert.equal(overlayNew(name, newDesign), false, `${name} ${newDesign}`);
});

test("each NEW_OVERLAYS line names an overlay and its own file in newui/overlays", () => {
  const reg = src("web/src/newui/screens/registry.ts");
  const from = reg.indexOf("export const NEW_OVERLAYS");
  const body = reg.slice(reg.indexOf("= {", from) + 3, reg.indexOf("\n};", from));
  for (const line of body.split("\n").filter((l) => l.trim())) {
    const m = line.match(/^\s*([A-Za-z]+): \(\) => import\("\.\.\/overlays\/([A-Za-z]+)"\),\s*$/);
    assert.ok(m, `each entry must be: name: () => import("../overlays/Name"), not ${line.trim()}`);
    assert.ok((OVERLAY_NAMES as readonly string[]).includes(m[1]), `${m[1]} is an overlay`);
    assert.equal(m[2], m[1][0].toUpperCase() + m[1].slice(1), "the file is named after the overlay");
    assert.ok(existsSync(new URL(`web/src/newui/overlays/${m[2]}.tsx`, root)), `${m[2]}.tsx exists`);
  }
});

test("a listed overlay uses its new version only where the viewer gets the new design", () => {
  const listed = new Set(["auth"]);
  assert.equal(overlayNew("auth", true, listed), true);
  assert.equal(overlayNew("auth", false, listed), false, "Classic shell, or the flag gives this viewer Classic");
  assert.equal(overlayNew("tour", true, listed), false, "not listed");
});

test("every overlay has a name, a default viewer and sample data", () => {
  assert.deepEqual([...OVERLAY_NAMES].sort(), ["arenaBar", "auth", "firstVisit", "password", "terms", "tour"]);
  assert.deepEqual(Object.keys(OVERLAY_VIEWER).sort(), [...OVERLAY_NAMES].sort());
  for (const name of OVERLAY_NAMES) for (const kind of ["visitor", "player", "guest"]) assert.ok(overlayFixture(name, kind), `${name} ${kind}`);
  assert.deepEqual([...OVERLAY_PAGES].sort(), ["password", "terms"]);
  assert.equal(overlayFixture("auth", "guest").guest, true, "a guest gets the save pop-up");
  assert.equal(overlayFixture("auth", "visitor").guest, false);
  assert.ok(overlayFixture("tour", "player").steps.length > 0);
  // sample people are named as samples, never shown as real players
  const bar = overlayFixture("arenaBar", "player");
  for (const n of [...(bar.arena?.waiting ?? []).map((w) => w.name), ...(bar.arena?.invites ?? []).map((i) => i.from_name)]) assert.match(n, /^Sample /);
});

test("App draws each overlay through its slot, with the Classic view unchanged as the fallback", () => {
  const slots: [string, number, RegExp][] = [
    ["auth", 2, /<AuthGate (reason=\{gate\.reason\}|guest reason="Save your progress")/],
    ["firstVisit", 1, /<FirstVisit crazy=\{onCrazyGames\}/],
    ["tour", 1, /<Tour steps=\{tour\.steps\}/],
    ["arenaBar", 1, /<ArenaBar arena=\{arena\}/],
    ["password", 1, /<SetPassword onDone=\{passwordDone\}/],
    ["terms", 1, /<AgeGate name=\{profile\.display_name\}/],
  ];
  for (const [name, count, classic] of slots) {
    assert.equal([...app.matchAll(new RegExp(`overlay\\("${name}"`, "g"))].length, count, `${name} slots`);
    assert.match(app, classic, `${name}: Classic still drawn`);
  }
  // the gates before the shell get their own page; inside the new shell the pop-ups and the bar are new only there
  assert.match(app, /overlay\("password", gateNew,[\s\S]*?, true\);/);
  assert.match(app, /overlay\("terms", gateNew,[\s\S]*?, true\);/);
  assert.match(app, /const gateNew = chooseDesign\(\{ mode: designFlag, isAdmin: profile\?\.role === "admin", override: designOverride \}\) === "new";/);
  // the Classic shell keeps the Classic views as they were: a visitor's pop-ups and the live-match bar outside the new shell
  assert.match(app, /\n {8}\{gate && <AuthGate reason=\{gate\.reason\}/);
  assert.match(app, /\n {10}<ArenaBar arena=\{arena\} fees=\{arenaFees\} canPlay=\{arenaOpen\} onPlay=\{arenaPlay\} \/>/);
});

test("Classic players never download the overlay host or the sample data", () => {
  assert.match(app, /const OverlayHost = lazy\(\(\) => import\("\.\/newui\/OverlayHost"\)\);/);
  assert.match(app, /const DevOverlay = import\.meta\.env\.DEV \? lazy\(\(\) => import\("\.\/newui\/DevOverlay"\)\) : null;/);
  assert.doesNotMatch(app, /overlayFixture|from "\.\/newui\/OverlayHost"|from "\.\/newui\/DevOverlay"/);
  assert.doesNotMatch(src("web/src/newui/OverlayHost.tsx"), /overlayFixture|baseFixture/);
});

test("the screenshot harness opens overlays with sample data", () => {
  const shots = src("tools/shots.mjs");
  assert.match(shots, /const overlays = gallery \? null : arg\("overlay"\)/);
  assert.match(shots, /&overlay=\$\{screen\}/);
  const dev = src("web/src/newui/DevOverlay.tsx");
  for (const c of ["AuthGate", "AgeGate", "SetPassword", "FirstVisit", "Tour", "ArenaBar"]) assert.match(dev, new RegExp(`case "\\w+": \\{ const c[^\\n]*<${c} `), `DevOverlay draws Classic ${c}`);
});
