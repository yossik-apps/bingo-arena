import { SKILLS, SKILL_INFO, type Dna, type Skill } from "./dna";

/** A spider chart of the six Bingo DNA skills. The weakest skill is marked in gold. */
export default function Radar({ dna, size = 260 }: { dna: Dna; size?: number }) {
  const c = size / 2, r = size / 2 - 42;
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / SKILLS.length;
    return [c + Math.cos(a) * r * (v / 100), c + Math.sin(a) * r * (v / 100)] as const;
  };
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, v).join(",")).join(" ");
  const vals = SKILLS.map((k) => dna.skills[k] ?? 0);
  const summary = SKILLS.map((k) => `${SKILL_INFO[k].name} ${dna.skills[k] ?? "not enough data"}`).join(", ");
  return (
    <svg className="radar" viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: size }} role="img" aria-label={`Bingo DNA: ${summary}`}>
      {[25, 50, 75, 100].map((v) => <polygon key={v} points={poly(SKILLS.map(() => v))} className="rg" />)}
      {SKILLS.map((_, i) => { const [x, y] = pt(i, 100); return <line key={i} x1={c} y1={c} x2={x} y2={y} className="rg" />; })}
      <polygon points={poly(vals)} className="rv" />
      {SKILLS.map((k: Skill, i) => {
        const [x, y] = pt(i, vals[i]);
        const [lx, ly] = pt(i, 128);
        const weak = dna.weakest === k;
        return (
          <g key={k}>
            <circle cx={x} cy={y} r={weak ? 6 : 4} className={weak ? "rw" : "rd"} />
            <text x={lx} y={ly - 6} textAnchor="middle" className={`rl ${weak ? "weak" : ""}`}>{SKILL_INFO[k].name}</text>
            <text x={lx} y={ly + 10} textAnchor="middle" className="rn">{dna.skills[k] ?? "?"}</text>
          </g>
        );
      })}
    </svg>
  );
}
