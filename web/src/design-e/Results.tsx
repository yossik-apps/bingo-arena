import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Ball } from "./Ball";
import { Coin, Icon } from "./Icon";
import { LEVEL_UNLOCKS, levelOf, xpForLevel } from "../lib/levels";
import type { RoundSummary } from "./Game";
import { coachTip, FEATURE_INFO, type Bonus, type Goal } from "./data";
import { Mini, useDesk } from "./Nav";

export function Results({ r, prevXp, newXp, best, isBest, bonus, doubleXp, shareLabel, onShare, onContinue, onAgain, onHome, wide, goals, nearMiss, rematch }: {
  /** the desktop layout */
  wide?: boolean;
  r: RoundSummary; prevXp: number; newXp: number; best: number; isBest: boolean; bonus?: Bonus[]; onContinue: () => void; onAgain: () => void; onHome: () => void;
  /** the first round of the day paid double XP */
  doubleXp?: boolean;
  /** "Challenge a friend" or "Share result". Left out while sharing is still locked. */
  shareLabel?: string; onShare?: () => void;
  /** the nearest things to reach, shown above the buttons so the next round always has a target */
  goals?: Goal[];
  /** "12 points short of Ben": a specific target, shown under the score */
  nearMiss?: string;
  /** after a match against a person: play them again on a fresh board */
  rematch?: { name: string; onRematch: () => void };
}) {
  const before = levelOf(prevXp), after = levelOf(newXp);
  const up = after > before;
  const lo = xpForLevel(before), hi = xpForLevel(before + 1);
  const startPct = Math.max(0, Math.min(100, ((prevXp - lo) / (hi - lo)) * 100));
  const endPct = up ? 100 : Math.max(0, Math.min(100, ((newXp - lo) / (hi - lo)) * 100));
  const [pct, setPct] = useState(startPct);
  useEffect(() => { const t = setTimeout(() => setPct(endPct), 350); return () => clearTimeout(t); }, [endPct]);
  const acc = Math.round(r.accuracy * 100);
  const tip = useMemo(() => coachTip(r), [r]);
  // the more cards under the score, the smaller the ball, so the buttons keep their full size
  const extras = Math.min(bonus?.length ?? 0, onShare ? 2 : 3) + (onShare ? 1 : 0) + (goals?.length ? 1 : 0);
  const ball = wide ? 230 : extras <= 1 ? 204 : extras === 2 ? 176 : 128;
  const stat = (big: string | number, small: string) => (
    <div className="e-white" style={{ flex: 1, borderRadius: 18, boxShadow: "0 4px 0 #0E3E9C", padding: "10px 4px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <span className="e-ld" style={{ fontSize: 30, lineHeight: 1 }}>{big}</span>
      <span className="e-sub" style={{ fontSize: 13, fontWeight: 800, textAlign: "center" }}>{small}</span>
    </div>
  );
  const head = (
    <div style={{ textAlign: "center", position: "relative" }}>
      <h1 className="e-ld" style={{ margin: 0, fontSize: 36, lineHeight: 1.05, textShadow: "0 3px 0 #123E91" }}>{isBest ? "New best!" : "Nice round!"}</h1>
      {nearMiss
        ? <p style={{ margin: "4px 0 0", fontSize: 15, fontWeight: 900, color: "#FFE9A0" }}>{nearMiss}</p>
        : <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 700 }}>{r.seconds} seconds · {r.speed[0].toUpperCase() + r.speed.slice(1)} speed</p>}
    </div>
  );
  const ballEl = (
    <div style={{ position: "relative", alignSelf: "center", marginTop: 4, marginBottom: 10, width: ball, height: ball }}>
      <div role="img" aria-label={`${r.score} points`} className="e-ball e-bP" style={{ ["--s" as string]: `${ball}px`, flexDirection: "column", border: "8px solid #fff", boxShadow: "inset -12px -16px 26px rgba(0,0,0,.26), inset 6px 8px 14px rgba(255,255,255,.45), 0 16px 26px rgba(4,16,60,.5)" } as CSSProperties}>
        <span className="e-ld" style={{ fontSize: ball < 180 ? (ball < 140 ? (r.score > 999 ? 42 : 52) : r.score > 999 ? 50 : 62) : r.score > 999 ? 64 : 78, lineHeight: 0.95, color: "#3A2300", textShadow: "0 3px 0 rgba(255,255,255,.55)", position: "relative", zIndex: 1 }}>{r.score}</span>
        <span style={{ fontSize: 15, fontWeight: 900, color: "#3A2300", position: "relative", zIndex: 1 }}>points</span>
      </div>
      {isBest ? <span style={{ position: "absolute", left: "50%", bottom: -12, transform: "translateX(-50%)", background: "#D6336C", color: "#fff", fontSize: 14, fontWeight: 900, borderRadius: 999, padding: "5px 16px", boxShadow: "0 3px 0 #8E1F4B", whiteSpace: "nowrap", zIndex: 6 }}>NEW BEST</span>
        : <span style={{ position: "absolute", left: "50%", bottom: -12, transform: "translateX(-50%)", background: "#123E91", color: "#fff", fontSize: 14, fontWeight: 900, borderRadius: 999, padding: "5px 16px", whiteSpace: "nowrap", zIndex: 6 }}>Best {best}</span>}
    </div>
  );
  const stats = (
    <div style={{ display: "flex", gap: 8 }}>
      {stat(r.daubs, "numbers marked")}
      {stat(r.lines, r.lines === 1 ? "line" : "lines")}
      {stat(`${acc}%`, "right taps")}
    </div>
  );
  const prog = (
    <section aria-label="Level progress" className="e-panel" style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
      <Ball tone="X" mode="n" num={before} size={44} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 900 }}><span>+{newXp - prevXp} XP{doubleXp ? " · 2x first round" : ""}</span><span style={{ color: "#FFE9A0" }}>{up ? "Level up!" : `${Math.max(0, hi - newXp)} to level ${before + 1}`}</span></span>
        <span role="img" aria-label={up ? "Level bar full" : `${Math.round(endPct)} percent to the next level`} style={{ display: "block", height: 12, borderRadius: 99, background: "#0B2C6E", overflow: "hidden" }}>
          <span style={{ display: "block", width: `${pct}%`, height: "100%", background: "#FFC531", borderRadius: 99, transition: "width 1s cubic-bezier(.2,.8,.2,1)" }} />
        </span>
      </div>
      <Ball tone={up ? "P" : "X"} mode="n" num={before + 1} size={52} />
    </section>
  );
  const coach = (
    <section aria-label="Coach tip" className="e-white" style={{ borderRadius: 20, boxShadow: "0 4px 0 #0E3E9C", padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
      <span aria-hidden="true" className="e-ld" style={{ width: 40, height: 40, borderRadius: "50%", background: "#2F6FE4", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>N</span>
      <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.35 }}><b style={{ fontWeight: 900 }}>Coach Nova:</b> {tip}</span>
    </section>
  );
  const bonusEls = (bonus ?? []).slice(0, wide ? 3 : onShare ? 2 : 3).map((b, i) => (
        <section key={i} className="e-white" style={{ borderRadius: 20, boxShadow: "0 4px 0 #0E3E9C", padding: "8px 14px 8px 10px", display: "flex", alignItems: "center", gap: 12 }}>
          <Ball tone={b.tone} size={40}><Icon name="star" size={20} color="#14254F" /></Ball>
          <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <span className="e-ld" style={{ fontSize: 18, lineHeight: 1.1 }}>{b.title}</span>
            <span className="e-sub" style={{ fontSize: 13, fontWeight: 700 }}>{b.text}</span>
          </span>
        </section>
      ));
  const actions = (
    <>
      {up ? (
        <button className="e-gold" onClick={onContinue} style={{ marginTop: "auto", marginBottom: 16 }}>Continue</button>
      ) : (
        <>
          {goals && goals.length > 0 && (
            <section aria-label="Next goals" className="e-goals" style={{ marginTop: "auto" }}>
              {goals.map((g) => <span key={g.text}><Icon name={g.icon} size={18} color="#FFE9A0" sw={2.4} />{g.text}</span>)}
            </section>
          )}
          {onShare && (
            <button className="e-white" onClick={onShare} style={{ height: 50, border: 0, marginTop: goals?.length ? undefined : "auto", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit", fontSize: 17, fontWeight: 900 }}>
              <Icon name="share" size={20} />{shareLabel ?? "Challenge a friend"}
            </button>
          )}
          {rematch
            ? <button className="e-gold" onClick={rematch.onRematch} style={onShare || goals?.length ? undefined : { marginTop: "auto" }}>Rematch {rematch.name}</button>
            : <button className="e-gold" onClick={onAgain} style={onShare || goals?.length ? undefined : { marginTop: "auto" }}>Play again</button>}
          <button className="e-ghost" onClick={onHome}>Home</button>
        </>
      )}
    </>
  );
  if (wide) {
    // desktop: the score on the left, what it earned on the right
    return (
      <div className="e-root e-desk-embed e-fade">
        <div className="e-desk-results">
          <div className="rl">{head}{ballEl}{stats}</div>
          <div className="rr">{prog}{coach}{bonusEls}<div className="ra">{actions}</div></div>
        </div>
      </div>
    );
  }
  return (
    <div className="e-root e-fade results-col" style={{ padding: "22px 16px 8px", gap: 12 }}>
      {head}{ballEl}{stats}{prog}{coach}{bonusEls}{actions}
    </div>
  );
}

export function LevelUp({ level, prevLevel, xp, avgXp, onAgain, onHome, onGo }: { level: number; prevLevel: number; xp: number; avgXp: number; onAgain: () => void; onHome: () => void; onGo: (to: string) => void }) {
  const nextU = LEVEL_UNLOCKS.find((u) => u.level > level);
  // everything unlocked between the old level and the new one (a big round can cross two levels)
  const feats = LEVEL_UNLOCKS.filter((u) => u.level > prevLevel && u.level <= level).flatMap((u) => u.features).filter((f) => f !== "play");
  const ball = feats.length >= 3 ? 150 : 190;
  const rounds = nextU ? Math.max(1, Math.ceil((xpForLevel(nextU.level) - xp) / avgXp)) : 0;
  const desk = useDesk();
  const top = (
    <>
      <h1 className="e-ld" style={{ margin: 0, textAlign: "center", fontSize: 26, lineHeight: 1, letterSpacing: 1, color: "#FFC531", textShadow: "0 3px 0 #123E91", position: "relative" }}>LEVEL UP!</h1>
      <div role="img" aria-label={`Level ${level}`} style={{ position: "relative", alignSelf: "center", marginTop: 12, width: ball, height: ball }}>
        <span className="e-ball e-bP" style={{ ["--s" as string]: `${ball}px`, border: "8px solid #fff", boxShadow: "inset -12px -16px 26px rgba(0,0,0,.26), inset 6px 8px 14px rgba(255,255,255,.45), 0 16px 26px rgba(4,16,60,.5)" } as CSSProperties}>
          <span className="e-lb" style={{ width: "66%", height: "66%", gap: 2 }}><i style={{ fontSize: ball / 9.5, letterSpacing: 1 }}>LEVEL</i><b style={{ fontSize: level > 9 ? ball * 0.3 : ball * 0.4, lineHeight: 0.9 }}>{level}</b></span>
        </span>
      </div>
      <p style={{ margin: "14px 0 0", textAlign: "center" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 40, padding: "0 16px 0 8px", borderRadius: 999, background: "#123E91", fontSize: 16, fontWeight: 900 }}><Coin />+30 coins</span>
      </p>
    </>
  );
  const list = (
    <>
      <h2 className="e-ld" style={{ margin: desk ? "0 0 8px" : "16px 0 8px", fontSize: 20, letterSpacing: 1, textAlign: desk ? "left" : "center", color: "#FFE9A0", textShadow: "0 2px 0 #123E91" }}>{feats.length ? `New at level ${level}` : "Keep going"}</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {feats.map((f) => {
          const info = FEATURE_INFO[f];
          return (
            <div key={f} className="e-white" style={{ borderRadius: 20, boxShadow: "0 4px 0 #0E3E9C", padding: "8px 12px 8px 10px", display: "flex", alignItems: "center", gap: 10 }}>
              <Ball tone={info.tone} size={44}><Icon name={info.icon} size={22} color="#14254F" /></Ball>
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                <span className="e-ld" style={{ fontSize: 18, lineHeight: 1.1 }}>{info.title}</span>
                <span className="e-sub" style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.25 }}>{info.desc}</span>
              </div>
              <Mini onClick={() => onGo(info.go)}>Try it</Mini>
            </div>
          );
        })}
        {nextU && (
          <div className="e-panel" style={{ borderRadius: 18, boxShadow: "none", padding: "8px 12px", display: "flex", alignItems: "center", gap: 10 }}>
            <Ball tone="X" size={36}><Icon name="lock" size={18} color="#4A5A85" sw={2.6} /></Ball>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 800 }}>Level {nextU.level}: {nextU.title}</span>
            <span style={{ fontSize: 14, fontWeight: 900, color: "#FFE9A0", whiteSpace: "nowrap" }}>~{rounds} {rounds === 1 ? "round" : "rounds"}</span>
          </div>
        )}
      </div>
    </>
  );
  if (desk) {
    // desktop: the level badge on the left, what opened and the next steps on the right
    return (
      <div className="e-root e-desk-embed e-fade">
        <div className="e-desk-levelup">
          <div className="ll">{top}</div>
          <div className="lr">
            {list}
            <div className="la">
              <button className="e-gold" onClick={onAgain}>Play again</button>
              <button className="e-ghost" onClick={onHome}>Back to the lobby</button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="e-root e-fade" style={{ padding: "36px 16px 0", background: "radial-gradient(circle at 50% 24%, #2F6DE4 0, #1F5FD6 62%)" }}>
      {top}
      {list}
      <span style={{ flex: 1 }} />
      <button className="e-gold" onClick={onAgain}>Play again</button>
      <button className="e-ghost" onClick={onHome} style={{ margin: "6px 0 14px" }}>Back to the lobby</button>
    </div>
  );
}
