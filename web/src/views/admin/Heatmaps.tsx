import { useCallback, useEffect, useRef, useState } from "react";
import { adminRpc } from "../../lib/admin";
import { parseMode, type FlagMode } from "../../lib/flags";
import { supabase } from "../../lib/supabase";
import Notice from "../../lib/Notice";
import { heatOverlayOn, setHeatOverlay } from "./HeatOverlay";

type Cell = { cell: number; hits: number; wrong: number; late: number; missed: number; rt: number | null };
type Slice = { slice: number; taps: number; hits: number; errors: number; quits: number };
type Board = { since: string | null; levels: string[]; modes: string[]; rounds: { finished: number; quit: number }; cells: Cell[]; slices: Slice[] };
type ScreenRow = { screen: string; taps: number; dead: number; rage: number; phone: number; desktop: number; tablet: number };
type ScreenDetail = { taps: number; dead: number; rage: number; elements: { el: string; taps: number; dead: number; rage: number }[]; points: [number, number, number, number][]; scroll: { bucket: number; n: number }[] };

const LETTERS = ["B", "I", "N", "G", "O"];
const MODE: Record<string, string> = { solo: "Practice", ghost: "Beat the Ghost", pvp: "Live match", tour: "Event", stage: "Journey", daily: "Daily Challenge", duel: "Friend challenge", drill: "Drill" };
const LEVEL: Record<string, string> = { beginner: "Beginner", medium: "Medium", hard: "Hard" };
type Metric = "hit" | "missed" | "wrong" | "late" | "rt";
const METRICS: [Metric, string, string][] = [
  ["hit", "Daubed in time", "Share of the numbers on this square that players daubed before they left the board"],
  ["missed", "Missed", "Share of the numbers on this square that left the board untapped"],
  ["wrong", "Wrong taps", "Taps on this square before its number was called, per round"],
  ["late", "Late taps", "Taps on this square after its number had left the board, per round"],
  ["rt", "Reaction time", "Average time from the call to the daub, in seconds"],
];
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const value = (c: Cell | undefined, m: Metric, rounds: number): number | null => {
  if (!c) return null;
  if (m === "hit") return c.hits + c.missed ? (c.hits / (c.hits + c.missed)) * 100 : null;
  if (m === "missed") return c.hits + c.missed ? (c.missed / (c.hits + c.missed)) * 100 : null;
  if (m === "wrong") return rounds ? c.wrong / rounds : null;
  if (m === "late") return rounds ? c.late / rounds : null;
  return c.rt === null ? null : c.rt / 1000;
};
const fmt = (v: number | null, m: Metric) => (v === null ? "–" : m === "rt" ? `${v.toFixed(1)}s` : m === "wrong" || m === "late" ? v.toFixed(2) : `${Math.round(v)}%`);
const SCREEN_NAME = (s: string) => s.replace(/^guest-/, "Visitor · ").replace(/:(.+)$/, " · pop-up $1").replace(/^lobby/, "Lobby").replace(/^result/, "Result").replace(/^match/, "Finding a match");

/** Admin → Heatmaps: the game board (where players hit and miss) and the screens (where they tap and how far they scroll). */
export default function Heatmaps() {
  const [tab, setTab] = useState<"board" | "screens">("board");
  const [mode, setMode] = useState<FlagMode | null>(null);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    void supabase.from("feature_flags").select("mode").eq("key", "heatmaps").maybeSingle().then(({ data, error }) => setMode(error || !data ? null : parseMode(data.mode)));
  }, []);
  const pick = async (m: FlagMode) => {
    try { await adminRpc("admin_set_flag", { p_key: "heatmaps", p_mode: m }); setMode(m); setMsg(m === "off" ? "Recording stopped. The data collected so far stays." : m === "admins" ? "Recording only your own play (admins), to check it works." : "Recording all players from their next page load."); }
    catch (e) { setMsg((e as Error).message); }
  };
  return (
    <div className="hm">
      <Notice text={msg} />
      <div className="box hm-flag">
        <div><b>Recording</b><span className="dim"> · Anonymous: no names, no player IDs, no IP addresses. Nothing is recorded during admin pages.</span></div>
        {mode === null ? <span className="dim">Run database update 024 to use heatmaps.</span> : (
          <div className="an-seg" role="radiogroup" aria-label="Heatmaps recording">
            {([["off", "Off"], ["admins", "Admins only"], ["all", "All players"]] as [FlagMode, string][]).map(([k, n]) => <button key={k} role="radio" aria-checked={mode === k} className={mode === k ? "on" : ""} onClick={() => void pick(k)}>{n}</button>)}
          </div>
        )}
      </div>
      <div className="an-seg hm-tabs" role="tablist">
        <button role="tab" aria-selected={tab === "board"} className={tab === "board" ? "on" : ""} onClick={() => setTab("board")}>Game board</button>
        <button role="tab" aria-selected={tab === "screens"} className={tab === "screens" ? "on" : ""} onClick={() => setTab("screens")}>Screens</button>
      </div>
      {tab === "board" ? <BoardHeat /> : <ScreenHeat />}
    </div>
  );
}

