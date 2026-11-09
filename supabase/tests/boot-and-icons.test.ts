import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

// The parts outside newui that every player sees before the Design flag is known: the loader, the loading cards,
// the icons and the browser colours. They use the new design (newui/tokens.css navy, the playground's gold ball) for everyone.
const root = new URL("../../", import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), "utf8").replace(/\r\n/g, "\n");
const NAVY = "#0b1533";
const tokens = read("web/src/newui/tokens.css");
const visuals = read("web/src/newui/visuals.css");
const css = read("web/src/styles.css");
const app = read("web/src/App.tsx");
const rule = (sel: string) => { const i = css.indexOf(`\n${sel}{`); assert.ok(i >= 0, sel); return css.slice(i + 1, css.indexOf("}", i) + 1); };

test("the colours used are the new design's own", () => {
  assert.ok(tokens.includes(NAVY), "navy page");
  assert.ok(tokens.includes("#1c2d62"), "dark panel");
  for (const c of ["#FFEFB0", "#FFC531", "#D98E00"]) assert.ok(visuals.includes(c), `gold ball ${c}`);
});

test("the loader is the new design for everyone: full-screen navy, the glossy gold ball, Nunito and Lilita One", () => {
  const boot = rule(".shell.boot");
  for (const s of ["position:fixed", "inset:0", "max-width:none", `background:${NAVY}`, "font-family:\"Nunito\""]) assert.ok(boot.includes(s), s);
  const ball = rule(".boot-ball");
  assert.match(ball, /radial-gradient\(circle at 36% 28%,#FFEFB0 0,#FFC531 52%,#D98E00 100%\)/);
  assert.ok(css.includes(".boot-ball::before{"), "gloss");
  assert.match(rule(".boot-ball span"), /font-family:"Lilita One".*color:#14254F/);
  // not tied to light or dark: no theme variables
  assert.doesNotMatch(boot + ball, /var\(--(bg|ink|gold|panel|surf2|mut)\)/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.boot-ball\{animation:none\}\}/);
  // the fonts load before the flag, from main.tsx
  assert.match(read("web/src/main.tsx"), /import "\.\/newui\/fonts";/);
});

test("the loader keeps its text, role and markup in all three places", () => {
  const ball = `<div className="boot-ball" aria-hidden="true"><span>B7</span></div>`;
  assert.equal(app.split(ball).length - 1, 3);
  assert.ok(app.includes(`<div className="shell boot">${ball}<p className="dim" role="status">Loading Bingo Arena…</p></div>`));
  assert.ok(!app.includes(`aria-hidden="true">B7</div>`), "no old ball left");
});

test("loading cards shimmer in navy and stay still with reduced motion", () => {
  const skel = rule(".skel");
  assert.ok(skel.includes("linear-gradient(90deg,#1c2d62 25%,#2c4389 50%,#1c2d62 75%)"));
  assert.ok(skel.includes("border-radius:22px") && skel.includes("animation:sk 1.4s linear infinite"));
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.skel\{animation:none\}\}/);
});

test("browser colours and the manifest use the navy", () => {
  const html = read("web/index.html");
  assert.ok(html.includes(`<meta name="theme-color" content="${NAVY}">`));
  assert.ok(html.includes(`<style>#root:empty{position:fixed;inset:0;background:${NAVY}}</style>`), "no white flash before the app draws");
  assert.ok(!html.includes("#150f2e"));
  const m = JSON.parse(read("web/public/manifest.webmanifest"));
  assert.equal(m.theme_color, NAVY);
  assert.equal(m.background_color, NAVY);
});

const pngSize = (p: string) => { const b = readFileSync(new URL(p, root)); assert.equal(b.toString("ascii", 1, 4), "PNG", p); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test("every icon is made from one SVG source, at the right size", () => {
  assert.ok(existsSync(new URL("web/icons/icon.svg", root)));
  assert.match(read("web/icons/icon.svg"), /<g id="ball">/);
  for (const [f, s] of [["icon-192", 192], ["icon-512", 512], ["icon-1024", 1024], ["icon-maskable-512", 512], ["apple-touch-icon", 180]] as const)
    assert.deepEqual(pngSize(`web/public/${f}.png`), [s, s], f);
  const m = JSON.parse(read("web/public/manifest.webmanifest"));
  for (const i of m.icons) assert.deepEqual(pngSize(`web/public${i.src}`), i.sizes.split("x").map(Number), i.src);
  assert.ok(m.icons.some((i: { purpose?: string }) => i.purpose === "maskable"));
  // the maskable ball (radius 410 + its shadow) stays inside the safe-zone circle (radius 409.6 of 1024)
  const scale = Number(/export const MASKABLE_SCALE = ([\d.]+);/.exec(read("tools/make-icons.mjs"))![1]);
  assert.ok(Math.hypot(0, 900 + 44 - 512) * scale < 409.6 && 410 * scale < 409.6);
});

test("an SVG favicon with a PNG fallback", () => {
  const html = read("web/index.html");
  assert.ok(html.includes(`<link rel="icon" href="/favicon.svg" type="image/svg+xml">`));
  assert.ok(html.includes(`<link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192">`));
  assert.ok(html.includes(`<link rel="apple-touch-icon" href="/apple-touch-icon.png">`));
  assert.match(read("web/public/favicon.svg"), /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 1024 1024">/);
});
