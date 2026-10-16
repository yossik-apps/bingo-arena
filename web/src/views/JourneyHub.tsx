import { useState } from "react";
import Journey from "./Journey";
import Season from "./Season";
import type { ShopItem } from "../lib/supabase";
import GuestTeaser from "./GuestTeaser";

export default function JourneyHub({ onPlay, items, balance, onChange, guest, onJoin }: { onPlay: (stageId: string) => void; items: ShopItem[]; balance: number; onChange: () => Promise<void>; guest?: boolean; onJoin?: () => void }) {
  const [t, setT] = useState<"worlds" | "season">("worlds");
  return (
    <>
      <div className="atabs" role="group" aria-label="Journey">
        <button className={`at ${t === "worlds" ? "on" : ""}`} aria-pressed={t === "worlds"} onClick={() => setT("worlds")}>Worlds</button>
        <button className={`at ${t === "season" ? "on" : ""}`} aria-pressed={t === "season"} onClick={() => setT("season")}>Season track</button>
      </div>
      {t === "worlds" ? <Journey onPlay={onPlay} /> : guest ? (
        <GuestTeaser title="Climb the season track" intro="Every round you play earns season XP. Each of the 30 tiers unlocks a reward, including looks you cannot get anywhere else." onJoin={() => onJoin?.()}
          points={[["star", "30 tiers of rewards", "Coins, stamp packs, boosters and exclusive looks."], ["gift", "Free track for everyone", "An optional season pass, bought with coins, adds a second reward on every tier."], ["clock", "New season every 6 weeks", "Fresh rewards and a new theme each time."]]} />
      ) : <Season items={items} balance={balance} onChange={onChange} />}
    </>
  );
}