function BoardHeat() {
  const [days, setDays] = useState(30);
  const [level, setLevel] = useState<string>("");
  const [mode, setMode] = useState<string>("");
  const [metric, setMetric] = useState<Metric>("hit");
  const [d, setD] = useState<Board | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    adminRpc<Board>("admin_heat_board", { p_days: days, p_level: level || null, p_mode: mode || null }).then(setD).catch((e: Error) => setErr(/function|PGRST20/i.test(e.message) ? "Run database update 024 to see heatmaps." : e.message));
  }, [days, level, mode]);
  if (err) return <p className="dim">{err}</p>;
  if (!d) return <div className="skel" style={{ height: 240 }} />;
  const rounds = d.rounds.finished;
  const byCell = new Map(d.cells.map((c) => [c.cell, c]));
  const vals = Array.from({ length: 25 }, (_, i) => (i === 12 ? null : value(byCell.get(i), metric, rounds)));
  const nums = vals.filter((v): v is number => v !== null);
  const lo = Math.min(...nums), hi = Math.max(...nums);
  const good = metric === "hit"; // higher is better only for the hit rate
  const shade = (v: number | null) => (v === null || hi === lo ? 0 : ((v - lo) / (hi - lo)) * 100);
  // per letter (column)
  const cols = LETTERS.map((_, c) => {
    const cs = [0, 1, 2, 3, 4].map((r) => byCell.get(r * 5 + c)).filter((x): x is Cell => !!x);
    const hits = cs.reduce((a, x) => a + x.hits, 0), missed = cs.reduce((a, x) => a + x.missed, 0), wrong = cs.reduce((a, x) => a + x.wrong + x.late, 0);
    const rtn = cs.filter((x) => x.rt !== null);
    return { hit: hits + missed ? (hits / (hits + missed)) * 100 : null, wrong: rounds ? wrong / rounds : null, rt: rtn.length ? rtn.reduce((a, x) => a + (x.rt ?? 0), 0) / rtn.length / 1000 : null };
  });
  const sl = Array.from({ length: 10 }, (_, i) => d.slices.find((s) => s.slice === i) ?? { slice: i, taps: 0, hits: 0, errors: 0, quits: 0 });
  const errMax = Math.max(1, ...sl.map((s) => (s.taps ? s.errors / s.taps : 0)));
  const quitMax = Math.max(1, ...sl.map((s) => s.quits));
  // plain-language reading
  const notes: string[] = [];
  if (rounds < 30) notes.push(`Only ${rounds} finished rounds so far${d.since ? ` (since ${d.since})` : ""}. Patterns get reliable after a few hundred.`);
  const colHits = cols.map((c, i) => ({ l: LETTERS[i], v: c.hit })).filter((x) => x.v !== null) as { l: string; v: number }[];
  if (colHits.length === 5) {
    const worst = colHits.reduce((a, b) => (b.v < a.v ? b : a)), best = colHits.reduce((a, b) => (b.v > a.v ? b : a));
    if (best.v - worst.v >= 5) notes.push(`Players miss most numbers in the ${worst.l} column (${Math.round(worst.v)}% daubed vs ${Math.round(best.v)}% in ${best.l}). A column hint or a brighter header there could help.`);
  }
  const errPeak = sl.reduce((a, b) => ((b.taps ? b.errors / b.taps : 0) > (a.taps ? a.errors / a.taps : 0) ? b : a));
  if (errPeak.taps) notes.push(`Most mistakes happen in the ${["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "last"][errPeak.slice]} tenth of a round (${pct(errPeak.errors, errPeak.taps)}% of taps there are wrong or late).`);
  if (d.rounds.quit) {
    const qPeak = sl.reduce((a, b) => (b.quits > a.quits ? b : a));
    notes.push(`${pct(d.rounds.quit, d.rounds.quit + rounds)}% of rounds were left before the end, most often around ${qPeak.slice * 10}–${qPeak.slice * 10 + 10}% of the way in.`);
  }
  return (
    <div className="hm-board">
      <div className="an-bar">
        <div className="an-seg" role="group" aria-label="Period">{[7, 30, 90].map((n) => <button key={n} className={days === n ? "on" : ""} onClick={() => setDays(n)}>{n} days</button>)}</div>
        <label className="hm-sel">Level <select value={level} onChange={(e) => setLevel(e.target.value)}><option value="">All</option>{d.levels.map((l) => <option key={l} value={l}>{LEVEL[l] ?? l}</option>)}</select></label>
        <label className="hm-sel">Mode <select value={mode} onChange={(e) => setMode(e.target.value)}><option value="">All</option>{d.modes.map((m) => <option key={m} value={m}>{MODE[m] ?? m}</option>)}</select></label>
        <span className="dim">{rounds.toLocaleString()} finished rounds · {d.rounds.quit} left early</span>
      </div>
      {notes.length > 0 && <ul className="rt-notes">{notes.map((n) => <li key={n} className="info">{n}</li>)}</ul>}
      <div className="hm-grid2">
        <section className="box">
          <div className="an-seg hm-metrics" role="radiogroup" aria-label="What to show">{METRICS.map(([k, n, h]) => <button key={k} role="radio" aria-checked={metric === k} title={h} className={metric === k ? "on" : ""} onClick={() => setMetric(k)}>{n}</button>)}</div>
          <p className="dim hm-help">{METRICS.find((m) => m[0] === metric)![2]}. {good ? "Darker = better." : "Darker = more."}</p>
          <div className="hm-card" role="table" aria-label="Board heatmap">
            {LETTERS.map((l) => <div key={l} className="hm-h" role="columnheader">{l}</div>)}
            {vals.map((v, i) => (
              <div key={i} role="cell" className={`hm-c ${i === 12 ? "free" : ""}`} title={i === 12 ? "Free space" : `${LETTERS[i % 5]} column, row ${Math.floor(i / 5) + 1}: ${fmt(v, metric)}`}
                style={i === 12 ? undefined : { background: `color-mix(in srgb, ${good ? "var(--ok)" : "var(--daub)"} ${Math.round(10 + shade(v) * 0.8)}%, var(--cell))` }}>
                {i === 12 ? "FREE" : fmt(v, metric)}
              </div>
            ))}
            {cols.map((c, i) => <div key={"c" + i} className="hm-f" role="cell" title={`${LETTERS[i]} column`}>{metric === "rt" ? fmt(c.rt, "rt") : metric === "wrong" || metric === "late" ? fmt(c.wrong, "wrong") : c.hit === null ? "–" : `${Math.round(metric === "missed" ? 100 - c.hit : c.hit)}%`}</div>)}
          </div>
          <p className="dim hm-help">The bottom row is the whole column. The board is the same 5 × 5 layout for every round, so this shows positions, not numbers.</p>
        </section>
        <section className="box">
          <h3>During the round</h3>
          <div className="hm-time" role="table" aria-label="Errors and quits by tenth of the round">
            {sl.map((s) => (
              <div key={s.slice} className="hm-t" role="row" title={`${s.slice * 10}–${s.slice * 10 + 10}% of the round: ${s.taps} taps, ${pct(s.errors, s.taps)}% wrong or late, ${s.quits} left`}>
                <span className="hm-tl">{s.slice * 10}%</span>
                <span className="hm-tb"><i className="err" style={{ width: `${s.taps ? ((s.errors / s.taps) / errMax) * 100 : 0}%` }} /></span>
                <span className="hm-tv">{s.taps ? `${pct(s.errors, s.taps)}%` : "–"}</span>
                <span className="hm-tb"><i className="quit" style={{ width: `${(s.quits / quitMax) * 100}%` }} /></span>
                <span className="hm-tv">{s.quits || ""}</span>
              </div>
            ))}
          </div>
          <p className="dim hm-help"><i className="hm-key err" /> wrong or late taps (share of taps) · <i className="hm-key quit" /> players who left the round then</p>
        </section>
      </div>
    </div>
  );
}

