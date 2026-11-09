// Makes every app icon from one source, web/icons/icon.svg, with the installed Edge or Chrome:
//   web/public/icon-192.png, icon-512.png, icon-1024.png   the ball on a full navy square
//   web/public/icon-maskable-512.png                       the ball inside the maskable safe zone (the middle 80% circle)
//   web/public/apple-touch-icon.png (180)                  full square; iOS rounds the corners itself
//   web/public/favicon.svg                                 a rounded navy square, for browser tabs
// Usage: node tools/make-icons.mjs
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");
const web = (p) => fileURLToPath(new URL(`../web/${p}`, import.meta.url));
const src = readFileSync(web("icons/icon.svg"), "utf8");

// variants are made from the source by wrapping its ball: nothing is drawn twice
const ball = /<g id="ball">[\s\S]*?\n  <\/g>/.exec(src)?.[0];
if (!ball) throw new Error('web/icons/icon.svg needs a <g id="ball"> … </g> group');
const defs = /<defs>[\s\S]*?<\/defs>/.exec(src)[0];
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${defs}${body}</svg>`;
// maskable: the ball, shadow included, fits inside the 80% safe-zone circle (radius 410 of 1024 at 0.78 = 320 + margin)
export const MASKABLE_SCALE = 0.78;
const VARIANTS = {
  full: svg(`<rect width="1024" height="1024" fill="#0b1533"/>${ball}`),
  maskable: svg(`<rect width="1024" height="1024" fill="#0b1533"/><g transform="translate(512 512) scale(${MASKABLE_SCALE}) translate(-512 -512)">${ball}</g>`),
  favicon: svg(`<rect width="1024" height="1024" rx="230" fill="#0b1533"/><g transform="translate(512 512) scale(1.06) translate(-512 -500)">${ball}</g>`),
};
const PNGS = [
  ["public/icon-192.png", "full", 192],
  ["public/icon-512.png", "full", 512],
  ["public/icon-1024.png", "full", 1024],
  ["public/icon-maskable-512.png", "maskable", 512],
  ["public/apple-touch-icon.png", "full", 180],
];

writeFileSync(web("public/favicon.svg"), VARIANTS.favicon + "\n");
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? "msedge", headless: true });
try {
  for (const [out, kind, size] of PNGS) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(`<!doctype html><style>html,body{margin:0;background:#0b1533}svg{display:block;width:${size}px;height:${size}px}</style>${VARIANTS[kind]}`);
    await page.screenshot({ path: web(out), clip: { x: 0, y: 0, width: size, height: size } });
    await page.close();
    console.log(`${out} ${size}x${size}`);
  }
} finally { await browser.close(); }
console.log("public/favicon.svg");
