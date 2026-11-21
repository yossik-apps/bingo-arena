import { useCallback, useEffect, useState } from "react";
import { adminRpc } from "../../lib/admin";
import { parseMode, type FlagMode } from "../../lib/flags";
import { supabase } from "../../lib/supabase";
import Notice from "../../lib/Notice";

// Admin → Channels (flag "channels", Off by default): which traffic source and which campaign bring players who play
// and come back, share taps, and the friend-challenge loop. Database update 028.
type Row = { visitors: number; played: number; finished: number; came_back: number; shares?: number };
type Report = {
  since: string | null;
  sources: (Row & { source: string })[];
  campaigns: (Row & { campaign: string })[];
  shares: Record<string, number>;
  challenge: { made: number; link_visitors: number; plays: number };
};

const SOURCE: Record<string, string> = { direct: "Direct or unknown", facebook: "Facebook", google: "Google", search: "Other search", x: "X (Twitter)", whatsapp: "WhatsApp", tiktok: "TikTok" };
const sourceName = (s: string) => SOURCE[s] ?? (/crazygames/.test(s) ? "CrazyGames" : s);
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");

/** The weakest step of the best-sized channel, said in plain words. */
function notes(r: Report): string[] {
  const out: string[] = [];
  const all = r.sources.reduce((a, s) => ({ v: a.v + s.visitors, p: a.p + s.played, b: a.b + s.came_back }), { v: 0, p: 0, b: 0 });
  if (all.v >= 20) out.push(`${pct(all.p, all.v)} of visitors start a round (target 70%), and ${pct(all.b, all.p)} of those who play come back on a later day.`);
  const best = r.sources.filter((s) => s.visitors >= 10).sort((a, b) => b.came_back / b.visitors - a.came_back / a.visitors)[0];
  if (best && best.came_back > 0) out.push(`${sourceName(best.source)} brings the visitors most likely to come back (${pct(best.came_back, best.visitors)} of its visitors).`);
  const shares = Object.values(r.shares).reduce((a, b) => a + b, 0);
  if (r.challenge.made > 0) out.push(`${r.challenge.made.toLocaleString()} challenge links were prepared, ${shares.toLocaleString()} share taps were made and ${r.challenge.link_visitors.toLocaleString()} visitors arrived through a challenge link.`);
  return out;
}

function Table({ rows, first, name }: { rows: (Row & { key: string })[]; first: string; name: (k: string) => string }) {
  const hasShares = rows.some((r) => r.shares !== undefined);
  return (
    <div className="tw an-tw"><table className="t">
      <thead><tr><th>{first}</th><th>Visitors</th><th>Started a round</th><th>Finished one</th><th>Came back</th>{hasShares && <th>Share taps</th>}</tr></thead>
      <tbody>{rows.map((r) => (
        <tr key={r.key}><td>{name(r.key)}</td><td>{r.visitors.toLocaleString()}</td>
          <td>{r.played.toLocaleString()} <span className="dim">{pct(r.played, r.visitors)}</span></td>
          <td>{r.finished.toLocaleString()} <span className="dim">{pct(r.finished, r.visitors)}</span></td>
          <td>{r.came_back.toLocaleString()} <span className="dim">{pct(r.came_back, r.visitors)}</span></td>
          {hasShares && <td>{(r.shares ?? 0).toLocaleString()}</td>}</tr>
      ))}</tbody>
    </table></div>
  );
}

