import type { CSSProperties } from "react";
import { Ball, Bulbs, toneOf, type Tone } from "./Ball";
import { Coin, Icon, type IconName } from "./Icon";
import { featureLevel, LADDER, nextUnlock, unlocked, xpForLevel, type Feature } from "../lib/levels";
import { BottomNav, Plus } from "./Nav";
import { DAILY, rewardText, SPEED_DESC } from "./data";

export type Speed = "chill" | "normal" | "fast";
/** What the big button starts. Practice and Ghost are remembered between visits. */
export type Mode = "practice" | "ghost" | "person";

export function Header({ level, xp, coins, onPath, onProfile }: { level: number; xp: number; coins: number; onPath: () => void; onProfile: () => void }) {
  const lo = xpForLevel(level), hi = xpForLevel(level + 1);
  const pct = Math.max(0, Math.min(100, Math.round(((xp - lo) / (hi - lo)) * 100)));
  return (
    <header style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 16px 0" }}>
      <button onClick={onProfile} aria-label={`Level ${level}, ${pct} percent to the next level. Open your profile`}
        style={{ display: "flex", alignItems: "center", gap: 10, border: 0, background: "transparent", color: "inherit", padding: 0, minHeight: 44, textAlign: "left" }}>
        <span aria-hidden="true" className="e-ld" style={{ width: 44, height: 44, borderRadius: "50%", background: "#FFC531", border: "3px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#14254F" }}>S</span>
        <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 16, fontWeight: 900 }}>SunnyOwl21</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ background: "#D6336C", color: "#fff", fontSize: 12, fontWeight: 900, borderRadius: 999, padding: "1px 8px" }}>Lv {level}</span>
            <span aria-hidden="true" style={{ width: 64, height: 8, borderRadius: 99, background: "#123E91", overflow: "hidden", display: "block" }}>
              <span style={{ display: "block", width: `${pct}%`, height: "100%", background: "#FFC531" }} />
            </span>
          </span>
        </span>
      </button>
      <span style={{ flex: 1 }} />
      <span style={{ display: "flex", alignItems: "center", gap: 6, height: 44, padding: "0 6px 0 8px", borderRadius: 999, background: "#123E91", fontSize: 16, fontWeight: 900 }}>
        <span role="status" aria-label={`${coins} coins`} style={{ display: "flex", alignItems: "center", gap: 6, paddingRight: 8 }}><Coin />{coins}</span>
        <Plus label="Get more coins" focus="coins" />
      </span>
      <button aria-label="Level path" onClick={onPath} style={{ width: 44, height: 44, border: 0, borderRadius: "50%", background: "#123E91", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon name="help" />
      </button>
    </header>
  );
}

// the balls resting in the globe (a fixed pseudo-random pile, so it never jumps between renders)
const HEAP = (() => {
  let s = 7;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const out: { n: number; x: number; y: number; size: number; rot: number; dx: number; dy: number; dr: number; dur: number; delay: number }[] = [];
  // back rows first, so the front rows overlap them like a real pile
  const rows: [number, number[]][] = [
    [206, [58, 100, 230, 272]],
    [236, [66, 106, 146, 186, 226, 266]],
    [266, [56, 94, 132, 170, 208, 246, 284]],
    [296, [78, 114, 150, 186, 222, 258]],
    [318, [112, 148, 184, 220]],
  ];
  for (const [y, xs] of rows) {
    for (const x of xs) {
      const n = Math.floor(r() * 75) + 1;
      const size = 46 + Math.round(r() * 2);
      out.push({ n, x: x - size / 2 + Math.round(r() * 6 - 3), y: y - size / 2 + Math.round(r() * 6 - 3), size, rot: Math.round(r() * 80 - 40), dx: Math.round(r() * 8 - 4), dy: -Math.round(4 + r() * 8), dr: Math.round(r() * 30 - 15), dur: 2.2 + r() * 2, delay: -r() * 4 });
    }
  }
  return out;
})();

