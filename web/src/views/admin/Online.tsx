import { useCallback, useEffect, useState } from "react";
import { adminRpc } from "../../lib/admin";
import { countryName } from "./geoUtil";

type On = { minutes: number; players: number; guests: number; list: { id: string; name: string; last_seen: string; level: number; device: string | null; country: string | null; playing: string | null }[] };
const ago = (t: string) => { const s = Math.max(0, Math.round((Date.now() - new Date(t).getTime()) / 1000)); return s < 60 ? "just now" : `${Math.floor(s / 60)} min ago`; };
const MODE: Record<string, string> = { solo: "Practice", ghost: "Beat the Ghost", pvp: "Live match", tour: "Event", stage: "Journey", daily: "Daily Challenge", duel: "Friend challenge", drill: "Drill" };

/** "● 7 online now" in the admin header; opens the list of players seen in the last 10 minutes. Refreshes every minute. */
export default function Online() {
  const [o, setO] = useState<On | null>(null);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState(false);
  const load = useCallback(() => { adminRpc<On>("admin_online", { p_minutes: 10 }).then((x) => { setO(x); setErr(false); }).catch(() => setErr(true)); }, []);
  useEffect(() => { load(); const t = setInterval(load, 60e3); return () => clearInterval(t); }, [load]);
  if (err) return <span className="on-pill off" title="Needs database update 016">Online: update 016 needed</span>;
  if (!o) return <span className="on-pill">Online…</span>;
  return (
    <div className="on-wrap">
      <button className="on-pill" aria-expanded={open} onClick={() => setOpen(!open)}>
        <i aria-hidden="true" /><b>{o.players}</b> {o.players === 1 ? "player" : "players"} online{o.guests ? <span className="dim"> · {o.guests} guest{o.guests === 1 ? "" : "s"}</span> : null}
      </button>
      {open && (
        <div className="on-pop" role="dialog" aria-label="Online in the last 10 minutes">
          <div className="on-h"><b>Online in the last {o.minutes} minutes</b><button className="linkbtn" onClick={load}>Refresh</button></div>
          {o.list.length === 0 ? <p className="dim">Nobody logged in right now.{o.guests ? ` ${o.guests} visitor${o.guests === 1 ? " is" : "s are"} looking around without an account.` : ""}</p> : (
            <div className="tw on-tw"><table className="t"><thead><tr><th>Player</th><th>Level</th><th>Now</th><th>Where</th><th>Seen</th></tr></thead><tbody>
              {o.list.map((p) => <tr key={p.id}><td>{p.name}</td><td>{p.level}</td><td>{p.playing ? <span className="tag ok">{MODE[p.playing] ?? p.playing}</span> : <span className="dim">Browsing</span>}</td><td className="dim">{[p.country ? countryName(p.country) : "", p.device ?? ""].filter(Boolean).join(" · ") || "–"}</td><td className="dim">{ago(p.last_seen)}</td></tr>)}
            </tbody></table></div>
          )}
          {o.guests > 0 && o.list.length > 0 && <p className="dim" style={{ margin: "8px 0 0" }}>Plus {o.guests} visitor{o.guests === 1 ? "" : "s"} without an account.</p>}
        </div>
      )}
    </div>
  );
}
