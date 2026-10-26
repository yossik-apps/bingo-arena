import { useCallback, useEffect, useState } from "react";
import { adminRpc } from "../../lib/admin";
import { HBars, shortDay } from "./charts";

type Cohort = { d: string; n: number; b1: number | null; b3: number | null; b7: number | null; bany: number | null };
type Group = { label: string; n: number; back: number };
type R = {
  range: { from: string; to: string; days: number; seg: string };
  cohorts: Cohort[];
  totals: { n1: number; b1: number; n3: number; b3: number; n7: number; b7: number; nany: number; bany: number; new: number };
  visitors: { n1: number; b1: number; n7: number; b7: number; bany: number };
  lost: { browsers: number; accounts: number; new_on_known_browser: number };
  by_rounds: Group[]; by_kind: Group[];
  regulars: { two_plus: number; five_plus: number };
};

const SEGS: [string, string][] = [["all", "Everyone"], ["crazygames", "CrazyGames"], ["web", "Your website"], ["saved", "Saved accounts"], ["guest", "Guests"]];
const rate = (b: number, n: number) => (n ? (b / n) * 100 : null);
const p1 = (v: number | null) => (v === null ? "–" : v < 10 ? `${v.toFixed(1)}%` : `${Math.round(v)}%`);
const cell = (b: number | null, n: number) => (b === null ? <span className="dim">not yet</span> : n === 0 ? <span className="dim">–</span> : <><b>{p1(rate(b, n))}</b> <span className="dim">({b})</span></>);

