import { useCallback, useEffect, useMemo, useState } from "react";
import { adminRpc, csvCell } from "../../lib/admin";
import { Cohorts, Funnel, Heat, HBars, Kpi, shortDay, TimeChart } from "./charts";

type K = {
  visitors: number; new_visitors: number; new_players: number; active: number; returning: number; dau: number; rounds: number; guest_rounds: number;
  revenue_cents: number; purchases: number; payers: number; refunded_cents: number; ad_views: number; ad_viewers: number; coins_in: number; coins_out: number;
};
type Day = { d: string; visitors: number; guest_rounds: number; signup_open: number; new: number; active: number; returning: number; rounds: number; revenue_cents: number; purchases: number; ads: number };
type Data = {
  range: { days: number; from: string; to: string; prev_from: string; prev_to: string; test: boolean; tz: string };
  now: K; prev: K;
  totals: { players: number; banned: number; mau: number; wau: number; dau: number; coins: number; gems: number; club_active: number; revenue_all_cents: number; payers_all: number; rejected: number; tracking_since: string | null };
  daily: Day[];
  funnel: { visitors: number; tried: number; signup_open: number; joined: number; joined_tracked: number; first_round: number; came_back: number; tried_joined: number };
  retention: { d1: { n: number; back: number }; d7: { n: number; back: number }; d30: { n: number; back: number }; cohorts: { week: string; size: number; w: (number | null)[] }[] };
  loyalty: { buckets: { label: string; n: number }[]; kept: number; churned: number; won_back: number };
  revenue: { by_product: { id: string; name: string; kind: string; n: number; cents: number; buyers: number }[]; first_time: number; repeat: number; top: { name: string; n: number; cents: number }[]; ads_by_placement: Record<string, number> };
  games: { by_mode: { mode: string; level: string; n: number; players: number; wins: number; avg_score: number; acc: number | null; fees: number; prizes: number }[]; heat: [number, number, number][]; top_players: { name: string; rounds: number; days: number; avg_score: number; joined: string }[] };
  traffic: { devices: Record<string, number>; sources: { source: string; n: number }[]; landing: { landing: string; n: number }[]; logged_in_share: number };
  economy: { kind: string; dir: "in" | "out"; amount: number; n: number }[];
};

const TABS = [["sum", "Summary"], ["players", "Players"], ["visitors", "Visitors"], ["revenue", "Revenue"], ["games", "Games"], ["economy", "Economy"]] as const;
type Tab = (typeof TABS)[number][0];
const MODE: Record<string, string> = { solo: "Practice", ghost: "Beat the Ghost", pvp: "Live match", tour: "Event", stage: "Journey", daily: "Daily Challenge", duel: "Friend challenge", drill: "Drill" };
const PLACE: Record<string, string> = { lobby: "Lobby", result: "After a round", store: "Store", wallet: "Coins screen" };
const SRC: Record<string, string> = { direct: "Direct or bookmark", google: "Google", search: "Other search", facebook: "Facebook / Instagram", x: "X (Twitter)", whatsapp: "WhatsApp", tiktok: "TikTok" };

const money = (c: number) => "$" + (c / 100).toLocaleString(undefined, { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });
const num = (n: number) => Math.round(n).toLocaleString();
const pc = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");
const load = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const save = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

