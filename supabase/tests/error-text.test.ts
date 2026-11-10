import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { screenData, type ScreenData } from "../../web/src/lib/screenData.ts";
import { friendly, signInText } from "../../web/src/lib/authText.ts";

// Where Classic shows rpcError(error), errorText(…) or Auth's friendly(…), the new screens' groups and overlays must give the
// same text, never the raw error. Every function of every data group is made to fail here and its text compared with Classic's.
const web = new URL("../../web/src/", import.meta.url);
const src = (path: string) => readFileSync(new URL(path, web), "utf8").replace(/\r\n/g, "\n");

const DB_ERROR = "User already registered"; // one that friendly() rewrites
const FN_ERROR = "insufficient_funds";

function failing(): ScreenData {
  const err = { message: DB_ERROR };
  const answer = () => ({ data: null, error: err, count: null });
  const chain = (): unknown => new Proxy({}, { get: (_, k) => k === "then" ? (ok: (v: unknown) => void) => ok(answer()) : () => chain() });
  const db = {
    from: () => chain(),
    rpc: async () => answer(),
    auth: new Proxy({}, { get: () => async () => ({ ...answer(), data: { session: null, user: null } }) }),
  };
  return screenData({
    db: db as never, userId: "ME", termsVersion: "v", origin: "O",
    call: async () => { throw new Error(FN_ERROR); },
    rpcError: (e) => `readable: ${e?.message}`, errorText: (c) => `text: ${c}`,
    refresh: async () => undefined, refreshInbox: () => undefined, markSaved: async () => undefined,
  });
}

// What Classic shows when each call fails.
//   rpc: rpcError(error)   fn: errorText(message)   friendly / signIn: Classic Auth's text   raw: Classic shows Supabase's own text
//   quiet: Classic shows nothing and the function never fails   reply: an AuthReply holding rpcError(error)
type Kind = "rpc" | "fn" | "friendly" | "signIn" | "raw" | "quiet" | "reply";
const EXPECT: { [G in keyof ScreenData]: { [F in keyof ScreenData[G]]: Kind } } = {
  journey: { load: "rpc" },
  season: { load: "rpc", buyPass: "rpc", claimTier: "rpc" },
  quests: { load: "rpc", claim: "rpc" },
  album: { load: "rpc", craft: "rpc", claim: "rpc" },
  account: { load: "rpc", setSpendLimit: "quiet", changePassword: "raw", deleteAccount: "fn" },
  compete: {
    events: "rpc", live_races: "rpc", attempts_used: "rpc", event_leaderboard: "rpc", league_info: "rpc", league_board: "rpc", league_payouts: "rpc",
    crew_info: "rpc", crew_board: "rpc", search_crews: "rpc", join_crew: "rpc", create_crew: "rpc", claim_crew_chest: "rpc", leave_crew: "rpc",
    update_crew: "rpc", kick_crew_member: "rpc", liveops: "rpc", new_players: "rpc", wave_hello: "rpc",
  },
  store: { loadProducts: "rpc", buyTest: "rpc", gemSpend: "rpc", clubClaim: "rpc", confirmAge: "rpc", isAdultsOnly: "quiet" },
  shop: { dailyDeals: "rpc", buy: "rpc", equip: "rpc" },
  history: { ledger: "rpc", purchases: "rpc" },
  inbox: { load: "rpc", open: "rpc", contact: "rpc", reply: "rpc", markRead: "quiet" },
  refer: { load: "quiet" },
  match: { find: "fn", state: "rpc", cancel: "quiet", online: "rpc", invite: "rpc", result: "rpc", challenge: "fn" },
  auth: {
    signUp: "friendly", signIn: "signIn", google: "friendly", linkGoogle: "friendly", addEmail: "friendly", setPassword: "friendly",
    resend: "friendly", resetPassword: "friendly", markSaved: "quiet", acceptTerms: "reply", signOut: "quiet",
  },
};
const ARGS: Record<string, unknown[]> = {
  "compete.create_crew": [{ name: "N", tag: "T", descr: "D", open: true }],
  "auth.signUp": [{ email: "a@b.co", password: "pw123456", name: "Sam", crazyGames: false }],
  "store.isAdultsOnly": [null],
};

