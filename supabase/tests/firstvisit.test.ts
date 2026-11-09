import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as L from "../../web/src/newui/overlays/FirstVisit.logic.ts";

const read = (p: string) => readFileSync(new URL(`../../web/src/${p}`, import.meta.url), "utf8");
const classic = read("views/FirstVisit.tsx");
const has = (s: string) => assert.ok(classic.includes(s), `Classic has "${s}"`);

test("the card's words are Classic's", () => {
  assert.equal(L.eyebrow(null), "Bingo Arena · free skill bingo");
  assert.equal(L.eyebrow("Sam"), "Sam invited you · bonus coins inside");
  has("${inviter} invited you · bonus coins inside");
  for (const s of [L.eyebrow(null), L.TITLE, L.SUB, `>${L.HOW}<`, `>${L.HAVE_ACCOUNT}<`, `>${L.LOOK_AROUND}<`, L.legalStart(true), L.legalStart(false), L.TERMS.href, L.PRIVACY.href, `>${L.TERMS.text}<`, `>${L.PRIVACY.text}<`]) has(s);
  assert.equal(L.playText(true), "Starting…");
  assert.equal(L.playText(false), "Play now");
  has("▶  Play now"); has('"Starting…"');
});

test("the three steps are Classic's, word for word", () => {
  const src = classic.slice(classic.indexOf("const STEPS"), classic.indexOf("];") + 2).replace(/\s+/g, " ");
  const mine = read("newui/overlays/FirstVisit.logic.ts");
  assert.equal(mine.slice(mine.indexOf("const STEPS"), mine.indexOf("];") + 2).replace(/\s+/g, " "), src);
  assert.equal(L.STEPS.length, 3);
  assert.equal(L.stepCount(0), "How to play · 1 of 3");
  has("How to play · {step + 1} of {STEPS.length}");
  for (const s of [L.SKIP_PLAY, `>${L.BACK}<`, `>${L.NEXT}<`]) has(s);
  assert.equal(L.isLast(2), true); assert.equal(L.isLast(1), false);
});

test("the card only calls the ctx's play, logIn and close", () => {
  const src = read("newui/overlays/FirstVisit.tsx");
  assert.doesNotMatch(src, /supabase|fetch\(|localStorage/);
  for (const c of ["ctx.play", "ctx.logIn", "ctx.close"]) assert.ok(src.includes(c), c);
  assert.doesNotMatch(src, /key === "Escape"/, "like Classic, Escape does not close it");
});