export default function AnalyticsTab() {
  const [days, setDays] = useState(() => Number(load("ba_an_days", "30")) || 30);
  const [test, setTest] = useState(() => load("ba_an_test", "1") === "1");
  const [tab, setTab] = useState<Tab>(() => (load("ba_an_tab", "sum") as Tab));
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const tz = useMemo(() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; } }, []);

  const get = useCallback(() => {
    setErr(""); setBusy(true);
    adminRpc<Data>("admin_analytics", { p_days: days, p_test: test, p_tz: tz }).then(setD).catch((e: Error) => setErr(e.message)).finally(() => setBusy(false));
  }, [days, test, tz]);
  useEffect(get, [get]);
  useEffect(() => { save("ba_an_days", String(days)); save("ba_an_test", test ? "1" : "0"); save("ba_an_tab", tab); }, [days, test, tab]);

  const exportCsv = () => {
    if (!d) return;
    const head = ["day", "visitors", "guest_rounds", "signup_form_opened", "new_players", "active_players", "returning_players", "rounds", "revenue_usd", "purchases", "ad_videos"];
    const rows = d.daily.map((x) => [x.d, x.visitors, x.guest_rounds, x.signup_open, x.new, x.active, x.returning, x.rounds, (x.revenue_cents / 100).toFixed(2), x.purchases, x.ads]);
    const blob = new Blob([[head, ...rows].map((r) => r.map(csvCell).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `bingo-arena-analytics-${d.range.from}-to-${d.range.to}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  return (
    <div className="an">
      <div className="an-bar">
        <div className="an-seg" role="group" aria-label="Date range">
          {[7, 30, 90].map((n) => <button key={n} className={days === n ? "on" : ""} aria-pressed={days === n} onClick={() => setDays(n)}>{n} days</button>)}
        </div>
        <label className="an-chk"><input type="checkbox" checked={test} onChange={(e) => setTest(e.target.checked)} /> Count test purchases</label>
        <div className="an-acts">
          <button className="btn alt sm" onClick={get} disabled={busy}>{busy ? "Loading…" : "Refresh"}</button>
          <button className="btn alt sm" onClick={exportCsv} disabled={!d} aria-label="Export CSV"><span className="an-wide">Export </span>CSV</button>
        </div>
      </div>
      <div className="atabs an-tabs" role="tablist" aria-label="Analytics sections">
        {TABS.map(([k, n]) => <button key={k} role="tab" aria-selected={tab === k} className={`at ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}>{n}</button>)}
      </div>
      {err && <p className="toast" role="alert">{err}</p>}
      {!d && !err && <><div className="skel" /><div className="skel" /></>}
      {d && (
        <>
          <p className="dim an-range">{shortDay(d.range.from)} – {shortDay(d.range.to)}, compared with the {d.range.days} days before. Days are in UTC; the play-time map uses your time zone ({d.range.tz}).{test ? " Test purchases are counted as revenue." : ""}</p>
          {tab === "sum" && <Summary d={d} />}
          {tab === "players" && <Players d={d} />}
          {tab === "visitors" && <Visitors d={d} />}
          {tab === "revenue" && <Revenue d={d} />}
          {tab === "games" && <Games d={d} />}
          {tab === "economy" && <Economy d={d} />}
        </>
      )}
    </div>
  );
}

const col = (d: Data, k: keyof Day) => d.daily.map((x) => Number(x[k]));
const dayList = (d: Data) => d.daily.map((x) => x.d);
const activeSeries = (d: Data) => [
  { key: "ret", label: "Returning players", color: "var(--s1)", values: d.daily.map((x) => x.returning) },
  { key: "new", label: "New that day", color: "var(--s2)", values: d.daily.map((x) => x.active - x.returning) },
];
const Sec = ({ title, sub, children, wide }: { title: string; sub?: string; children: React.ReactNode; wide?: boolean }) => (
  <section className={`an-sec ${wide ? "wide" : ""}`}><div className="an-sh"><h3>{title}</h3>{sub && <span className="dim">{sub}</span>}</div>{children}</section>
);

