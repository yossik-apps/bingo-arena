import { useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { supabase } from "../../lib/supabase";
import { isWide, mainScroller, screenName } from "../../lib/heat";
import { deviceKind } from "../../lib/track";

// Heatmap overlay for admins: draws where players tapped on top of the real game screens.
// Started from Admin → Heatmaps. It stays on (in this browser) until closed, and shows nothing to players.
type Pts = { screen: string; taps: number; dead: number; points: [number, number, number, number][] };
const KEY = "ba_hm_overlay";

function Overlay({ onClose }: { onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [screen, setScreen] = useState(screenName());
  const [data, setData] = useState<Pts | null>(null);
  const [mine, setMine] = useState(true); // only taps from screens like mine (same device, same layout)
  const [deadOnly, setDeadOnly] = useState(false);
  const [msg, setMsg] = useState("");
  const [days, setDays] = useState(30);

  useEffect(() => { const t = setInterval(() => setScreen(screenName()), 700); return () => clearInterval(t); }, []);
  useEffect(() => {
    let alive = true;
    setData(null); setMsg("");
    void supabase.rpc("admin_heat_screen", { p_screen: screen, p_days: days, p_device: mine ? deviceKind() : null, p_wide: mine ? isWide() : null }).then(({ data: d, error }) => {
      if (!alive) return;
      if (error) { setMsg(/forbidden/.test(error.message) ? "Admins only." : "Run database update 024 first."); return; }
      setData({ screen, ...(d as Omit<Pts, "screen">) });
    });
    return () => { alive = false; };
  }, [screen, mine, days]);

  // draw, and redraw on scroll and resize
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = 0;
      const c = canvas.current;
      if (!c) return;
      c.width = innerWidth; c.height = innerHeight;
      const g = c.getContext("2d");
      if (!g || !data) return;
      g.clearRect(0, 0, c.width, c.height);
      const top = screen.includes(":") ? 0 : mainScroller().top;
      const r = Math.max(14, Math.min(28, innerWidth / 30));
      for (const [x, y, , dead] of data.points) {
        if (deadOnly && !dead) continue;
        const px = (x / 1000) * innerWidth, py = y - top;
        if (py < -r || py > innerHeight + r) continue;
        const grad = g.createRadialGradient(px, py, 0, px, py, r);
        grad.addColorStop(0, dead ? "rgba(37,99,235,0.35)" : "rgba(239,68,68,0.32)");
        grad.addColorStop(1, "rgba(250,204,21,0)");
        g.fillStyle = grad;
        g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fill();
      }
    };
    const later = () => { if (!raf) raf = requestAnimationFrame(draw); };
    draw();
    document.addEventListener("scroll", later, { capture: true, passive: true });
    window.addEventListener("resize", later);
    return () => { document.removeEventListener("scroll", later, { capture: true }); window.removeEventListener("resize", later); if (raf) cancelAnimationFrame(raf); };
  }, [data, deadOnly, screen]);

  return (
    <>
      <canvas ref={canvas} className="hmo-canvas" aria-hidden="true" />
      <div className="hmo-panel" data-heat-ignore role="region" aria-label="Heatmap overlay">
        <div className="hmo-row"><b>Heatmap</b><span className="hmo-screen">{screen}</span><button className="hmo-x" aria-label="Close the heatmap" onClick={onClose}>✕</button></div>
        <div className="hmo-row hmo-dim">{msg || (data ? `${data.taps.toLocaleString()} taps · ${data.dead} on nothing · last ${days} days` : "Loading…")}</div>
        <div className="hmo-row">
          <label><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Screens like mine</label>
          <label><input type="checkbox" checked={deadOnly} onChange={(e) => setDeadOnly(e.target.checked)} /> Dead taps only</label>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period">{[7, 30, 90].map((d) => <option key={d} value={d}>{d} days</option>)}</select>
        </div>
        <div className="hmo-row hmo-dim"><i className="hmo-dot red" /> taps <i className="hmo-dot blue" /> taps on nothing · go to any screen to see its map</div>
      </div>
    </>
  );
}

let root: Root | null = null, host: HTMLElement | null = null;
/** Shows or hides the overlay on the game screens (admins only; the data is refused to anyone else). */
export function setHeatOverlay(on: boolean) {
  try { if (on) localStorage.setItem(KEY, "1"); else localStorage.removeItem(KEY); } catch { /* ignore */ }
  if (on && !root) {
    host = document.createElement("div");
    host.setAttribute("data-heat-ignore", "");
    document.documentElement.appendChild(host); // outside <body>, so the big-text zoom does not shift the map
    root = createRoot(host);
    root.render(<Overlay onClose={() => setHeatOverlay(false)} />);
  } else if (!on && root) {
    root.unmount(); root = null; host?.remove(); host = null;
  }
}
export const heatOverlayOn = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };
