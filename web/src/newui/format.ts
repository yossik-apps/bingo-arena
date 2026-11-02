/** A balance for the phone header: the number up to 9,999, then 12.4k and 1.2M. Rounds down, so it never shows more than the player has. */
export function shortAmount(n: number): string {
  if (n <= 9999) return n.toLocaleString("en-US");
  const f = (v: number) => (Math.floor(v * 10) / 10).toFixed(1).replace(/\.0$/, "");
  return n < 999950 ? `${f(n / 1000)}k` : `${f(n / 1000000)}M`;
}
