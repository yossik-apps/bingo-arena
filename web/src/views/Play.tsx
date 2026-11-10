import { useEffect, useMemo, useRef, useState } from "react";
import { currentIndex, LINES, makeBoard, missedCount, multiplier, scoreTaps, status, type Params, type Tap } from "@engine";
import { callFn, errorText, type DailyResult, type DuelResult, type StageResult } from "../lib/supabase";
import { Ic, label, L } from "../lib/ui";

export type RoundStart = {
  roundId: string; seed: number; balance: number; params: Params & { total: number; pay: number; ghost: number | null; goals?: number[]; label?: string; boosters?: string[]; level?: string };
  startAt?: number; matchId?: string; opponent?: string; // real-player matches start together at a set time
  local?: boolean; // a visitor's free round: scored on the device, nothing is saved
};
export type RoundResult = {
  score: number; daubs: number; wrong: number; late: number; lines: number; maxMult: number; accuracy: number;
  avgReactionMs: number | null; win: boolean; prize: number; xp: number; ghost: number | null; best: number | null;
  balance: number; level: number; achievements: string[]; mode?: string; eventId?: string | null; matchId?: string | null; stage?: StageResult | null; boost?: { xp: number; coins: number }; daily?: DailyResult | null; duel?: DuelResult | null; roundId?: string;
  bonus?: number; fast1?: number; fast2?: number; cv?: number; // balance v2: speed bonus points, taps within 1 s and within 2 s of the call, rules version
  missed?: number; maxStreak?: number; drill?: { ok: boolean; first_today: boolean; coins: number; skill?: string } | null;
};

const LEVEL_NAME: Record<string, string> = { beginner: "Beginner", medium: "Medium", hard: "Hard" };
type Flash = { i: number; kind: "good" | "wrong" | "late"; pts?: number; id: number };

