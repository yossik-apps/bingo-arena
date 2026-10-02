import { useState } from "react";
import type { GameCfg } from "../lib/supabase";
import { Coins, Ic } from "../lib/ui";

type Mode = "solo" | "ghost";
const LV: Record<string, number> = { beginner: 1, medium: 2, hard: 3 };
const NAMES: Record<string, string> = { beginner: "Beginner", medium: "Medium", hard: "Hard" };

const BOOSTERS: [string, string][] = [["slow", "Slow motion"], ["win", "Extra window"], ["time", "Extra time"], ["hint", "Hint glow"]];

export default function Lobby({ cfg, balance, banned, boosters, onStart, error }: {
  cfg: GameCfg; balance: number; banned: boolean; boosters: Record<string, number>; error: string; onStart: (m: Mode, l: string, b: string[]) => void;
}) {
  const [armed, setArmed] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>("ghost");
  const [level, setLevel] = useState("beginner");
  const lv = cfg.levels[level];
  const paid = mode !== "solo";
  const win = Math.round(lv.fee * cfg.g.pay);
  const blocked = banned || cfg.g.maint || (paid && !cfg.g.paid) || (paid && balance < lv.fee);
  const hint = banned ? "Your account is suspended. Contact support."
    : cfg.g.maint ? "The game is under maintenance. Try again soon."
    : paid && balance < lv.fee ? "Not enough coins. Play solo to earn more."
    : paid ? `Win up to ${win} coins` : "Free practice. Beat your own best.";

  const modes: [Mode, string, string, string, number | null][] = [
    ["solo", "user", "Play alone", "Free practice. Beat your own best.", null],
    ["ghost", "ghost", "Vs ghost", "Beat a practice rival for prizes.", lv.fee],
  ];
  return (
    <>
      {cfg.g.note && <p className="toast">{cfg.g.note}</p>}
      <section className="hero">
        <span className="eyebrow">Bingo Arena</span>
        <h2>{cfg.g.total} seconds. Highest score wins.</h2>
        <p>Daub numbers as they drop, build combos, complete lines.</p>
      </section>
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
        <div className="mode" style={{ opacity: 0.6 }}>
          <span className="mi"><Ic n="users" /></span>
          <span className="mt"><b>Vs real players</b><span className="dim">Coming soon</span></span>
        </div>
      </div>
      <h2 className="sec">Level</h2>
      <div className="seg">
        {Object.keys(cfg.levels).map((k) => (
          <button key={k} className="lvlb" aria-pressed={level === k} onClick={() => setLevel(k)}>
            <b>{NAMES[k] ?? k}</b>
            <span className="dots" aria-hidden="true">{[1, 2, 3].map((i) => <i key={i} className={i <= (LV[k] ?? 1) ? "on" : ""} />)}</span>
            <span className="dim">{cfg.levels[k].every / 1000}s per number</span>
          </button>
        ))}
      </div>
      <h2 className="sec">Boosters <span className="dim" style={{ textTransform: "none", letterSpacing: 0 }}>(alone and vs ghost only)</span></h2>
      <div className="seg" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
        {BOOSTERS.map(([k, n]) => (
          <button key={k} className="lvlb" aria-pressed={armed.includes(k)} disabled={(boosters[k] ?? 0) === 0}
            onClick={() => setArmed((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]))}>
            <b>{n}</b><span className="dim">Owned: {boosters[k] ?? 0}</span>
          </button>
        ))}
      </div>
      <div className="cta">
        <button className="btn big" disabled={blocked} onClick={() => { onStart(mode, level, armed.filter((k) => (boosters[k] ?? 0) > 0)); setArmed([]); }}>
          Play{paid ? <> · <Coins n={lv.fee} /></> : " · Free"}
        </button>
        <p className="hint">{hint}</p>
        {error && <p className="hint" role="alert" style={{ color: "var(--warn)" }}>{error}</p>}
      </div>
    </>
  );
}
