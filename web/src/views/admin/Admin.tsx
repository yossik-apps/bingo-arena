import { useState } from "react";
import OverviewTab from "./Overview";
import PlayersTab from "./Players";
import EventsTab from "./EventsAdmin";
import ConfigTab from "./Config";
import CatalogTab from "./Catalog";
import AuditTab from "./Audit";

const TABS: [string, string][] = [["over", "Overview"], ["pl", "Players"], ["ev", "Events"], ["cfg", "Config"], ["cat", "Catalog"], ["audit", "Audit log"]];

export default function Admin({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState("over");
  return (
    <>
      <div className="leave" style={{ marginTop: 6 }}>
        <h1 style={{ margin: 0, fontSize: 26 }}>Admin</h1>
        <button className="btn alt" onClick={onBack}>Back to game</button>
      </div>
      <div className="atabs" role="group" aria-label="Admin sections">
        {TABS.map(([k, n]) => <button key={k} className={`at ${tab === k ? "on" : ""}`} aria-pressed={tab === k} onClick={() => setTab(k)}>{n}</button>)}
      </div>
      {tab === "over" && <OverviewTab />}
      {tab === "pl" && <PlayersTab />}
      {tab === "ev" && <EventsTab />}
      {tab === "cfg" && <ConfigTab />}
      {tab === "cat" && <CatalogTab />}
      {tab === "audit" && <AuditTab />}
    </>
  );
}
