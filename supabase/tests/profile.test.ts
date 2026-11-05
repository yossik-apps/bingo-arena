import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ago, bandRange, canChangePassword, canDelete, coachAfterBlur, coachInitial, dnaEmpty, dnaProgress, firstTab, gamesEmpty, logOutLabel, masteryNext, masteryPct, masteryScore,
  passwordProblem, PASSWORD_CHANGED, realEmail, removeAccount, saveLabel, setLimit, shieldPct, shieldText, spendCents, spendValue, spentText, submitPassword, toShield, xpLine,
} from "../../web/src/newui/screens/Profile.logic.ts";
import type { MasteryRow } from "../../web/src/lib/supabase.ts";

const src = (f: string) => readFileSync(new URL(`../../web/src/${f}`, import.meta.url), "utf8");

// A fake ctx.account that records what the screen asks for. Nothing here reaches a server.
function fakeAccount(fail?: string) {
  const calls: string[] = [];
  const act = (name: string) => async (v: unknown) => { calls.push(`${name}(${JSON.stringify(v)})`); if (fail) throw new Error(fail); };
  return { calls, setSpendLimit: act("setSpendLimit"), changePassword: act("changePassword"), deleteAccount: act("deleteAccount") };
}

test("the spending limit sends Classic's values: null for No limit, otherwise the cents", async () => {
  assert.equal(spendCents(""), null);
  assert.equal(spendCents("0"), 0);
  assert.equal(spendCents("2500"), 2500);
  assert.equal(spendValue(null), "");
  assert.equal(spendValue(5000), "5000");
  const a = fakeAccount();
  for (const v of ["", "0", "1000", "10000"]) await setLimit(a, v);
  assert.deepEqual(a.calls, ["setSpendLimit(null)", "setSpendLimit(0)", "setSpendLimit(1000)", "setSpendLimit(10000)"]);
  await setLimit(fakeAccount("network"), "1000"); // a failure is swallowed, as in Classic, and does not throw
  assert.equal(spentText(499), "Spent this month: $4.99");
});

test("change password: Classic's checks first, then exactly one call with the new password", async () => {
  assert.equal(passwordProblem("short", "short"), "The password must be at least 8 characters.");
  assert.equal(passwordProblem("longenough", "different1"), "The two passwords do not match.");
  assert.equal(passwordProblem("longenough", "longenough"), null);
  const a = fakeAccount();
  assert.deepEqual(await submitPassword(a, "short", "short"), { ok: false, msg: "The password must be at least 8 characters." });
  assert.deepEqual(await submitPassword(a, "longenough", "other12345"), { ok: false, msg: "The two passwords do not match." });
  assert.deepEqual(a.calls, [], "nothing is sent while the form has a problem");
  assert.deepEqual(await submitPassword(a, "longenough", "longenough"), { ok: true, msg: PASSWORD_CHANGED });
  assert.deepEqual(a.calls, ['changePassword("longenough")']);
  assert.deepEqual(await submitPassword(fakeAccount("Password is too weak"), "longenough", "longenough"), { ok: false, msg: "Password is too weak" }, "the server's message is shown");
});

test("delete account: only with DELETE typed exactly, then one call with the confirmation", async () => {
  for (const t of ["", "delete", "DELETE ", "DELET"]) assert.equal(canDelete(t), false, t);
  assert.equal(canDelete("DELETE"), true);
  const a = fakeAccount();
  assert.equal(await removeAccount(a, "delete"), "");
  assert.deepEqual(a.calls, []);
  assert.equal(await removeAccount(a, "DELETE"), "");
  assert.deepEqual(a.calls, ['deleteAccount("DELETE")']);
  assert.equal(await removeAccount(fakeAccount("Something went wrong"), "DELETE"), "Something went wrong");
});

