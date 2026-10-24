import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Ic } from "../lib/ui";

export type Cal = { rewards: number[]; day: number; claimed_today: boolean; streak: number; next: number; shields: number };

/** The 7-day login calendar (null until the 0.24 database update is installed). */
export function useCalendar(key: unknown): Cal | null {
  const [cal, setCal] = useState<Cal | null>(null);
  useEffect(() => {
    if (key == null) { setCal(null); return; }
    let alive = true;
    void supabase.rpc("login_calendar").then(({ data, error }) => { if (alive) setCal(error || !data || !Array.isArray((data as Cal).rewards) || (data as Cal).rewards.length !== 7 ? null : (data as Cal)); }, () => undefined);
    return () => { alive = false; };
  }, [key]);
  return cal;
}

/** Seven reward tiles. Days already collected are ticked; today's tile glows. */
export function CalendarStrip({ cal, title = true }: { cal: Cal; title?: boolean }) {
  const doneUpTo = cal.claimed_today ? cal.day : cal.day - 1;
  return (
    <div className="cal">
      {title && <div className="cal-head"><b><Ic n="gift" /> Daily rewards</b><span className="dim">{cal.claimed_today ? <>Come back tomorrow for <b className="cal-next">+{cal.next}</b></> : `Today: +${cal.next}`}</span></div>}
      <ol className="cal-days" aria-label="7-day login rewards">
        {cal.rewards.map((r, i) => {
          const d = i + 1, done = d <= doneUpTo, today = d === cal.day, next = cal.claimed_today && d === (cal.day % 7) + 1;
          return (
            <li key={d} className={`cal-d ${done ? "done" : ""} ${today ? "today" : ""} ${next ? "next" : ""} ${d === 7 ? "big" : ""}`} aria-label={`Day ${d}: ${r} coins${d === 7 ? " and a stamp pack" : ""}${done ? ", collected" : today ? ", today" : ""}`}>
              <span className="cal-n">Day {d}</span>
              <span className="cal-ic" aria-hidden="true">{done ? <Ic n="check" /> : d === 7 ? "🎁" : "🪙"}</span>
              <b className="cal-r">{r}</b>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Shown when today's login reward was just collected. */
export function CalendarPopup({ cal, bonus, pack, shieldUsed, onClose }: { cal: Cal; bonus: number; pack?: string | null; shieldUsed?: boolean; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" || e.key === "Enter") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="cal-title" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="tour-card cal-pop">
        <span className="eyebrow">Day {cal.day} of 7 · {cal.streak}-day streak</span>
        <h2 id="cal-title">Welcome back! +{bonus} coins</h2>
        {pack && <p className="cal-pack">🎁 Day 7 bonus: a free stamp, <b>{pack}</b>!</p>}
        {shieldUsed && <p className="dim">Your Streak Shield saved your streak.</p>}
        <CalendarStrip cal={cal} title={false} />
        <p className="cal-tease">Tomorrow: <b>+{cal.next} coins</b>{cal.day === 6 ? " and a stamp pack" : ""}. Come back to keep your streak!</p>
        <button className="btn big" autoFocus onClick={onClose}>Collect and play</button>
      </div>
    </div>
  );
}

/** End of a round: a reason to come back tomorrow. */
export function TomorrowCard({ cal }: { cal: Cal }) {
  if (!cal.claimed_today) return null;
  return (
    <div className="box tmr" role="note">
      <span className="tmr-ic" aria-hidden="true">{cal.day === 6 ? "🎁" : "📅"}</span>
      <span><b>Tomorrow: +{cal.next} coins{cal.day === 6 ? " and a stamp pack" : ""}</b><span className="dim">Day {(cal.day % 7) + 1} of your login calendar, plus a new Daily Challenge and new quests.</span></span>
    </div>
  );
}
