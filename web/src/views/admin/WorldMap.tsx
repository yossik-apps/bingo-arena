// World map of visitors and players by country (loaded only when an admin opens it).
import { useEffect, useMemo, useRef, useState } from "react";
import { feature } from "topojson-client";
import { geoEqualEarth, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
import world from "world-atlas/countries-110m.json";
import { NAME_TO_A2, NUM_TO_A2 } from "./isoNumeric";

import { countryName, fmtMetric, METRICS, type GeoRow, type Metric } from "./geoUtil";

type Shape = { a2: string; d: string; name: string; small: boolean; cx: number; cy: number };
let shapesCache: { list: Feature<Geometry, { name: string }>[] } | null = null;
function countries() {
  if (!shapesCache) {
    const topo = world as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
    const fc = feature(topo, topo.objects.countries) as FeatureCollection<Geometry, { name: string }>;
    shapesCache = { list: fc.features.filter((f) => f.properties.name !== "Antarctica") };
  }
  return shapesCache.list;
}
const STEPS = [18, 36, 54, 72, 92]; // % of the series color mixed into the panel color (light → strong)

export default function WorldMap({ rows, metric, selected, onSelect }: { rows: GeoRow[]; metric: Metric; selected: string | null; onSelect: (c: string | null) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const [hov, setHov] = useState<{ c: string; x: number; y: number } | null>(null);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const fit = () => setW(Math.max(260, el.clientWidth));
    fit();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);
  const h = Math.round(w * 0.46);
  const shapes = useMemo<Shape[]>(() => {
    const list = countries();
    const proj = geoEqualEarth().fitSize([w, h], { type: "FeatureCollection", features: list } as FeatureCollection);
    const path = geoPath(proj);
    return list.map((f) => {
      const [cx, cy] = path.centroid(f);
      return { a2: (f.id && NUM_TO_A2[String(f.id)]) || NAME_TO_A2[f.properties.name] || "", d: path(f) ?? "", name: f.properties.name, small: path.area(f) < 60, cx, cy };
    });
  }, [w, h]);
  const by = useMemo(() => new Map(rows.map((r) => [r.c, r])), [rows]);
  const max = Math.max(0, ...rows.filter((r) => r.c !== "??").map((r) => r[metric]));
  const step = (v: number) => (v <= 0 || !max ? -1 : Math.min(4, Math.floor((v / max) * 5 - 1e-9)));
  const fill = (v: number) => { const s = step(v); return s < 0 ? "var(--surf2)" : `color-mix(in oklab, var(--s1) ${STEPS[s]}%, var(--panel))`; };
  const hr = hov ? by.get(hov.c) : undefined;
  const top = [...rows].filter((r) => r.c !== "??" && r[metric] > 0).sort((a, b) => b[metric] - a[metric])[0];
  return (
    <div className="wm" ref={box}>
      <svg width={w} height={h} role="img" aria-label={top ? `Map of ${METRICS.find((m) => m[0] === metric)![1].toLowerCase()} by country. Most: ${countryName(top.c)} with ${fmtMetric(metric, top[metric])}.` : "Map by country: no data yet"}
        onPointerLeave={() => setHov(null)} style={{ display: "block" }}>
        {shapes.map((s, i) => {
          const r = by.get(s.a2);
          const v = r ? r[metric] : 0;
          return (
            <path key={s.a2 + i} d={s.d} fill={fill(v)} className={`wm-c ${selected && selected === s.a2 ? "sel" : ""} ${v > 0 ? "has" : ""}`}
              onPointerMove={(e) => { const b = box.current!.getBoundingClientRect(); setHov({ c: s.a2 || s.name, x: e.clientX - b.left, y: e.clientY - b.top }); }}
              onClick={() => s.a2 && onSelect(selected === s.a2 ? null : s.a2)} />
          );
        })}
        {/* small countries with data get a dot, so they can be seen and hovered */}
        {shapes.filter((s) => s.small && s.a2 && (by.get(s.a2)?.[metric] ?? 0) > 0 && Number.isFinite(s.cx)).map((s) => (
          <circle key={"dot" + s.a2} cx={s.cx} cy={s.cy} r={Math.max(4, w / 160)} fill={fill(by.get(s.a2)![metric])} className={`wm-dot ${selected === s.a2 ? "sel" : ""}`}
            onPointerMove={(e) => { const b = box.current!.getBoundingClientRect(); setHov({ c: s.a2, x: e.clientX - b.left, y: e.clientY - b.top }); }}
            onClick={() => onSelect(selected === s.a2 ? null : s.a2)} />
        ))}
      </svg>
      {hov && (
        <div className="an-tip wm-tip" style={{ left: Math.min(Math.max(hov.x + 12, 0), w - 180), top: Math.max(0, hov.y - 10) }}>
          <b>{hov.c.length === 2 ? countryName(hov.c) : hov.c}</b>
          {hr ? METRICS.map(([k, n]) => <span key={k}>{n}<em>{fmtMetric(k, hr[k])}</em></span>) : <span>No visitors yet</span>}
        </div>
      )}
      <div className="wm-legend" aria-hidden="true">
        <span>Fewer</span>{STEPS.map((p) => <i key={p} style={{ background: `color-mix(in oklab, var(--s1) ${p}%, var(--panel))` }} />)}<span>More</span>
        <span className="wm-none"><i style={{ background: "var(--surf2)" }} />None</span>
      </div>
    </div>
  );
}
