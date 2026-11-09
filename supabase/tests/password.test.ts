import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { check, INTRO, NEW_LABEL, REPEAT_LABEL, SAVE, TITLE } from "../../web/src/newui/overlays/Password.logic.ts";

const read = (p: string) => readFileSync(new URL(`../../web/src/${p}`, import.meta.url), "utf8");
const classic = read("views/SetPassword.tsx");

test("every word is the same as in Classic's SetPassword", () => {
  for (const s of [`<h1>${TITLE}</h1>`, `<p>${INTRO}</p>`, `>${NEW_LABEL}<`, `>${REPEAT_LABEL}<`, `>${SAVE}<`, check("short", "short")!, check("12345678", "87654321")!]) {
    assert.ok(classic.includes(s), `Classic has "${s}"`);
  }
});

test("the two checks come in Classic's order", () => {
  assert.equal(check("", ""), "Password must be at least 8 characters.");
  assert.equal(check("short", "other"), "Password must be at least 8 characters.", "length first");
  assert.equal(check("12345678", "1234567"), "The two passwords do not match.");
  assert.equal(check("12345678", "12345678"), null);
});

test("the page saves only through ctx.password and never talks to Supabase itself", () => {
  const src = read("newui/overlays/Password.tsx");
  assert.doesNotMatch(src, /supabase|fetch\(/);
  assert.ok(src.includes("ctx.save(pw)"));
  assert.ok(src.includes("ctx.done()"));
});