/** Analytics → Retention: do new players come back, is the counting right, and what do returning players do differently. */
export default function Retention() {
  const [days, setDays] = useState(14);
  const [seg, setSeg] = useState("all");
  const [r, setR] = useState<R | null>(null);
  const [err, setErr] = useState("");
  const get = useCallback(() => {
    setErr("");
    adminRpc<R>("admin_retention", { p_days: days, p_seg: seg }).then(setR).catch((e: Error) => setErr(/function|PGRST20/i.test(e.message) ? "Run database update 022 to see retention." : e.message));
  }, [days, seg]);
  useEffect(get, [get]);
  if (err) return <p className="dim an-none">{err}</p>;
  if (!r) return <><div className="skel" /><div className="skel" /></>;
  const t = r.totals, v = r.visitors;
  const d1 = rate(t.b1, t.n1), vd1 = rate(v.b1, v.n1);
  // plain-language reading of the numbers
  const notes: { tone: "ok" | "warn" | "info"; text: string }[] = [];
  if (t.n1 < 20) notes.push({ tone: "info", text: `Only ${t.n1} new players can be measured so far in this range. Percentages move a lot with small numbers; give it a few more days.` });
  if (d1 !== null && vd1 !== null) {
    if (vd1 > d1 + 5) notes.push({ tone: "warn", text: `Browsers come back more often (${p1(vd1)} the next day) than player accounts (${p1(d1)}). Some returning people are getting a new account instead of their old one.` });
    else notes.push({ tone: "ok", text: `Browsers (${p1(vd1)}) and player accounts (${p1(d1)}) come back at about the same rate, so the counting is right: the low number is real retention, not lost accounts.` });
  }
  if (r.lost.new_on_known_browser > 0) notes.push({ tone: "warn", text: `${r.lost.new_on_known_browser} new accounts were created in a browser that already had an account (${r.lost.browsers} browsers). Those players lost their progress and count as new.` });
  else notes.push({ tone: "ok", text: "No browser got a second account in this range: returning players keep their account." });
  const low = r.by_rounds.filter((g) => g.label === "1 round" || g.label === "0 rounds").reduce((a, g) => ({ n: a.n + g.n, b: a.b + g.back }), { n: 0, b: 0 });
  const high = r.by_rounds.filter((g) => g.label === "3–5 rounds" || g.label === "6+ rounds").reduce((a, g) => ({ n: a.n + g.n, b: a.b + g.back }), { n: 0, b: 0 });
  if (low.n >= 5 && high.n >= 5) notes.push({ tone: "info", text: `Players who played 3+ rounds on their first day came back ${p1(rate(high.b, high.n))} of the time, against ${p1(rate(low.b, low.n))} for 0–1 rounds. Getting new players to round 3 is the biggest lever.` });

  return (
    <div className="rt">
      <div className="an-bar">
        <div className="an-seg" role="group" aria-label="New players in the last">
          {[7, 14, 30].map((n) => <button key={n} className={days === n ? "on" : ""} aria-pressed={days === n} onClick={() => setDays(n)}>{n} days</button>)}
        </div>
        <div className="an-seg rt-segs" role="group" aria-label="Which players">
          {SEGS.map(([k, n]) => <button key={k} className={seg === k ? "on" : ""} aria-pressed={seg === k} onClick={() => setSeg(k)}>{n}</button>)}
        </div>
      </div>
      <ul className="rt-notes">{notes.map((x, i) => <li key={i} className={x.tone}>{x.text}</li>)}</ul>
      <div className="an-rets rt-tiles">
        <div className="an-ret"><b>{p1(d1)}</b><span>Back the next day</span><em className="dim">{t.b1} of {t.n1} new players</em></div>
        <div className="an-ret"><b>{p1(rate(t.b3, t.n3))}</b><span>Back on day 3</span><em className="dim">{t.b3} of {t.n3}</em></div>
        <div className="an-ret"><b>{p1(rate(t.b7, t.n7))}</b><span>Back on day 7</span><em className="dim">{t.b7} of {t.n7}</em></div>
        <div className="an-ret"><b>{p1(rate(t.bany, t.nany))}</b><span>Came back at all</span><em className="dim">{t.bany} of {t.nany}</em></div>
        <div className="an-ret"><b>{p1(vd1)}</b><span>Browsers back next day</span><em className="dim">counts visitors, not accounts</em></div>
      </div>
      <section className="an-sec wide">
        <div className="an-sh"><h3>Day by day</h3><span className="dim">Players who joined on each day, and how many played again exactly 1, 3 and 7 days later</span></div>
        <div className="tw"><table className="t rt-t"><thead><tr><th>Joined</th><th>New players</th><th>Next day</th><th>Day 3</th><th>Day 7</th><th>Any later day</th></tr></thead>
          <tbody>{r.cohorts.map((c) => <tr key={c.d}><td>{shortDay(c.d)}</td><td>{c.n}</td><td>{cell(c.b1, c.n)}</td><td>{cell(c.b3, c.n)}</td><td>{cell(c.b7, c.n)}</td><td>{cell(c.bany, c.n)}</td></tr>)}</tbody></table></div>
        <p className="dim an-note">Why the Summary's "Returning players" grows slowly: since 0.24 every visitor who presses Play becomes a player, so Active players includes all first-day guests. Only the share who play again on a later day count as returning.</p>
      </section>
      <div className="an-grid2">
        <section className="an-sec"><div className="an-sh"><h3>Back next day, by rounds on the first day</h3></div>
          {r.by_rounds.length ? <HBars rows={r.by_rounds.map((g) => ({ label: `${g.label} (${g.n})`, n: Math.round((rate(g.back, g.n) ?? 0) * 10) / 10 }))} fmt={(n) => `${n}%`} noShare /> : <p className="dim">Not enough players yet.</p>}
        </section>
        <section className="an-sec"><div className="an-sh"><h3>Back next day, by kind of player</h3></div>
          {r.by_kind.length ? <HBars rows={r.by_kind.map((g) => ({ label: `${g.label} (${g.n})`, n: Math.round((rate(g.back, g.n) ?? 0) * 10) / 10 }))} fmt={(n) => `${n}%`} noShare color="var(--s3)" /> : <p className="dim">Not enough players yet.</p>}
        </section>
      </div>
      <p className="dim an-note">Regulars: {r.regulars.two_plus} players who joined in the last weeks have come back on 2+ days, {r.regulars.five_plus} on 5+ days. Activity = played a round or opened the game while logged in. Admin accounts are left out. Days are UTC.</p>
    </div>
  );
}
