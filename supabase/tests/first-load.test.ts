import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classicAtOnce, readFlag, rememberDesignFlag, rememberRole, storedDesignFlag, storedNotAdmin, type FlagMode } from "../../web/src/lib/flags.ts";
import { chooseDesign } from "../../web/src/lib/design.ts";

// The first screen: the database connection opens early, and a remembered Design flag that can only mean Classic lets the
// page start at once. A remembered value never shows New.
const web = new URL("../../web/", import.meta.url);
const src = (path: string) => readFileSync(new URL(path, web), "utf8").replace(/\r\n/g, "\n");
const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };

test("only a remembered answer that means Classic for this viewer starts at once", () => {
  const modes: (FlagMode | null)[] = [null, "off", "admins", "all"];
  for (const stored of modes) for (const signedIn of [false, true]) for (const knownNotAdmin of [false, true]) {
    const early = classicAtOnce(stored, signedIn, knownNotAdmin);
    if (early === null) continue;
    assert.equal(early, "off");
    // it can never give anyone New, admin or not
    for (const isAdmin of [false, true]) assert.equal(chooseDesign({ mode: early, isAdmin, override: null }), "classic");
  }
  assert.equal(classicAtOnce("off", false), "off");
  assert.equal(classicAtOnce("off", true), "off");
  assert.equal(classicAtOnce("admins", false), "off", "a visitor is never an admin");
  assert.equal(classicAtOnce("admins", true), null, "a signed-in player might be an admin: wait for the database");
  assert.equal(classicAtOnce("admins", true, true), "off", "a player this device saw as not an admin");
  assert.equal(classicAtOnce("all", true, true), null, "a remembered non-admin never skips the wait toward New");
  assert.equal(classicAtOnce(null, true, true), null);
  assert.equal(classicAtOnce("all", false), null, "New always waits for the database");
  assert.equal(classicAtOnce("all", true), null);
  assert.equal(classicAtOnce(null, false), null, "first visit: wait, as before");
});

test("the database's own answer is remembered, even a late one; a timeout or an error is not", async () => {
  const seen: FlagMode[] = [];
  const keep = (m: FlagMode) => { seen.push(m); };
  assert.equal(await readFlag(async () => ({ data: { mode: "admins" }, error: null }), 500, keep), "admins");
  assert.equal(await readFlag(async () => ({ data: null, error: { message: "relation does not exist" } }), 500, keep), "off");
  assert.equal(await readFlag(async () => { throw new Error("network down"); }, 500, keep), "off");
  assert.deepEqual(seen, ["admins"]);
  const slow = () => new Promise<{ data: { mode: string }; error: null }>((done) => { setTimeout(() => done({ data: { mode: "all" }, error: null }), 30); });
  assert.equal(await readFlag(slow, 5, keep), "off", "this load carries on as off");
  await new Promise((r) => setTimeout(r, 50));
  assert.deepEqual(seen, ["admins", "all"], "and the late answer is kept for the next load");
  // a failing store never breaks the read
  assert.equal(await readFlag(async () => ({ data: { mode: "all" }, error: null }), 500, () => { throw new Error("full"); }), "all");
});

test("remembering survives blocked storage and ignores bad values", () => {
  const s = memory();
  assert.equal(storedDesignFlag(() => s), null);
  rememberDesignFlag("admins", () => s);
  assert.equal(storedDesignFlag(() => s), "admins");
  s.setItem("ba_flag_design", "rainbow");
  assert.equal(storedDesignFlag(() => s), null);
  const gone = () => { throw new Error("blocked"); };
  assert.equal(storedDesignFlag(gone), null);
  assert.doesNotThrow(() => rememberDesignFlag("off", gone));
});

test("the device remembers a non-admin by user id; an admin clears it; blocked storage is harmless", () => {
  const s = memory();
  assert.equal(storedNotAdmin(() => s), null);
  rememberRole("user-a", false, () => s);
  assert.equal(storedNotAdmin(() => s), "user-a");
  rememberRole("user-a", true, () => s);
  assert.equal(storedNotAdmin(() => s), null, "an admin waits for the database again");
  rememberRole("user-b", false, () => s);
  assert.notEqual(storedNotAdmin(() => s), "user-a", "another player on the same device is not taken as a known non-admin");
  const gone = () => { throw new Error("blocked"); };
  assert.equal(storedNotAdmin(gone), null);
  assert.doesNotThrow(() => rememberRole("user-a", false, gone));
});

test("App: starts at once only through classicAtOnce, keeps the first value for the page load, remembers the answer", () => {
  const app = src("src/App.tsx");
  assert.match(app, /const \[storedFlag\] = useState\(\(\) => storedDesignFlag\(\(\) => localStorage\)\);/);
  assert.match(app, /\(m\) => rememberDesignFlag\(m, \(\) => localStorage\)\)\n\s*\.then\(\(m\) => setDesignFlag\(\(now\) => now \?\? m\)\);/);
  assert.match(app, /const early = classicAtOnce\(storedFlag, !!data\.session, !!data\.session && storedNotAdmin\(\(\) => localStorage\) === data\.session\.user\.id\);\n\s*if \(early\) setDesignFlag\(\(now\) => now \?\? early\);/);
  // the boot screen still waits for the flag when nothing says Classic
  assert.match(app, /if \(!ready \|\| designFlag === null \|\| \(cgBoot && !session\)\) return <div className="shell boot">/);
  // the role is remembered from the loaded profile only, for that profile's id
  assert.ok(app.includes('useEffect(() => { if (profile) rememberRole(profile.id, profile.role === "admin", () => localStorage); }, [profile?.id, profile?.role]);'));
  // nothing else sets the flag
  assert.equal(app.match(/setDesignFlag\(/g)?.length, 2);
});

test("the built page opens the database connection early, and builds without the variable (CI)", () => {
  const cfg = src("vite.config.ts");
  for (const t of [
    'plugins: [react(), preconnect(loadEnv(mode, process.cwd(), "VITE_").VITE_SUPABASE_URL)]',
    'try { origin = new URL(url ?? "").origin; } catch { return []; }',
    'attrs: { rel: "preconnect", href: origin, crossorigin: true }, injectTo: "head"',
  ]) assert.ok(cfg.includes(t), t);
  // no placeholder in index.html: an unset variable broke the build
  assert.doesNotMatch(src("index.html"), /%VITE_/);
  assert.match(src("src/lib/supabase.ts"), /import\.meta\.env\.VITE_SUPABASE_URL/);
});
