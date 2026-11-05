import test from "node:test";
import assert from "node:assert/strict";
import { ago, canJoinWithCode, chest, eventStatus, leagueRows, leftText, prizeNow, raceRows, splitOps, weekEnd, type Ev } from "../../web/src/newui/screens/Compete.logic.ts";
import type { CrewInfo, LiveOp } from "../../web/src/lib/supabase.ts";

const ev = { id: "e", name: "Daily Cup", descr: "", level: "medium", fee: 20, attempts: 3, starts_at: "", ends_at: "", bonus: 0, split: [50, 30, 20], status: "live" } as Ev;

test("event Enter is blocked in the same cases as Classic", () => {
  assert.deepEqual(eventStatus(ev, 0, 100, false), { rest: 3, disabled: false, cta: "Enter" });
  assert.equal(eventStatus(ev, 3, 100, false).cta, "No attempts left");
  assert.equal(eventStatus(ev, 0, 19, false).cta, "Not enough coins");
  assert.equal(eventStatus(ev, 0, 100, true).disabled, true);
});

test("time left uses Classic's wording", () => {
  assert.equal(leftText(0), "ended");
  assert.equal(leftText(30 * 6e4), "30 min left");
  assert.equal(leftText(5 * 36e5), "5 h left");
  assert.equal(leftText(72 * 36e5), "3 days left");
  assert.equal(new Date(weekEnd(Date.UTC(2026, 10, 4, 12))).getUTCDay(), 1, "weeks end on Monday");
});

test("league shows the top 20 plus the player's own row", () => {
  const rows = Array.from({ length: 30 }, (_, i) => ({ rank: i + 1, user_id: `u${i + 1}`, display_name: "x", points: 100 - i }));
  assert.equal(leagueRows(rows, "u5").length, 20);
  assert.equal(leagueRows(rows, "u25").at(-1)?.user_id, "u25");
  assert.equal(prizeNow({ players: 3, prizes: [1000], auto: true }, 1), "wins 1,000 coins now");
  assert.equal(prizeNow({ players: 3, prizes: [1000], auto: true }, 2), "");
});

test("races show the top 5 plus the player's own row", () => {
  const board = Array.from({ length: 8 }, (_, i) => ({ rank: i + 1, name: "x", points: 10, me: i === 7 }));
  assert.equal(raceRows({ board } as never).length, 6);
});

test("crew chests unlock in the same cases as Classic", () => {
  const c = { week_points: 200, goal: 600, tier1: 150, claimed: [], size: 3, min_members: 3, my_points: 50, min_points: 30 } as unknown as CrewInfo;
  assert.equal(chest(c, 1).label, "Open chest");
  assert.equal(chest(c, 2).label, "600 crew XP");
  assert.equal(chest({ ...c, size: 2 }, 1).label, "Needs 3 players");
  assert.equal(chest({ ...c, my_points: 10 }, 1).label, "You need 30 XP yourself");
  assert.equal(chest({ ...c, claimed: [1] }, 1).label, "Claimed");
  assert.equal(canJoinWithCode("ABC"), false);
  assert.equal(canJoinWithCode("ABCD"), true);
});

test("calendar splits on now; new players say when they joined", () => {
  const now = Date.UTC(2026, 10, 3);
  const op = (s: number) => ({ starts_at: new Date(now + s).toISOString() }) as LiveOp;
  const { live, soon } = splitOps([op(-1), op(1)], now);
  assert.equal(live.length, 1);
  assert.equal(soon.length, 1);
  assert.equal(ago(new Date(now).toISOString(), now), "joined today");
  assert.equal(ago(new Date(now - 864e5).toISOString(), now), "joined yesterday");
  assert.equal(ago(new Date(now - 3 * 864e5).toISOString(), now), "joined 3 days ago");
});
