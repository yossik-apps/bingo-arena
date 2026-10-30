import { Ball } from "./Ball";
import { Icon } from "./Icon";
import { LEVEL_UNLOCKS, nextUnlock, xpForLevel } from "../lib/levels";
import { useDesk } from "./Nav";

/** "Level path": every unlock, in order. Opened from the level badge in the lobby header. */
export default function Roadmap({ level, xp, avgXp, onBack }: { level: number; xp: number; avgXp: number; onBack: () => void }) {
  const next = nextUnlock(level);
  const toNext = Math.max(1, Math.ceil((xpForLevel(level + 1) - xp) / avgXp));
  const desk = useDesk();
  return (
    <div className={desk ? "e-deskcols e-fade e-pathpage" : "e-root e-fade"} style={desk ? undefined : { padding: "16px 12px 0" }}>
      {desk && <p style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Level {level} · {toNext} {toNext === 1 ? "round" : "rounds"} to level {level + 1}{!next ? " · everything is open" : ""}</p>}
      {!desk && <header style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 4px" }}>
        <button aria-label="Back" onClick={onBack} style={{ width: 48, height: 48, border: 0, borderRadius: 16, background: "#fff", boxShadow: "0 4px 0 #0E3E9C", display: "flex", alignItems: "center", justifyContent: "center", color: "#14254F" }}>
          <Icon name="back" size={24} sw={3} />
        </button>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <h1 className="e-ld" style={{ margin: 0, fontSize: 28, lineHeight: 1.05, textShadow: "0 3px 0 #123E91" }}>Level path</h1>
          <span style={{ fontSize: 13, fontWeight: 800 }}>Level {level} · {toNext} {toNext === 1 ? "round" : "rounds"} to level {level + 1}{!next ? " · everything is open" : ""}</span>
        </div>
      </header>}
      <div className="e-span" style={{ position: "relative", marginTop: desk ? 0 : 10, flex: 1 }}>
        <ol className="e-roadmap" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 7, position: "relative" }}>
          {LEVEL_UNLOCKS.map((u, i) => {
            const state = u.level <= level && !(LEVEL_UNLOCKS[i + 1] && LEVEL_UNLOCKS[i + 1].level <= level) ? "here" : u.level <= level ? "done" : "locked";
            const left = i % 2 === 0;
            const card = state === "locked" ? "e-panel" : "e-white";
            return (
              <li key={u.level} className={`${card}${state === "here" ? " e-ring" : ""}`}
                style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, minHeight: 62, padding: "6px 12px 6px 8px", marginLeft: left ? 0 : 22, marginRight: left ? 22 : 0, borderRadius: 22, boxShadow: state === "here" ? undefined : state === "locked" ? "0 4px 0 #0B2C6E" : "0 4px 0 #0E3E9C", color: state === "locked" ? "#fff" : "#14254F", background: state === "here" ? "#FFF8E1" : undefined, opacity: state === "locked" ? 0.92 : 1 }}>
                <span style={{ width: 50, display: "flex", justifyContent: "center", flexShrink: 0, transform: state === "here" ? "scale(1.12)" : undefined }}>
                  {state === "here" ? <Ball tone="P" mode="n" num={u.level} size={50} style={{ border: "3px solid #fff" }} />
                    : <Ball tone={state === "done" ? u.tone : "X"} mode="n" num={u.level} size={46} />}
                </span>
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                  <span className="e-ld" style={{ fontSize: 18, lineHeight: 1.15 }}>{u.title}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.25, color: state === "locked" ? "#DCE7FF" : "#4A5A85" }}>{u.desc}</span>
                </span>
                {state === "here" && <span className="e-tag" style={{ padding: "3px 10px", whiteSpace: "nowrap" }}>YOU ARE HERE</span>}
                {state === "done" && <span role="img" aria-label="Unlocked" style={{ width: 26, height: 26, borderRadius: "50%", background: "#2EB872", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="check" size={15} color="#fff" sw={3.4} /></span>}
                {state === "locked" && <span role="img" aria-label="Locked" style={{ display: "flex", flexShrink: 0 }}><Icon name="lock" size={20} color="#DCE7FF" /></span>}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
