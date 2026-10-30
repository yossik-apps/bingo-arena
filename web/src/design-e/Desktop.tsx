import { useContext, useEffect, useState, type ReactNode } from "react";
import { Ball, Bulbs, type Tone } from "./Ball";
import { Coin, Icon, type IconName } from "./Icon";
import { featureLevel, LADDER, nextUnlock, unlocked, xpForLevel, type Feature } from "../lib/levels";
import { Globe, NextUnlockCard, type Mode, type Speed } from "./Lobby";
import { DailyCtx, DeskCtx, TAB_FEATURE, Wallet, type Tab } from "./Nav";
import { SoundButton } from "./SoundControl";
import { DAILY, rewardText, SPEED_DESC } from "./data";

const ITEMS: { id: Tab; label: string; icon: IconName }[] = [
  { id: "play", label: "Play", icon: "play" },
  { id: "journey", label: "Journey", icon: "map" },
  { id: "collect", label: "Collect", icon: "book" },
  { id: "compete", label: "Compete", icon: "trophy" },
  { id: "shop", label: "Shop", icon: "bag" },
];

/** The desktop frame: a side navigation on the left, a top bar with the wallet and sound, and the screen in the middle. */
export function DeskShell({ level, xp, coins, gems, tab, title, onBack, onNav, onProfile, onPath, onTools, toolsOpen, children }: {
  level: number; xp: number; coins: number; gems: number; tab: Tab | null; title?: string; onBack?: () => void; onNav: (t: Tab) => void; onProfile: () => void; onPath: () => void;
  onTools: () => void; toolsOpen: boolean; children: ReactNode;
}) {
  const daily = useContext(DailyCtx);
  const items = LADDER === "original" ? ITEMS.filter((t) => unlocked(TAB_FEATURE[t.id], level)) : ITEMS;
  const lo = xpForLevel(level), hi = xpForLevel(level + 1);
  const pct = Math.max(0, Math.min(100, Math.round(((xp - lo) / (hi - lo)) * 100)));
  return (
    <div className="e-root e-desk e-shell">
      <nav className="e-rail" aria-label="Main">
        <div className="e-sign"><Bulbs n={9} /><h1 className="e-ld">Bingo Arena</h1><Bulbs n={9} /></div>
        <button onClick={onProfile} aria-label={`Level ${level}, ${pct} percent to the next level. Open your profile`} className="e-ni e-me" aria-current={tab === null ? "page" : undefined} style={{ height: 64, marginBottom: 10 }}>
          <span aria-hidden="true" className="e-ld" style={{ width: 40, height: 40, borderRadius: "50%", background: "#FFC531", border: "3px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#14254F", flexShrink: 0 }}>S</span>
          <span style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 15, lineHeight: 1 }}>SunnyOwl21</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ background: "#D6336C", color: "#fff", fontSize: 11, fontWeight: 900, borderRadius: 999, padding: "1px 7px" }}>Lv {level}</span>
              <span aria-hidden="true" style={{ flex: 1, height: 7, borderRadius: 99, background: "#0B2C6E", overflow: "hidden" }}><span style={{ display: "block", width: `${pct}%`, height: "100%", background: "#FFC531" }} /></span>
            </span>
          </span>
        </button>
        {items.map((t) => {
          const f = TAB_FEATURE[t.id];
          const open = unlocked(f, level);
          return (
            <button key={t.id} className={`e-ni${open ? "" : " e-lk"}`} aria-current={t.id === tab ? "page" : undefined}
              aria-label={open ? t.label : `${t.label}, locked. Unlocks at level ${featureLevel[f]}`} onClick={() => onNav(t.id)}>
              <Icon name={t.icon} size={24} sw={2.2} />{t.label}
              {!open && <span className="e-nlv"><Icon name="lock" size={14} color="#B7C8F2" sw={2.6} />Lv {featureLevel[f]}</span>}
              {open && featureLevel[f] === level && t.id !== "play" && <span className="e-newdot" role="img" aria-label="New" />}
              {open && t.id === "compete" && tab !== "compete" && !!daily?.unread && featureLevel[f] !== level && <span className="e-newdot" role="img" aria-label="A friend answered your challenge" />}
              {t.id === "play" && tab !== "play" && daily?.unlocked && daily.any && <span className="e-newdot" role="img" aria-label="A reward is waiting" />}
            </button>
          );
        })}
        <span style={{ flex: 1 }} />
        <button className="e-ni" onClick={onPath} style={{ height: 44, fontSize: 15 }}><Icon name="help" size={22} />Level path</button>
        <button className="e-ni" onClick={onTools} aria-expanded={toolsOpen} style={{ height: 44, fontSize: 14, background: "#FFC531", color: "#3A2300" }}>Prototype tools</button>
      </nav>
      <div className="e-deskmain">
        <header className="e-desktop">
          {onBack && (
            <button aria-label="Back" onClick={onBack} className="e-deskback"><Icon name="back" size={22} sw={3} /></button>
          )}
          <h1 className="e-ld" style={{ margin: 0, fontSize: 30, lineHeight: 1.1, textShadow: "0 3px 0 #123E91" }}>{title ?? (tab ? ITEMS.find((i) => i.id === tab)?.label : "You")}</h1>
          <span style={{ flex: 1 }} />
          <Wallet wide coins={coins} gems={gems} level={level} />
          <SoundButton />
        </header>
        <div className="e-deskbody"><DeskCtx.Provider value={true}>{children}</DeskCtx.Provider></div>
      </div>
    </div>
  );
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** The desktop lobby: the globe on the left, the choices and today's rewards on the right. */
/** globe scale: 1.08 up to 1280px wide, growing to 1.6 on big screens, never taller than the window */
function useGlobeK(stacked: boolean) {
  const calc = () => {
    const w = window.innerWidth, h = window.innerHeight;
    const byW = 1.08 + Math.max(0, Math.min(1, (w - 1280) / 640)) * 0.52;
    const byH = (h - 72 - 40 - 56) / 378;
    const pad = Math.min(64, Math.max(24, w * 0.04)), gap = Math.min(64, Math.max(32, w * 0.04));
    const inner = Math.min(1440, w - 248 - 2 * pad);
    const col = stacked ? inner : (inner - gap) * 1.15 / 2.15;
    return Math.max(0.9, Math.min(byW, byH, col / 330));
  };
  const [k, setK] = useState(calc);
  useEffect(() => { const f = () => setK(calc()); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, [stacked]);
  return k;
}

export function DeskLobby({ level, xp, coins, rounds, speed, onSpeed, mode: picked, onMode, onPlay, onPath, onGo, onLocked, daily, streak, cardScore, firstToday, ghostFee, ghostFreeLeft, avgXp }: {
  level: number; xp: number; coins: number; rounds: number; speed: Speed; onSpeed: (s: Speed) => void; mode: Mode; onMode: (m: Mode) => void;
  onPlay: (m: Mode) => void; onPath: () => void; onGo: (to: string) => void; onLocked: (f: Feature) => void;
  daily: { day: number; ready: boolean; box?: boolean }; streak: number; cardScore: number; firstToday: boolean; ghostFee: number; ghostFreeLeft: number; avgXp: number;
}) {
  const ghostOn = unlocked("ghost", level), pvpOn = unlocked("pvp", level);
  const mode: Mode = picked === "person" ? (pvpOn ? "person" : "practice") : picked === "ghost" ? (ghostOn ? "ghost" : "practice") : "practice";
  const speedOk: Record<Speed, boolean> = { chill: true, normal: unlocked("normalSpeed", level), fast: unlocked("fastSpeed", level) };
  const sp: Speed = speedOk[speed] ? speed : "chill";
  const fee = ghostFee;
  const cantPay = mode === "ghost" && coins < fee;
  const next = nextUnlock(level);
  const globeK = useGlobeK(window.innerWidth <= 1180);
  const what = mode === "ghost" ? "Beat the Ghost" : mode === "person" ? "Play a person" : "Practice";
  /** button text: never "Play Play a person" */
  const cta = mode === "person" ? "Play a person" : mode === "ghost" ? "Race the Ghost" : "Play Practice";

  const caption = cantPay ? "Not enough coins for Ghost. Click play to get more."
    : firstToday ? "2x XP on your first round today"
      : mode === "ghost" ? (fee ? `Ghost costs ${fee} coins. Win ${fee + 8}.` : `${ghostFreeLeft} free ${ghostFreeLeft === 1 ? "race" : "races"} left. Win ${fee + 8} coins.`)
        : mode === "person" ? "Live match on the same board. Highest score wins."
          : `Practice · ${cap(sp)} speed · ${unlocked("combos", level) ? "combos on" : "free"}`;

  const modeCard = (m: Mode, icon: IconName, tone: Tone, title: string, desc: string, tag: ReactNode, feat: Feature, open: boolean) => open ? (
    <button key={m} role="radio" aria-checked={mode === m} className="e-mode" onClick={() => onMode(m)}>
      <Ball tone={tone} size={52}><Icon name={icon} size={26} color="#14254F" /></Ball>
      <span style={{ display: "flex", flexDirection: "column", gap: 1, flex: 1 }}>
        <span className="e-ld" style={{ fontSize: 22 }}>{title}{level === featureLevel[feat] && m !== "practice" && <span className="e-tag" style={{ marginLeft: 8, verticalAlign: 3 }}>NEW</span>}</span>
        <span className="e-sub" style={{ fontSize: 14, fontWeight: 700 }}>{desc}</span>
      </span>
      {tag}
    </button>
  ) : (
    <button key={m} className="e-mode e-locked" aria-label={`${title}, locked. Unlocks at level ${featureLevel[feat]}`} onClick={() => onLocked(feat)}>
      <Ball tone="X" size={52}><Icon name="lock" size={24} color="#4A5A85" sw={2.6} /></Ball>
      <span style={{ display: "flex", flexDirection: "column", gap: 1, flex: 1 }}>
        <span className="e-ld" style={{ fontSize: 22 }}>{title}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#DCE7FF" }}>Unlocks at level {featureLevel[feat]}</span>
      </span>
    </button>
  );
  const free = <span style={{ background: "#CFF5DD", color: "#0F6B3A", fontSize: 13, fontWeight: 900, borderRadius: 999, padding: "4px 10px" }}>FREE</span>;
  const tile = (icon: IconName, tone: Tone, a: string, b: string, go: string) => (
    <button onClick={() => onGo(go)} className="e-white" style={{ flex: 1, minWidth: 0, minHeight: 76, border: 0, boxShadow: "0 4px 0 #0E3E9C", borderRadius: 20, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, font: "inherit", textAlign: "left" }}>
      <Ball tone={tone} size={46}><Icon name={icon} size={22} color="#14254F" /></Ball>
      <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.2 }}>{a}</span>
        <span className="e-sub" style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>{b}</span>
      </span>
    </button>
  );
  const risk = daily.ready && streak > 0;
  const dailySub = daily.ready ? (risk ? `Keep your ${streak}-day streak` : rewardText(DAILY[daily.day], level)) : daily.box ? "A free box is waiting" : `Streak ${streak} · back tomorrow`;

  return (
    <div className="e-deskgrid">
      <div className="e-deskstage">
        <Globe k={globeK} label={level < 2 ? "Play your first round" : `Start: ${what}, ${sp} speed`} dim={cantPay} onPlay={() => onPlay(level < 2 ? "practice" : mode)} />
        <p className="e-deskcap">
          {level < 2 ? (rounds === 0 ? "Your first round is 60 seconds. Click each number when it is called." : "Play another round.") : firstToday && !cantPay ? <span className="e-chip" style={{ fontSize: 14 }}>{caption}</span> : caption}
        </p>
      </div>
      <div className="e-deskpanel">
        {level >= 2 && (
          <>
            {unlocked("dailyRewards", level) && (
              <div className="e-desktiles">
                {tile("gift", "P", daily.ready ? `Day ${daily.day + 1} reward` : daily.box ? "Free bonus box" : "Reward claimed", dailySub, "daily")}
                {unlocked("dailyChallenge", level) && tile("target", "G", "Daily card", cardScore >= 0 ? `Played: ${cardScore}` : "New board today", "collect")}
              </div>
            )}
            <div className="e-deskgroup">
            <h2 className="e-ld" style={{ margin: 0, fontSize: 28, lineHeight: 1.1, textShadow: "0 3px 0 #123E91" }}>Choose your game</h2>
            <div role="radiogroup" aria-label="Game mode" className="e-deskmodes">
              {modeCard("practice", "user", "B", "Practice", "Play alone. Beat your best.", free, "play", true)}
              {modeCard("ghost", "ghost", "I", "Beat the Ghost", "Race a practice rival.", (
                <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                  {fee > 0 ? <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 16, fontWeight: 900 }}><Coin size={20} />{fee}</span> : free}
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#0F6B3A" }}>Win {fee + 8}</span>
                </span>
              ), "ghost", ghostOn)}
              {modeCard("person", "users", "N", "Play a person", "Live match, same board.", null, "pvp", pvpOn)}
            </div>
            </div>
            <div role="radiogroup" aria-label="Speed" className="e-seg" style={mode === "person" ? { opacity: 0.55, pointerEvents: "none" } : undefined} aria-disabled={mode === "person"}>
              {(["chill", "normal", "fast"] as Speed[]).map((s) => (
                <button key={s} role="radio" aria-checked={sp === s} aria-label={speedOk[s] ? undefined : `${s}, locked`}
                  onClick={() => (speedOk[s] ? onSpeed(s) : onLocked(s === "normal" ? "normalSpeed" : "fastSpeed"))} style={speedOk[s] ? undefined : { color: "#DCE7FF" }}>
                  {!speedOk[s] && <Icon name="lock" size={16} color="#DCE7FF" />}{cap(s)}
                </button>
              ))}
            </div>
            <p style={{ margin: "-6px 0 0", textAlign: "center", fontSize: 14, fontWeight: 700, color: "#DCE7FF", minHeight: 20, opacity: mode === "person" ? 0 : 1 }}>{SPEED_DESC[sp]}</p>
            <button className="e-gold" aria-disabled={cantPay || undefined} onClick={() => onPlay(mode)}>{cta}{mode === "ghost" && fee ? ` · ${fee} coins` : ""}</button>
          </>
        )}
        {level < 2 && (
          <div className="e-deskgroup">
            <h2 className="e-ld" style={{ margin: 0, fontSize: 30, lineHeight: 1.1, textShadow: "0 3px 0 #123E91" }}>How it works</h2>
            {["A number is called every few seconds.", "Click it on your card. The faster you click, the more points you get.", "Fill a row, a column or a diagonal for a bonus."].map((t, i) => (
              <span key={t} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 16, fontWeight: 800 }}>
                <Ball tone={(["B", "G", "O"] as Tone[])[i]} mode="n" num={i + 1} size={40} />{t}
              </span>
            ))}
          </div>
        )}
        {next && <div className="e-desknext"><NextUnlockCard level={level} xp={xp} avgXp={avgXp} onPath={onPath} big lift={0} /></div>}
      </div>
    </div>
  );
}
