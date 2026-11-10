// Helpers for balance.test.ts: a deterministic imperfect player, so the same taps can be replayed by any version of the engine.
import type { Board, Tap } from "../functions/_shared/engine.ts";

export function mulberry(a: number): () => number {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Taps of a player who reacts in about `rt` ms, misses a share of the numbers and sometimes taps a square not called yet. */
export function humanTaps(board: Board, every: number, seed: number, rt: number, miss: number, slip: number, totalMs = 100000): Tap[] {
  const { card, seq } = board, r = mulberry(seed ^ 0xabc123), raw: Tap[] = [];
  const when = new Map(seq.map((n, k) => [n, k]));
  for (let k = 0; k < seq.length && k * every <= totalMs; k++) {
    const i = card.indexOf(seq[k]);
    if (i < 0 || i === 12 || r() < miss) continue;
    const t = k * every + rt * (0.7 + 0.6 * r());
    raw.push({ i, t });
    if (r() < slip) {
      const later = card.map((v, j) => (v > 0 && (when.get(v) ?? 0) > k ? j : -1)).filter((j) => j >= 0);
      if (later.length) raw.push({ i: later[Math.floor(r() * later.length)], t: t * 0.8 });
    }
  }
  raw.sort((a, b) => a.t - b.t);
  const taps: Tap[] = []; let last = -1000;
  for (const x of raw) { const t = Math.round(Math.max(x.t, last + 100)); if (t > totalMs) break; taps.push({ i: x.i, t }); last = t; }
  return taps;
}
