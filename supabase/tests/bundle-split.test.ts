import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// The bundle split: Supabase Realtime and Storage are replaced by stand-ins in the build (web/vite.config.ts), and the
// Classic screens that are not on the first screen load when opened, with Play and Result fetched once the lobby shows.
const webDir = fileURLToPath(new URL("../../web/", import.meta.url));
const src = (path: string) => readFileSync(join(webDir, path), "utf8").replace(/\r\n/g, "\n");
// CI runs `npm test` before it installs the web folder's packages; the client test needs Vite and supabase-js from there.
const viteEntry = join(webDir, "node_modules/vite/dist/node/index.js");
const haveWeb = existsSync(viteEntry) && existsSync(join(webDir, "node_modules/@supabase/supabase-js"));

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const USER = "00000000-0000-4000-8000-000000000001";
const ANON = "anon-key-for-tests";
const jwt = (n: number) => {
  const now = Math.floor(Date.now() / 1000);
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: USER, role: "authenticated", aud: "authenticated", iat: now, exp: now + 3600, session_id: `s${n}` })}.sig${n}`;
};

/** Builds a client the way the game's build does (same vite.config.ts, so the same stand-ins) and imports it. */
async function buildClient(): Promise<{ createClient: typeof import("@supabase/supabase-js").createClient; code: string }> {
  const vite = await import(pathToFileURL(viteEntry).href);
  const out = mkdtempSync(join(tmpdir(), "ba-split-"));
  const noEnv = mkdtempSync(join(tmpdir(), "ba-noenv-")); // no VITE_ variables are read into the test build
  try {
    await vite.build({
      root: webDir, configFile: join(webDir, "vite.config.ts"), envDir: noEnv, logLevel: "silent", mode: "production",
      plugins: [{
        name: "client-probe",
        resolveId: (id: string) => (id === "virtual:client-probe" ? "\0client-probe" : null),
        load: (id: string) => (id === "\0client-probe" ? 'export { createClient } from "@supabase/supabase-js";' : null),
      }],
      build: {
        outDir: out, emptyOutDir: true, copyPublicDir: false, modulePreload: false,
        rollupOptions: { input: "virtual:client-probe", preserveEntrySignatures: "exports-only", output: { format: "es", entryFileNames: "probe.mjs", inlineDynamicImports: true } },
      },
    });
    const file = join(out, "probe.mjs");
    const code = readFileSync(file, "utf8");
    const mod = await import(pathToFileURL(file).href);
    return { createClient: mod.createClient, code };
  } finally {
    rmSync(out, { recursive: true, force: true });
    rmSync(noEnv, { recursive: true, force: true });
  }
}

test("a client built with the stand-ins signs in, refreshes its token, queries, calls RPCs and functions, and signs out", { skip: haveWeb ? false : "web packages are not installed yet (CI installs them after npm test)", timeout: 120000 }, async () => {
  const { createClient, code } = await buildClient();
  // the left-out parts are really gone from the build
  for (const marker of ["phx_join", "phoenix", "StorageFileApi", "/object/list/"]) assert.ok(!code.includes(marker), `${marker} is still in the build`);

  const calls: { method: string; path: string; auth: string | null; apikey: string | null; body: string }[] = [];
  let issued = 0;
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const user = { id: USER, aud: "authenticated", role: "authenticated", email: "zz@example.test", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
  const session = () => { issued += 1; return { access_token: jwt(issued), refresh_token: `refresh-${issued}`, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user }; };
  // a stand-in for the Supabase server: no network is used
  const fakeFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    const u = new URL(req.url);
    calls.push({ method: req.method, path: u.pathname + u.search, auth: req.headers.get("authorization"), apikey: req.headers.get("apikey"), body: req.method === "GET" ? "" : await req.clone().text() });
    if (u.pathname === "/auth/v1/token") return json(session());
    if (u.pathname === "/auth/v1/logout") return new Response(null, { status: 204 });
    if (u.pathname === "/auth/v1/user") return json(user);
    if (u.pathname.startsWith("/rest/v1/rpc/")) return json(42);
    if (u.pathname.startsWith("/rest/v1/")) return json([{ id: USER, display_name: "zz" }]);
    if (u.pathname.startsWith("/functions/v1/")) return json({ ok: true });
    return json({ message: "not found" }, 404);
  };
  const store = new Map<string, string>();
  const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); } };
  const supabase = createClient("https://project.supabase.test", ANON, {
    auth: { flowType: "pkce", persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, storage },
    global: { fetch: fakeFetch as typeof fetch },
  });
  const events: string[] = [];
  const { data: sub } = supabase.auth.onAuthStateChange((event) => { events.push(event); });
  const last = () => calls[calls.length - 1];

  // sign-in
  const signIn = await supabase.auth.signInWithPassword({ email: "zz@example.test", password: "test-only" });
  assert.equal(signIn.error, null);
  assert.equal(signIn.data.session?.access_token, jwt(1));
  assert.match(last().path, /^\/auth\/v1\/token\?grant_type=password/);

  // a query and an RPC carry the player's token
  const q = await supabase.from("profiles").select("id, display_name").eq("id", USER);
  assert.equal(q.error, null);
  assert.deepEqual(q.data, [{ id: USER, display_name: "zz" }]);
  assert.equal(last().method, "GET");
  assert.match(last().path, /^\/rest\/v1\/profiles\?select=id%2Cdisplay_name&id=eq\./);
  assert.equal(last().auth, `Bearer ${jwt(1)}`);
  assert.equal(last().apikey, ANON);
  const rpc = await supabase.rpc("claim_daily", { p_day: "2026-11-08" });
  assert.equal(rpc.error, null);
  assert.equal(rpc.data, 42);
  assert.equal(last().method, "POST");
  assert.equal(last().path, "/rest/v1/rpc/claim_daily");
  assert.equal(last().body, JSON.stringify({ p_day: "2026-11-08" }));
  assert.equal(last().auth, `Bearer ${jwt(1)}`);

  // token refresh: the new token is used from then on
  const refreshed = await supabase.auth.refreshSession();
  assert.equal(refreshed.error, null);
  assert.match(last().path, /^\/auth\/v1\/token\?grant_type=refresh_token/);
  assert.equal(last().body, JSON.stringify({ refresh_token: "refresh-1" }));
  assert.equal(refreshed.data.session?.access_token, jwt(2));
  await supabase.from("profiles").select("id").eq("id", USER);
  assert.equal(last().auth, `Bearer ${jwt(2)}`);
  const fn = await supabase.functions.invoke("start-round", { body: { mode: "solo" } });
  assert.equal(fn.error, null);
  assert.deepEqual(fn.data, { ok: true });
  assert.equal(last().path, "/functions/v1/start-round");
  assert.equal(last().auth, `Bearer ${jwt(2)}`);

  // the session survives a new client on the same storage (a page reload)
  const again = createClient("https://project.supabase.test", ANON, { auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, storage }, global: { fetch: fakeFetch as typeof fetch } });
  assert.equal((await again.auth.getSession()).data.session?.access_token, jwt(2));

  // sign-out: back to the public key
  assert.equal((await supabase.auth.signOut()).error, null);
  await supabase.from("profiles").select("id");
  assert.equal(last().auth, `Bearer ${ANON}`);
  for (const e of ["SIGNED_IN", "TOKEN_REFRESHED", "SIGNED_OUT"]) assert.ok(events.includes(e), `${e} in ${events.join(", ")}`);
  sub.subscription.unsubscribe();

  // the left-out parts say so clearly if anything ever uses them
  assert.throws(() => supabase.channel("room"), /Realtime is left out of this build/);
  assert.throws(() => supabase.storage.from("avatars"), /Storage is left out of this build/);
  assert.deepEqual(supabase.getChannels(), []);
  // no other address was called
  for (const c of calls) assert.match(c.path, /^\/(auth|rest|functions)\/v1\//);
});

test("the stand-ins are wired for the whole build and the game uses neither Realtime nor Storage", () => {
  const cfg = src("vite.config.ts");
  assert.ok(cfg.includes('{ find: /^@supabase\\/realtime-js$/, replacement: fileURLToPath(new URL("./src/lib/stubs/realtime.ts", import.meta.url)) },'));
  assert.ok(cfg.includes('{ find: /^@supabase\\/storage-js$/, replacement: fileURLToPath(new URL("./src/lib/stubs/storage.ts", import.meta.url)) },'));
  assert.ok(cfg.includes("      ...supabaseStubs,\n"));
  // a search of all the game's code: no channels, no storage buckets
  const files = readdirSync(join(webDir, "src"), { recursive: true, encoding: "utf8" })
    .filter((f) => /\.(ts|tsx)$/.test(f) && !f.replace(/\\/g, "/").startsWith("lib/stubs/"));
  assert.ok(files.length > 50, "found the game's files");
  for (const f of files) assert.doesNotMatch(src(join("src", f)), /\.channel\(|removeChannel|getChannels|\.storage\.(from|listBuckets|getBucket|createBucket)\(/, f);
});

test("App: Classic screens off the first screen load when opened; Play and Result are fetched once the lobby shows", () => {
  const app = src("src/App.tsx");
  // the first screen stays in the main download
  assert.match(app, /^import Lobby from "\.\/views\/Lobby";$/m);
  for (const [name, file] of [["Matchmaking", "Matchmaking"], ["Compete", "Compete"], ["JourneyHub", "JourneyHub"], ["Collect", "Collect"], ["Wallet", "Wallet"], ["ProfileView", "Profile"], ["Refer", "Refer"], ["Help", "Help"], ["Inbox", "Inbox"], ["ShopHub", "ShopHub"], ["Store", "Store"], ["Shop", "Shop"]]) {
    assert.ok(app.includes(`const ${name} = lazy(() => import("./views/${file}"));`), name);
    assert.doesNotMatch(app, new RegExp(`^import ${name}\\b`, "m"), `${name} is no longer imported up front`);
  }
  assert.ok(app.includes('const loadPlay = () => import("./views/Play");'));
  assert.ok(app.includes('const loadResult = () => import("./views/Result");'));
  assert.ok(app.includes("const Play = lazy(loadPlay);") && app.includes("const Result = lazy(loadResult);"));
  assert.ok(app.includes('import type { RoundResult, RoundStart } from "./views/Play";'));
  assert.ok(app.includes("const ROUND_SCREENS = [loadPlay, loadResult];"));
  // prefetched from both lobbies (signed in and visitor)
  assert.ok(app.includes('{view === "lobby" && <Prefetch />}'));
  assert.ok(app.includes('{!guestRes && gview === "lobby" && cfg && <Prefetch />}'));
  // every place that shows a lazy Classic screen has a loading placeholder: the visitor's free round, the visitor's pages and the player's pages
  assert.equal(app.match(/<Suspense fallback=\{<Loading \/>\}>/g)?.length, 3);
  assert.equal(app.match(/<\/Suspense><\/div>/g)?.length, 3);
  // after a release, a screen's old file is gone: main.tsx reloads the page once to get the new version
  assert.ok(src("src/main.tsx").includes('window.addEventListener("vite:preloadError"'));
});
