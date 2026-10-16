import { useState } from "react";
import OverviewTab from "./Overview";
import PlayersTab from "./Players";
import EventsTab from "./EventsAdmin";
import ConfigTab from "./Config";
import CatalogTab from "./Catalog";
import AuditTab from "./Audit";
import LeagueAdmin from "./LeagueAdmin";
import JourneyAdmin from "./JourneyAdmin";
import HealthTab from "./Health";
import LiveOpsAdmin from "./LiveOpsAdmin";
import SeasonAdmin from "./SeasonAdmin";
import CrewsAdmin from "./CrewsAdmin";
import MessagesAdmin from "./MessagesAdmin";
import { APP_VERSION, COMMIT, fullBuildDate } from "../../lib/version";

const TABS: [string, string][] = [["over", "Overview"], ["msg", "Messages"], ["pl", "Players"], ["ev", "Events"], ["league", "League"], ["liveops", "Live ops"], ["season", "Season"], ["crews", "Crews"], ["journey", "Journey"], ["cfg", "Config"], ["cat", "Catalog"], ["audit", "Audit log"], ["health", "Health"]];

export default function Admin({ onBack, onChange, unanswered, onCount }: { onBack: () => void; onChange: () => Promise<void>; unanswered: number; onCount: () => void }) {
  const [tab, setTab] = useState("over");
  return (
    <>
      <div className="leave" style={{ marginTop: 6 }}>
        <h1 style={{ margin: 0, fontSize: 26 }}>Admin</h1>
        <button className="btn alt" onClick={onBack}>Back to game</button>
      </div>
      <p className="dim" style={{ margin: "0 0 8px" }} aria-label="Website version">Version <b style={{ color: "var(--ink)" }}>{APP_VERSION}</b> · built {fullBuildDate()}{COMMIT ? ` · commit ${COMMIT}` : ""}</p>
      <div className="atabs" role="group" aria-label="Admin sections">
        {TABS.map(([k, n]) => <button key={k} className={`at ${tab === k ? "on" : ""}`} aria-pressed={tab === k} onClick={() => setTab(k)}>{n}{k === "msg" && unanswered > 0 ? ` (${unanswered})` : ""}</button>)}
      </div>
      {tab === "over" && <OverviewTab />}
      {tab === "msg" && <MessagesAdmin onCount={onCount} />}
      {tab === "pl" && <PlayersTab onChange={onChange} onCount={onCount} />}
      {tab === "ev" && <EventsTab />}
      {tab === "league" && <LeagueAdmin />}
      {tab === "liveops" && <LiveOpsAdmin />}
      {tab === "season" && <SeasonAdmin />}
      {tab === "crews" && <CrewsAdmin />}
      {tab === "journey" && <JourneyAdmin />}
      {tab === "cfg" && <ConfigTab />}
      {tab === "cat" && <CatalogTab />}
      {tab === "audit" && <AuditTab />}
      {tab === "health" && <HealthTab />}
    </>
  );
}
