import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { refLink } from "../lib/refer";
import ShareBar from "../lib/ShareBar";
import { Ic } from "../lib/ui";

type Rewards = { friend_coins: number; reg_coins: number; reg_gems: number; play_rounds: number; play_coins: number; play_gems: number; ret_coins: number; ret_gems: number; week_days: number; week_coins: number; week_gems: number; window_days: number };
type Friend = { name: string; joined: string; status: string; register: boolean; play: boolean; return: boolean; week: boolean; rounds: number; coins: number; gems: number; saved: boolean; ends: string };
type Data = { enabled: boolean; code: string; rewards: Rewards; stats: { invited: number; active: number; registered: number; played: number; returned: number; week: number; coins: number; gems: number }; friends: Friend[] };

const prize = (c: number, g: number) => [c > 0 ? `${c.toLocaleString()} coins` : "", g > 0 ? `${g} gems` : ""].filter(Boolean).join(" + ") || "—";
const STATUS: Record<string, string> = {
  ok: "", review: "Being checked: rewards start once we confirm it", blocked: "Not counted: same device, browser or network as you",
  rejected: "Not counted", capped: "Not counted: invite limit reached",
};

/** Invite friends: your link, what you earn at each step, and every friend you brought with their progress. */
export default function Refer({ onChange }: { onChange?: () => void }) {
  const [d, setD] = useState<Data | null | "old">(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { void supabase.rpc("my_referral").then(({ data, error }) => { setD(error || !data ? "old" : (data as Data)); if (!error) onChange?.(); }); }, []);
  if (d === "old") return <section><h1>Invite friends</h1><p className="dim">Invites are coming soon.</p></section>;
  if (!d) return <section><div className="skel" style={{ height: 120 }} /><div className="skel" style={{ height: 200 }} /></section>;
  if (!d.enabled) return <section><h1>Invite friends</h1><p className="dim">Invites are paused right now. Your friends can still join and play.</p></section>;
  const link = refLink(d.code), r = d.rewards, s = d.stats;
  const total = { c: r.reg_coins + r.play_coins + r.ret_coins + r.week_coins, g: r.reg_gems + r.play_gems + r.ret_gems + r.week_gems };
  const steps: [string, string, string][] = [
    ["save", "Saves their account", prize(r.reg_coins, r.reg_gems)],
    ["play", `Plays ${r.play_rounds} rounds`, prize(r.play_coins, r.play_gems)],
    ["back", "Comes back on another day", prize(r.ret_coins, r.ret_gems)],
    ["week", `Plays on ${r.week_days} different days`, prize(r.week_coins, r.week_gems)],
  ];
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* the link is visible to copy by hand */ } };
  return (
    <section className="rf">
      <div className="hero rf-hero">
        <span className="eyebrow">Invite friends</span>
        <h2>Earn up to {prize(total.c, total.g)} for every friend</h2>
        <p>Your friend gets <b>{r.friend_coins} bonus coins</b> after their first round. You earn more at every step they reach in their first {r.window_days} days.</p>
      </div>
      <div className="rf-grid">
        <div className="rf-col">
          <div className="box rf-link">
            <h3>Your invite link</h3>
            <div className="rf-copy"><input readOnly value={link} aria-label="Your invite link" onFocus={(e) => e.currentTarget.select()} /><button className="btn sm" onClick={() => void copy()}>{copied ? "Copied!" : "Copy"}</button></div>
            <span className="dim">Your code: <b>{d.code}</b></span>
            <ShareBar title="Send it to a friend" text={`Play Bingo Arena with me! Free skill bingo, and you get ${r.friend_coins} bonus coins with my link:`} link={link} />
          </div>
          <div className="box rf-steps">
            <h3>What you earn per friend</h3>
            <ol>{steps.map(([k, t, p]) => <li key={k}><span>{t}</span><b>{p}</b></li>)}</ol>
            <p className="dim rf-fine">Only real new players count. Invites from your own device, browser or internet connection, and repeat accounts, are not counted. Big numbers from one connection are checked by hand.</p>
          </div>
        </div>
        <div className="rf-col">
          <div className="rf-kpis">
            <div className="kpi"><b>{s.invited}</b><span>friends joined</span></div>
            <div className="kpi"><b>{s.played}</b><span>played {r.play_rounds}+ rounds</span></div>
            <div className="kpi"><b>{s.week}</b><span>regular players</span></div>
            <div className="kpi"><b>{s.coins.toLocaleString()}</b><span>coins earned</span></div>
            <div className="kpi"><b>{s.gems}</b><span>gems earned</span></div>
          </div>
          <div className="box rf-list">
            <h3>Your friends</h3>
            {d.friends.length === 0 ? <p className="dim" style={{ margin: 0 }}>Nobody yet. Share your link: friends who join show up here with their progress.</p> : (
              <ul>
                {d.friends.map((f, i) => (
                  <li key={i} className={f.status !== "ok" ? "off" : ""}>
                    <div className="rf-who"><b>{f.name}</b><span className="dim">joined {new Date(f.joined).toLocaleDateString()}{f.status === "ok" && !f.week && new Date(f.ends) > new Date() ? ` · rewards until ${new Date(f.ends).toLocaleDateString()}` : ""}</span></div>
                    {f.status === "ok" ? (
                      <div className="rf-dots" aria-label="Steps reached">
                        {([["register", "Saved"], ["play", `${r.play_rounds} rounds`], ["return", "Came back"], ["week", `${r.week_days} days`]] as const).map(([k, t]) => (
                          <span key={k} className={f[k] ? "on" : ""}>{f[k] ? <Ic n="check" /> : null}{t}</span>
                        ))}
                      </div>
                    ) : <span className="dim rf-why">{STATUS[f.status] ?? ""}</span>}
                    {(f.coins > 0 || f.gems > 0) && <span className="rf-earn">+{prize(f.coins, f.gems)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
