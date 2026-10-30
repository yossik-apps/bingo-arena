import test from "node:test";
import assert from "node:assert/strict";
import { FLAG_WAIT_MS, forgetDesignFlag, loadDesignFlag, parseMode, readFlag, type FlagMode } from "../../web/src/lib/flags.ts";
import { chooseDesign, loadOverride, screenDesign, shellAllowed, withoutOverride, type Design } from "../../web/src/lib/design.ts";

const row = (mode: unknown) => async () => ({ data: { mode }, error: null });

test("flag values are read as they are", async () => {
  assert.equal(await readFlag(row("off")), "off");
  assert.equal(await readFlag(row("admins")), "admins");
  assert.equal(await readFlag(row("all")), "all");
});

test("a missing table, an error, a missing row or an unknown value means off", async () => {
  assert.equal(await readFlag(async () => ({ data: null, error: { message: 'relation "public.feature_flags" does not exist' } })), "off");
  assert.equal(await readFlag(async () => { throw new Error("network down"); }), "off");
  assert.equal(await readFlag(async () => ({ data: null, error: null })), "off");
  for (const v of ["ALL", "on", "", 1, true, null, undefined]) assert.equal(parseMode(v), "off", String(v));
  assert.equal(await readFlag(row("ALL")), "off");
});

test("an answer that comes too late means off", async () => {
  const slow = () => new Promise<{ data: { mode: string }; error: null }>((done) => { setTimeout(() => done({ data: { mode: "all" }, error: null }), 40); });
  assert.equal(await readFlag(slow, 5), "off");
  assert.equal(await readFlag(slow, 500), "all");
  assert.equal(FLAG_WAIT_MS, 800);
});

test("the flag is read once per page load", async () => {
  forgetDesignFlag();
  let reads = 0;
  const read = async () => { reads++; return { data: { mode: "all" }, error: null }; };
  assert.equal(await loadDesignFlag(read), "all");
  assert.equal(await loadDesignFlag(async () => ({ data: { mode: "off" }, error: null })), "all", "an open tab keeps its value");
  assert.equal(reads, 1);
  forgetDesignFlag();
});

test("design choice for every flag state, admin and guest", () => {
  const cases: [FlagMode, boolean, Design][] = [
    ["off", false, "classic"], ["off", true, "classic"],
    ["admins", false, "classic"], ["admins", true, "new"],
    ["all", false, "new"], ["all", true, "new"],
  ];
  for (const [mode, isAdmin, want] of cases) assert.equal(chooseDesign({ mode, isAdmin, override: null }), want, `${mode} admin=${isAdmin}`);
});

test("the override counts only for a signed-in admin", () => {
  for (const mode of ["off", "admins", "all"] as FlagMode[]) {
    assert.equal(chooseDesign({ mode, isAdmin: true, override: "new" }), "new", mode);
    assert.equal(chooseDesign({ mode, isAdmin: true, override: "classic" }), "classic", mode);
    assert.equal(chooseDesign({ mode, isAdmin: false, override: mode === "all" ? "classic" : "new" }), mode === "all" ? "new" : "classic", mode);
  }
});

test("a screen without a new version stays Classic", () => {
  const some = new Set(["lobby"]);
  assert.equal(screenDesign("lobby", "new", some), "new");
  assert.equal(screenDesign("shop", "new", some), "classic");
  assert.equal(screenDesign("lobby", "classic", some), "classic");
  assert.equal(screenDesign("lobby", "new"), "classic", "no screen is redesigned yet");
});

test("players never get the empty shell, whatever the flag says", () => {
  for (const design of ["classic", "new"] as Design[]) {
    for (const override of [null, "new", "classic"] as (Design | null)[]) {
      assert.equal(shellAllowed({ screen: "lobby", design, isAdmin: false, override, dev: false }), false, `${design} ${override}`);
    }
  }
});

test("the shell shows on a screen with a new version only when the design is New", () => {
  const some = new Set(["lobby"]);
  assert.equal(shellAllowed({ screen: "lobby", design: "new", isAdmin: false, override: null, dev: false, screens: some }), true);
  assert.equal(shellAllowed({ screen: "lobby", design: "classic", isAdmin: false, override: null, dev: false, screens: some }), false);
  assert.equal(shellAllowed({ screen: "shop", design: "new", isAdmin: false, override: null, dev: false, screens: some }), false);
});

test("previewing the shell needs an admin's ?design=new, or local development", () => {
  assert.equal(shellAllowed({ screen: "lobby", design: "classic", isAdmin: true, override: "new", dev: false }), true);
  assert.equal(shellAllowed({ screen: "lobby", design: "classic", isAdmin: false, override: "new", dev: true }), true);
  assert.equal(shellAllowed({ screen: "lobby", design: "classic", isAdmin: true, override: null, dev: false }), false, "no override");
  assert.equal(shellAllowed({ screen: "lobby", design: "new", isAdmin: true, override: "classic", dev: true }), false, "asked for Classic");
});

test("the admin panel, rounds and results never use the preview", () => {
  for (const screen of ["admin", "play", "match", "result"]) assert.equal(shellAllowed({ screen, design: "new", isAdmin: true, override: "new", dev: true }), false, screen);
});

const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };

test("the override is remembered, and bad values are ignored", () => {
  const s = memory();
  assert.equal(loadOverride("", () => s), null);
  assert.equal(loadOverride("?design=new", () => s), "new");
  assert.equal(loadOverride("", () => s), "new");
  assert.equal(loadOverride("?design=classic", () => s), "classic");
  assert.equal(loadOverride("?design=rainbow", () => s), "classic");
  const bad = memory(); bad.setItem("ba_design", "rainbow");
  assert.equal(loadOverride("", () => bad), null);
});

test("localStorage unavailable never throws", () => {
  const gone = () => { throw new Error("blocked"); };
  assert.equal(loadOverride("", gone), null);
  assert.equal(loadOverride("?design=new", gone), "new");
  const full = { getItem: () => null, setItem: () => { throw new Error("full"); } };
  assert.equal(loadOverride("?design=classic", () => full), "classic");
});

test("the override is removed from the address and the rest stays", () => {
  assert.equal(withoutOverride("?design=new"), "");
  assert.equal(withoutOverride("?design=new&r=ABC123"), "?r=ABC123");
  assert.equal(withoutOverride("?c=abc12345"), "?c=abc12345");
});
