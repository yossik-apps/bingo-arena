import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Shared pieces: the danger Button, notices.composing, the multiline TextField and three icons.
const root = new URL("../../", import.meta.url);
const src = (path: string) => readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");
const tokens = src("web/src/newui/tokens.css");
const css = src("web/src/newui/components/components.css");
const comp = src("web/src/newui/components/index.tsx");
const app = src("web/src/App.tsx");

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const token = (name: string) => { const m = tokens.match(new RegExp(`--${name}: (#[0-9a-f]{6});`)); assert.ok(m, name); return m[1]; };

test("the danger button has at least 4.5:1 contrast in light, dark and big text", () => {
  assert.ok(ratio(token("nu-danger"), token("nu-on-danger")) >= 4.5);
  // the dark themes and big text do not redefine the danger colours, so the light pair is the pair everywhere
  assert.equal(tokens.match(/--nu-danger:/g)?.length, 1);
  assert.doesNotMatch(tokens.match(/html\.big-text[^}]*\}/)?.[0] ?? "", /danger/);
  assert.match(css, /\.nu-root \.nu-btn-danger \{ background: var\(--nu-danger\); color: var\(--nu-on-danger\);/);
  assert.match(comp, /kind\?: "gold" \| "green" \| "white" \| "panel" \| "ghost" \| "danger"/);
});

test("Leave crew and Delete account use the danger kind, with no local recolouring", () => {
  assert.match(src("web/src/newui/screens/Compete.tsx"), /kind="danger"[^\n]*>Leave crew<\/Button>/);
  assert.match(src("web/src/newui/screens/Profile.tsx"), /kind="danger" expanded=\{delOpen\}[^\n]*>Delete account<\/Button>/);
  assert.doesNotMatch(src("web/src/newui/screens/compete.css"), /\.nu-btn \{ background/);
  assert.doesNotMatch(src("web/src/newui/screens/profile.css"), /nu-pf-danger/);
});

test("notices.composing comes from App's compose state; a visitor is never composing", () => {
  assert.match(src("web/src/newui/screens/contract.ts"), /\n  composing: boolean;\n/);
  assert.match(app, /contactUs: \(\) => \{ setCompose\(true\); setView\("inbox"\); \}, composing: compose \}/);
  assert.match(app, /in your inbox"\), composing: false \}/);
  // the inbox button and tab clear it, as in Classic
  assert.match(app, /go: \(v\) => \{ if \(v === "inbox"\) setCompose\(false\);/);
});

test("TextField has a multiline option with rows and a character count", () => {
  assert.match(comp, /multiline\?: boolean; rows\?: number;/);
  assert.match(comp, /<textarea \{\.\.\.common\} rows=\{rows\}/);
  assert.match(comp, /\{value\.length\} of \{maxLength\} characters/);
});

test("the three new icons are in Icon and in the gallery", () => {
  const icon = src("web/src/newui/Icon.tsx"), gallery = src("web/src/newui/Gallery.tsx");
  for (const n of ["swords", "wave", "megaphone"]) {
    assert.match(icon, new RegExp(`\\n  ${n}: '<path`), n);
    assert.match(gallery, new RegExp(`"${n}"`), n);
  }
  assert.match(gallery, /kind="danger"/);
  assert.match(gallery, /<TextField label="Your message" multiline/);
});
