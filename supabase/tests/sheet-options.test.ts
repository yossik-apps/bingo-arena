import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The shared Sheet's two options for long pop-ups such as sign-up: closeText (Classic's "Not now" at the top) and tall.
const root = new URL("../../", import.meta.url);
const src = (path: string) => readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");
const comp = src("web/src/newui/components/index.tsx");
const css = src("web/src/newui/components/components.css");
const sheet = comp.slice(comp.indexOf("export function Sheet"), comp.indexOf("export const Modal"));

test("closeText: the close button says it, sits at the top, and there is no second Close at the bottom", () => {
  assert.match(comp, /closeText\?: string;/);
  // at the top, in the head row, after the title (or a spacer when there is no title)
  assert.ok(sheet.includes('<div className="nu-sheethead">{title ? <h2>{title}</h2> : <span className="nu-sheetgap" />}<Button kind="ghost" size="sm" onClick={onClose}>{closeText}</Button></div>'));
  assert.ok(sheet.indexOf("{closeText}</Button>") < sheet.indexOf("{children}"), "above the content");
  // the bottom Close only without closeText
  assert.ok(sheet.includes('{closeText === undefined && <Button kind="ghost" size="md" onClick={onClose}>Close</Button>}'));
  assert.equal(sheet.match(/>Close<\/Button>/g)?.length, 1);
  // Escape, the scrim and the focus trap still close and hold focus as before
  assert.match(sheet, /if \(e\.key === "Escape"\) close\.current\(\);/);
  assert.match(sheet, /<div className=\{`nu-scrim\$\{modal \? " is-modal" : ""\}`\} onClick=\{onClose\}>/);
  assert.match(css, /\.nu-sheetgap \{ flex: 1; \}/);
});

test("tall: the screen less 24 px, like Classic's pop-up; a phone bottom sheet takes that height", () => {
  assert.match(comp, /tall\?: boolean;/);
  assert.ok(sheet.includes('className={`nu-sheet${tall ? " is-tall" : ""}`}'));
  assert.match(css, /\.nu-sheet\.is-tall \{ max-height: calc\(100vh - 24px\); max-height: calc\(100dvh - 24px\); \}/);
  assert.match(css, /@media \(max-width: 999\.98px\) \{ \.nu-scrim:not\(\.is-modal\) \.nu-sheet\.is-tall \{ height: calc\(100vh - 24px\); height: calc\(100dvh - 24px\); \} \}/);
  // Classic's pop-up card, for comparison
  assert.match(src("web/src/styles.css"), /\.tour-card\{[^}]*max-height:calc\(100vh - 24px\)/);
  // the default sheet is unchanged
  assert.match(css, /\.nu-sheet \{ width: 100%; max-height: 92vh;/);
});

test("Modal takes the same options, and the gallery shows a tall sheet with Not now", () => {
  assert.match(comp, /export const Modal = \(p: Omit<SheetProps, "modal">\) => <Sheet \{\.\.\.p\} modal \/>;/);
  const g = src("web/src/newui/Gallery.tsx");
  assert.match(g, /<Sheet label="Sample sign-up form" title="Save your progress" closeText="Not now" tall onClose=/);
  assert.match(g, /setOpen\("tall"\)\}>Tall sheet with Not now<\/Button>/);
});