function Summary({ d }: { d: Data }) {
  const n = d.now, p = d.prev, t = d.totals;
  return (
    <>
      <div className="an-kpis">
        <Kpi label="Visitors" value={num(n.visitors)} now={n.visitors} prev={p.visitors} spark={col(d, "visitors")} />
        <Kpi label="New players" value={num(n.new_players)} now={n.new_players} prev={p.new_players} spark={col(d, "new")} />
        <Kpi label="Active players" value={num(n.active)} now={n.active} prev={p.active} spark={col(d, "active")} />
        <Kpi label="Returning players" value={num(n.returning)} now={n.returning} prev={p.returning} spark={col(d, "returning")} hint="Active in this range and joined before it" />
        <Kpi label="Rounds played" value={num(n.rounds)} now={n.rounds} prev={p.rounds} spark={col(d, "rounds")} />
        <Kpi label="Revenue" value={money(n.revenue_cents)} now={n.revenue_cents} prev={p.revenue_cents} spark={col(d, "revenue_cents")} />
        <Kpi label="Paying players" value={num(n.payers)} now={n.payers} prev={p.payers} />
        <Kpi label="Reward videos" value={num(n.ad_views)} now={n.ad_views} prev={p.ad_views} spark={col(d, "ads")} />
      </div>
      <div className="an-grid2">
        <Sec title="Active players per day" sub="Played a round or opened the game while logged in" wide>
          <TimeChart label="Active players per day" days={dayList(d)} series={activeSeries(d)} kind="stack" />
        </Sec>
        <Sec title="Right now">
          <div className="an-now">
            <div><b>{num(t.dau)}</b><span>Active today</span></div>
            <div><b>{num(t.wau)}</b><span>Active, 7 days</span></div>
            <div><b>{num(t.mau)}</b><span>Active, 30 days</span></div>
            <div><b>{pc(n.dau, t.mau)}</b><span>Stickiness (daily ÷ monthly)</span></div>
            <div><b>{num(t.players)}</b><span>Players in total</span></div>
            <div><b>{num(t.club_active)}</b><span>Bingo Club members</span></div>
            <div><b>{money(t.revenue_all_cents)}</b><span>Revenue, all time</span></div>
            <div><b>{num(t.coins)}</b><span>Coins held by players</span></div>
          </div>
        </Sec>
        <Sec title="From visitor to player" sub="New visitors in this range">
          <FunnelBlock d={d} short />
        </Sec>
        <Sec title="Who keeps coming back" wide>
          <RetentionTiles d={d} />
        </Sec>
      </div>
      {t.tracking_since === null && <p className="dim an-note">Visitor counting starts once update 014 is installed and people open the new version. Player, round and revenue numbers include all history.</p>}
    </>
  );
}

function FunnelBlock({ d, short }: { d: Data; short?: boolean }) {
  const f = d.funnel;
  const steps = [
    { label: "New visitors", n: f.visitors },
    { label: "Played the free round", n: f.tried },
    { label: "Opened sign-up", n: f.signup_open },
    { label: "Created an account", n: f.joined, note: f.joined !== f.joined_tracked ? `${f.joined_tracked} of them tracked as visitors` : undefined },
    { label: "Played a real round", n: f.first_round },
    { label: "Came back another day", n: f.came_back },
  ];
  return <Funnel steps={short ? [steps[0], steps[1], steps[3], steps[5]] : steps} />;
}

function RetentionTiles({ d }: { d: Data }) {
  const r = d.retention;
  const tile = (label: string, x: { n: number; back: number }, help: string) => (
    <div className="an-ret" title={help}><b>{x.n ? pc(x.back, x.n) : "–"}</b><span>{label}</span><em className="dim">{x.n ? `${x.back} of ${x.n} players` : "Not enough players yet"}</em></div>
  );
  return (
    <div className="an-rets">
      {tile("Back the next day", r.d1, "Played the day after joining")}
      {tile("Back in week 2", r.d7, "Played on days 7 to 13 after joining")}
      {tile("Still playing after a month", r.d30, "Played on day 30 or later")}
    </div>
  );
}

