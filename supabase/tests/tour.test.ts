import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as L from "../../web/src/newui/overlays/Tour.logic.ts";
import { GUIDE } from "../../web/src/guide/content.ts";
import { label } from "../../web/src/lib/ui.tsx";

const read = (p: string) => readFileSync(new URL(`../../web/src/${p}`, import.meta.url), "utf8");
const classic = read("views/Tour.tsx");
const has = (s: string) => assert.ok(classic.includes(s), `Classic has "${s}"`);
const icons = read("newui/Icon.tsx");

test("the tour's words are Classic's", () => {
  assert.equal(L.counter("Quick tour", 0, 21), "Quick tour · 1 of 21");
  has("{heading} · {i + 1} of {steps.length}");
  for (const s of [`>${L.SKIP}<`, `>${L.OPEN_NOW}<`, `>${L.BACK}<`, `"${L.nextText(true)}"`, `"${L.nextText(false)}"`]) has(s);
  assert.equal(L.showOpen(true, false), true);
  assert.equal(L.showOpen(true, true), false, "never on the last step");
  assert.equal(L.showOpen(false, false), false);
});

test("the practice board is Classic's: the same cells, target, words and ball label", () => {
  has(`const cells = [${L.DEMO_CELLS.join(", ")}];`);
  has(`const target = ${L.DEMO_TARGET};`);
  assert.equal(L.ballLabel(L.DEMO_TARGET), label(L.DEMO_TARGET));
  for (const n of [1, 15, 16, 31, 46, 61, 75]) assert.equal(L.ballLabel(n), label(n));
  assert.equal(L.demoText(false), "The ball says N45. Tap 45 on the card.");
  has("`The ball says ${label(target)}. Tap ${target} on the card.`");
  for (const s of [L.demoText(true), `"${L.DEMO_LABEL}"`, `>${L.TRY_AGAIN}<`, '", tapped"']) has(s);
  assert.equal(L.cellLabel(45, true), "45, tapped");
  assert.equal(L.cellLabel(7, true), "7");
});

test("every guide step's icon has a new-design icon", () => {
  for (const s of GUIDE) {
    const n = L.ICONS[s.icon];
    assert.ok(n, `${s.id}: icon "${s.icon}" is mapped`);
    if (n !== "coin" && n !== "gem") assert.match(icons, new RegExp(`\\n  ${n}: '`), `${n} is in the new icon set`);
  }
});

test("the tour only calls the ctx's close and go, and Escape closes it as in Classic", () => {
  const src = read("newui/overlays/Tour.tsx");
  assert.doesNotMatch(src, /supabase|fetch\(|localStorage/);
  for (const c of ["ctx.close", "ctx.go("]) assert.ok(src.includes(c), c);
  assert.match(src, /key === "Escape"/);
});
