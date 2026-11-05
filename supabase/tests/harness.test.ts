import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The screenshot harness opens any screen from sample data: New always, Classic where it can be drawn, the playground where it has one.
const root = new URL("../../", import.meta.url);
const src = (path: string) => readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");
const shots = src("tools/shots.mjs");
const dev = src("web/src/newui/DevScreen.tsx");
const base = src("web/src/newui/screens/baseFixture.ts");

test("the menu screens, Play and Result open by name, and --direct opens any screen that way", () => {
  const direct = shots.match(/const DIRECT = new Set\((\[[^\]]+\])\)/);
  assert.ok(direct);
  for (const s of ["play", "result", "inbox", "help", "refer", "wallet", "match"]) assert.ok(JSON.parse(direct[1]).includes(s), s);
  assert.match(shots, /has\("direct"\) \|\| DIRECT\.has\(screen\)/);
  assert.match(shots, /matchmaking: "match", results: "result"/);
});

test("Classic is drawn from sample data for Play, Result, Help and Wallet, as App draws them", () => {
  for (const [name, view] of [["play", "Play"], ["result", "Result"], ["help", "Help"], ["wallet", "Wallet"]]) assert.match(dev, new RegExp(`\\n  ${name}: [^\\n]*(\\n\\s+)?<${view} `), name);
  assert.match(dev, /result: \(c\) => c\.rounds\.result && \(\n\s+<Result r=\{c\.rounds\.result\.r\} p=\{c\.rounds\.result\.p\}/, "Classic Result from ctx.rounds.result");
  assert.match(dev, /it loads its own data from the server/, "the others say why they cannot be drawn");
});

test("the result screen gets a sample round in ctx.rounds.result", () => {
  assert.match(base, /result: screen === "result" \? sampleResult\(visitor\) : null/);
  assert.match(base, /xpBefore: visitor \? null : \{ xp: 4964, level: 12 \}/);
  assert.match(base, /achievementNames: \{ lines3: "3 lines in one round" \}/);
});

test("the playground's matching screen: results after one round on the page clock, its matchmaking and profile, none for the rest", () => {
  assert.match(shots, /const pgRound = column === "playground" && !overlays && screen === "result";\n\s+if \(moment \|\| pgRound\) await context\.clock\.install\(\);/);
  assert.match(shots, /for \(let ms = 0; ms < PG_ROUND_MAX_MS && !\(await over\(\)\); ms \+= 5000\) await page\.clock\.runFor\(5000\);/);
  assert.match(shots, /const PG_NONE = new Set\(\["inbox", "help", "refer", "wallet", "admin"\]\);/);
  assert.match(shots, /const PG_BUTTON = \{ profile: \/Open your profile\/ \};/);
  assert.match(shots, /screen === "match"\) await page\.getByRole\("radio", \{ name: \/Person\|Play a person\/ \}\)/);
});
