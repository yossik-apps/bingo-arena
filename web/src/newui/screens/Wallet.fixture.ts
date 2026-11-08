// Sample data for the Wallet's captures, one state per name. Local development only.
import type { LedgerRow } from "../../lib/screenData";
import type { Economy, PurchaseRow } from "../../lib/store";
import type { ScreenCtx, ScreenFixture } from "./contract";

const H = 36e5, DAY = 864e5;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const ECON: Economy = {
  mode: "test", is_admin: false, gems: 128, vault: 0, vault_cap: 0, vault_pct: 0, club_until: null, club_claimed: false, limit_cents: null, month_cents: 0, owned: [], in_crew: false, has_pass: false,
};

// a mid-game week, with one reason of each kind Classic gives an icon to, and one it does not
const WEEK: [number, string, number][] = [
  [45, "Round prize", 1], [-20, "Entry fee", 1.2], [20, "Daily drill", 3], [60, "Daily Challenge gold", 5], [40, "Quest reward: play 3 rounds", 7],
  [50, "Login streak day 6", 26], [-900, "Bought Season Pass", 27], [30, "Journey stage clear", 30], [15, "Stamp pack duplicate", 50],
  [120, "League prize: 7th place", 52], [25, "Crew chest", 75], [-150, "Bought booster pack in the shop", 76], [20, "Refund: abandoned match", 99],
  [10, "Sample reason the game has no icon for, with a very long text", 100], [-30, "Sample spend with no icon", 125], [500, "Admin correction", 140],
  [50, "Welcome gift", 400],
];
const rows = (list: [number, string, number][]): LedgerRow[] => list.map(([amount, reason, h], i) => ({ id: 1000 - i, amount, reason, created_at: ago(h * H) }));
const MANY: LedgerRow[] = Array.from({ length: 75 }, (_, i) => ({ id: 5000 - i, amount: i % 3 === 0 ? -20 : 25, reason: i % 3 === 0 ? "Entry fee" : "Round prize", created_at: ago(i * 2.5 * H + H) }));
const BUYS: PurchaseRow[] = [
  { id: "p3", product_id: "gems_small", name: "Handful of gems", price_cents: 199, status: "test", created_at: ago(2 * DAY) },
  { id: "p2", product_id: "club", name: "Bingo Club, one month, with a sample name that is long", price_cents: 499, status: "paid", created_at: ago(9 * DAY) },
  { id: "p1", product_id: "starter", name: "Starter pack", price_cents: 299, status: "refunded", created_at: ago(30 * DAY) },
];

const set = (base: ScreenCtx, ledger: () => Promise<LedgerRow[]>, opts: { buys?: PurchaseRow[]; econ?: boolean; coins?: number; drillDone?: boolean } = {}): ScreenCtx => ({
  ...base,
  wallet: { ...base.wallet, economy: opts.econ === false ? null : ECON, gems: opts.econ === false ? null : ECON.gems, coins: opts.coins ?? base.wallet.coins },
  daily: { ...base.daily, drillDone: opts.drillDone ?? base.daily.drillDone },
  history: { ledger, purchases: async () => opts.buys ?? [] },
});

export const fixture: ScreenFixture = (base, state) => {
  const full = async () => rows(WEEK);
  switch (state) {
    case "new": return set(base, async () => rows([[50, "Welcome gift", 0.2]]), { coins: 50 });
    case "empty": return set(base, async () => [], { coins: 0 });
    case "nospend": return set(base, async () => rows([[50, "Welcome gift", 0.5], [45, "Round prize", 0.2]]), { coins: 95 });
    case "many": return set(base, async () => MANY);
    case "purchases": return set(base, full, { buys: BUYS });
    case "noecon": return set(base, full, { econ: false, buys: BUYS });
    case "drilldone": return set(base, full, { drillDone: true });
    case "rich": return set(base, async () => rows([[123456, "Admin correction", 1], [-98765, "Bought everything in the shop", 2], ...WEEK]), { coins: 9876543 });
    case "loading": return set(base, () => new Promise(() => undefined));
    case "error": return set(base, async () => { throw new Error("offline"); });
    default: return set(base, full);
  }
};
