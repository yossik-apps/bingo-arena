// Small chart kit for the admin Analytics tab: plain SVG and HTML, no chart library.
// Colors come from CSS variables (--s1, --s2, --s3) so light and dark themes each get their own steps.
import { useEffect, useRef, useState } from "react";

export type Series = { key: string; label: string; color: string; values: number[] };

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => setW(Math.max(200, Math.round(el.clientWidth)));
    fit();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);
  return [ref, w] as const;
}

const niceMax = (v: number) => {
  if (v <= 4) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / p;
  return ([1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => f <= s) ?? 10) * p;
};
export const shortDay = (d: string) => new Date(d + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" });
const longDay = (d: string) => new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

/** Bars (one series), stacked bars (two or more) or lines over days, with a hover tooltip and a table view. */
export function TimeChart({ days, series, kind = "bar", fmt = (n) => n.toLocaleString(), height = 190, label }: {
  days: string[]; series: Series[]; kind?: "bar" | "stack" | "line"; fmt?: (n: number) => string; height?: number; label: string;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hov, setHov] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const n = days.length;
  const padL = 40, padR = 8, padT = 10, padB = 24;
  const iw = w - padL - padR, ih = height - padT - padB;
  const totals = days.map((_, i) => (kind === "line" ? Math.max(...series.map((s) => s.values[i] ?? 0)) : series.reduce((a, s) => a + (s.values[i] ?? 0), 0)));
  const max = niceMax(Math.max(0, ...totals));
  const y = (v: number) => padT + ih - (v / max) * ih;
  const step = iw / Math.max(1, n);
  const bw = Math.max(2, Math.min(28, step - (n > 40 ? 1 : 2)));
  const x = (i: number) => padL + step * i + step / 2;
  const every = Math.ceil(n / Math.max(2, Math.floor(iw / 64)));
  const empty = totals.every((t) => t === 0);
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - r.left - padL) / step);
    setHov(i >= 0 && i < n ? i : null);
  };
  return (
    <div className="an-chart" ref={ref}>
      <div className="an-chart-top">
        {series.length > 1 && <div className="an-legend">{series.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}</div>}
        <button className="linkbtn an-tbl" onClick={() => setTable(!table)} aria-pressed={table}>{table ? "Show chart" : "Show numbers"}</button>
      </div>
      {table ? (
        <div className="tw an-tw"><table className="t"><thead><tr><th>Day</th>{series.map((s) => <th key={s.key}>{s.label}</th>)}</tr></thead>
          <tbody>{days.map((d, i) => <tr key={d}><td>{longDay(d)}</td>{series.map((s) => <td key={s.key}>{fmt(s.values[i] ?? 0)}</td>)}</tr>).reverse()}</tbody></table></div>
      ) : (
        <div style={{ position: "relative" }}>
          <svg width={w} height={height} role="img" aria-label={`${label}. ${series.map((s) => `${s.label}: total ${fmt(s.values.reduce((a, b) => a + b, 0))}`).join(". ")}`}
            onPointerMove={onMove} onPointerLeave={() => setHov(null)} style={{ display: "block", touchAction: "pan-y" }}>
            {[0, 0.5, 1].map((f) => (
              <g key={f}>
                <line x1={padL} x2={w - padR} y1={y(max * f)} y2={y(max * f)} className="an-grid" />
                <text x={padL - 6} y={y(max * f) + 4} textAnchor="end" className="an-axis">{fmt(max * f)}</text>
              </g>
            ))}
            {days.map((d, i) => (i % every === 0 ? <text key={d} x={x(i)} y={height - 6} textAnchor="middle" className="an-axis">{shortDay(d)}</text> : null))}
            {hov !== null && <rect x={padL + step * hov} y={padT} width={step} height={ih} className="an-hov" />}
            {kind !== "line" && days.map((d, i) => {
              let acc = 0;
              return series.map((s, k) => {
                const v = s.values[i] ?? 0;
                if (!v) return null;
                const y0 = y(acc), y1 = y(acc + v);
                acc += v;
                const top = k === series.length - 1 || series.slice(k + 1).every((t) => !(t.values[i] ?? 0));
                const h = Math.max(1, y0 - y1 - (k > 0 ? 2 : 0));
                const r = top ? Math.min(4, bw / 2, h) : 0;
                const bx = x(i) - bw / 2, byTop = y1 + (k > 0 ? 0 : 0);
                const path = r
                  ? `M${bx},${byTop + h} V${byTop + r} Q${bx},${byTop} ${bx + r},${byTop} H${bx + bw - r} Q${bx + bw},${byTop} ${bx + bw},${byTop + r} V${byTop + h} Z`
                  : `M${bx},${byTop + h} V${byTop} H${bx + bw} V${byTop + h} Z`;
                return <path key={d + s.key} d={path} fill={s.color} />;
              });
            })}
            {kind === "line" && series.map((s) => (
              <g key={s.key}>
                <polyline fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
                {hov !== null && <circle cx={x(hov)} cy={y(s.values[hov] ?? 0)} r={4.5} fill={s.color} className="an-dot" />}
              </g>
            ))}
            {kind === "line" && hov !== null && <line x1={x(hov)} x2={x(hov)} y1={padT} y2={padT + ih} className="an-cross" />}
          </svg>
          {empty && <p className="an-empty">No data in this range yet.</p>}
          {hov !== null && (
            <div className="an-tip" style={{ left: Math.min(Math.max(x(hov) - 80, 0), w - 170), top: 4 }}>
              <b>{longDay(days[hov])}</b>
              {series.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label}<em>{fmt(s.values[hov] ?? 0)}</em></span>)}
              {kind === "stack" && series.length > 1 && <span className="an-tip-tot">Total<em>{fmt(totals[hov])}</em></span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** A tiny trend line for KPI tiles. */
export function Spark({ values, color = "var(--s1)" }: { values: number[]; color?: string }) {
  if (values.length < 2) return null;
  const mx = Math.max(1, ...values), w = 100, h = 26;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 2 - (v / mx) * (h - 4)}`).join(" ");
  return <svg className="an-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true"><polyline fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" points={pts} /></svg>;
}

/** A KPI tile: big number, change against the previous period, optional trend line. */
export function Kpi({ label, value, now, prev, spark, invert, hint }: { label: string; value: string; now?: number; prev?: number; spark?: number[]; invert?: boolean; hint?: string }) {
  let delta: React.ReactNode = null;
  if (now !== undefined && prev !== undefined) {
    if (prev === 0 && now === 0) delta = <span className="an-d flat">no change</span>;
    else if (prev === 0) delta = <span className="an-d up">new</span>;
    else {
      const ch = Math.round(((now - prev) / prev) * 100);
      const good = invert ? ch < 0 : ch > 0;
      // from a tiny base a percentage is meaningless (1 → 50 is "4900%"): show the earlier number instead
      const txt = prev < 10 && Math.abs(ch) > 200 ? `from ${prev.toLocaleString()}` : `${Math.abs(ch)}%`;
      delta = <span className={`an-d ${ch === 0 ? "flat" : good ? "up" : "down"}`}>{ch > 0 ? "▲" : ch < 0 ? "▼" : ""} {txt}<span className="sr-only"> against the previous period</span></span>;
    }
  }
  return (
    <div className="an-kpi" title={hint}>
      <span className="an-kl">{label}</span>
      <b>{value}</b>
      {(delta || spark) && <div className="an-kf">{delta}{spark && <Spark values={spark} />}</div>}
    </div>
  );
}

/** Horizontal bars for a short ranked list. */
export function HBars({ rows, fmt = (n) => n.toLocaleString(), color = "var(--s1)", total }: { rows: { label: string; n: number }[]; fmt?: (n: number) => string; color?: string; total?: number }) {
  const mx = Math.max(1, ...rows.map((r) => r.n));
  const sum = total ?? rows.reduce((a, r) => a + r.n, 0);
  if (!rows.length) return <p className="dim an-none">No data in this range yet.</p>;
  return (
    <div className="an-hbars">
      {rows.map((r) => (
        <div className="an-hb" key={r.label} title={`${r.label}: ${fmt(r.n)}`}>
          <span className="an-hl">{r.label}</span>
          <span className="an-ht"><i style={{ width: `${(r.n / mx) * 100}%`, background: color }} /></span>
          <b>{fmt(r.n)}</b><span className="dim an-hp">{sum ? Math.round((r.n / sum) * 100) + "%" : ""}</span>
        </div>
      ))}
    </div>
  );
}

/** A funnel: each step as a bar, with the share kept from the step before. */
export function Funnel({ steps }: { steps: { label: string; n: number; note?: string }[] }) {
  const top = Math.max(1, steps[0]?.n ?? 1);
  return (
    <ol className="an-funnel">
      {steps.map((s, i) => {
        const prev = i ? steps[i - 1].n : 0;
        return (
          <li key={s.label}>
            <div className="an-fl"><b>{s.label}</b>{s.note && <span className="dim">{s.note}</span>}</div>
            <div className="an-ft"><i style={{ width: `${Math.max(s.n ? 2 : 0, (s.n / top) * 100)}%` }} /></div>
            <div className="an-fn"><b>{s.n.toLocaleString()}</b><span className="dim">{i === 0 ? "start" : prev ? `${Math.round((s.n / prev) * 100)}% of step ${i}` : "–"}</span></div>
          </li>
        );
      })}
    </ol>
  );
}

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** When people play: weekday × hour, darker = more rounds. */
export function Heat({ cells }: { cells: [number, number, number][] }) {
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
  cells.forEach(([d, h, n]) => { if (d >= 1 && d <= 7 && h >= 0 && h < 24) grid[d - 1][h] = n; });
  const mx = Math.max(1, ...cells.map((c) => c[2]));
  let best = { d: 0, h: 0, n: 0 };
  grid.forEach((r, d) => r.forEach((n, h) => { if (n > best.n) best = { d, h, n }; }));
  return (
    <div className="an-heat-wrap">
      <div className="an-heat" role="img" aria-label={best.n ? `Busiest time: ${DOW[best.d]} ${best.h}:00 with ${best.n} rounds` : "No rounds yet"}>
        <span />
        {Array.from({ length: 24 }, (_, h) => <span key={h} className="an-hh">{h % 3 === 0 ? h : ""}</span>)}
        {grid.map((r, d) => [
          <span key={"l" + d} className="an-hd">{DOW[d]}</span>,
          ...r.map((n, h) => <i key={d + "-" + h} title={`${DOW[d]} ${h}:00–${h + 1}:00 · ${n} rounds`} style={{ background: n ? `color-mix(in oklab, var(--s1) ${Math.round(15 + (n / mx) * 85)}%, var(--panel))` : undefined }} />),
        ])}
      </div>
      <p className="dim an-cap">{best.n ? <>Busiest: <b>{DOW[best.d]} around {best.h}:00</b> ({best.n} rounds). </> : null}Stronger color means more rounds.</p>
    </div>
  );
}

/** Weekly sign-up groups and the share that came back in each following week. */
export function Cohorts({ rows }: { rows: { week: string; size: number; w: (number | null)[] }[] }) {
  if (!rows.length) return <p className="dim an-none">No sign-ups in the last 8 weeks yet.</p>;
  return (
    <div className="tw an-tw"><table className="t an-coh">
      <thead><tr><th>Joined in week of</th><th>Players</th><th>Week 1</th><th>Week 2</th><th>Week 3</th><th>Week 4</th></tr></thead>
      <tbody>{rows.map((r) => (
        <tr key={r.week}><td>{shortDay(r.week)}</td><td>{r.size}</td>
          {r.w.map((v, k) => {
            if (v === null) return <td key={k} className="dim">…</td>;
            const p = r.size ? Math.round((v / r.size) * 100) : 0;
            return <td key={k} style={{ background: `color-mix(in oklab, var(--s1) ${Math.round(8 + p * 0.8)}%, var(--panel))`, color: p > 55 ? "#fff" : undefined }} title={`${v} of ${r.size} came back`}>{p}%</td>;
          })}
        </tr>
      ))}</tbody>
    </table></div>
  );
}
