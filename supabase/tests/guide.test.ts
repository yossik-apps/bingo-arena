import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GUIDE, GUIDE_VERSION, FAQ, GLOSSARY } from "../../web/src/guide/content.ts";

test("every guide step is complete and the version matches", () => {
  const ids = new Set<string>();
  for (const s of GUIDE) {
    assert.ok(s.id && !ids.has(s.id), "unique id: " + s.id); ids.add(s.id);
    assert.ok(Number.isInteger(s.since) && s.since >= 1, s.id + " has a since");
    assert.ok(s.title.length > 2 && s.body.length >= 1 && s.body.every((b) => b.length > 8), s.id + " has text");
  }
  assert.equal(GUIDE_VERSION, Math.max(...GUIDE.map((s) => s.since)));
  assert.ok(FAQ.length >= 5 && FAQ.every((f) => f.q && f.a));
  assert.ok(GLOSSARY.length >= 5);
});

test("the release process keeps the guide up to date", () => {
  const log = readFileSync(new URL("../../CHANGELOG.md", import.meta.url), "utf8");
  const pkg = JSON.parse(readFileSync(new URL("../../web/package.json", import.meta.url), "utf8"));
  const top = log.split(/\n## /)[1] ?? "";
  assert.ok(top.startsWith(pkg.version), `the top CHANGELOG entry (${top.slice(0, 12)}) must be for version ${pkg.version}`);
  assert.ok(/^- Guide:/m.test(top), 'the top CHANGELOG entry needs a line starting "- Guide:" saying what changed in the player guide (or "- Guide: no change")');
});
