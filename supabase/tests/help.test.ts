import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { facebookLink, footer, SECTIONS, WORDS } from "../../web/src/newui/screens/Help.logic.ts";
import { FAQ, GLOSSARY, GUIDE, GUIDE_VERSION } from "../../web/src/guide/content.ts";

test("every guide section, question and word is shown, unchanged and in order", () => {
  assert.equal(SECTIONS.guide, GUIDE);
  assert.equal(SECTIONS.faq, FAQ);
  assert.equal(SECTIONS.glossary, GLOSSARY);
  assert.ok(GUIDE.length > 0 && FAQ.length > 0 && GLOSSARY.length > 0);
});

test("the footer names the guide version, as in Classic", () => {
  assert.equal(footer(), `Guide version ${GUIDE_VERSION}. The guide is updated whenever the game gets new features.`);
});

test("the Facebook button shows only when a link is set", () => {
  assert.equal(facebookLink("https://www.facebook.com/x"), "https://www.facebook.com/x");
  assert.equal(facebookLink(""), null, "empty on CrazyGames or when not set");
  assert.equal(facebookLink(null), null);
});

test("Classic's wording is kept", () => {
  const classic = readFileSync(new URL("../../web/src/views/Help.tsx", import.meta.url), "utf8");
  for (const w of Object.values(WORDS)) assert.ok(classic.includes(w), `Classic Help says "${w}"`);
});

test("the screen uses ctx's tour and Contact us, which ask a visitor to sign up", () => {
  const src = readFileSync(new URL("../../web/src/newui/screens/Help.tsx", import.meta.url), "utf8");
  assert.match(src, /ctx\.settings\.replayTour/);
  assert.match(src, /ctx\.notices\.contactUs/);
  assert.doesNotMatch(src, /supabase|callFn/);
});
