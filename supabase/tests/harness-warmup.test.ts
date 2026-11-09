import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The screenshot harness on a busy machine: warm-up before the first picture, one retry after a timeout, and --help.
const root = new URL("../../", import.meta.url);
const shots = readFileSync(new URL("tools/shots.mjs", root), "utf8").replace(/\r\n/g, "\n");

test("--help and -h print the usage and start nothing", () => {
  for (const flag of ["--help", "-h"]) {
    const t0 = Date.now();
    const r = spawnSync(process.execPath, ["tools/shots.mjs", flag], { cwd: fileURLToPath(root), encoding: "utf8", timeout: 20000 });
    assert.equal(r.status, 0, flag);
    assert.match(r.stdout, /^Screenshot harness: captures Playground, Classic and New/);
    assert.match(r.stdout, /--help \(or -h\) prints this text and starts nothing\./);
    assert.doesNotMatch(r.stdout, /^\/\//m, "no comment markers");
    assert.ok(Date.now() - t0 < 15000, "no dev server or browser was started");
  }
  // it exits before the port check, the servers and the browser
  assert.ok(shots.indexOf("process.exit(0);\n}") < shots.indexOf("const PORTS ="));
});

test("each dev server is warmed up, with writes blocked, before the first picture", () => {
  const main = shots.slice(shots.indexOf("let failed = false;"));
  assert.ok(main.indexOf("await warmUp(BASE,") > main.indexOf("serve(join(ROOT, \"web\"), PORT);"));
  assert.ok(main.indexOf("await warmUp(BASE,") < main.indexOf("captureOrRetry(screen, column, sz, mode)"));
  assert.match(main, /if \(compare\.includes\("playground"\)\) await warmUp\(PG_BASE,/);
  // the warm-up and the moments loader open the app too, so their writes are blocked like every picture's
  assert.match(shots, /async function guardedPage\(b\) \{ const context = await b\.newContext\(\); await guard\(context\); return context\.newPage\(\); \}/);
  assert.equal(shots.match(/await b\.newPage\(\)/g), null, "no page without the guard");
  assert.match(shots, /const LOAD_MS = 30000, RETRY_MS = 90000, WARM_MS = 180000;/);
});

test("a picture that times out is tried once more with a longer wait, then reported instead of stopping the run", () => {
  assert.match(shots, /context\.setDefaultNavigationTimeout\(loadMs\);/);
  const retry = shots.slice(shots.indexOf("async function captureOrRetry"), shots.indexOf("\n}\n", shots.indexOf("async function captureOrRetry")));
  assert.match(retry, /if \(!isTimeout\(e\)\) throw e;/, "other errors still stop the run");
  assert.match(retry, /loadMs = RETRY_MS;/);
  assert.match(retry, /finally \{ loadMs = LOAD_MS; \}/);
  assert.match(retry, /the page did not load in \$\{RETRY_MS \/ 1000\} s, twice/);
  assert.equal(shots.match(/await capture\(screen, column, sz, mode\)/g)?.length, 2, "only through captureOrRetry");
  assert.match(shots, /const r = await captureOrRetry\(screen, column, sz, mode\);/);
});

test("big-text pictures are really in big text, on the gallery and the direct screens too", () => {
  // the gallery and the direct screens skip the game's settings, and the start-up script can run before <html> exists
  assert.match(shots, /const on = \(\) => \{ if \(!document\.documentElement\) return false; document\.documentElement\.classList\.add\("big-text"\); return true; \};/);
  assert.match(shots, /if \(!on\(\)\) new MutationObserver\(\(_, o\) => \{ if \(on\(\)\) o\.disconnect\(\); \}\)\.observe\(document, \{ childList: true \}\);/);
  assert.doesNotMatch(shots, /document\.documentElement\?\.classList\.add\("big-text"\)/, "the old one-shot add, which did nothing before <html> existed");
  // a big-text picture without the class fails
  assert.match(shots, /const bigOk = mode !== "bigtext" \|\| await page\.evaluate\(\(\) => document\.documentElement\.classList\.contains\("big-text"\)\);/);
  assert.match(shots, /\.\.\.\(bigOk \? \[\] : \["big text did not apply"\]\)/);
});

test("a first picture taken before the new design drew is tried once more", () => {
  assert.match(shots, /const NOT_DRAWN = "new shell did not render";/);
  assert.ok(shots.includes("if (!r.problems.includes(NOT_DRAWN) && !r.problems.includes(NO_DIALOG)) return r;"));
  assert.match(shots, /return \{ name, problems: \[NOT_DRAWN\] \};/);
});

test("a New overlay picture waits for its dialog to be on screen, and is retried once if it never shows", () => {
  assert.ok(shots.includes('const dialogShown = !overlays || column !== "new" || await page.locator("[role=dialog]").first().waitFor({ state: "visible", timeout: 15000 }).then(() => page.waitForTimeout(500)).then(() => true, () => false);'));
  assert.ok(shots.includes(`const NO_DIALOG = "the overlay's dialog did not show";`));
  assert.ok(shots.includes("...(dialogShown ? [] : [NO_DIALOG])"));
  // the wait comes before the picture
  assert.ok(shots.indexOf("const dialogShown") < shots.indexOf("await page.screenshot({ path: join(dir, name), fullPage: gallery });"));
});

test("the tab bar limits what is on screen only when nothing covers it", () => {
  assert.ok(shots.includes("const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);"));
  assert.ok(shots.includes("return top && !b.contains(top) ? window.innerHeight : r.top;"));
});