function Players({ d }: { d: Data }) {
  const n = d.now, p = d.prev, l = d.loyalty;
  return (
    <>
      <div className="an-kpis">
        <Kpi label="New players" value={num(n.new_players)} now={n.new_players} prev={p.new_players} spark={col(d, "new")} />
        <Kpi label="Active players" value={num(n.active)} now={n.active} prev={p.active} spark={col(d, "active")} />
        <Kpi label="Daily active, average" value={n.dau.toLocaleString()} now={n.dau} prev={p.dau} />
        <Kpi label="Returning share" value={pc(n.returning, n.active)} hint="Active players who joined before this range" />
        <Kpi label="Kept from last period" value={num(l.kept)} hint="Active in both this and the previous period" />
        <Kpi label="Lost since last period" value={num(l.churned)} hint="Active in the previous period, not in this one" />
        <Kpi label="Won back" value={num(l.won_back)} hint="Away the whole previous period, active again now" />
        <Kpi label="Suspended" value={num(d.totals.banned)} />
      </div>
      <div className="an-grid2">
        <Sec title="New players per day" wide><TimeChart label="New players per day" days={dayList(d)} series={[{ key: "n", label: "New players", color: "var(--s2)", values: col(d, "new") }]} /></Sec>
        <Sec title="Active players per day" sub="New and returning" wide><TimeChart label="Active players per day" days={dayList(d)} series={activeSeries(d)} kind="stack" /></Sec>
        <Sec title="Returning players" sub="Share of new players who came back"><RetentionTiles d={d} /></Sec>
        <Sec title="How often players come" sub="Active players by number of days they played"><HBars rows={l.buckets} /></Sec>
        <Sec title="Weekly sign-up groups" sub="Share of each week's new players who played again in the weeks after" wide><Cohorts rows={d.retention.cohorts} /></Sec>
        <Sec title="Most active players" wide>
          <div className="tw an-tw"><table className="t"><thead><tr><th>Player</th><th>Rounds</th><th>Days played</th><th>Avg score</th><th>Joined</th></tr></thead>
            <tbody>{d.games.top_players.length === 0 && <tr><td colSpan={5} className="dim">No rounds in this range.</td></tr>}
              {d.games.top_players.map((x) => <tr key={x.name + x.joined}><td>{x.name}</td><td>{x.rounds}</td><td>{x.days}</td><td>{x.avg_score}</td><td>{shortDay(x.joined)}</td></tr>)}</tbody></table></div>
        </Sec>
      </div>
    </>
  );
}

function Visitors({ d }: { d: Data }) {
  const n = d.now, p = d.prev, tr = d.traffic;
  const dev = ["phone", "tablet", "desktop"].map((k) => ({ label: k === "phone" ? "Phone" : k === "tablet" ? "Tablet" : "Computer", n: tr.devices[k] ?? 0 }));
  return (
    <>
      <div className="an-kpis">
        <Kpi label="Visitors" value={num(n.visitors)} now={n.visitors} prev={p.visitors} spark={col(d, "visitors")} />
        <Kpi label="New visitors" value={num(n.new_visitors)} now={n.new_visitors} prev={p.new_visitors} hint="First visit ever in this range" />
        <Kpi label="Free rounds by guests" value={num(n.guest_rounds)} now={n.guest_rounds} prev={p.guest_rounds} spark={col(d, "guest_rounds")} />
        <Kpi label="Visitor → player" value={pc(d.funnel.joined, d.funnel.visitors)} hint="New players ÷ new visitors" />
        <Kpi label="Logged in visitors" value={pc(tr.logged_in_share, n.visitors)} hint="Visitors who were logged in" />
      </div>
      <div className="an-grid2">
        <Sec title="Visitors and new players per day" wide>
          <TimeChart label="Visitors and new players per day" days={dayList(d)} kind="line" series={[
            { key: "v", label: "Visitors", color: "var(--s1)", values: col(d, "visitors") },
            { key: "n", label: "New players", color: "var(--s2)", values: col(d, "new") },
          ]} />
        </Sec>
        <Sec title="Sign-up funnel" sub="New visitors in this range, step by step" wide><FunnelBlock d={d} /></Sec>
        <Sec title="Devices"><HBars rows={dev} /></Sec>
        <Sec title="Where visitors come from" sub="Add ?utm_source=name to links you share to see them here"><HBars rows={tr.sources.map((s) => ({ label: SRC[s.source] ?? s.source, n: s.n }))} /></Sec>
        <Sec title="First screen" sub="Where visits started"><HBars rows={tr.landing.map((s) => ({ label: s.landing === "challenge" ? "Friend challenge link" : s.landing[0].toUpperCase() + s.landing.slice(1), n: s.n }))} /></Sec>
      </div>
      <p className="dim an-note">Visitors are counted with a random ID kept in the browser: no name, email or IP address is stored. {d.totals.tracking_since ? `Counting since ${shortDay(d.totals.tracking_since)}.` : "Counting starts after update 014."} A visitor who clears their browser or uses another device counts again.</p>
    </>
  );
}