export function NextUnlockCard({ level, xp, avgXp, onPath, big, lift }: { level: number; xp: number; avgXp: number; onPath: () => void; big?: boolean; lift?: number }) {
  const next = nextUnlock(level);
  if (!next) return null;
  const left = Math.max(1, Math.ceil((xpForLevel(next.level) - xp) / avgXp));
  if (big) {
    const lo = xpForLevel(level), hi = xpForLevel(level + 1);
    const pct = Math.max(4, Math.round(((xp - lo) / (hi - lo)) * 100));
    return (
      <button className="e-white" onClick={onPath} aria-label={`Next unlock, level ${next.level}: ${next.title}. Open the level path`}
        style={{ margin: `0 16px ${lift ?? 22}px`, border: 0, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 9, textAlign: "left", font: "inherit", width: "calc(100% - 32px)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Ball tone="X" size={48}><Icon name="lock" size={22} color="#4A5A85" sw={2.6} /></Ball>
          <span style={{ display: "flex", flexDirection: "column", gap: 1, flex: 1 }}>
            <span className="e-sub" style={{ fontSize: 13, fontWeight: 900 }}>Next: Level {next.level}</span>
            <span className="e-ld" style={{ fontSize: 21, lineHeight: 1.15 }}>{next.title}</span>
          </span>
          <span className="e-sub" style={{ fontSize: 14, fontWeight: 900 }}>{left} {left === 1 ? "round" : "rounds"}</span>
        </span>
        <span aria-hidden="true" style={{ display: "block", height: 10, borderRadius: 99, background: "#DCE4F5", overflow: "hidden" }}>
          <span style={{ display: "block", width: `${pct}%`, height: "100%", background: "#FFC531", borderRadius: 99 }} />
        </span>
      </button>
    );
  }
  return (
    <button onClick={onPath} className="e-panel" style={{ margin: `12px 16px ${lift ?? 0}px`, border: 0, boxShadow: "none", borderRadius: 18, padding: "8px 12px", display: "flex", alignItems: "center", gap: 10, color: "#fff", font: "inherit", width: "calc(100% - 32px)", minHeight: 52, textAlign: "left" }}>
      <Ball tone="X" size={36}><Icon name="lock" size={18} color="#4A5A85" sw={2.6} /></Ball>
      <span style={{ flex: 1, fontSize: 14, fontWeight: 800 }}>Level {next.level} unlocks {next.title}</span>
      <span style={{ fontSize: 14, fontWeight: 900, color: "#FFE9A0", whiteSpace: "nowrap" }}>{left} {left === 1 ? "round" : "rounds"}</span>
    </button>
  );
}

/** The globe with the big PLAY ball. Drawn at 330 x 378 and scaled with `k`, so every level shares one picture. */
export function Globe({ k, label, dim, onPlay }: { k: number; label: string; dim?: boolean; onPlay: () => void }) {
  return (
    <div style={{ position: "relative", width: 330 * k, height: 378 * k, flexShrink: 0 }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: 330, height: 378, transform: `scale(${k})`, transformOrigin: "top left" }}>
        <div className="e-glass" aria-hidden="true">
          {HEAP.map((b, i) => <Ball key={i} tone={toneOf(b.n)} num={b.n} size={b.size} rot={b.rot} className="e-jig" style={{ position: "absolute", left: b.x, top: b.y, ["--dx" as string]: `${b.dx}px`, ["--dy" as string]: `${b.dy}px`, ["--dr" as string]: `${b.dr}deg`, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s` } as CSSProperties} />)}
        </div>
        <div className="e-neck" aria-hidden="true" /><div className="e-foot" aria-hidden="true"><Bulbs n={5} /></div>
        <button className="e-play" aria-label={label} onClick={onPlay} style={dim ? { opacity: 0.55, animation: "none" } : undefined}>
          <span className="e-ball e-bP" style={{ ["--s" as string]: "152px", border: "7px solid #fff", boxShadow: "inset -9px -12px 20px rgba(0,0,0,.28), inset 5px 6px 12px rgba(255,255,255,.45), 0 14px 22px rgba(4,16,60,.5)" } as CSSProperties}>
            <span className="e-ld" style={{ fontSize: 40, lineHeight: 1, color: "#3A2300", textShadow: "0 2px 0 rgba(255,255,255,.55)", position: "relative", zIndex: 1 }}>PLAY!</span>
          </span>
        </button>
      </div>
    </div>
  );
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export default function Lobby({ level, xp, coins, rounds, speed, onSpeed, mode: picked, onMode, onPlay, onPath, onProfile, onGo, onLocked, daily, streak, cardScore, firstToday, ghostFee, ghostFreeLeft, avgXp }: {
  level: number; xp: number; coins: number; rounds: number; speed: Speed; onSpeed: (s: Speed) => void;
  /** the mode the player used last time. The big button always starts this one. */
  mode: Mode; onMode: (m: Mode) => void;
  onPlay: (m: Mode) => void; onPath: () => void;
  onProfile: () => void; onGo: (to: string) => void;
  /** tapped a locked mode or speed: the app shows the lock sheet */
  onLocked: (f: Feature) => void;
  daily: { day: number; ready: boolean; box?: boolean }; streak: number;
  /** score of today's scored daily card try, or -1 if it has not been played yet */
  cardScore: number; firstToday: boolean; ghostFee: number; ghostFreeLeft: number; avgXp: number;
}) {
  const ghostOn = unlocked("ghost", level), pvpOn = unlocked("pvp", level);
  const mode: Mode = picked === "person" ? (pvpOn ? "person" : "practice") : picked === "ghost" ? (ghostOn ? "ghost" : "practice") : "practice";
  const speedOk: Record<Speed, boolean> = { chill: true, normal: unlocked("normalSpeed", level), fast: unlocked("fastSpeed", level) };
  const sp: Speed = speedOk[speed] ? speed : "chill";
  const next = nextUnlock(level);
  const fee = ghostFee;
  const cantPay = mode === "ghost" && coins < fee;

  // ---- level 1: one big button and nothing else ----
  if (level < 2) {
    return (
      <div className="e-root e-hero-bg">
        <Header level={level} xp={xp} coins={coins} onPath={onPath} onProfile={onProfile} />
        <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 16px" }}>
          <div className="e-sign">
            <Bulbs n={11} />
            <h1 className="e-ld">Bingo Arena</h1>
            <Bulbs n={11} />
          </div>
          <div style={{ marginTop: 22 }}><Globe k={1} label="Play your first round" onPlay={() => onPlay("practice")} /></div>
          <p style={{ margin: "18px 0 0", textAlign: "center", fontSize: 16, fontWeight: 800, lineHeight: 1.35, maxWidth: 300 }}>
            {rounds === 0 ? "Your first round is 60 seconds." : "Play another round."}<br /><span style={{ fontWeight: 700 }}>Tap each number when it is called.</span>
          </p>
        </main>
        <NextUnlockCard level={level} xp={xp} avgXp={avgXp} onPath={onPath} big lift={LADDER === "original" ? 22 : 96} />
        <BottomNav level={level} current="play" onNav={(tab) => (tab === "play" ? undefined : onGo(tab))} />
      </div>
    );
  }

  // ---- level 2 and up: the same big button, with the choices as small chips under it ----
  const tile = (icon: IconName, tone: Tone, a: string, b: string, go: string) => (
    <button onClick={() => onGo(go)} className="e-white" style={{ flex: 1, minWidth: 0, minHeight: 64, border: 0, boxShadow: "0 4px 0 #0E3E9C", borderRadius: 18, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8, font: "inherit", textAlign: "left" }}>
      <Ball tone={tone} size={40}><Icon name={icon} size={20} color="#14254F" /></Ball>
      <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 900, lineHeight: 1.2 }}>{a}</span>
        <span className="e-sub" style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.2 }}>{b}</span>
      </span>
    </button>
  );
  const hasTiles = unlocked("dailyRewards", level);
  const risk = daily.ready && streak > 0;
  const dailySub = daily.ready ? (risk ? `Keep your ${streak}-day streak` : rewardText(DAILY[daily.day], level)) : daily.box ? "A free box is waiting" : `Streak ${streak} · back tomorrow`;
  const chip = (m: Mode, text: string, icon: IconName, feat: Feature, open: boolean) => (
    <button key={m} role="radio" aria-checked={open && mode === m} aria-label={open ? undefined : `${text}, unlocks at level ${featureLevel[feat]}`}
      onClick={() => (open ? onMode(m) : onLocked(feat))} style={open ? undefined : { color: "#DCE7FF" }}>
      <Icon name={open ? icon : "lock"} size={16} color={open && mode === m ? "#14254F" : "#DCE7FF"} />{text}
    </button>
  );
  const what = mode === "ghost" ? "Beat the Ghost" : mode === "person" ? "Play a person" : "Practice";
  return (
    <div className="e-root e-hero-bg">
      <Header level={level} xp={xp} coins={coins} onPath={onPath} onProfile={onProfile} />
      {hasTiles && (
        <div style={{ display: "flex", gap: 8, margin: "12px 16px 0" }}>
          {tile("gift", "P", daily.ready ? `Day ${daily.day + 1} reward` : daily.box ? "Free bonus box" : "Reward claimed", dailySub, "daily")}
          {unlocked("dailyChallenge", level) && tile("target", "G", "Daily card", cardScore >= 0 ? `Played: ${cardScore}` : "New board today", "collect")}
        </div>
      )}
      <main style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
        <Globe k={0.86} label={`Play: ${what}, ${sp} speed`} dim={cantPay} onPlay={() => onPlay(mode)} />
        <div style={{ width: "100%", padding: "0 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div role="radiogroup" aria-label="Game mode" className="e-seg">
            {chip("practice", "Practice", "user", "play", true)}
            {chip("ghost", "Ghost", "ghost", "ghost", ghostOn)}
            {chip("person", "Person", "users", "pvp", pvpOn)}
          </div>
          <div role="radiogroup" aria-label="Speed" className="e-seg e-sm" style={{ opacity: mode === "person" ? 0.5 : 1 }}>
            {(["chill", "normal", "fast"] as Speed[]).map((s) => (
              <button key={s} role="radio" aria-checked={sp === s} aria-label={speedOk[s] ? undefined : `${s}, locked`}
                onClick={() => (speedOk[s] ? onSpeed(s) : onLocked(s === "normal" ? "normalSpeed" : "fastSpeed"))} style={speedOk[s] ? undefined : { color: "#DCE7FF" }}>
                {!speedOk[s] && <Icon name="lock" size={14} color="#DCE7FF" />}{cap(s)}
              </button>
            ))}
          </div>
          <p style={{ margin: "-2px 0 0", textAlign: "center", fontSize: 12, fontWeight: 700, color: "#DCE7FF", minHeight: 16, opacity: mode === "person" ? 0 : 1 }}>{SPEED_DESC[sp]}</p>
          <p style={{ margin: 0, textAlign: "center", fontSize: 13, fontWeight: 700, minHeight: 22 }}>
            {cantPay ? "Not enough coins for Ghost. Tap play to get more."
              : firstToday ? <span className="e-chip">2x XP on your first round today</span>
                : mode === "ghost" ? (fee ? `Ghost costs ${fee} coins. Win ${fee + 8}.` : `${ghostFreeLeft} free ${ghostFreeLeft === 1 ? "race" : "races"} left. Win ${fee + 8} coins.`)
                  : mode === "person" ? "Live match on the same board. Highest score wins."
                    : `Practice · ${cap(sp)} speed · ${unlocked("combos", level) ? "combos on" : "free"}`}
          </p>
        </div>
      </main>
      {next ? <NextUnlockCard level={level} xp={xp} avgXp={avgXp} onPath={onPath} lift={92} /> : <div aria-hidden="true" style={{ height: 92, flexShrink: 0 }} />}
      <BottomNav level={level} current="play" onNav={(tab) => (tab === "play" ? undefined : onGo(tab))} />
    </div>
  );
}
