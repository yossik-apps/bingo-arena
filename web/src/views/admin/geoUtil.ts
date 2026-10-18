// Shared helpers for the country map (kept apart so the map and its world data load only when opened).
export type GeoRow = { c: string; visitors: number; players: number; new_players: number; payers: number; cents: number };
export type Metric = "visitors" | "players" | "new_players" | "cents";
export const METRICS: [Metric, string][] = [["visitors", "Visitors"], ["players", "Active players"], ["new_players", "New players"], ["cents", "Revenue"]];

let names: Intl.DisplayNames | null = null;
export const countryName = (c: string) => {
  if (c === "??") return "Unknown";
  try { names ??= new Intl.DisplayNames(undefined, { type: "region" }); return names.of(c) ?? c; } catch { return c; }
};
const money = (c: number) => "$" + (c / 100).toLocaleString(undefined, { maximumFractionDigits: 2 });
export const fmtMetric = (m: Metric, v: number) => (m === "cents" ? money(v) : v.toLocaleString());

