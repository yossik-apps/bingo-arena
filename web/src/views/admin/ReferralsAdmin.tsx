import { useCallback, useEffect, useState } from "react";
import { adminRpc, csvCell, dt, pct } from "../../lib/admin";
import Notice from "../../lib/Notice";
import { Funnel, HBars, Kpi } from "./charts";

type Settings = { enabled: boolean; friend_coins: number; reg_coins: number; reg_gems: number; play_rounds: number; play_coins: number; play_gems: number; ret_coins: number; ret_gems: number; week_days: number; week_coins: number; week_gems: number; window_days: number; daily_cap: number; lifetime_cap: number; max_per_ip: number };
type Row = { id: string; created_at: string; status: string; reason: string; referrer: string; referred: string; joined_on: string; is_guest: boolean; played: number; register: boolean; play: boolean; return_day: boolean; week: boolean; coins_paid: number; gems_paid: number; friend_paid: boolean; same_ip: number };
type Data = {
  settings: Settings;
  kpis: { invited: number; referrers: number; ok: number; review: number; blocked: number; rejected: number; capped: number; registered: number; played: number; returned: number; week: number; coins: number; gems: number; friend_coins: number };
  all_time: { invited: number; coins: number; gems: number; with_code: number };
  reasons: Record<string, number>;
  top: { id: string; name: string; invited: number; ok: number; bad: number; played: number; week: number; coins: number; gems: number }[];
  rows: Row[];
};

const REASON: Record<string, string> = {
  same_network: "Same internet connection as the inviter", same_device: "Same device as the inviter", same_browser: "Same browser as the inviter",
  device_used_before: "Device already used by another invited friend", browser_used_before: "Browser already used by another invited friend",
  many_from_one_network: "Many invites from one connection", daily_cap: "Inviter passed the daily limit", lifetime_cap: "Inviter passed the lifetime limit",
  no_fingerprint: "No connection or device info",
};
const STATUS: Record<string, string> = { ok: "Counted", review: "Needs your decision", blocked: "Blocked", rejected: "Rejected", capped: "Over the limit" };
const FIELDS: [keyof Settings, string, number, number][] = [
  ["friend_coins", "Welcome bonus for the friend (coins, after their first round)", 0, 10000],
  ["reg_coins", "Friend saves an account: coins", 0, 10000], ["reg_gems", "… gems", 0, 1000],
  ["play_rounds", "Rounds the friend must play", 1, 50], ["play_coins", "Friend plays those rounds: coins", 0, 10000], ["play_gems", "… gems", 0, 1000],
  ["ret_coins", "Friend comes back on another day: coins", 0, 10000], ["ret_gems", "… gems", 0, 1000],
  ["week_days", "Active days for the big reward", 3, 30], ["week_coins", "Friend active on those days: coins", 0, 20000], ["week_gems", "… gems", 0, 1000],
  ["window_days", "Days after joining in which steps count", 7, 90],
  ["daily_cap", "Invites per player per day before review", 1, 100], ["lifetime_cap", "Counted invites per player, ever", 1, 10000],
  ["max_per_ip", "Invited accounts from one connection before review", 1, 20],
];

