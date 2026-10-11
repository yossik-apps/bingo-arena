/** "2 h 10 min left", "3 days left", "starts in 5 h", "ended" */
export function timeLeft(iso: string, now = Date.now()): string {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "ended";
  const min = Math.floor(ms / 6e4), h = Math.floor(min / 60), d = Math.floor(h / 24);
  if (d >= 2) return `${d} days left`;
  if (h >= 1) return `${h} h ${min % 60} min left`;
  return `${Math.max(1, min)} min left`;
}
export const startsIn = (iso: string, now = Date.now()) => {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "now";
  const min = Math.floor(ms / 6e4), h = Math.floor(min / 60), d = Math.floor(h / 24);
  return d >= 2 ? `in ${d} days` : h >= 1 ? `in ${h} h` : `in ${Math.max(1, min)} min`;
};
export const when = (iso: string) => new Date(iso).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export const OP_LABEL: Record<string, string> = { xp_boost: "XP boost", coin_boost: "Coin boost", fee_discount: "Cheaper entries", banner: "News" };
export const opText = (o: { kind: string; mult: number; pct: number }) =>
  o.kind === "xp_boost" ? `${o.mult}x XP on every round` : o.kind === "coin_boost" ? `${o.mult}x coin prizes in Practice and Beat the Ghost` : o.kind === "fee_discount" ? `${o.pct}% off Beat the Ghost entry` : "";
