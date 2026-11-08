import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The shared Button's disabled look: clearly off (flat, dashed edge, no 3D shadow), but readable, in light, dark and big text.
const root = new URL("../../", import.meta.url);
const src = (path: string) => readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");
const css = src("web/src/newui/components/components.css");
const tokens = src("web/src/newui/tokens.css");

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
/** a token's value in each block of tokens.css: light first, then dark (system setting), then dark (chosen) */
const values = (name: string) => [...tokens.matchAll(new RegExp(`--nu-${name}: (#[0-9a-f]{6});`, "g"))].map((m) => m[1]);

test("disabled is flat, dashed and not faded", () => {
  const rule = css.match(/\.nu-root \.nu-btn\[disabled\] \{([^}]*)\}/)?.[1] ?? "";
  assert.match(rule, /background: var\(--nu-disabled\);/);
  assert.match(rule, /color: var\(--nu-on-disabled\);/);
  assert.match(rule, /box-shadow: none;/);
  assert.match(rule, /outline: 2px dashed var\(--nu-disabled-line\);/);
  assert.match(rule, /opacity: 1;/, "no fading, which made it unreadable in dark mode");
  assert.match(rule, /cursor: not-allowed;/);
  assert.match(css, /\.nu-btn:active:not\(\[disabled\]\)/, "it does not press down");
});

test("readable text and a visible edge in light and dark", () => {
  for (const name of ["disabled", "on-disabled", "disabled-line", "card", "panel", "bg"]) assert.equal(values(name).length, 3, `${name}: light and both dark blocks`);
  for (const i of [0, 1, 2]) {
    const v = (n: string) => values(n)[i];
    const mode = i === 0 ? "light" : "dark";
    assert.ok(ratio(v("on-disabled"), v("disabled")) >= 4.5, `${mode}: text ${ratio(v("on-disabled"), v("disabled")).toFixed(2)}:1`);
    for (const under of ["card", "panel", "bg"]) assert.ok(ratio(v("disabled-line"), v(under)) >= 3 || ratio(v("disabled"), v(under)) >= 3, `${mode}: the button shows on ${under}`);
  }
  // big text only scales sizes, so it keeps these colours
  assert.match(tokens, /html\.big-text \.nu-root \{ --nu-scale: 1\.18; \}/);
});
