import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ScreenGuard from "../../web/src/newui/ScreenGuard.tsx";
import { ago, newPlayersOf, shownName } from "../../web/src/newui/screens/Compete.logic.ts";

const root = new URL("../../", import.meta.url);
// react is installed in web/, not at the repo root
const web = createRequire(new URL("web/package.json", root));
const { createElement } = web("react") as typeof import("react");
const { renderToStaticMarkup } = web("react-dom/server") as typeof import("react-dom/server");
const src = (path: string) => readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");

// ---- the guard: a screen that throws must not take down the shell ----
type G = InstanceType<typeof ScreenGuard>;
const make = (props: Record<string, unknown> = {}) => {
  const g = new ScreenGuard({ children: null, ...props }) as G;
  // a stand-in for React applying setState, so the class can be driven without a browser
  g.setState = ((u: unknown) => { g.state = { ...g.state, ...(typeof u === "function" ? (u as (s: G["state"]) => object)(g.state) : (u as object)) }; }) as G["setState"];
  return g;
};

test("a throwing screen makes the guard fail, and the failure is shown inline with a retry button", () => {
  assert.deepEqual(ScreenGuard.getDerivedStateFromError(), { failed: true });
  const g = make();
  g.state = { failed: true, tries: 0 };
  const html = renderToStaticMarkup(g.render() as never);
  assert.match(html, /This part could not load\. Try again\./);
  assert.match(html, /role="alert"/);
  assert.match(html, /<button[^>]*>Try again<\/button>/);
  assert.doesNotMatch(html, /Something went wrong/, "not the whole-app error page");
});

test("a healthy screen is drawn as it is", () => {
  const html = renderToStaticMarkup(createElement(ScreenGuard, null, createElement("p", null, "all good")));
  assert.match(html, /<p>all good<\/p>/);
  assert.doesNotMatch(html, /could not load/);
});

test("Try again clears the failure, remounts the screen and lets the host forget what failed", () => {
  let forgot = 0;
  const g = make({ onRetry: () => { forgot++; } });
  g.state = { failed: true, tries: 0 };
  g.retry();
  assert.equal(forgot, 1);
  assert.deepEqual(g.state, { failed: false, tries: 1 });
});

test("moving to another screen or tab clears a failure", () => {
  const g = make({ resetKey: "crew" });
  g.state = { failed: true, tries: 0 };
  g.componentDidUpdate({ children: null, resetKey: "crew" });
  assert.equal(g.state.failed, true, "same screen: stays failed until Try again");
  g.props = { children: null, resetKey: "league" } as never;
  g.componentDidUpdate({ children: null, resetKey: "crew" });
  assert.equal(g.state.failed, false);
});

test("every New screen and every Compete tab sits inside a guard, and the shell is outside it", () => {
  const host = src("web/src/newui/ScreenHost.tsx");
  assert.match(host, /<ScreenGuard resetKey=\{name\}[^>]*onRetry=\{\(\) => \{ delete cache\[name\]; \}\}>\s*<Suspense fallback=\{<Skeleton \/>\}><Screen ctx=\{data\} \/><\/Suspense>\s*<\/ScreenGuard>/);
  const compete = src("web/src/newui/screens/Compete.tsx");
  assert.match(compete, /<ScreenGuard resetKey=\{tab\}[^>]*>\s*\{tab === "events"/);
  assert.doesNotMatch(src("web/src/newui/NewShell.tsx"), /ScreenGuard/, "the shell itself is not inside the guard, so it keeps working");
});

// ---- BA-02: Compete > New ----
const row = { user_id: "u1", name: "Maya", level: 3, joined_at: "2026-11-08T10:00:00Z", is_me: false, waved: false };

test("New players: the server's { total, players } answer is read like Classic reads it", () => {
  assert.deepEqual(newPlayersOf({ total: 1, players: [row] }), [row]);
  assert.deepEqual(newPlayersOf([row]), [row], "a plain list still works");
});

test("New players: an empty list, nothing, or the wrong shape gives an empty list, not a crash", () => {
  for (const raw of [{ total: 0, players: [] }, [], null, undefined, {}, { players: null }, "x", 7, { players: {} }]) assert.deepEqual(newPlayersOf(raw), []);
});

test("New players: a player without a name or other fields is shown, a row that is not a player is skipped", () => {
  const [a, b, c] = newPlayersOf({ players: [{ user_id: "a", name: null }, { user_id: "b", name: "  " }, { user_id: "c" }, null, 3, { name: "no id" }, { user_id: "" }] });
  assert.equal(a.name, "New player");
  assert.equal(b.name, "New player");
  assert.deepEqual(c, { user_id: "c", name: "New player", level: 1, joined_at: "", is_me: false, waved: false });
  assert.equal(newPlayersOf({ players: [{ user_id: "a" }, null, 3, { name: "no id" }] }).length, 1);
  assert.equal(shownName(undefined), "New player");
  assert.equal(shownName("Dana"), "Dana");
});

test("New players: a missing or bad join date reads as recent, not NaN", () => {
  assert.equal(ago(""), "joined recently");
  assert.equal(ago("not a date"), "joined recently");
  assert.equal(ago("2026-11-08T10:00:00Z", Date.parse("2026-11-10T12:00:00Z")), "joined 2 days ago");
});
