import { useState } from "react";
import Events from "./Events";
import League from "./League";

export default function Compete(props: { userId: string; balance: number; blocked: boolean; onEnter: (id: string) => void }) {
  const [t, setT] = useState<"events" | "league">("events");
  return (
    <>
      <div className="atabs" role="group" aria-label="Compete">
        <button className={`at ${t === "events" ? "on" : ""}`} aria-pressed={t === "events"} onClick={() => setT("events")}>Events</button>
        <button className={`at ${t === "league" ? "on" : ""}`} aria-pressed={t === "league"} onClick={() => setT("league")}>Weekly league</button>
      </div>
      {t === "events" ? <Events {...props} /> : <League userId={props.userId} />}
    </>
  );
}
