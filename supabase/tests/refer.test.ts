import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { earned, friendSteps, heading, intro, inviteLink, joinedLine, kpis, prize, reason, shareText, steps, WORDS } from "../../web/src/newui/screens/Refer.logic.ts";

const r = { friend_coins: 100, reg_coins: 200, reg_gems: 5, play_rounds: 5, play_coins: 300, play_gems: 10, ret_coins: 200, ret_gems: 5, week_days: 7, week_coins: 500, week_gems: 20, window_days: 30 };
const f = { name: "A", joined: "2026-10-01T10:00:00Z", status: "ok", register: true, play: true, return: false, week: false, rounds: 6, coins: 500, gems: 15, saved: true, ends: "2026-10-31T10:00:00Z" };
const classic = readFileSync(new URL("../../web/src/views/Refer.tsx", import.meta.url), "utf8");

test("prizes read as in Classic", () => {
  assert.equal(prize(1250, 15), `${(1250).toLocaleString()} coins + 15 gems`);
  assert.equal(prize(200, 0), "200 coins");
  assert.equal(prize(0, 5), "5 gems");
  assert.equal(prize(0, 0), "—");
});

test("the heading adds up the four steps, from the server's numbers", () => {
  assert.equal(heading(r), `Earn up to ${(1200).toLocaleString()} coins + 40 gems for every friend`);
  assert.equal(heading({ ...r, reg_coins: 0, play_coins: 0, ret_coins: 0, week_coins: 0, reg_gems: 0, play_gems: 0, ret_gems: 0, week_gems: 0 }), "Earn up to — for every friend");
  const i = intro(r);
  assert.equal(i.before + i.bold + i.after, "Your friend gets 100 bonus coins after their first round. You earn more at every step they reach in their first 30 days.");
});

test("the steps, totals and friend steps are Classic's, in order", () => {
  assert.deepEqual(steps(r).map((s) => [s.text, s.prize]), [["Saves their account", "200 coins + 5 gems"], ["Plays 5 rounds", "300 coins + 10 gems"], ["Comes back on another day", "200 coins + 5 gems"], ["Plays on 7 different days", "500 coins + 20 gems"]]);
  const stats = { invited: 3, active: 1, registered: 2, played: 2, returned: 1, week: 1, coins: 1500, gems: 30 };
  assert.deepEqual(kpis({ stats, rewards: r }).map((k) => k.label), ["friends joined", "played 5+ rounds", "regular players", "coins earned", "gems earned"]);
  assert.equal(kpis({ stats, rewards: r })[3].value, (1500).toLocaleString());
  assert.deepEqual(friendSteps(f, r).map((s) => [s.text, s.done]), [["Saved", true], ["5 rounds", true], ["Came back", false], ["7 days", false]]);
});

test("the reward window shows only for a counted friend still in it", () => {
  const before = new Date("2026-10-10T00:00:00Z"), after = new Date("2026-11-05T00:00:00Z");
  assert.ok(joinedLine(f, before).includes("rewards until"));
  assert.ok(!joinedLine(f, after).includes("rewards until"), "window over");
  assert.ok(!joinedLine({ ...f, week: true }, before).includes("rewards until"), "last step reached");
  assert.ok(!joinedLine({ ...f, status: "review" }, before).includes("rewards until"), "not counted");
  assert.ok(joinedLine(f, before).startsWith("joined "));
});

test("reasons a friend is not counted, and what they earned", () => {
  assert.equal(reason("ok"), "");
  assert.equal(reason("review"), "Being checked: rewards start once we confirm it");
  assert.equal(reason("blocked"), "Not counted: same device, browser or network as you");
  assert.equal(reason("rejected"), "Not counted");
  assert.equal(reason("capped"), "Not counted: invite limit reached");
  assert.equal(reason("something new"), "");
  assert.equal(earned(f), "+500 coins + 15 gems");
  assert.equal(earned({ coins: 0, gems: 0 }), null);
});

test("the link and share text are Classic's", () => {
  assert.equal(inviteLink("https://example.test", "ABC123"), "https://example.test/?r=ABC123");
  const lib = readFileSync(new URL("../../web/src/lib/refer.ts", import.meta.url), "utf8");
  assert.ok(lib.includes("`${location.origin}/?r=${code}`"), "same format as lib/refer.ts refLink");
  assert.equal(shareText(r), "Play Bingo Arena with me! Free skill bingo, and you get 100 bonus coins with my link:");
});

test("Classic's wording is kept", () => {
  const app = readFileSync(new URL("../../web/src/App.tsx", import.meta.url), "utf8");
  for (const [k, w] of Object.entries(WORDS)) {
    if (k === "crazyGames") assert.ok(app.includes(w), w);
    else assert.ok(classic.includes(w.trim()), `Classic Refer says "${w}"`);
  }
});

test("the screen makes no calls of its own", () => {
  const src = readFileSync(new URL("../../web/src/newui/screens/Refer.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(src, /supabase|callFn|lib\/refer/);
  assert.match(src, /ctx\.refer\.load|refer\.current\.load/);
});
