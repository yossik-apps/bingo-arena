import { useState } from "react";
import { levelKeys, type ChallengeInfo, type GameCfg } from "../lib/supabase";
import { Coins, Ic } from "../lib/ui";
import DailyCard from "./DailyCard";

type Mode = "solo" | "ghost" | "pvp";
const LV: Record<string, number> = { beginner: 1, medium: 2, hard: 3 };
const NAMES: Record<string, string> = { beginner: "Beginner", medium: "Medium", hard: "Hard" };
const BOOSTERS: [string, string][] = [["slow", "Slow motion"], ["win", "Extra window"], ["time", "Extra time"], ["hint", "Hint glow"]];

export default function Lobby({ cfg, balance, banned, boosters, onStart, error, userId, dailyKey, onDaily, challenge, onAccept, onDismiss }: {
  cfg: GameCfg; balance: number; banned: boolean; boosters: Record<string, number>; error: string; onStart: (m: Mode, l: string, b: string[]) => void;
  userId: string; dailyKey: number; onDaily: () => void; challenge: ChallengeInfo | null; onAccept: (code: string) => void; onDismiss: () => void;
}) {
  const saved = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
  const m0 = saved("ba_mode", "ghost");
  const [mode, setModeS] = useState<Mode>(m0 === "solo" || m0 === "pvp" ? m0 : "ghost");
  const [level, setLevelS] = useState(cfg.levels[saved("ba_level", "beginner")] ? saved("ba_level", "beginner") : "beginner");
  const [armed, setArmed] = useState<string[]>([]);
  const setMode = (m: Mode) => { setModeS(m); try { localStorage.setItem("ba_mode", m); } catch { /* ignore */ } };
  const setLevel = (l: string) => { setLevelS(l); try { localStorage.setItem("ba_level", l); } catch { /* ignore */ } };

  const lv = cfg.levels[level];
  const paid = mode !== "solo";
  const win = Math.round(lv.fee * cfg.g.pay);
  const pvpOff = mode === "pvp" && !cfg.g.pvp;
  const blocked = banned || cfg.g.maint || (paid && !cfg.g.paid) || (paid && balance < lv.fee) || pvpOff;
  const hint = banned ? "Your account is suspended. Contact support."
    : cfg.g.maint ? "The game is under maintenance. Try again soon."
    : pvpOff ? "Real-player matches are switched off right now."
    : paid && balance < lv.fee ? "Not enough coins. Play solo to earn more."
    : paid ? `Win up to ${win} coins` : "Free practice. Beat your own best.";

  const modes: [Mode, string, string, string, number | null][] = [
    ["solo", "user", "Play alone", "Free practice. Beat your own best.", null],
    ["ghost", "ghost", "Vs ghost", "Beat a practice rival for prizes.", lv.fee],
    ["pvp", "users", "Vs real players", "Same card for both. Higher score wins.", lv.fee],
  ];
  return (
    <div className="lobby">
      {cfg.g.note && <p className="toast" style={{ gridColumn: "1 / -1" }}>{cfg.g.note}</p>}
      <section className="hero l-hero">
        <span className="eyebrow">Bingo Arena</span>
        <h2>{cfg.g.total} seconds. Highest score wins.</h2>
        <p>Daub numbers as they drop, build combos, complete lines.</p>
      </section>
      {challenge && !challenge.mine && !challenge.played && !challenge.expired && (
        <section className="box l-chal" role="status">
          <b>{challenge.creator} challenged you!</b>
          <p className="dim" style={{ margin: "4px 0" }}>Beat <b>{challenge.score}</b> points on {NAMES[challenge.level] ?? challenge.level}, on the exact same board. Free, one try.</p>
          <div className="row2"><button className="btn" onClick={() => onAccept(challenge.code)}>Accept the challenge</button><button className="btn alt" onClick={onDismiss}>Not now</button></div>
        </section>
      )}
      <div className="l-daily"><DailyCard onPlay={onDaily} refreshKey={dailyKey} userId={userId} /></div>
      <div className="l-modes">
        <h2 className="sec">Mode</h2>
        <div className="modes">
          {modes.map(([k, ic, name, desc, fee]) => (
            <button key={k} className="mode" aria-pressed={mode === k} onClick={() => setMode(k)}>
              <span className="mi"><Ic n={ic} /></span>
              <span className="mt"><b>{name}</b><span className="dim">{desc}</span></span>
              <span className="fee">{fee === null ? "Free" : <Coins n={fee} />}</span>
              <span className="tick"><Ic n="check" /></span>
            </button>
          ))}
        </div>
      </div>
      <div className="l-levels">
        <h2 className="sec">Level</h2>
        <div className="seg">
          {levelKeys(cfg.levels).map((k) => (
            <button key={k} className="lvlb" aria-pressed={level === k} onClick={() => setLevel(k)}>
              <b>{NAMES[k] ?? k}</b>
              <span className="dots" aria-hidden="true">{[1, 2, 3].map((i) => <i key={i} className={i <= (LV[k] ?? 1) ? "on" : ""} />)}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="l-boost">
        <h2 className="sec">Boosters <span className="dim" style={{ textTransform: "none", letterSpacing: 0 }}>(alone and vs ghost only)</span></h2>
        <div className="seg">
          {BOOSTERS.map(([k, n]) => (
            <button key={k} className="lvlb" aria-pressed={armed.includes(k)} disabled={mode === "pvp" || (boosters[k] ?? 0) === 0}
              onClick={() => setArmed((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]))}>
              <b>{n}</b><span className="dim">Owned: {boosters[k] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="cta sticky l-cta">
        <button className="btn big" disabled={blocked} onClick={() => { onStart(mode, level, mode === "pvp" ? [] : armed.filter((k) => (boosters[k] ?? 0) > 0)); setArmed([]); }}>
          {mode === "pvp" ? "Find opponent" : "Play"}{paid ? <> · <Coins n={lv.fee} /></> : " · Free"}
        </button>
        <p className="hint">{hint}</p>
        {error && <p className="hint" role="alert" style={{ color: "var(--warn)" }}>{error}</p>}
      </div>
    </div>
  );
}