function ScreenHeat() {
  const [days, setDays] = useState(30);
  const [list, setList] = useState<ScreenRow[] | null>(null);
  const [since, setSince] = useState<string | null>(null);
  const [sel, setSel] = useState<string>("");
  const [device, setDevice] = useState<"phone" | "desktop">("phone");
  const [det, setDet] = useState<ScreenDetail | null>(null);
  const [err, setErr] = useState("");
  const [overlay, setOverlay] = useState(heatOverlayOn());
  useEffect(() => {
    adminRpc<{ since: string | null; screens: ScreenRow[] }>("admin_heat_screens", { p_days: days }).then((r) => { setList(r.screens); setSince(r.since); if (!sel && r.screens[0]) setSel(r.screens[0].screen); })
      .catch((e: Error) => setErr(/function|PGRST20/i.test(e.message) ? "Run database update 024 to see heatmaps." : e.message));
  }, [days]);
  const loadDet = useCallback(() => {
    if (!sel) return;
    adminRpc<ScreenDetail>("admin_heat_screen", { p_screen: sel, p_days: days, p_device: device, p_wide: device === "desktop" ? true : false }).then(setDet).catch(() => setDet(null));
  }, [sel, days, device]);
  useEffect(loadDet, [loadDet]);
  if (err) return <p className="dim">{err}</p>;
  if (!list) return <div className="skel" style={{ height: 240 }} />;
  const scrollTotal = det?.scroll.reduce((a, s) => a + s.n, 0) ?? 0;
  const reach = (b: number) => (scrollTotal ? Math.round(((det?.scroll.filter((s) => s.bucket >= b).reduce((a, s) => a + s.n, 0) ?? 0) / scrollTotal) * 100) : 0);
  const deadTop = det?.elements.filter((e) => e.dead > 0).sort((a, b) => b.dead - a.dead)[0];
  const notes: string[] = [];
  if (det && det.taps) {
    if (det.dead / det.taps >= 0.15) notes.push(`${pct(det.dead, det.taps)}% of taps here land on things that do nothing${deadTop ? `, most on “${deadTop.el}”. Players expect it to react: make it a button or make it look less tappable` : ""}.`);
    if (det.rage) notes.push(`${det.rage} angry repeat taps (3+ quick taps on one spot): something feels slow or broken there.`);
    if (scrollTotal >= 10 && reach(5) < 50) notes.push(`Only ${reach(5)}% of visits scroll past the middle of this screen. Anything important below that is rarely seen.`);
  }
  return (
    <div className="hm-screens">
      <div className="an-bar">
        <div className="an-seg" role="group" aria-label="Period">{[7, 30, 90].map((n) => <button key={n} className={days === n ? "on" : ""} onClick={() => setDays(n)}>{n} days</button>)}</div>
        <div className="an-seg" role="group" aria-label="Device">{(["phone", "desktop"] as const).map((k) => <button key={k} className={device === k ? "on" : ""} onClick={() => setDevice(k)}>{k === "phone" ? "Phones" : "Computers"}</button>)}</div>
        <button className={`btn sm ${overlay ? "alt" : ""}`} onClick={() => { setHeatOverlay(!overlay); setOverlay(!overlay); }}>{overlay ? "Hide the map on the game" : "Show the map on the game"}</button>
      </div>
      {overlay && <p className="dim hm-help">The map now shows on top of the real game screens. Press “Back to game” and open any screen; close it with ✕ in its corner. Only you see it.</p>}
      {list.length === 0 ? <p className="dim">No taps recorded yet{since ? "" : ": switch Recording to “Admins only” or “All players” above"}.</p> : (
        <div className="hm-grid2">
          <section className="box">
            <h3>Screens</h3>
            <div className="tw"><table className="t hm-list"><thead><tr><th>Screen</th><th>Taps</th><th>On nothing</th><th>Angry</th></tr></thead>
              <tbody>{list.map((s) => (
                <tr key={s.screen} className={sel === s.screen ? "picked" : ""} onClick={() => setSel(s.screen)} style={{ cursor: "pointer" }}>
                  <td><button className="linkbtn hm-pick" onClick={() => setSel(s.screen)}>{SCREEN_NAME(s.screen)}</button></td><td>{s.taps.toLocaleString()}</td>
                  <td style={{ color: s.dead / Math.max(1, s.taps) >= 0.15 ? "var(--warn)" : undefined }}>{pct(s.dead, s.taps)}%</td><td>{s.rage || ""}</td></tr>
              ))}</tbody></table></div>
          </section>
          <section className="box">
            <h3>{sel ? SCREEN_NAME(sel) : "Pick a screen"}</h3>
            {!det ? <div className="skel" style={{ height: 160 }} /> : (
              <>
                {notes.length > 0 && <ul className="rt-notes">{notes.map((n) => <li key={n} className="warn">{n}</li>)}</ul>}
                <div className="hm-shot-wrap">
                  <Density points={det.points} phone={device === "phone"} />
                  <div className="hm-side">
                    <h4>Most tapped</h4>
                    <ol className="hm-els">{det.elements.slice(0, 10).map((e) => <li key={e.el}><span className={e.dead ? "dead" : ""}>{e.el || "(no label)"}</span><b>{pct(e.taps, det.taps)}%</b></li>)}</ol>
                    <h4>Scrolled at least</h4>
                    {scrollTotal ? [3, 5, 8, 10].map((b) => <div key={b} className="hm-reach"><span>{b === 10 ? "to the end" : `${b * 10}%`}</span><span className="an-ht"><i style={{ width: `${reach(b)}%`, background: "var(--s1)" }} /></span><b>{reach(b)}%</b></div>) : <p className="dim">No scroll data yet.</p>}
                  </div>
                </div>
                <p className="dim hm-help">{det.taps.toLocaleString()} taps on {device === "phone" ? "phones" : "computers"}. <span className="hm-key red" /> taps · <span className="hm-key blue" /> taps on nothing. For the exact spot on the real screen, use “Show the map on the game”.</p>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

/** A density map of taps in a phone-shaped or computer-shaped frame (positions relative to the page). */
function Density({ points, phone }: { points: [number, number, number, number][]; phone: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const W = phone ? 220 : 360, vwRef = phone ? 390 : 1366;
    const maxY = Math.max(phone ? 844 : 768, ...points.map((p) => p[1] * (vwRef / Math.max(200, p[2]))));
    const H = Math.min(phone ? 520 : 420, Math.round((maxY / vwRef) * W));
    c.width = W; c.height = H;
    const g = c.getContext("2d");
    if (!g) return;
    g.clearRect(0, 0, W, H);
    const scale = W / vwRef, r = phone ? 10 : 8;
    for (const [x, y, vw, dead] of points) {
      const px = (x / 1000) * W, py = y * (vwRef / Math.max(200, vw)) * scale;
      if (py > H) continue;
      const grad = g.createRadialGradient(px, py, 0, px, py, r);
      grad.addColorStop(0, dead ? "rgba(37,99,235,0.45)" : "rgba(239,68,68,0.4)");
      grad.addColorStop(1, "rgba(250,204,21,0)");
      g.fillStyle = grad; g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fill();
    }
  }, [points, phone]);
  return <canvas ref={ref} className={`hm-shot ${phone ? "phone" : "desk"}`} aria-label="Tap density map" role="img" />;
}
