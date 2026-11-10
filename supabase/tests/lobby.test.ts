import test from "node:test";
import assert from "node:assert/strict";
import { boostersToUse, dailyTier, firstMode, lobbyStatus, ownedTotal } from "../../web/src/newui/screens/Lobby.logic.ts";
import type { GameCfg } from "../../web/src/lib/supabase.ts";

const cfg = (g: object = {}) => ({
  levels: { beginner: { fee: 10 }, medium: { fee: 20 }, hard: { fee: 40 } },
  g: { pay: 1.8, maint: false, paid: true, pvp: true, welcome: 50, total: 100, ...g },
}) as unknown as GameCfg;
const base = { cfg: cfg(), mode: "ghost" as const, level: "beginner", balance: 100, banned: false, visitor: false, freeRounds: false };

test("fees and winnings come from the config, unchanged", () => {
  const s = lobbyStatus({ ...base, level: "hard" });
  assert.equal(s.fee, 40);
  assert.equal(s.win, 72);
  assert.equal(lobbyStatus({ ...base, mode: "solo" }).paid, false);
});

test("the start button is blocked in the same cases as Classic", () => {
  assert.equal(lobbyStatus(base).blocked, false);
  assert.equal(lobbyStatus({ ...base, banned: true }).blocked, true);
  assert.equal(lobbyStatus({ ...base, balance: 9 }).blocked, true);
  assert.equal(lobbyStatus({ ...base, mode: "solo", balance: 0 }).blocked, false, "Practice is free");
  assert.equal(lobbyStatus({ ...base, cfg: cfg({ maint: true }) }).blocked, true);
  assert.equal(lobbyStatus({ ...base, cfg: cfg({ paid: false }) }).blocked, true);
  assert.equal(lobbyStatus({ ...base, mode: "solo", cfg: cfg({ paid: false }) }).blocked, false);
  assert.equal(lobbyStatus({ ...base, mode: "pvp", cfg: cfg({ pvp: false }) }).blocked, true);
  assert.equal(lobbyStatus({ ...base, visitor: true, balance: 0, cfg: cfg({ maint: true }) }).blocked, false, "a visitor is sent to sign up, not blocked");
});

test("the hint explains why, most serious reason first", () => {
  assert.match(lobbyStatus({ ...base, banned: true, balance: 0 }).hint, /suspended/);
  assert.match(lobbyStatus({ ...base, cfg: cfg({ maint: true }) }).hint, /maintenance/);
  assert.match(lobbyStatus({ ...base, mode: "pvp", cfg: cfg({ pvp: false }) }).hint, /switched off/);
  assert.match(lobbyStatus({ ...base, balance: 9 }).hint, /You need 10 coins/);
  assert.match(lobbyStatus(base).hint, /You pay 10 coins.*win 18/);
  assert.match(lobbyStatus({ ...base, mode: "solo", visitor: true, freeRounds: true }).hint, /no account needed/);
  assert.match(lobbyStatus({ ...base, visitor: true }).hint, /50 free coins arrive after your first round/);
});

test("new players start on Practice, and a saved choice wins", () => {
  assert.equal(firstMode(null, true), "solo");
  assert.equal(firstMode(null, false), "ghost");
  assert.equal(firstMode("pvp", true), "pvp");
  assert.equal(firstMode("nonsense", true), "ghost");
});

test("boosters never go into a live match, and only ones still owned are used", () => {
  assert.deepEqual(boostersToUse("pvp", ["slow"], { slow: 3 }), []);
  assert.deepEqual(boostersToUse("ghost", ["slow", "time"], { slow: 1, time: 0 }), ["slow"]);
  assert.equal(ownedTotal({}), 0);
  assert.equal(ownedTotal({ slow: 2, hint: 1, unknown: 9 }), 3);
});

test("daily stars", () => {
  const goals = [100, 200, 300];
  assert.equal(dailyTier(null, goals), null);
  assert.equal(dailyTier({ status: "rejected", score: 0 }, goals), null);
  assert.equal(dailyTier({ status: "scored", score: 99 }, goals), 0);
  assert.equal(dailyTier({ status: "scored", score: 200 }, goals), 2);
  assert.equal(dailyTier({ status: "scored", score: 300 }, goals), 3);
});