test("the screen goes through ctx.account and never talks to the server itself", () => {
  const s = src("newui/screens/Profile.tsx");
  assert.ok(!/from "[^"]*supabase"|callFn|design-e/.test(s.replace('from "../../lib/supabase"', "")), "no supabase client, callFn or design-e import");
  assert.ok(!s.includes("supabase."), "no direct supabase calls");
  assert.ok(s.includes("setLimit(ctx.account, v)"));
  assert.ok(s.includes("submitPassword(ctx.account, pw, pw2)"));
  assert.ok(s.includes("removeAccount(ctx.account, confirm)"));
  assert.ok(s.includes('"ba_ptab"'), "the tab is remembered under Classic's key");
});

test("tabs: Classic's remembered tab, and no Settings for the demo", () => {
  assert.equal(firstTab(null, false), "stats");
  assert.equal(firstTab("games", false), "games");
  assert.equal(firstTab("settings", false), "settings");
  assert.equal(firstTab("settings", true), "stats");
  assert.equal(firstTab("other", false), "stats");
});

test("streak shields: one per 5 Daily Challenges, at most 2", () => {
  assert.equal(toShield(0, 0), 5);
  assert.equal(toShield(1, 9), 1);
  assert.equal(toShield(2, 9), 0);
  assert.equal(shieldText(1, 9), "1 more Daily Challenge");
  assert.equal(shieldText(0, 2), "3 more Daily Challenges");
  assert.equal(shieldText(2, 3), "Shields full");
  assert.equal(shieldPct(1, 7), 40);
  assert.equal(shieldPct(2, 7), 100);
});

test("empty DNA and games: Classic's counts and words", () => {
  assert.match(dnaEmpty(0), /^Play 3 more rounds to see/);
  assert.match(dnaEmpty(2), /^Play 1 more round to see/);
  assert.equal(Math.round(dnaProgress(1)), 33);
  assert.equal(dnaProgress(5), 100);
  assert.match(gamesEmpty(1, "Coach Nova"), /^Play 2 more rounds and Coach Nova will read/);
  assert.match(gamesEmpty(2, "Max"), /^Play 1 more round and Max will/);
  assert.equal(coachInitial("Coach Nova"), "N");
  assert.equal(coachInitial("max"), "M");
  assert.equal(coachAfterBlur("  "), "Coach Nova");
  assert.equal(coachAfterBlur("Max"), "Max");
});

test("mastery rows, explainer bands, times and the account words", () => {
  const m = { level: "medium", best: 150, tier: 1, name: "Bronze", next_name: "Silver", next_min: 300 } as MasteryRow;
  assert.equal(masteryPct(m), 50);
  assert.equal(masteryScore(m), "150 / 300");
  assert.equal(masteryNext(m), "Silver next");
  const top = { ...m, next_name: null, next_min: null } as unknown as MasteryRow;
  assert.equal(masteryPct(top), 100);
  assert.equal(masteryScore(top), "Best 150");
  assert.equal(masteryNext(top), "Top rank");
  assert.match(bandRange(0), /^\d+–100$/);
  const now = Date.parse("2026-11-04T12:00:00Z");
  assert.equal(ago("2026-11-04T11:50:00Z", now), "10 min ago");
  assert.equal(ago("2026-11-04T09:00:00Z", now), "3 h ago");
  assert.equal(ago("2026-11-03T08:00:00Z", now), "Yesterday");
  assert.equal(xpLine("310 / 440 XP", 130, 6), "310 / 440 XP · 130 to level 7");
  assert.equal(saveLabel(true), "Log in with CrazyGames");
  assert.equal(saveLabel(false), "Save your progress");
  assert.equal(logOutLabel(true), "Log out (lose guest progress)");
  assert.equal(realEmail("x@guest.invalid"), false);
  assert.equal(realEmail("a@b.co"), true);
  assert.equal(canChangePassword(false, "a@b.co"), true);
  assert.equal(canChangePassword(true, "a@b.co"), false);
  assert.equal(canChangePassword(false, "x@guest.invalid"), false);
});
