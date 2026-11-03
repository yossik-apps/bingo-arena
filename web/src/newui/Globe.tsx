import type { CSSProperties } from "react";
import { Ball, Bulbs, toneOf } from "./Ball";

// the balls resting in the globe (a fixed pseudo-random pile, so it never jumps between renders)
const HEAP = (() => {
  let s = 7;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const out: { n: number; x: number; y: number; size: number; rot: number; dx: number; dy: number; dr: number; dur: number; delay: number }[] = [];
  // back rows first, so the front rows overlap them like a real pile
  const rows: [number, number[]][] = [
    [206, [58, 100, 230, 272]],
    [236, [66, 106, 146, 186, 226, 266]],
    [266, [56, 94, 132, 170, 208, 246, 284]],
    [296, [78, 114, 150, 186, 222, 258]],
    [318, [112, 148, 184, 220]],
  ];
  for (const [y, xs] of rows) {
    for (const x of xs) {
      const n = Math.floor(r() * 75) + 1;
      const size = 46 + Math.round(r() * 2);
      out.push({ n, x: x - size / 2 + Math.round(r() * 6 - 3), y: y - size / 2 + Math.round(r() * 6 - 3), size, rot: Math.round(r() * 80 - 40), dx: Math.round(r() * 8 - 4), dy: -Math.round(4 + r() * 8), dr: Math.round(r() * 30 - 15), dur: 2.2 + r() * 2, delay: -r() * 4 });
    }
  }
  return out;
})();

/** The globe with the big PLAY ball. Drawn at 330 x 378 and scaled with `k`, so the caller decides how much room it gets. */
export function Globe({ k, label, dim, disabled, onPlay }: { k: number; label: string; dim?: boolean; disabled?: boolean; onPlay: () => void }) {
  return (
    <div style={{ position: "relative", width: 330 * k, height: 378 * k, flexShrink: 0 }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: 330, height: 378, transform: `scale(${k})`, transformOrigin: "top left" }}>
        <div className="nu-glass" aria-hidden="true">
          {HEAP.map((b, i) => <Ball key={i} tone={toneOf(b.n)} num={b.n} size={b.size} rot={b.rot} className="nu-jig" style={{ position: "absolute", left: b.x, top: b.y, ["--dx" as string]: `${b.dx}px`, ["--dy" as string]: `${b.dy}px`, ["--dr" as string]: `${b.dr}deg`, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s` } as CSSProperties} />)}
        </div>
        <div className="nu-neck" aria-hidden="true" /><div className="nu-foot" aria-hidden="true"><Bulbs n={5} /></div>
        <button type="button" className="nu-play" aria-label={label} disabled={disabled} onClick={onPlay} style={dim ? { opacity: 0.55, animation: "none" } : undefined}>
          <span className="nu-ball nu-bP" style={{ ["--s" as string]: "152px", border: "7px solid #fff", boxShadow: "inset -9px -12px 20px rgba(0,0,0,.28), inset 5px 6px 12px rgba(255,255,255,.45), 0 14px 22px rgba(4,16,60,.5)" } as CSSProperties}>
            <span style={{ fontFamily: "var(--nu-font-display)", fontSize: 40, lineHeight: 1, color: "#3A2300", textShadow: "0 2px 0 rgba(255,255,255,.55)", position: "relative", zIndex: 1 }}>PLAY!</span>
          </span>
        </button>
      </div>
    </div>
  );
}
