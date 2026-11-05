import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The new-design reward-video button: Classic's rules, calls and messages, a new look. Classic screens keep the Classic button.
const root = new URL("../../", import.meta.url);
const src = (path: string) => readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");
const classic = src("web/src/lib/RewardAd.tsx");
const fresh = src("web/src/newui/RewardAd.tsx");
const app = src("web/src/App.tsx");

/** The logic lines of a reward button: everything from the CrazyGames rule up to the end of go(). */
const flow = (s: string) => {
  const a = s.indexOf("  // inside CrazyGames only their reward videos may be used"), b = s.indexOf("    setBusy(false);\n  };", a);
  assert.ok(a > 0 && b > a);
  // what each returns while hidden differs only in markup; compare the rules and the flow
  return s.slice(a, b).replace(/return msg \? .*? : null;/, "return HIDDEN;");
};

test("availability, CrazyGames, the claim call and every message are Classic's, line for line", () => {
  assert.equal(flow(fresh), flow(classic));
  for (const call of ["supabase.rpc(\"claim_ad_reward\", { p_placement: cg ? \"cg_\" + placement : placement })", "await showReward(placement)", "await cgRewarded()", "!ads || ads.left_today <= 0", "adsActive(ads)"]) assert.ok(fresh.includes(call), call);
  // while hidden it still shows the last message, as Classic does
  assert.match(fresh, /ads\.left_today <= 0\) return msg \? <div className="nu-ra"><p className="nu-ra-msg" role="status">\{msg\}<\/p><\/div> : null;/);
});

test("new screens get the new button through ctx.platform.rewardAd; Classic screens keep lib/RewardAd", () => {
  assert.match(app, /const NewRewardAd = lazy\(\(\) => import\("\.\/newui\/RewardAd"\)\);/);
  assert.match(app, /rewardAd: \(placement, compact\) => <Suspense fallback=\{null\}><NewRewardAd ads=\{ads\} placement=\{placement\} onDone=\{refresh\} compact=\{compact\} \/><\/Suspense> \}/);
  for (const p of ["lobby", "result", "wallet", "store"]) assert.ok(app.includes(`<RewardAd ads={ads} placement="${p}" onDone={refresh}`), `Classic ${p}`);
  // a visitor still gets none
  assert.match(app, /platform: \{ crazyGames: onCrazyGames, ads: null, rewardAd: \(\) => null \}/);
  assert.match(src("web/src/newui/screens/Lobby.tsx"), /platform\.rewardAd\("lobby", true\)/);
  assert.match(src("web/src/newui/screens/Shop.tsx"), /platform\.rewardAd\("store"\)/);
});

test("the look: a row with at least a 44 px tap target, busy and message states, coins named for screen readers", () => {
  const css = src("web/src/newui/rewardad.css"), rows = src("web/src/newui/components/components.css");
  assert.match(rows, /\.nu-row \{ width: 100%; min-height: 72px;/);
  assert.doesNotMatch(css, /\.nu-ra-btn \{[^}]*min-height/, "compact keeps the full row height, so it lines up in the Lobby");
  assert.match(fresh, /disabled=\{busy\} aria-busy=\{busy \|\| undefined\}/);
  assert.match(fresh, /\{busy \? "Loading video…" : "Watch a short video"\}/);
  assert.match(fresh, /\+\{coins\}<span className="nu-sr"> coins<\/span>/);
  assert.match(src("web/src/newui/Gallery.tsx"), /<RewardAdView coins=\{25\} left=\{3\} busy msg=""/);
});
