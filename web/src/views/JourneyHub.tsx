import { useState } from "react";
import Journey from "./Journey";
import Season from "./Season";
import type { ShopItem } from "../lib/supabase";

export default function JourneyHub({ onPlay, items, balance, onChange }: { onPlay: (stageId: string) => void; items: ShopItem[]; balance: number; onChange: () => Promise<void> }) {
  const [t, setT] = useState<"worlds" | "season">("worlds");
  return (
    <>
      <div className="atabs" role="group" aria-label="Journey">
        <button className={`at ${t === "worlds" ? "on" : ""}`} aria-pressed={t === "worlds"} onClick={() => setT("worlds")}>Worlds</button>
        <button className={`at ${t === "season" ? "on" : ""}`} aria-pressed={t === "season"} onClick={() => setT("season")}>Season track</button>
      </div>
      {t === "worlds" ? <Journey onPlay={onPlay} /> : <Season items={items} balance={balance} onChange={onChange} />}
    </>
  );
}