export default function Play({ round, onDone, onError, onLeave, tips }: { round: RoundStart; onDone: (r: RoundResult, p: RoundStart["params"]) => void; onError: (m: string) => void; onLeave: () => void; tips: boolean }) {
  const p = round.params;
  const totalMs = p.total * 1000;
  // older rounds (and live matches) do not send the level; the slowest pace is Beginner
  const level = p.level ?? (p.every >= 3800 && p.win >= 4 ? "beginner" : "");
  const beginner = level === "beginner";
  const lineHints = level === "beginner" || level === "medium";
  const step = p.comboStep ?? 4, maxM = p.maxMult ?? 3;
  const { card, seq } = useMemo(() => makeBoard(round.seed, round.params.calls), [round.seed, round.params.calls]);
  const t0 = useRef(performance.now() + (round.startAt ? Math.max(0, round.startAt - Date.now()) : 0));
  const taps = useRef<Tap[]>([]);
  const sent = useRef(false);
  const streak = useRef(0);
  const doneLines = useRef<Set<number>>(new Set());
  const [el, setEl] = useState(0);
  const [msg, setMsg] = useState<{ text: string; tone: "info" | "good" | "bad" | "gold" }>({ text: "", tone: "info" });
  const [lastPts, setLastPts] = useState<number | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [glow, setGlow] = useState<number[]>([]);
  const [scoring, setScoring] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [showTip, setShowTip] = useState(() => { try { return tips && Number(localStorage.getItem("ba_tip_rounds") ?? 0) < 2; } catch { return false; } });
  const closeTip = () => { setShowTip(false); try { localStorage.setItem("ba_tip_rounds", "2"); } catch { /* ignore */ } };

  const finish = async () => {
    setScoring(true);
    try { localStorage.setItem("ba_tip_rounds", String(Number(localStorage.getItem("ba_tip_rounds") ?? 0) + 1)); } catch { /* ignore */ }
    if (round.local) {
      const s = scoreTaps(round.seed, p, taps.current);
      onDone({ ...s, missed: missedCount(round.seed, p, s.marked, totalMs), win: false, prize: 0, xp: 0, ghost: null, best: null, balance: 0, level: 1, achievements: [], mode: "local" }, p);
      return;
    }
    try {
      const r = await callFn<RoundResult>("submit-round", { roundId: round.roundId, taps: taps.current });
      onDone(r, p);
    } catch (e) { onError(errorText((e as Error).message)); }
  };

  const leave = async () => {
    sent.current = true;
    if (!round.local) try { await callFn("submit-round", { roundId: round.roundId, abandon: true }); } catch { /* the server also expires stale rounds */ }
    onLeave();
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    const id = setInterval(() => {
      const e = performance.now() - t0.current;
      setEl(Math.min(e, totalMs));
      if (e >= totalMs && !sent.current) { sent.current = true; clearInterval(id); void finish(); }
    }, 100);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 900); return () => clearTimeout(t); }, [flash]);
  useEffect(() => { if (!glow.length) return; const t = setTimeout(() => setGlow([]), 1200); return () => clearTimeout(t); }, [glow]);

  const live = scoreTaps(round.seed, p, taps.current);
  const pre = el < 0;
  const now = Math.max(0, el);
  const idx = currentIndex(now, p.every, seq.length);
  const last = seq[idx];
  const left = Math.min(p.total, Math.max(0, totalMs - el) / 1000);
  const mult = multiplier(streak.current, step, maxM);
  const toNext = mult >= maxM ? 0 : (Math.floor(streak.current / step) + 1) * step - streak.current;
  const pips = mult >= maxM ? step : streak.current % step;
  // the numbers that can still be tapped, newest first, each with how much of its time is left
  const onBoard = Array.from({ length: Math.min(p.win, idx + 1) }, (_, j) => {
    const k = idx - j, n = seq[k];
    const rest = Math.max(0, Math.min(1, ((k + p.win) * p.every - now) / (p.win * p.every)));
    const ci = card.indexOf(n);
    return { n, rest, j, daubed: ci >= 0 && live.marked[ci] };
  });
  const nextIn = 1 - (now % p.every) / p.every; // the ring around the ball
  // rows and columns that need one more number (Beginner and Medium)
  const almost = lineHints ? LINES.map((ln, k) => ({ k, n: ln.filter((x) => live.marked[x]).length })).filter((x) => x.n === 4 && x.k < 10) : [];

  const tap = (i: number) => {
    if (sent.current || live.marked[i]) return;
    const t = Math.round(performance.now() - t0.current);
    if (t < 0) return; // the match has not started yet
    const prev = taps.current[taps.current.length - 1];
    if (prev && t - prev.t < 100) return; // ignore accidental double taps (the server rejects superhuman speed)
    const before = live.score;
    taps.current = [...taps.current, { i, t }];
    const after = scoreTaps(round.seed, p, taps.current);
    const st = status(seq, card[i], t, p);
    const id = Date.now();
    if (st === "live") {
      streak.current += 1;
      const pts = after.score - before;
      setLastPts(pts);
      setFlash({ i, kind: "good", pts, id });
      const newLines = LINES.map((ln, k) => ({ ln, k })).filter(({ ln, k }) => !doneLines.current.has(k) && ln.every((x) => after.marked[x]));
      if (newLines.length) {
        newLines.forEach(({ k }) => doneLines.current.add(k));
        setGlow(newLines.flatMap(({ ln }) => ln));
        setMsg({ text: `LINE! +${Math.round(50 * p.pt * (p.lineMul ?? 1)) * newLines.length} bonus points`, tone: "gold" });
      } else {
        const m = multiplier(streak.current, step, maxM);
        const nx = m >= maxM ? 0 : (Math.floor(streak.current / step) + 1) * step - streak.current;
        setMsg({ text: streak.current < 2 ? "Good tap!" : m >= maxM ? `${streak.current} in a row. Top combo x${m}!` : `Nice! ${streak.current} in a row. ${nx} more for x${m + 1}.`, tone: "good" });
      }
    } else {
      streak.current = 0;
      setLastPts(after.score - before);
      setFlash({ i, kind: st === "late" ? "late" : "wrong", id });
      setMsg({ text: st === "late" ? "That number already left the board. Combo reset." : "Not called yet. Combo reset.", tone: "bad" });
    }
    setEl(Math.min(performance.now() - t0.current, totalMs));
  };

  const modeName = round.local ? "Free round" : round.opponent ? "Live match" : p.ghost != null ? "Beat the Ghost" : p.goals ? (p.label || "Stage") : (p.label || "Practice");
  const levelText = LEVEL_NAME[level] ? ` · ${LEVEL_NAME[level]}` : "";
  const sub = round.opponent ? `vs ${round.opponent}` : p.ghost != null ? `Ghost ${Math.round(p.ghost * (now / totalMs))}` : lastPts !== null ? `${lastPts >= 0 ? "+" : ""}${lastPts} last tap` : "";

  return (
    <section id="play" className="v2">
      {pre && <div className="countdown" role="status" aria-live="polite"><div>{Math.ceil(-el / 1000)}</div><span>Get ready{round.opponent ? ` · vs ${round.opponent}` : ""}</span></div>}

      <div className="pl-top">
        {leaving ? (
          <div className="pl-confirm">
            <span>{round.local || !p.fee ? "Leave this round? It will not count." : "Leave this round? The entry fee is not refunded."}</span>
            <span className="row2"><button className="btn alt" onClick={() => setLeaving(false)}>Keep playing</button><button className="btn" onClick={() => void leave()}>Leave</button></span>
          </div>
        ) : (
          <>
            <button className="pl-leave" disabled={scoring} onClick={() => setLeaving(true)} aria-label="Leave round">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
              <span className="desk">Leave</span>
            </button>
            <div className="pl-mtime mob">
              <div className="pl-mtl"><span>{modeName}{levelText}</span><b>{Math.ceil(left)} s left</b></div>
              <div className="pl-bar"><i style={{ width: `${(left / p.total) * 100}%` }} /></div>
            </div>
            <div className="pl-mscore mob"><b>{live.score}</b><span>{round.opponent || p.ghost != null ? sub : "score"}</span></div>
            <span className="pl-pill desk">{modeName}{levelText}</span>
          </>
        )}
      </div>

      {showTip && (
        <div className="tipbar" role="note">
          <span>Tap the number on your card that matches the ball. Only the last {p.win} numbers can still be tapped. Correct taps in a row build a combo.</span>
          <button className="btn alt" style={{ minHeight: 36, padding: "4px 12px" }} onClick={closeTip}>Got it</button>
        </div>
      )}

      <div className="pl-stats desk">
        <div className="pl-tile"><span className="pl-k">Time left</span><b>{Math.ceil(left)}<small> s</small></b><div className="pl-bar"><i style={{ width: `${(left / p.total) * 100}%` }} /></div></div>
        <div className="pl-tile"><span className="pl-k">Score</span><b>{live.score}</b><span className={`pl-sub ${lastPts !== null && lastPts < 0 && !round.opponent && p.ghost == null ? "neg" : ""}`}>{sub || " "}</span></div>
        <div className="pl-tile"><span className="pl-k">Combo</span><b className="gold">x{mult}</b><span className="pl-pips" role="img" aria-label={toNext ? `${toNext} more correct taps for x${mult + 1}` : "Top combo"}>{Array.from({ length: step }, (_, k) => <i key={k} className={k < pips ? "on" : ""} />)}</span></div>
      </div>

      {p.goals && (
        <div className="goals pl-goals" aria-label="Star goals">
          {p.goals.map((g, i) => <span key={i} className={live.score >= g ? "got" : ""}><Ic n="star" c="star" />{i + 1} · {g}</span>)}
          {p.label ? <span className="tag">{p.label}</span> : null}
        </div>
      )}

      <div className="pl-ball">
        <div className="pl-orb">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="46" className="trk" />
            <circle cx="50" cy="50" r="46" className="run" strokeDasharray="289" strokeDashoffset={289 * (1 - nextIn)} transform="rotate(-90 50 50)" />
          </svg>
          <div className="ball2 roll" key={idx} aria-hidden="true"><small>{label(last)[0]}</small>{last}</div>
        </div>
        <span className="sr-live" role="status" aria-live="polite">Number {label(last)}</span>
        <div className="pl-calls">
          <span className="pl-k desk">Just called</span>
          <b className="pl-ask">{beginner ? <>Look in column <em>{label(last)[0]}</em></> : "Is it on your card?"}</b>
          <span className="pl-k">Still on the board</span>
          <div className="pl-chips">
            {onBoard.map((c) => (
              <div key={c.n} className={`pl-chip ${c.j === 0 ? "new" : ""} ${c.j === p.win - 1 && !c.daubed ? "bye" : ""} ${c.daubed ? "done" : ""}`}>
                <div className="pl-ct"><b>{label(c.n)}</b>{c.daubed ? <span className="ok" aria-label="daubed">✓</span> : c.j === 0 ? <span className="tg">NEW</span> : c.j === p.win - 1 ? <span className="tg">LEAVING</span> : null}</div>
                <div className="pl-fuse"><i style={{ width: `${c.rest * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="pl-card">
        <div className="pl-hd" aria-hidden="true">{[...L].map((x) => <span key={x}>{x}</span>)}</div>
        <div className="pl-cells">
          {card.map((v, i) => {
            const f = flash && flash.i === i ? flash : null;
            return (
              <button key={i} disabled={scoring || !v}
                className={`cell ${live.marked[i] ? "m" : ""} ${p.hint && !live.marked[i] && v && v === last ? "hint" : ""} ${f ? "f-" + f.kind : ""} ${glow.includes(i) ? "glow" : ""}`}
                aria-label={`${v ? label(v) : "free space"}${live.marked[i] ? ", daubed" : ""}`} onClick={() => tap(i)}>
                {live.marked[i] ? <span className="dab">{v || "★"}</span> : v || "★"}
                {f?.kind === "good" && f.pts ? <span className="pop" key={f.id}>+{f.pts}</span> : null}
                {f?.kind === "wrong" ? <span className="why" key={f.id}>Not called yet</span> : null}
                {f?.kind === "late" ? <span className="why late" key={f.id}>Already left</span> : null}
              </button>
            );
          })}
          {almost.map(({ k }) => {
            const row = k % 2 === 0, n = Math.floor(k / 2);
            return <span key={k} className={`togo ${row ? "r" : "c"}`} style={row ? { top: `${(n + 0.5) * 20}%` } : { left: `${(n + 0.5) * 20}%` }}>1 to go</span>;
          })}
        </div>
      </div>

      <div className={`pl-feed t-${msg.tone}`} role="status">
        <b className="pl-mx mob">x{mult}</b>
        <div className="pl-ft">
          <span>{scoring ? "Scoring your round…" : msg.text || (beginner ? "Find the called number on your card and tap it." : "Tap called numbers on your card. Look before you tap.")}</span>
          <span className="pl-pips mob" aria-hidden="true">{Array.from({ length: step }, (_, k) => <i key={k} className={k < pips ? "on" : ""} />)}</span>
        </div>
      </div>
    </section>
  );
}