function Revenue({ d }: { d: Data }) {
  const n = d.now, p = d.prev, r = d.revenue, t = d.totals;
  const [ecpm, setEcpm] = useState(() => Number(load("ba_an_ecpm", "10")) || 0);
  const activeDays = d.daily.reduce((a, x) => a + x.active, 0);
  const adEst = (n.ad_views / 1000) * ecpm;
  return (
    <>
      <div className="an-kpis">
        <Kpi label="Revenue" value={money(n.revenue_cents)} now={n.revenue_cents} prev={p.revenue_cents} spark={col(d, "revenue_cents")} />
        <Kpi label="Purchases" value={num(n.purchases)} now={n.purchases} prev={p.purchases} spark={col(d, "purchases")} />
        <Kpi label="Paying players" value={num(n.payers)} now={n.payers} prev={p.payers} />
        <Kpi label="Paying share" value={pc(n.payers, n.active)} hint="Paying players ÷ active players" />
        <Kpi label="Per paying player" value={money(n.payers ? Math.round(n.revenue_cents / n.payers) : 0)} hint="ARPPU: revenue ÷ paying players" />
        <Kpi label="Per player per day" value={money(activeDays ? Math.round(n.revenue_cents / activeDays) : 0)} hint="ARPDAU: revenue ÷ daily active players added up" />
        <Kpi label="First-time buyers" value={num(r.first_time)} />
        <Kpi label="Repeat buyers" value={num(r.repeat)} hint="Bought at least twice, once in this range" />
      </div>
      {!d.range.test && t.revenue_all_cents === 0 && <p className="toast an-note" role="status">Real payments are not live yet, so revenue is $0. Tick “Count test purchases” to see how the numbers will look.</p>}
      <div className="an-grid2">
        <Sec title="Revenue per day" wide><TimeChart label="Revenue per day" days={dayList(d)} series={[{ key: "r", label: "Revenue", color: "var(--s1)", values: col(d, "revenue_cents") }]} fmt={(c) => money(Math.round(c))} /></Sec>
        <Sec title="By product" wide>
          <div className="tw an-tw"><table className="t"><thead><tr><th>Product</th><th>Sold</th><th>Buyers</th><th>Revenue</th><th>Share</th></tr></thead>
            <tbody>{r.by_product.length === 0 && <tr><td colSpan={5} className="dim">No purchases in this range.</td></tr>}
              {r.by_product.map((x) => <tr key={x.id}><td>{x.name}</td><td>{x.n}</td><td>{x.buyers}</td><td>{money(x.cents)}</td><td><span className="an-ibar"><i style={{ width: pc(x.cents, n.revenue_cents) }} /></span>{pc(x.cents, n.revenue_cents)}</td></tr>)}</tbody></table></div>
        </Sec>
        <Sec title="Reward videos" sub={`${num(n.ad_views)} videos by ${num(n.ad_viewers)} players`}>
          <TimeChart label="Reward videos per day" days={dayList(d)} series={[{ key: "a", label: "Videos", color: "var(--s3)", values: col(d, "ads") }]} height={150} />
          <HBars color="var(--s3)" rows={Object.entries(r.ads_by_placement).map(([k, v]) => ({ label: PLACE[k] ?? k, n: v })).sort((a, b) => b.n - a.n)} />
          <div className="an-est">
            <label>Your rate per 1,000 videos ($) <input type="number" min={0} step={0.5} value={ecpm} onChange={(e) => { const v = Math.max(0, Number(e.target.value) || 0); setEcpm(v); save("ba_an_ecpm", String(v)); }} /></label>
            <span>Estimated ad income: <b>${adEst.toFixed(2)}</b></span>
          </div>
          <p className="dim an-cap">Google pays the real amount; copy your rate from AdSense to make this estimate closer.</p>
        </Sec>
        <Sec title="Top spenders">
          {r.top.length === 0 ? <p className="dim an-none">No purchases in this range.</p> : (
            <div className="tw an-tw"><table className="t"><thead><tr><th>Player</th><th>Purchases</th><th>Spent</th></tr></thead>
              <tbody>{r.top.map((x) => <tr key={x.name}><td>{x.name}</td><td>{x.n}</td><td>{money(x.cents)}</td></tr>)}</tbody></table></div>
          )}
          <div className="an-now sm">
            <div><b>{money(t.revenue_all_cents)}</b><span>All time</span></div>
            <div><b>{num(t.payers_all)}</b><span>Paying players, all time</span></div>
            <div><b>{num(t.club_active)}</b><span>Club members now</span></div>
            <div><b>{money(n.refunded_cents)}</b><span>Refunded in range</span></div>
          </div>
        </Sec>
      </div>
    </>
  );
}

