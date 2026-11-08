import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canContinue, consentStart, CONTINUE, intro, LOG_OUT, PRIVACY, TERMS, title } from "../../web/src/newui/overlays/Terms.logic.ts";

const classic = readFileSync(new URL("../../web/src/views/AgeGate.tsx", import.meta.url), "utf8");

test("the title and intro are Classic's, for a new player and after an update", () => {
  assert.equal(title("Sam", false), "Welcome, Sam");
  assert.equal(title("Sam", true), "We updated our terms");
  assert.equal(intro(false), "One last step before you play.");
  assert.equal(intro(true), "Please review and accept the new Terms and Privacy Policy to keep playing.");
});

test("the consent line has the age words on the web only, as in Classic", () => {
  assert.equal(consentStart(false), "I am 18 or older, and I have read and agree to the ");
  assert.equal(consentStart(true), "I have read and agree to the ");
});

test("every word and link is the same as in Classic's AgeGate", () => {
  for (const s of [title("X", true), intro(false), intro(true), consentStart(false), consentStart(true), TERMS.text, PRIVACY.text, TERMS.href, PRIVACY.href, `>${CONTINUE}<`, `>${LOG_OUT}<`]) {
    assert.ok(classic.includes(s), `Classic has "${s}"`);
  }
  assert.ok(classic.includes("`Welcome, ${name}`"));
});

test("Continue needs the box ticked, and is off while sending", () => {
  assert.equal(canContinue(false, false), false);
  assert.equal(canContinue(true, false), true);
  assert.equal(canContinue(true, true), false);
});
