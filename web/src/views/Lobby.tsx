import { useState } from "react";
import { levelKeys, type ChallengeInfo, type GameCfg, type LiveOp } from "../lib/supabase";
import { opText, timeLeft } from "../lib/time";
import { Coins, Ic } from "../lib/ui";
import InfoTip from "../lib/InfoTip";
import DailyCard from "./DailyCard";
import { DRILL_NAMES, SKILL_INFO, todaysDrill, type Dna } from "../lib/dna";

type Mode = "solo" | "ghost" | "pvp";
const LV: Record<string, number> = { beginner: 1, medium: 2, hard: 3 };
const NAMES: Record<string, string> = { beginner: "Beginner", medium: "Medium", hard: "Hard" };
const FEEL: Record<string, string> = { beginner: "Relaxed", medium: "Balanced", hard: "Fast" };
const BOOSTERS: [string, string][] = [["slow", "Slow motion"], ["win", "Extra window"], ["time", "Extra time"], ["hint", "Hint glow"]];

export default function Lobby({ cfg, balance, banned, boosters, onStart, error, userId, dailyKey, onDaily, challenge, onAccept, onDismiss, isNew, ops, newCount, onSayHi, guest, guestFree, dna, drillDone, onDrill }: {
  cfg: GameCfg; balance: number; banned: boolean; boosters: Record<string, number>; error: string; onStart: (m: Mode, l: string, b: string[]) => void;
  userId: string; dailyKey: number; onDaily: () => void; challenge: ChallengeInfo | null; onAccept: (code: string) => void; onDismiss: () => void; isNew: boolean; ops: LiveOp[]; newCount: number; onSayHi: () => void; guest?: boolean; guestFree?: boolean;
  dna?: Dna | null; drillDone?: boolean; onDrill?: () => void;
}) {
  const saved = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
  const m0 = saved("ba_mode", isNew ? "solo" : "ghost"); // new players start with the free option
  const [mode, setModeS] = useState<Mode>(m0 === "solo" || m0 === "pvp" ? m0 : "ghost");
  const [level, setLevelS] = useState(cfg.levels[saved("ba_level", "beginner")] ? saved("ba_level", "beginner") : "beginner");
  const [armed, setArmed] = useState<string[]>([]);
  const setMode = (m: Mode) => { setModeS(m); try { localStorage.setItem("ba_mode", m); } catch { /* ignore */ } };
  const setLevel = (l: string) => { setLevelS(l); try { localStorage.setItem("ba_level", l); } catch { /* ignore */ } };

  const lv = cfg.levels[level];
  const paid = mode !== "solo";
  const win = Math.round(lv.fee * cfg.g.pay);
  const pvpOff = mode === "pvp" && !cfg.g.pvp;
  const blocked = !guest && (banned || cfg.g.maint || (paid && !cfg.g.paid) || (paid && balance < lv.fee) || pvpOff);
  const owned = BOOSTERS.reduce((n, [k]) => n + (boosters[k] ?? 0), 0);
  const hint = guest && guestFree && mode === "solo" ? "Try one Practice round now, no account needed." : guest ? `Free account needed to play. You get ${cfg.g.welcome} free coins when you sign up.` : banned ? "Your account is suspended. Contact support."
    : cfg.g.maint ? "The game is under maintenance. Try again soon."
    : pvpOff ? "Live matches are switched off right now."
    : paid && balance < lv.fee ? `You need ${lv.fee} coins for this. Play Practice to earn more.`
    : mode === "ghost" ? `You pay ${lv.fee} coins. Beat the ghost and you win ${win}.`
    : mode === "pvp" ? `You pay ${lv.fee} coins. The winner gets ${win}.`
    : "Free. Nothing to lose, so it is a good place to learn.";

  const modes: [Mode, string, string, string, number | null][] = [
    ["solo", "user", "Practice", "Play alone. Free. Beat your own best.", null],
    ["ghost", "ghost", "Beat the Ghost", `A practice rival. Entry ${lv.fee} coins, win ${win}.`, lv.fee],
    ["pvp", "users", "Play a person", `Live match on the same board. Winner gets ${win}.`, lv.fee],
  ];
  const cta = mode === "pvp" ? "Find an opponent" : mode === "solo" ? "Start practice" : "Play now";
  return (
    <div className="lobby">
      {cfg.g.note && <p className="toast" style={{ gridColumn: "1 / -1" }}>{cfg.g.note}</p>}
      {isNew ? (
        <section className="hero l-hero">
          <span className="eyebrow">Welcome</span>
          <h2>Start with a free practice round</h2>
          <p>It takes under two minutes and costs nothing. The tour (the ? button at the top) explains the rest.</p>
        </section>
      ) : (
        <section className="hero l-hero">
          <span className="eyebrow">Bingo Arena</span>
          <h2>{cfg.g.total} seconds. Highest score wins.</h2>
          <p>Tap the numbers as they are called. Chain correct taps for combos and complete lines.</p>
        </section>
      )}
      {ops.length > 0 && (
        <div className="ops l-chal" role="status" aria-label="Events on now">
          {ops.map((o) => (
            <div className="opchip" key={o.id}><b>{o.title}</b><span>{opText(o) || o.descr}</span><span className="dim">{timeLeft(o.ends_at)}</span></div>
          ))}
        </div>
      )}
      {challenge && !challenge.mine && !challenge.played && !challenge.expired && (
        <section className="box l-chal" role="status">
          <b>{challenge.creator} challenged you!</b>
          <p className="dim" style={{ margin: "4px 0" }}>Beat <b>{challenge.score}</b> points on {NAMES[challenge.level] ?? challenge.level}, on the exact same board. Free, one try.</p>
          <div className="row2"><button className="btn" onClick={() => onAccept(challenge.code)}>Accept the challenge</button><button className="btn alt" onClick={onDismiss}>Not now</button></div>
        </section>
      )}
      {newCount > 0 && (
        <button className="chipbtn l-chal" onClick={onSayHi}><Ic n="users" /><span><b>{newCount} new player{newCount === 1 ? "" : "s"}</b> joined this week. Tap to say welcome.</span></button>
      )}
      {onDrill && !guest && (
        <button className="chipbtn l-chal fixcard" onClick={onDrill}>
          <Ic n="target" />
          <span><b>Today's fix: {DRILL_NAMES[todaysDrill(dna ?? null)]}</b> 60 seconds{dna?.weakest ? ` to train your ${SKILL_INFO[dna.weakest].name}` : ""}. {drillDone ? "Done today, train again any time." : "Free, +20 coins today."}</span>
        </button>
      )}
      <div className="l-daily"><DailyCard onPlay={onDaily} refreshKey={dailyKey} userId={userId} /></div>
      <div className="l-modes">
        <h2 className="sec">1. Choose how to play <InfoTip label="the play modes" text="Practice is free. Beat the Ghost and Play a person cost a small entry fee in coins, and the winner earns more back. Coins are play money." /></h2>
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
        <h2 className="sec">2. Pick your pace <InfoTip label="the levels" text="Higher levels move faster and keep fewer numbers on the board, but they pay more points and XP. If you are new, start with Beginner." /></h2>
        <div className="seg">
          {levelKeys(cfg.levels).map((k) => (
            <button key={k} className="lvlb" aria-pressed={level === k} onClick={() => setLevel(k)}>
              <b>{NAMES[k] ?? k}</b>
              <span className="dots" aria-hidden="true">{[1, 2, 3].map((i) => <i key={i} className={i <= (LV[k] ?? 1) ? "on" : ""} />)}</span>
              <span className="dim">{FEEL[k] ?? ""}</span>
            </button>
          ))}
        </div>
      </div>
      <details className="l-boost faq" open={owned > 0 && mode !== "pvp"}>
        <summary>Boosters {owned > 0 ? `(you have ${owned})` : "(optional)"}</summary>
        {mode === "pvp" ? <p>Boosters are not allowed in live matches, so everyone has the same chance.</p>
          : owned === 0 ? <p>You have none yet. You can buy boosters in the Shop. They help in Practice and Beat the Ghost.</p>
          : (
            <div className="seg">
              {BOOSTERS.map(([k, n]) => (
                <button key={k} className="lvlb" aria-pressed={armed.includes(k)} disabled={(boosters[k] ?? 0) === 0}
                  onClick={() => setArmed((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]))}>
                  <b>{n}</b><span className="dim">Owned: {boosters[k] ?? 0}</span>
                </button>
              ))}
            </div>
          )}
      </details>
      <div className="cta sticky l-cta">
        <button className="btn big" disabled={blocked} onClick={() => { onStart(mode, level, mode === "pvp" ? [] : armed.filter((k) => (boosters[k] ?? 0) > 0)); setArmed([]); }}>
          {cta}{paid ? <> · <Coins n={lv.fee} /></> : ""}
        </button>
        <p className="hint">{hint}</p>
        {error && <p className="hint" role="alert" style={{ color: "var(--warn)" }}>{error}</p>}
      </div>
    </div>
  );
}
