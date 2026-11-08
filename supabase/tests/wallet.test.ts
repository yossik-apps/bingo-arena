import test from "node:test";
import assert from "node:assert/strict";
import {
  chartLabel, dayLabel, dayTitle, emptyText, filtered, FILTERS, groups, kindIcon, PAGE, purchaseSub, signed, totals, week, WORDS,
} from "../../web/src/newui/screens/Wallet.logic.ts";
import type { LedgerRow } from "../../web/src/lib/screenData.ts";
import type { PurchaseRow } from "../../web/src/lib/store.ts";

const H = 36e5, DAY = 864e5;
// noon local time, so "today" and "yesterday" do not depend on when the test runs
const NOW = new Date(2026, 10, 5, 12).getTime();
const row = (id: number, amount: number, reason: string, ago: number): LedgerRow => ({ id, amount, reason, created_at: new Date(NOW - ago).toISOString() });
const ROWS = [
  row(7, 45, "Round prize", 1 * H), row(6, -20, "Entry fee", 2 * H), row(5, 50, "Login streak", DAY), row(4, -300, "Bought Neon frame", 3 * DAY),
  row(3, 20, "Daily drill", 3 * DAY + H), row(2, 15, "Something new", 6 * DAY), row(1, 50, "Welcome", 20 * DAY),
];

test("the last 7 days add up earned and spent per day, oldest first, ending Today", () => {
  const days = week(ROWS, NOW);
  assert.equal(days.length, 7);
  assert.equal(days[6].label, "Today");
  assert.deepEqual([days[6].earned, days[6].spent], [45, 20]);
  assert.deepEqual([days[5].earned, days[3].earned, days[3].spent, days[0].earned], [50, 20, 300, 15]);
  const t = totals(days);
  assert.deepEqual([t.earned, t.spent, t.net, t.top], [130, 320, -190, 300]);
  // a row older than 7 days is left out, as in Classic
  assert.equal(days.reduce((a, d) => a + d.earned, 0), 130);
});

test("an empty week still scales the bars (no division by zero)", () => {
  assert.equal(totals(week([], NOW)).top, 1);
});

test("signs use Classic's minus, with digit groups only where Classic has them", () => {
  assert.equal(signed(1234), `+${(1234).toLocaleString()}`);
  assert.equal(signed(-1234), `−${(1234).toLocaleString()}`);
  assert.equal(signed(-1234, false), "−1234");
  assert.equal(signed(0), "+0");
});

test("rows group by day: Today, Yesterday, then a date, each with its net", () => {
  const g = groups(ROWS, PAGE, NOW);
  assert.deepEqual(g.map((x) => x.label).slice(0, 2), ["Today", "Yesterday"]);
  assert.equal(g[0].net, 25);
  assert.equal(g[0].items.length, 2);
  assert.equal(dayLabel(new Date(NOW - 3 * DAY), NOW), new Date(NOW - 3 * DAY).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" }));
  // only the first `shown` rows are grouped
  assert.equal(groups(ROWS, 3, NOW).reduce((a, x) => a + x.items.length, 0), 3);
});

test("the filter keeps earned or spent rows; the empty text follows Classic", () => {
  assert.deepEqual(filtered(ROWS, "in").map((r) => r.id), [7, 5, 3, 2, 1]);
  assert.deepEqual(filtered(ROWS, "out").map((r) => r.id), [6, 4]);
  assert.equal(filtered(ROWS, "all").length, ROWS.length);
  assert.equal(emptyText("out"), "You have not spent any coins yet.");
  assert.equal(emptyText("all"), "Nothing yet. Play a round to get started.");
  assert.equal(emptyText("in"), "Nothing yet. Play a round to get started.");
  assert.deepEqual(FILTERS.map((f) => f.text), ["All", "Earned", "Spent"]);
});

test("each kind of activity gets Classic's icon, mapped to the new set", () => {
  const k = (reason: string, amount = 10) => kindIcon(row(0, amount, reason, 0));
  assert.equal(k("Daily drill"), "bolt");
  assert.equal(k("Login streak day 4"), "flame");
  assert.equal(k("Daily Challenge gold"), "star");
  assert.equal(k("Quest reward"), "target");
  assert.equal(k("Bought Season Pass", -900), "bag");
  assert.equal(k("Entry fee", -20), "play");
  assert.equal(k("Refund"), "plus");
  assert.equal(k("League prize"), "trophy");
  assert.equal(k("Stamp pack"), "book");
  assert.equal(k("Journey stage"), "map");
  assert.equal(k("Crew chest"), "users");
  assert.equal(k("Welcome gift"), "gift");
  assert.equal(k("Admin correction"), "gear");
  assert.equal(k("Something new"), null);
});

test("chart words and purchase lines are Classic's", () => {
  const d = { key: "k", label: "Mon", earned: 40, spent: 5 };
  assert.equal(dayTitle(d), "Mon: +40 earned, −5 spent");
  assert.equal(chartLabel([d, { ...d, label: "Today" }]), "Coins per day, last 7 days: Mon earned 40, spent 5; Today earned 40, spent 5");
  const b = (status: PurchaseRow["status"]) => ({ id: "p", product_id: "x", name: "Gems", price_cents: 499, status, created_at: new Date(NOW).toISOString() });
  const date = new Date(NOW).toLocaleDateString();
  assert.equal(purchaseSub(b("paid")), date);
  assert.equal(purchaseSub(b("test")), `${date} · test, not charged`);
  assert.equal(purchaseSub(b("refunded")), `${date} · refunded`);
  assert.equal(WORDS.playMoney, "Play money. It cannot be cashed out.");
  assert.equal(WORDS.drillDone, "Done today. Back tomorrow for more.");
});