test("every data group's error path gives the text Classic shows", async () => {
  const sd = failing();
  // the table covers every function, so a new one must be added here
  for (const g of Object.keys(sd) as (keyof ScreenData)[]) assert.deepEqual(Object.keys(sd[g]).sort(), Object.keys(EXPECT[g]).sort(), `${g}: every function is listed`);
  for (const [g, fns] of Object.entries(EXPECT)) for (const [f, kind] of Object.entries(fns as Record<string, Kind>)) {
    const name = `${g}.${f}`;
    const fn = (sd as unknown as Record<string, Record<string, (...a: unknown[]) => unknown>>)[g][f];
    const run = async () => fn(...(ARGS[name] ?? ["X", "Y"]));
    if (kind === "rpc") await assert.rejects(run, { message: `readable: ${DB_ERROR}` }, name);
    else if (kind === "fn") await assert.rejects(run, { message: `text: ${FN_ERROR}` }, name);
    else if (kind === "raw") await assert.rejects(run, { message: DB_ERROR }, name);
    else if (kind === "quiet") await assert.doesNotReject(run, name);
    else {
      const r = (await run()) as { error: string | null };
      const want = kind === "friendly" ? friendly(DB_ERROR) : kind === "signIn" ? signInText(DB_ERROR) : `readable: ${DB_ERROR}`;
      assert.equal(r.error, want, name);
      assert.notEqual(r.error, DB_ERROR, `${name} is not the raw error`);
    }
  }
});

test("the Classic screens show those same texts", () => {
  const has = (file: string, ...texts: string[]) => { const s = src(file); for (const t of texts) assert.ok(s.includes(t), `${file} has ${t}`); };
  for (const f of ["views/Season.tsx", "views/Quests.tsx", "views/Album.tsx", "views/Crew.tsx", "views/NewPlayers.tsx", "views/Store.tsx", "views/Shop.tsx", "views/Matchmaking.tsx", "views/AgeGate.tsx"]) has(f, "rpcError(error)");
  has("views/Inbox.tsx", "rpcError(e)");
  has("views/Matchmaking.tsx", "onError(errorText((e as Error).message))");
  has("views/Profile.tsx", "setMsg(errorText((e as Error).message))", "if (error) setPwMsg(error.message);");
  // Classic Auth uses the shared helpers, so the new auth group cannot drift from it
  has("views/Auth.tsx", 'import { friendly, signInText } from "../lib/authText";', "if (error) setMsg(signInText(error.message));",
    'setMsg(error ? friendly(error.message) : "Sent again.', 'setMsg(error ? friendly(error.message) : "If that email has an account',
    'setMsg(m ? friendly(m) : "Sign-in did not finish. Please try again.")');
  assert.equal(src("views/Auth.tsx").match(/friendly\((error|pe)\.message\)/g)?.length, 7, "sign-up, Google, link Google, add email, its password, resend, reset");
  assert.doesNotMatch(src("views/Auth.tsx"), /const friendly =/);
});

test("App's overlay ctx and its own ctx calls give Classic's text too", () => {
  const app = src("App.tsx");
  // sign-up pop-up: the auth group above, and the Google pop-up's message as Classic Auth shows it
  assert.match(app, /data: dataFor\(profile\?\.id \?\? null, refresh, \(\) => undefined\)\.auth \}/);
  assert.match(app, /startPopupSignIn\(\(st, m\) => onState\(st, st === "error" \? \(m \? friendly\(m\) : "Sign-in did not finish\. Please try again\."\) : m\)\)/);
  assert.match(app, /popupSignIn: popupSignIn, track:/);
  // terms: AgeGate's rpcError, through auth.acceptTerms
  assert.match(app, /accept: \(\) => dataFor\(profile\.id, refresh, \(\) => undefined\)\.auth\.acceptTerms\(onCrazyGames\)/);
  // new password after a reset link: Classic SetPassword shows Supabase's own text
  assert.match(app, /save: async \(pw\) => \{ const \{ error \} = await supabase\.auth\.updateUser\(\{ password: pw \}\); return \{ error: error\?\.message \?\? null \}; \}/);
  assert.ok(src("views/SetPassword.tsx").includes("if (error) setMsg(error.message); else onDone();"));
  // daily challenge and the end of a round: errorText
  assert.match(app, /const dailyInfo = async \(\) => \{ try \{ return await asPlayer\(supabase\.auth, \(\) => callFn<DailyInfo>\("daily-info"\)\); \} catch \(e\) \{ throw new Error\(errorText\(\(e as Error\)\.message\)\); \} \};/);
  assert.equal(app.match(/loadChallenge: dailyInfo,/g)?.length, 2);
  assert.doesNotMatch(app, /loadChallenge: \(\) => callFn/);
  assert.match(app, /const calls = roundCalls\(callFn, errorText\);/);
  assert.match(src("lib/roundCalls.ts"), /catch \(e\) \{ throw new Error\(text\(\(e as Error\)\.message\)\); \}/);
  assert.match(src("views/Play.tsx"), /onError\(errorText\(\(e as Error\)\.message\)\)/);
});