function Games({ d }: { d: Data }) {
  const n = d.now, p = d.prev, g = d.games;
  return (
    <>
      <div className="an-kpis">
        <Kpi label="Rounds played" value={num(n.rounds)} now={n.rounds} prev={p.rounds} spark={col(d, "rounds")} />
        <Kpi label="Rounds per active player" value={n.active ? (n.rounds / n.active).toFixed(1) : "–"} hint="Rounds ÷ active players" />
        <Kpi label="Free rounds by guests" value={num(n.guest_rounds)} now={n.guest_rounds} prev={p.guest_rounds} />
        <Kpi label="Rejected rounds" value={num(d.totals.rejected)} hint="Failed checks, abandoned or expired" />
      </div>
      <div className="an-grid2">
        <Sec title="Rounds per day" wide><TimeChart label="Rounds per day" days={dayList(d)} series={[{ key: "r", label: "Rounds", color: "var(--s1)", values: col(d, "rounds") }]} /></Sec>
        <Sec title="When people play" sub={`Weekday and hour, ${d.range.tz}`} wide><Heat cells={g.heat} /></Sec>
        <Sec title="By way of playing and level" wide>
          <div className="tw an-tw"><table className="t"><thead><tr><th>Mode</th><th>Level</th><th>Rounds</th><th>Players</th><th>Win rate</th><th>Accuracy</th><th>Avg score</th><th>Fees in</th><th>Prizes out</th></tr></thead>
            <tbody>{g.by_mode.length === 0 && <tr><td colSpan={9} className="dim">No rounds in this range.</td></tr>}
              {g.by_mode.map((m) => <tr key={m.mode + m.level}><td>{MODE[m.mode] ?? m.mode}</td><td>{m.level}</td><td>{m.n}</td><td>{m.players}</td><td>{["ghost", "pvp", "duel", "tour"].includes(m.mode) ? pc(m.wins, m.n) : "–"}</td><td>{m.acc === null ? "–" : m.acc + "%"}</td><td>{m.avg_score}</td><td>{num(m.fees)}</td><td>{num(m.prizes)}</td></tr>)}</tbody></table></div>
        </Sec>
      </div>
    </>
  );
}

function Economy({ d }: { d: Data }) {
  const n = d.now, p = d.prev, t = d.totals;
  const ins = d.economy.filter((e) => e.dir === "in"), outs = d.economy.filter((e) => e.dir === "out");
  return (
    <>
      <div className="an-kpis">
        <Kpi label="Coins given out" value={num(n.coins_in)} now={n.coins_in} prev={p.coins_in} />
        <Kpi label="Coins spent" value={num(n.coins_out)} now={n.coins_out} prev={p.coins_out} />
        <Kpi label="Net coins added" value={(n.coins_in - n.coins_out >= 0 ? "+" : "−") + num(Math.abs(n.coins_in - n.coins_out))} hint="Given out minus spent. A big plus means coins pile up and prices feel cheap." />
        <Kpi label="Coins held by players" value={num(t.coins)} />
        <Kpi label="Gems held by players" value={num(t.gems)} />
      </div>
      <div className="an-grid2">
        <Sec title="Where coins come from"><HBars color="var(--s1)" rows={ins.map((e) => ({ label: e.kind, n: e.amount }))} /></Sec>
        <Sec title="Where coins go"><HBars color="var(--s2)" rows={outs.map((e) => ({ label: e.kind, n: e.amount }))} /></Sec>
      </div>
      <p className="dim an-note">Coins and gems are play money with no cash value. A healthy economy spends most of what it gives out; if coins keep piling up, raise entry fees or shop prices, or lower daily rewards in Config.</p>
    </>
  );
}