export default function Channels() {
  const [mode, setMode] = useState<FlagMode | null>(null);
  const [days, setDays] = useState(30);
  const [rep, setRep] = useState<Report | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState(false);

  useEffect(() => {
    void supabase.from("feature_flags").select("mode").eq("key", "channels").maybeSingle().then(({ data, error }) => setMode(error || !data ? null : parseMode(data.mode)));
  }, []);
  const load = useCallback(async () => {
    setRep(null);
    try { setRep(await adminRpc<Report>("admin_channels", { p_days: days })); setErr(false); }
    catch { setErr(true); setMsg("Run database update 028 to use the Channels report."); }
  }, [days]);
  useEffect(() => { void load(); }, [load]);

  const pick = async (m: FlagMode) => {
    try {
      await adminRpc("admin_set_flag", { p_key: "channels", p_mode: m }); setMode(m); setErr(false);
      setMsg(m === "off" ? "Recording of share taps and campaigns stopped. Visits and rounds are still counted as before." : m === "admins" ? "Recording only your own share taps and campaigns, to check it works." : "Recording share taps and campaigns for all visitors from their next page load.");
    } catch (e) { setErr(true); setMsg((e as Error).message); }
  };

  return (
    <div className="hm">
      <Notice text={msg} error={err} />
      <div className="box hm-flag">
        <div><b>Recording</b><span className="dim"> · Share taps and the campaign of a link (utm_campaign). Same privacy as visits: a random browser id, no names, no IP addresses.</span></div>
        {mode === null ? <span className="dim">Run database update 028 to use this switch.</span> : (
          <div className="an-seg" role="radiogroup" aria-label="Channels recording">
            {([["off", "Off"], ["admins", "Admins only"], ["all", "All players"]] as [FlagMode, string][]).map(([k, n]) => <button key={k} role="radio" aria-checked={mode === k} className={mode === k ? "on" : ""} onClick={() => void pick(k)}>{n}</button>)}
          </div>
        )}
      </div>
      <div className="an-seg" role="radiogroup" aria-label="Period" style={{ margin: "10px 0" }}>
        {[7, 30, 90].map((d) => <button key={d} role="radio" aria-checked={days === d} className={days === d ? "on" : ""} onClick={() => setDays(d)}>{d} days</button>)}
      </div>
      {!rep && !err && <div className="skel" />}
      {rep && (
        <>
          {notes(rep).map((n) => <div key={n} className="box dim" style={{ margin: "6px 0" }}>{n}</div>)}
          <div className="box">
            <h2 style={{ margin: "0 0 4px" }}>By source</h2>
            <p className="dim" style={{ margin: "0 0 8px" }}>Each browser counts once, under the source of its first visit in the period. "Came back" means it played or opened the game signed in on a later day.</p>
            {rep.sources.length ? <Table first="Source" rows={rep.sources.map((s) => ({ ...s, key: s.source }))} name={sourceName} /> : <p className="dim">No visits in this period.</p>}
          </div>
          <div className="box">
            <h2 style={{ margin: "0 0 4px" }}>By campaign</h2>
            <p className="dim" style={{ margin: "0 0 8px" }}>Links with ?utm_campaign=…, such as the Facebook posts. Counted only while recording is on.</p>
            {rep.campaigns.length ? <Table first="Campaign" rows={rep.campaigns.map((c) => ({ ...c, key: c.campaign }))} name={(k) => k} /> : <p className="dim">No campaign visits recorded yet.</p>}
          </div>
          <div className="box">
            <h2 style={{ margin: "0 0 4px" }}>Sharing and friend challenges</h2>
            <p style={{ margin: "4px 0" }}>Share taps: WhatsApp <b>{rep.shares.whatsapp ?? 0}</b> · Telegram <b>{rep.shares.telegram ?? 0}</b> · Facebook <b>{rep.shares.facebook ?? 0}</b></p>
            <p style={{ margin: "4px 0" }}>Challenge links prepared <b>{rep.challenge.made}</b> · visitors through a challenge link <b>{rep.challenge.link_visitors}</b> · challenges played <b>{rep.challenge.plays}</b></p>
            <p className="dim" style={{ margin: "4px 0 0" }}>A challenge link is prepared for every Practice or Ghost result, shared or not, so "prepared" is not "sent". Share taps show how many were actually sent.</p>
          </div>
        </>
      )}
    </div>
  );
}
