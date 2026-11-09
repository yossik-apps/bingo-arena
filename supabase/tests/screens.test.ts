import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

// The screen contract: every listed screen has its own file, a fixture, and says which ctx groups it uses.
const dir = new URL("../../web/src/newui/screens/", import.meta.url);
const GROUPS = ["profile", "wallet", "rounds", "navigation", "notices", "social", "daily", "dna", "settings", "platform", "visitor", "journey", "season", "quests", "album", "account", "compete", "store", "shop", "history", "inbox", "refer", "match", "auth"];
// only NEW_SCREENS: the registry also holds NEW_OVERLAYS (overlays.test.ts checks that one)
const file = readFileSync(new URL("registry.ts", dir), "utf8");
const from = file.indexOf("export const NEW_SCREENS");
const registry = file.slice(from, file.indexOf("\n};", from) + 3);
const lines = [...registry.matchAll(/^\s*([a-z]+): \(\) => import\("\.\/([A-Za-z]+)"\),\s*$/gm)];

test("the registry has one line per screen and nothing else inside it", () => {
  const body = registry.slice(registry.indexOf("= {") + 3, registry.lastIndexOf("}"));
  const entries = body.split(/\r?\n/).filter((l) => l.trim());
  assert.equal(entries.length, lines.length, 'each entry must be: name: () => import("./Name"),');
});

for (const [, name, file] of lines) {
  test(`${name} follows the contract`, () => {
    assert.equal(file.toLowerCase(), name, "the file is named after the screen");
    assert.ok(existsSync(new URL(`${file}.tsx`, dir)), `${file}.tsx exists`);
    assert.ok(existsSync(new URL(`${file}.fixture.ts`, dir)), `${file}.fixture.ts exists`);
    const src = readFileSync(new URL(`${file}.tsx`, dir), "utf8");
    const uses = src.match(/\/\/ Uses: (.+)/);
    assert.ok(uses, `${file}.tsx has a "// Uses: profile, wallet" comment`);
    for (const g of uses![1].split(",").map((s) => s.trim())) assert.ok(GROUPS.includes(g), `unknown group ${g}`);
    assert.ok(!/design-e/.test(src), "does not import the playground");
  });
}
