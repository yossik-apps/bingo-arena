// Sample data for the Profile's captures, one state per name. Local development only: nothing is sent anywhere.
import { computeDna } from "../../lib/dna";
import { demoRounds } from "../../lib/demo";
import type { Economy } from "../../lib/store";
import type { ScreenFixture } from "./contract";

const ECON = { club_until: null, club_claimed: false, limit_cents: 2500, month_cents: 499, owned: [], in_crew: false, has_pass: false } as unknown as Economy;
const never = () => new Promise<never>(() => undefined);

export const fixture: ScreenFixture = (base, state) => {
  const rounds = demoRounds();
  const dna = { dna: computeDna(rounds), rounds, coach: "Coach Nova" };
  // a visitor sees Classic's demo profile, which App builds from the same demo rounds
  if (!base.profile) return { ...base, dna };
  const ctx = { ...base, dna, wallet: { ...base.wallet, economy: ECON } };
  switch (state) {
    case "new": return { ...ctx, dna: { dna: null, rounds: rounds.slice(0, 1), coach: "Coach Nova" }, profile: { ...base.profile, played: 1, streak: 1, shields: 0, dailyDone: 0 } };
    case "guest": return { ...ctx, wallet: { ...base.wallet, economy: null }, profile: { ...base.profile, guest: true, played: 4 } };
    case "club": return { ...ctx, wallet: { ...ctx.wallet, economy: { ...ECON, club_until: new Date(Date.now() + 20 * 864e5).toISOString() } } };
    case "loading": return { ...ctx, account: { ...ctx.account, load: never } };
    case "error": return { ...ctx, account: { ...ctx.account, load: async () => { throw new Error("Sample data: the ranks did not load"); } } };
    case "nomastery": return { ...ctx, account: { ...ctx.account, load: async () => ({ mastery: [], email: "sample@example.com" }) } };
    // opens on the Settings tab (the tab Classic remembers), so one --click can open the password or delete form
    case "settings": try { sessionStorage.setItem("ba_ptab", "settings"); } catch { /* ignore */ } return ctx;
    case "games": try { sessionStorage.setItem("ba_ptab", "games"); } catch { /* ignore */ } return ctx;
    case "drilled": return { ...ctx, daily: { ...ctx.daily, drillDone: true }, profile: { ...base.profile, shields: 2 } };
    default: return ctx;
  }
};