/** Admin → Referrals: how invites perform, who brings players, suspicious invites to decide on, and the reward settings. */
export default function ReferralsAdmin() {
  const [days, setDays] = useState(30);
  const [d, setD] = useState<Data | null>(null);
  const [s, setS] = useState<Settings | null>(null);
  const [msg, setMsg] = useState("");
  const [filter, setFilter] = useState<"all" | "review" | "blocked" | "ok">("all");
  const load = useCallback(() => {
    adminRpc<Data>("admin_referrals", { p_days: days }).then((x) => { setD(x); setS(x.settings); }).catch((e) => setMsg(/function|PGRST20/i.test((e as Error).message) ? "Run database update 020 to use referrals." : (e as Error).message));
  }, [days]);
  useEffect(load, [load]);
  if (!d || !s) return msg ? <Notice text={msg} /> : <div className="skel" style={{ height: 200 }} />;
  const k = d.kpis;
  const save = async () => {
    try { await adminRpc("admin_save_ref_settings", { p: s }); setMsg("Referral settings saved."); load(); } catch (e) { setMsg((e as Error).message); }
  };
  const decide = async (id: string, ok: boolean) => {
    try { await adminRpc("admin_ref_decide", { p_id: id, p_ok: ok }); setMsg(ok ? "Approved. Rewards for steps already reached were paid." : "Rejected. This invite will never pay."); load(); } catch (e) { setMsg((e as Error).message); }
  };
  const rows = d.rows.filter((r) => filter === "all" || r.status === filter || (filter === "blocked" && (r.status === "rejected" || r.status === "capped")));
  const csv = () => {
    const head = ["date", "inviter", "friend", "status", "reason", "played", "saved", "3 rounds", "came back", "week", "coins", "gems"];
    const body = d.rows.map((r) => [r.created_at, r.referrer, r.referred, r.status, r.reason, r.played, r.register, r.play, r.return_day, r.week, r.coins_paid, r.gems_paid].map(csvCell).join(","));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([[head.join(","), ...body].join("\n")], { type: "text/csv" }));
    a.download = `referrals-${days}d.csv`; a.click();
  };
  return (
    <div className="an ref-adm">
      <Notice text={msg} />
      <div className="an-bar">
        <div className="an-seg" role="group" aria-label="Period">{[7, 30, 90, 365].map((n) => <button key={n} className={days === n ? "on" : ""} onClick={() => setDays(n)}>{n === 365 ? "1 year" : `${n} days`}</button>)}</div>
        <span className="dim">All time: {d.all_time.invited} invited · {d.all_time.coins.toLocaleString()} coins · {d.all_time.gems} gems paid · {d.all_time.with_code} players opened their invite page</span>
      </div>
      <div className="an-kpis">
        <Kpi label="Friends invited" value={String(k.invited)} hint={`${k.referrers} players invited someone`} />
        <Kpi label="Counted" value={String(k.ok)} hint={pct(k.ok, k.invited) + " of invites"} />
        <Kpi label="Waiting for you" value={String(k.review)} hint="Approve or reject below" />
        <Kpi label="Blocked as fake" value={String(k.blocked + k.rejected)} hint="Same device, browser or network, or rejected" />
        <Kpi label="Coins paid" value={k.coins.toLocaleString()} hint={`+ ${k.friend_coins.toLocaleString()} welcome coins to friends`} />
        <Kpi label="Gems paid" value={String(k.gems)} />
      </div>
      <div className="an-grid2">
        <section className="box"><h3>What counted friends did</h3>
          <Funnel steps={[{ label: "Joined with a link (counted)", n: k.ok }, { label: `Played ${s.play_rounds}+ rounds`, n: k.played }, { label: "Came back another day", n: k.returned }, { label: `Active on ${s.week_days} days`, n: k.week }]} />
          <p className="dim" style={{ margin: "6px 0 0", fontSize: 13 }}>{k.registered} of {k.ok} counted friends saved their account ({pct(k.registered, k.ok)}).</p>
        </section>
        <section className="box"><h3>Why invites were stopped</h3>
          {Object.keys(d.reasons).length === 0 ? <p className="dim">Nothing suspicious in this period.</p> : <HBars rows={Object.entries(d.reasons).map(([r, n]) => ({ label: REASON[r] ?? r, n }))} color="var(--warn)" />}
        </section>
      </div>
      <section className="box"><h3>Top inviters</h3>
        {d.top.length === 0 ? <p className="dim">No invites yet.</p> : (
          <div className="tw"><table className="t"><thead><tr><th>Player</th><th>Invited</th><th>Counted</th><th>Blocked</th><th>{s.play_rounds}+ rounds</th><th>{s.week_days} days</th><th>Coins</th><th>Gems</th></tr></thead>
            <tbody>{d.top.map((t) => <tr key={t.id}><td>{t.name}</td><td>{t.invited}</td><td>{t.ok}</td><td style={{ color: t.bad ? "var(--warn)" : undefined }}>{t.bad}</td><td>{t.played}</td><td>{t.week}</td><td>{Number(t.coins).toLocaleString()}</td><td>{t.gems}</td></tr>)}</tbody></table></div>
        )}
      </section>
      <section className="box">
        <div className="ref-head"><h3>Every invite</h3>
          <div className="an-seg" role="group" aria-label="Filter">{([["all", "All"], ["review", `Waiting (${k.review})`], ["blocked", "Blocked"], ["ok", "Counted"]] as const).map(([f, t]) => <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>{t}</button>)}</div>
          <button className="btn alt sm" onClick={csv}>Export CSV</button>
        </div>
        {rows.length === 0 ? <p className="dim">Nothing here.</p> : (
          <div className="tw"><table className="t ref-t"><thead><tr><th>When</th><th>Inviter → friend</th><th>Status</th><th>Steps</th><th>Paid</th><th></th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id} className={r.status === "review" ? "hot" : ""}>
                <td>{dt(r.created_at)}</td>
                <td><b>{r.referrer}</b> → {r.referred}<span className="dim"> · {r.played} rounds{r.is_guest ? " · guest" : ""}{r.joined_on === "crazygames" ? " · CrazyGames" : ""}{r.same_ip > 1 ? ` · ${r.same_ip} accounts on this connection` : ""}</span></td>
                <td><span className={`tag ${r.status === "ok" ? "ok" : r.status === "review" ? "" : "bad"}`}>{STATUS[r.status] ?? r.status}</span>{r.reason && <span className="dim ref-why">{REASON[r.reason] ?? r.reason}</span>}</td>
                <td className="ref-steps">{[r.register, r.play, r.return_day, r.week].map((x, i) => <i key={i} className={x ? "on" : ""} title={["Saved", "Rounds", "Came back", "Week"][i]} />)}</td>
                <td>{r.coins_paid ? `${r.coins_paid} c` : ""}{r.gems_paid ? ` ${r.gems_paid} g` : ""}</td>
                <td>{r.status !== "ok" && <button className="btn sm" onClick={() => void decide(r.id, true)}>Approve</button>}{(r.status === "ok" || r.status === "review") && <button className="btn alt sm" onClick={() => void decide(r.id, false)}>Reject</button>}</td>
              </tr>
            ))}</tbody></table></div>
        )}
      </section>
      <section className="box">
        <h3>Rewards and limits</h3>
        <label className="adm-check"><input type="checkbox" checked={s.enabled} onChange={(e) => setS({ ...s, enabled: e.target.checked })} /> Invites on (players see Invite friends and links work)</label>
        <div className="fgrid">
          {FIELDS.map(([key, label, min, max]) => (
            <label key={key}>{label}<input type="number" min={min} max={max} value={s[key] as number} onChange={(e) => setS({ ...s, [key]: Math.round(Number(e.target.value) || 0) })} /></label>
          ))}
        </div>
        <p className="dim" style={{ fontSize: 13 }}>Checks on every invite: not the inviter's own account, not the same internet connection, device or browser as the inviter, a brand-new account (under 48 hours old), and no device used for another invite. Rewards come only for rounds with points, inside the days above. Internet addresses are never stored, only a one-way fingerprint.</p>
        <button className="btn" onClick={() => void save()}>Save referral settings</button>
      </section>
    </div>
  );
}
