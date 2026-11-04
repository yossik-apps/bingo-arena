// The daily login reward in the new design: Classic's CalendarPopup and CalendarStrip (views/LoginCalendar.tsx), same words and rules.
// The reward is claimed by App.tsx (daily-bonus) when the game opens; this only shows what was collected.
import { useEffect } from "react";
import type { Cal } from "../views/LoginCalendar";
import { Button, Modal } from "./components";
import { Coin, Icon } from "./Icon";
import "./daily.css";

/** Seven reward tiles. Days already collected are ticked; today's tile is gold. */
export function DayStrip({ cal }: { cal: Cal }) {
  const doneUpTo = cal.claimed_today ? cal.day : cal.day - 1;
  return (
    <ol className="nu-days" aria-label="7-day login rewards">
      {cal.rewards.map((r, i) => {
        const d = i + 1, done = d <= doneUpTo, today = d === cal.day, next = cal.claimed_today && d === (cal.day % 7) + 1;
        return (
          <li key={d} className={`nu-day${done ? " is-done" : ""}${today ? " is-today" : ""}${next ? " is-next" : ""}${d === 7 ? " is-big" : ""}`}
            aria-label={`Day ${d}: ${r} coins${d === 7 ? " and a stamp pack" : ""}${done ? ", collected" : today ? ", today" : ""}`}>
            <span className="nu-dayn">Day {d}</span>
            <span className="nu-dayic" aria-hidden="true">{done ? <Icon name="check" size={20} sw={3.2} /> : d === 7 ? <Icon name="gift" size={22} /> : <Coin size={22} />}</span>
            <b>{r}</b>
          </li>
        );
      })}
    </ol>
  );
}

/** Shown when today's login reward was just collected. Enter, Escape or a tap outside closes it, as in Classic. */
export default function DailyPopup({ cal, bonus, pack, shieldUsed, onClose }: { cal: Cal; bonus: number; pack?: string | null; shieldUsed?: boolean; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Enter") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <Modal label="Daily reward collected" onClose={onClose}>
      <div className="nu-dailypop">
        <span className="nu-dailyeyebrow">Day {cal.day} of 7 · {cal.streak}-day streak</span>
        <h2 className="nu-d">Welcome back! +{bonus} coins</h2>
        {pack && <p className="nu-dailypack"><Icon name="gift" size={20} /> Day 7 bonus: a free stamp, <b>{pack}</b>!</p>}
        {shieldUsed && <p className="nu-dailynote"><Icon name="shield" size={18} /> Your Streak Shield saved your streak.</p>}
        <DayStrip cal={cal} />
        <p className="nu-dailynote">Tomorrow: <b>+{cal.next} coins</b>{cal.day === 6 ? " and a stamp pack" : ""}. Come back to keep your streak!</p>
        <Button size="lg" wide autoFocus onClick={onClose}>Collect and play</Button>
      </div>
    </Modal>
  );
}
