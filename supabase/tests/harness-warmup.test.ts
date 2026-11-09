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

// The harness's own wait for a New overlay, taken from tools/shots.mjs and run against a stand-in page.
const waitStart = shots.indexOf("const overlayReady = ");
const waitEnd = shots.indexOf("}).then(() => true, () => false);", waitStart) + "}).then(() => true, () => false);".length;
const waitCode = shots.slice(waitStart + "const overlayReady = ".length, waitEnd - 1);
type Fake = { ready: boolean; dialogs: number; loading?: boolean };
async function overlayWait(fake: Fake, overlays: string[] | null = ["x"], column = "new") {
  const calls: string[] = [];
  const page = {
    locator: (sel: string) => ({
      waitFor: async (o: { state: string; timeout: number }) => { calls.push(`waitFor ${sel} ${o.state}`); if (!fake.ready) throw new Error(`Timeout ${o.timeout}ms exceeded`); },
      count: async () => { calls.push(`count ${sel}`); return sel === "[role=dialog]" ? fake.dialogs : 1; },
    }),
    waitForTimeout: async (ms: number) => { calls.push(`sleep ${ms}`); },
    waitForFunction: async (fn: () => boolean, _arg: unknown, o: { timeout: number }) => {
      calls.push(`until ${String(fn).replace(/\s+/g, " ")}`);
      if (fake.loading) throw new Error(`Timeout ${o.timeout}ms exceeded`);
    },
  };
  const run = new Function("page", "overlays", "column", `return (async () => ${waitCode})();`) as (p: unknown, o: unknown, c: string) => Promise<boolean>;
  return { ok: await run(page, overlays, column), calls };
}

test("an overlay with no dialog (terms, password, the live-match bar, even drawing nothing) is captured as soon as it is ready", async () => {
  // these New overlays really have no dialog
  for (const f of ["Terms", "Password", "ArenaBar"]) {
    const src = readFileSync(new URL(`web/src/newui/overlays/${f}.tsx`, root), "utf8");
    assert.doesNotMatch(src, /role="dialog"|<Sheet|<Modal/, f);
  }
  const r = await overlayWait({ ready: true, dialogs: 0 });
  assert.equal(r.ok, true);
  assert.deepEqual(r.calls, ["waitFor html[data-overlay-ready] attached", `until () => !document.querySelector(".nu-skel")`, "count [role=dialog]"], "no wait for a dialog, no 500 ms");
  // the screen behind it still loading counts as not ready (the picture is retried)
  assert.equal((await overlayWait({ ready: true, dialogs: 0, loading: true })).ok, false);
});

test("an overlay with a dialog waits 500 ms more for the sheet to rise; one that never becomes ready is reported and retried", async () => {
  const sheet = await overlayWait({ ready: true, dialogs: 1 });
  assert.equal(sheet.ok, true);
  assert.deepEqual(sheet.calls, ["waitFor html[data-overlay-ready] attached", `until () => !document.querySelector(".nu-skel")`, "count [role=dialog]", "sleep 500"]);
  const never = await overlayWait({ ready: false, dialogs: 0 });
  assert.equal(never.ok, false);
  assert.ok(shots.includes('const NO_DIALOG = "the overlay never became ready";'));
  assert.ok(shots.includes("...(overlayReady ? [] : [NO_DIALOG])"));
  // Classic pictures and screens do not wait
  for (const [o, c] of [[null, "new"], [["x"], "classic"]] as const) assert.deepEqual((await overlayWait({ ready: false, dialogs: 0 }, o as string[] | null, c)).calls, []);
  // the wait comes before the picture
  assert.ok(waitStart > 0 && waitStart < shots.indexOf("await page.screenshot({ path: join(dir, name), fullPage: gallery });"));
});

test("DevOverlay marks the page ready after the overlay has drawn, also when it is not redesigned yet", () => {
  const dev = readFileSync(new URL("web/src/newui/DevOverlay.tsx", root), "utf8").replace(/\r\n/g, "\n");
  assert.ok(dev.includes("document.documentElement.dataset.overlayReady = name;"));
  // rendered after the overlay, so its effect runs once the overlay has committed, even if it returned null
  assert.ok(dev.includes("return C ? <><C ctx={ctx} /><Ready name={name} /></> : null;"));
  assert.ok(dev.includes("if (!has) return <NewPage>{missing}<Ready name={name} /></NewPage>;"));
});

test("the tab bar limits what is on screen only when nothing covers it", () => {
  assert.ok(shots.includes("const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);"));
  assert.ok(shots.includes("return top && !b.contains(top) ? window.innerHeight : r.top;"));
});
