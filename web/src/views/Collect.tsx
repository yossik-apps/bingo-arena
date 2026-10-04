import { useState } from "react";
import Album from "./Album";
import Quests from "./Quests";
import type { ShopItem } from "../lib/supabase";

export default function Collect({ items, onChange }: { items: ShopItem[]; onChange: () => Promise<void> }) {
  const [t, setT] = useState<"album" | "quests">("album");
  return (
    <>
      <div className="atabs" role="group" aria-label="Collection">
        <button className={`at ${t === "album" ? "on" : ""}`} aria-pressed={t === "album"} onClick={() => setT("album")}>Album</button>
        <button className={`at ${t === "quests" ? "on" : ""}`} aria-pressed={t === "quests"} onClick={() => setT("quests")}>Quests and badges</button>
      </div>
      {t === "album" ? <Album items={items} onChange={onChange} /> : <Quests onChange={onChange} />}
    </>
  );
}
