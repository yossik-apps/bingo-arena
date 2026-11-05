import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Shell fixes: the header title fits in steps, the visitor banner hides during a free-round result, and Delete everything is a danger button.
const root = new URL("../../", import.meta.url);
const src = (path: string) => readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");
const shell = src("web/src/newui/NewShell.tsx");
const css = src("web/src/newui/shell.css");
const shots = src("tools/shots.mjs");

test("the header makes room in order: streak chip, smaller title, smallest title, then an ellipsis", () => {
  assert.match(shell, /if \(!el \|\| fit >= 3 \|\|/);
  assert.match(shell, /fit < 1 && <DailyChip/);
  assert.match(shell, /\$\{fit >= 2 \? " is-small" : ""\}\$\{fit >= 3 \? " is-smaller" : ""\}`\} title=\{title\}>\{title\}<\/h1>/, "the heading keeps the full title as its text");
  assert.match(css, /\.nu-title\.is-small \{ font-size: calc\(22px \* var\(--nu-scale\)\); \}/);
  assert.match(css, /\.nu-title\.is-smaller \{ font-size: calc\(18px \* var\(--nu-scale\)\);/);
  assert.match(css, /\.nu-title \{[^}]*text-overflow: ellipsis;/);
  // turning big text on or off measures again
  assert.match(shell, /const fitKey = `[^`]*\$\{ctx\.settings\.settings\.bigText\}`;/);
});

test("the harness fails a page title cut off before the last step, and any cut title from 390 px in standard text", () => {
  for (const why of ["the streak chip is still shown", "the title is not at its smallest size", "it has no ellipsis", "the heading does not hold the full title", "in standard text it must fit in full"]) assert.ok(shots.includes(why), why);
  assert.match(shots, /window\.innerWidth >= 390 && !document\.documentElement\.classList\.contains\("big-text"\)/);
});

test("the visitor banner hides while a free round's result is showing, as Classic does (!guestRes)", () => {
  assert.match(shell, /\{v && !v\.freeResult && screen !== "help" && screen !== "profile" && \(\n\s+<p className="nu-guestbar">/);
  assert.match(src("web/src/App.tsx"), /gview !== "help" && gview !== "profile" && !guestRes && <p className="toast guestbar">/);
  assert.match(src("web/src/newui/screens/baseFixture.ts"), /freeResult: screen === "result" \? \{ level: "beginner"/);
});

test("Delete everything uses the danger kind", () => {
  assert.match(src("web/src/newui/screens/Profile.tsx"), /<Button kind="danger" disabled=\{!canDelete\(confirm\) \|\| busy\}[^\n]*>Delete everything<\/Button>/);
});
