// Creates one of the two dedicated test accounts on the LIVE project, as a guest account. Run it yourself, once per account:
//
//   node tools/test-account.mjs zz_test_account
//   node tools/test-account.mjs zz_test_account_2
//
// It signs up with the same guest details the game uses, saves the sign-in to .test-profiles/<name>/session.json (git-ignored),
// and stops. It plays no rounds and never opens the game, so no daily reward or streak starts.
// What this does on live: one new profile row, the welcome coins, and the account appears in the "new players" list for 7 days.
// The saved file holds a live login token: never commit or share it. If it is lost the account cannot be recovered.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ALLOWED = ["zz_test_account", "zz_test_account_2"];
const fail = (m) => { console.error(m); process.exit(1); };

const name = process.argv[2];
if (!ALLOWED.includes(name)) fail(`Usage: node tools/test-account.mjs ${ALLOWED.join(" | ")}`);
const dir = join(ROOT, ".test-profiles", name);
const file = join(dir, "session.json");
if (existsSync(file)) fail(`${name} already has a saved sign-in (${file}). Nothing was created.`);

const envFile = join(ROOT, "web", ".env.local");
if (!existsSync(envFile)) fail("web/.env.local is missing.");
const env = {};
for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const url = env.VITE_SUPABASE_URL, key = env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) fail("web/.env.local needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
const host = new URL(url).hostname;

const terms = readFileSync(join(ROOT, "web", "src", "lib", "supabase.ts"), "utf8").match(/TERMS_VERSION = "([^"]+)"/)?.[1];
if (!terms) fail("Could not read TERMS_VERSION.");

const require = createRequire(join(ROOT, "web", "package.json"));
const { createClient } = require("@supabase/supabase-js");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

// the same details as startGuestAccount() in web/src/lib/guest.ts, with a fixed name
const { data, error } = await db.auth.signInAnonymously({ options: { data: { name, guest: "true", terms: "true", terms_version: terms } } });
if (error || !data.session) fail(`Sign-up failed: ${error?.message ?? "no session returned"}. Nothing was saved.`);

mkdirSync(dir, { recursive: true });
// the storage key supabase-js uses in the browser
writeFileSync(file, JSON.stringify({ key: `sb-${host.split(".")[0]}-auth-token`, session: data.session }, null, 2));

const { data: row } = await db.from("profiles").select("display_name,is_guest").eq("id", data.user.id).maybeSingle();
console.log(`Created ${row?.display_name ?? name} (guest: ${row?.is_guest ?? "unknown"}).`);
console.log(`Sign-in saved to ${file}`);
if (row && row.display_name !== name) console.log(`Check this: the name on the account is "${row.display_name}", not "${name}".`);
process.exit(0);
