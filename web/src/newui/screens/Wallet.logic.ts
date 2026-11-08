// The Wallet (Coins): Classic's conditions, numbers and words (views/Wallet.tsx), as pure functions.
import type { LedgerRow } from "../../lib/screenData";
import type { PurchaseRow } from "../../lib/store";
import type { IconName } from "../Icon";

export type Filter = "all" | "in" | "out";
export const FILTERS: { id: Filter; text: string }[] = [{ id: "all", text: "All" }, { id: "in", text: "Earned" }, { id: "out", text: "Spent" }];
/** Classic shows 30 rows, and "Show more" adds 30. */
export const PAGE = 30;
/** Classic shows up to 8 purchases. */
export const PURCHASES_SHOWN = 8;

export const WORDS = {
  balance: "Balance",
  playMoney: "Play money. It cannot be cashed out.",
  earned7: "Earned, 7 days", spent7: "Spent, 7 days", net: "Net",
  chart: "Last 7 days", legendIn: "Earned", legendOut: "Spent",
  purchases: "Purchases",
  ways: "Ways to earn coins",
  activity: "Recent activity", filter: "Filter activity", more: "Show more",
  drill: "Today's drill", drillTodo: "60 seconds, +20 coins", drillDone: "Done today. Back tomorrow for more.",
  challenge: "Daily Challenge", challengeSub: "Coins for bronze, silver and gold",
  quests: "Daily quests", questsSub: "Three goals, each with a reward",
};

/** Classic's icon for each kind of coin activity, mapped onto the new icon set. null: Classic's up or down arrow. */
const KINDS: [RegExp, IconName][] = [
  [/drill/i, "bolt"], [/login|streak/i, "flame"], [/daily challenge/i, "star"], [/quest/i, "target"],
  [/bought|shop|deal|season pass/i, "bag"], [/entry fee/i, "play"], [/refund/i, "plus"],
  [/prize|league|event/i, "trophy"], [/album|stamp|pack/i, "book"], [/journey/i, "map"], [/crew/i, "users"],
  [/registration|welcome/i, "gift"], [/admin/i, "gear"],
];
/** The icon for a row; null means Classic's fallback arrow (drawn as + or −). */
export const kindIcon = (r: LedgerRow): IconName | null => KINDS.find(([re]) => re.test(r.reason))?.[1] ?? null;

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
export function dayLabel(d: Date, now = Date.now()) {
  const t = new Date(now), y = new Date(now - 864e5);
  if (dayKey(d) === dayKey(t)) return "Today";
  if (dayKey(d) === dayKey(y)) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
}

export type Day = { key: string; label: string; earned: number; spent: number };
/** The last 7 days, oldest first: coins earned and spent per day. */
export function week(rows: LedgerRow[], now = Date.now()): Day[] {
  const days: Day[] = Array.from({ length: 7 }, (_, k) => {
    const d = new Date(now - (6 - k) * 864e5);
    return { key: dayKey(d), label: k === 6 ? "Today" : d.toLocaleDateString(undefined, { weekday: "short" }), earned: 0, spent: 0 };
  });
  for (const r of rows) {
    const d = days.find((x) => x.key === dayKey(new Date(r.created_at)));
    if (!d) continue;
    if (r.amount > 0) d.earned += r.amount; else d.spent += -r.amount;
  }
  return days;
}
export function totals(days: Day[]) {
  const earned = days.reduce((a, d) => a + d.earned, 0), spent = days.reduce((a, d) => a + d.spent, 0);
  return { earned, spent, net: earned - spent, top: Math.max(1, ...days.map((d) => Math.max(d.earned, d.spent))) };
}

/** "+N" or "−N" with Classic's minus sign. Classic groups the digits in the 7-day totals only, not in the day nets and rows. */
export const signed = (n: number, group = true) => `${n >= 0 ? "+" : "−"}${group ? Math.abs(n).toLocaleString() : Math.abs(n)}`;
export const chartLabel = (days: Day[]) => `Coins per day, last 7 days: ${days.map((d) => `${d.label} earned ${d.earned}, spent ${d.spent}`).join("; ")}`;
export const dayTitle = (d: Day) => `${d.label}: +${d.earned} earned, −${d.spent} spent`;

export const filtered = (rows: LedgerRow[], f: Filter) => rows.filter((r) => f === "all" || (f === "in" ? r.amount > 0 : r.amount < 0));
export type Group = { label: string; net: number; items: LedgerRow[] };
/** The first `shown` rows, grouped by day as Classic does. */
export function groups(list: LedgerRow[], shown: number, now = Date.now()): Group[] {
  const out: Group[] = [];
  for (const r of list.slice(0, shown)) {
    const label = dayLabel(new Date(r.created_at), now), g = out[out.length - 1];
    if (g && g.label === label) { g.items.push(r); g.net += r.amount; } else out.push({ label, net: r.amount, items: [r] });
  }
  return out;
}
export const emptyText = (f: Filter) => (f === "out" ? "You have not spent any coins yet." : "Nothing yet. Play a round to get started.");

export const timeOf = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
export const purchaseSub = (b: PurchaseRow) =>
  `${new Date(b.created_at).toLocaleDateString()}${b.status === "test" ? " · test, not charged" : b.status === "refunded" ? " · refunded" : ""}`;
