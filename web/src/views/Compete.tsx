import { useState } from "react";
import Events from "./Events";
import League from "./League";
import Crew from "./Crew";
import Calendar from "./Calendar";
import NewPlayers from "./NewPlayers";

type Tab = "events" | "league" | "crew" | "calendar" | "new";
const TABS: [Tab, string][] = [["events", "Events"], ["league", "Weekly league"], ["crew", "Crew"], ["calendar", "Calendar"], ["new", "New players"]];

export default function Compete(props: { initial?: Tab; userId: string; balance: number; blocked: boolean; onEnter: (id: string) => void; onChange: () => Promise<void> }) {
  const [t, setT] = useState<Tab>(props.initial ?? "events");
  return (
    <>
      <div className="atabs" role="group" aria-label="Compete">
        {TABS.map(([k, n]) => <button key={k} className={`at ${t === k ? "on" : ""}`} aria-pressed={t === k} onClick={() => setT(k)}>{n}</button>)}
      </div>
      {t === "events" && <Events userId={props.userId} balance={props.balance} blocked={props.blocked} onEnter={props.onEnter} />}
      {t === "league" && <League userId={props.userId} />}
      {t === "crew" && <Crew userId={props.userId} onChange={props.onChange} />}
      {t === "calendar" && <Calendar />}
      {t === "new" && <NewPlayers />}
    </>
  );
}
