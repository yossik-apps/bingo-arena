import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { currentIndex, LINES, makeBoard, multiplier, scoreTaps, status, type Params, type Tap } from "@engine";
import { Ball, letterOf, NumberBall } from "./Ball";
import { Icon } from "./Icon";
import { unlocked } from "../lib/levels";
import type { Speed } from "./Lobby";
import type { Boost } from "./data";
import { buzz, sfx, speak, stopSpeech } from "./sound";
import { SoundButton } from "./SoundControl";

export type RoundSummary = {
  score: number; daubs: number; lines: number; wrong: number; accuracy: number; seconds: number; speed: Speed; rival?: { name: string; target: number; won: boolean };
  /** the board this round was played on, so it can be shared as a challenge */
  seed: number; marked: boolean[]; bestStreak: number;
};

// The same pace table idea as the real levels: slower calls and a wider window for beginners.
const PACE: Record<Speed, { every: number; win: number; pt: number }> = {
  chill: { every: 4000, win: 5, pt: 1 },
  normal: { every: 3000, win: 4, pt: 1.2 },
  fast: { every: 2200, win: 3, pt: 1.5 },
};

const CIRC = 2 * Math.PI * 58;

/** A playable round of the E design. It scores with the real game engine, on this device, and sends nothing to a server. */
export default function Game({ level, speed, firstRound, rival, boost, dab, seed: fixedSeed, wide, label, onDone, onLeave }: { /** the desktop layout: three columns on a wide screen */ wide?: boolean; label?: string; level: number; speed: Speed; firstRound: boolean; rival?: { name: string; target: number }; boost?: Boost | null; dab?: string[]; seed?: number; onDone: (r: RoundSummary) => void; onLeave: () => void }) {
  const combos = unlocked("combos", level);
  const total = firstRound ? 60 : 100;
  const p: Params & { total: number } = useMemo(() => ({
    every: Math.round(PACE[speed].every * (boost === "slow" ? 1.35 : 1)), win: PACE[speed].win, pt: PACE[speed].pt * (boost === "x2" ? 2 : 1), pen: 5, hint: speed === "chill" || boost === "hint", xm: 1, fee: 0, gl: 0, gr: 0,
    maxMult: combos ? 3 : 1, total,
  }), [speed, combos, total, boost]);
  const seed = useMemo(() => fixedSeed ?? (Math.floor(Math.random() * 2 ** 30) + 1), [fixedSeed]);
  const { card, seq } = useMemo(() => makeBoard(seed), [seed]);
  const t0 = useRef(performance.now() + 3000); // three seconds of "get ready"
  const taps = useRef<Tap[]>([]);
  const streak = useRef(0);
  const doneLines = useRef<Set<number>>(new Set());
  const finished = useRef(false);
  const [el, setEl] = useState(-3000);
  const [msg, setMsg] = useState("");
  const [lastPts, setLastPts] = useState<number | null>(null);
  const [flash, setFlash] = useState<{ i: number; kind: "good" | "wrong"; pts?: number; id: number } | null>(null);
  const [glow, setGlow] = useState<number[]>([]);
  const totalMs = total * 1000;

  useEffect(() => {
    const id = setInterval(() => {
      const e = performance.now() - t0.current;
      setEl(Math.min(e, totalMs));
      if (e >= totalMs && !finished.current) {
        finished.current = true;
        clearInterval(id);
        const s = scoreTaps(seed, p, taps.current);
        onDone({ score: s.score, daubs: s.daubs, lines: s.lines, wrong: s.wrong + s.late, accuracy: s.accuracy, seconds: total, speed, seed, marked: s.marked, bestStreak: s.maxStreak, rival: rival ? { name: rival.name, target: rival.target, won: s.score > rival.target } : undefined });
      }
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 900); return () => clearTimeout(t); }, [flash]);
  useEffect(() => { if (!glow.length) return; const t = setTimeout(() => setGlow([]), 1400); return () => clearTimeout(t); }, [glow]);

  const live = scoreTaps(seed, p, taps.current);
  const pre = el < 0;
  const now = Math.max(0, el);
  const idx = currentIndex(now, p.every, seq.length);
  const dropped = useRef(-1);
  const last = seq[idx];
  useEffect(() => { if (el >= 0 && idx !== dropped.current) { dropped.current = idx; sfx("drop"); speak(letterOf(last), last, speed); } });
  useEffect(() => stopSpeech, []);
  const left = Math.min(total, Math.max(0, totalMs - el) / 1000);
  const mult = multiplier(streak.current, 4, p.maxMult ?? 3);
  const onBoard = Array.from({ length: Math.min(p.win, idx + 1) }, (_, j) => {
    const k = idx - j, n = seq[k];
    const rest = Math.max(0, Math.min(1, ((k + p.win) * p.every - now) / (p.win * p.every)));
    const ci = card.indexOf(n);
    return { n, rest, j, daubed: ci >= 0 && live.marked[ci] };
  });
  const nextIn = 1 - (now % p.every) / p.every;
  const rivalNow = rival ? Math.round(rival.target * Math.min(1, now / totalMs) * (1 + 0.06 * Math.sin(now / 1800))) : 0;

  const tap = (i: number) => {
    if (finished.current || live.marked[i] || !card[i]) return;
    const t = Math.round(performance.now() - t0.current);
    if (t < 0) return;
    const prev = taps.current[taps.current.length - 1];
    if (prev && t - prev.t < 100) return;
    const before = live.score;
    taps.current = [...taps.current, { i, t }];
    const after = scoreTaps(seed, p, taps.current);
    const st = status(seq, card[i], t, p);
    const id = Date.now();
    if (st === "live") {
      streak.current += 1;
      const pts = after.score - before;
      setLastPts(pts);
      setFlash({ i, kind: "good", pts, id });
      const fresh = LINES.map((ln, k) => ({ ln, k })).filter(({ ln, k }) => !doneLines.current.has(k) && ln.every((x) => after.marked[x]));
      sfx(fresh.length ? "line" : "good");
      buzz(fresh.length ? [20, 30, 40] : 12);
      if (fresh.length) {
        fresh.forEach(({ k }) => doneLines.current.add(k));
        setGlow(fresh.flatMap(({ ln }) => ln));
        setMsg("BINGO! A line is done.");
      } else {
        const m = multiplier(streak.current, 4, 3);
        const need = 4 - (streak.current % 4);
        setMsg(!combos ? "Good tap!" : m >= 3 ? "Top combo x3!" : `Nice! ${need} more for x${m + 1}.`);
      }
    } else {
      streak.current = 0;
      sfx("wrong");
      buzz([30, 40, 30]);
      setLastPts(after.score - before);
      setFlash({ i, kind: "wrong", id });
      setMsg(st === "late" ? "That number already left the board." : "Not called yet. Look again.");
    }
    setEl(Math.min(performance.now() - t0.current, totalMs));
  };

  const letter = letterOf(last);
  /** the desktop round: called numbers on the left, the card in the middle, score and combo on the right */
  function wideRound() {
    const pips = combos ? (mult >= 3 ? 4 : streak.current % 4) : 0;
    const top = Math.max(live.score, rivalNow, 1);
    const panel: CSSProperties = { borderRadius: 24, padding: "16px 18px" };
    return (
      <div className="e-root e-desk e-hero-bg" style={dab ? ({ "--d1": dab[0], "--d2": dab[1], "--d3": dab[2] } as CSSProperties) : undefined}>
        {pre && (
          <div role="status" aria-live="polite" style={{ position: "absolute", inset: 0, zIndex: 30, background: "rgba(14,62,156,.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <span className="e-ld" style={{ fontSize: 160, lineHeight: 1 }}>{Math.ceil(-el / 1000)}</span>
            <span style={{ fontSize: 22, fontWeight: 900 }}>Get ready</span>
          </div>
        )}
        <header style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 28px", flexShrink: 0 }}>
          <button aria-label="Leave round" onClick={onLeave} className="e-white" style={{ width: 52, height: 52, border: 0, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon name="back" size={24} sw={3} />
          </button>
          <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span className="e-ld" style={{ fontSize: 24, lineHeight: 1.1 }}>{label ?? "Practice"}</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#DCE7FF" }}>{speed[0].toUpperCase() + speed.slice(1)} speed · {total} seconds</span>
          </span>
          <div role="timer" aria-label={`${Math.ceil(left)} seconds left`} className="e-panel" style={{ flex: 1, maxWidth: 560, marginLeft: "auto", height: 52, boxShadow: "none", borderRadius: 16, padding: "6px 16px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 5 }}>
            <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}><span className="e-ld" style={{ fontSize: 24, lineHeight: 1 }}>{Math.ceil(left)}</span><span style={{ fontSize: 13, fontWeight: 800, color: "#DCE7FF" }}>seconds left</span></span>
            <span aria-hidden="true" style={{ display: "block", height: 8, borderRadius: 99, background: "#0B2C6E", overflow: "hidden" }}><span style={{ display: "block", width: `${(left / total) * 100}%`, height: "100%", background: "#FFC531", borderRadius: 99 }} /></span>
          </div>
          <SoundButton />
        </header>

        <main className="e-desk-round">
          <section aria-label="Called number" className="e-panel" style={{ ...panel, display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="e-desk-call" style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ position: "relative", width: 150, height: 150, flexShrink: 0 }}>
                <svg width="150" height="150" viewBox="0 0 124 124" aria-hidden="true" style={{ position: "absolute", left: 0, top: 0 }}>
                  <circle cx="62" cy="62" r="58" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="6" />
                  <circle cx="62" cy="62" r="58" fill="none" stroke="#FFC531" strokeWidth="6" strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - nextIn)} transform="rotate(-90 62 62)" />
                </svg>
                <div key={idx} className="e-drop" style={{ position: "absolute", left: 15, top: 15 }}><NumberBall n={last} size={120} /></div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 900, color: "#DCE7FF" }}>Just called</span>
                <span className="e-ld" style={{ fontSize: 36, lineHeight: 1 }}>{p.hint ? <>Look in <span style={{ color: "#7CF0A8" }}>{letter}</span></> : `${letter}${last}`}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#DCE7FF" }}>{p.hint ? `Find ${last} on your card` : "Is it on your card?"}</span>
              </div>
            </div>
            <div className="e-onboard" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 900, color: "#DCE7FF" }}>Still on the board</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {onBoard.map((c) => (
                <div key={c.n} style={{ display: "flex", alignItems: "center", gap: 12, height: 48 }}>
                  <NumberBall n={c.n} size={46} style={{ opacity: c.daubed ? 0.5 : 1, flexShrink: 0 }} />
                  <span aria-hidden="true" style={{ flex: 1, height: 8, borderRadius: 9, background: "#0B2C6E", overflow: "hidden" }}><span style={{ display: "block", width: `${c.rest * 100}%`, height: "100%", background: "#FFC531" }} /></span>
                  <span style={{ width: 62, textAlign: "right", fontSize: 12, fontWeight: 900, color: c.daubed ? "#7CF0A8" : c.j === p.win - 1 ? "#FFC531" : "#fff" }}>
                    {c.daubed ? "DONE" : c.j === 0 ? "NEW" : c.j === p.win - 1 ? "LEAVING" : ""}
                  </span>
                </div>
              ))}
            </div>
            </div>
          </section>

          <section aria-label="Your card" className="e-white e-desk-card" style={{ padding: 12 }}>
            <div aria-hidden="true" style={{ display: "grid", gridTemplateColumns: "repeat(5, var(--cell))", gap: 8, marginBottom: 10 }}>
              {"BINGO".split("").map((L) => (
                <span key={L} style={{ display: "flex", justifyContent: "center" }}>
                  <Ball tone={L as "B"} mode="l" letter={L} size={46} style={p.hint && L === letter ? { filter: "drop-shadow(0 0 7px #FFC531)" } : undefined} />
                </span>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, var(--cell))", gap: 8 }}>{cells}</div>
          </section>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="e-white" style={{ ...panel, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <span className="e-sub" style={{ fontSize: 13, fontWeight: 900 }}>Score</span>
              <span className="e-ld" style={{ fontSize: 72, lineHeight: 1 }}>{live.score}</span>
              {lastPts !== null && lastPts !== 0 && <span className="e-ld" style={{ fontSize: 18, color: lastPts > 0 ? "#1B8A55" : "#D6336C" }}>{lastPts > 0 ? `+${lastPts}` : lastPts}</span>}
            </div>
            {combos && (
              <div className="e-panel" style={{ ...panel, boxShadow: "none", display: "flex", alignItems: "center", gap: 14 }}>
                <span className="e-ld" style={{ fontSize: 48, color: "#FFC531", lineHeight: 1 }}>x{mult}</span>
                <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 900, color: "#DCE7FF" }}>Combo</span>
                  <span aria-hidden="true" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 5 }}>
                    {[0, 1, 2, 3].map((k) => <span key={k} style={{ height: 10, borderRadius: 99, background: k < pips ? "#FFC531" : "#0B2C6E" }} />)}
                  </span>
                </span>
              </div>
            )}
            {rival && (
              <div className="e-panel" style={{ ...panel, boxShadow: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 900, color: "#DCE7FF" }}>Race</span>
                {[{ n: "You", v: live.score, c: "#2EB872" }, { n: rival.name, v: rivalNow, c: "#D6336C" }].map((r) => (
                  <span key={r.n} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 900 }}>
                    <span style={{ width: 70, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.n}</span>
                    <span aria-hidden="true" style={{ flex: 1, height: 10, borderRadius: 99, background: "#0B2C6E", overflow: "hidden" }}><span style={{ display: "block", width: `${(r.v / top) * 100}%`, height: "100%", background: r.c, transition: "width .3s" }} /></span>
                    <span style={{ width: 38, textAlign: "right" }}>{r.v}</span>
                  </span>
                ))}
              </div>
            )}
            <div role="status" className="e-panel" style={{ ...panel, boxShadow: "none", minHeight: 76, display: "flex", alignItems: "center", fontSize: 16, fontWeight: 900, lineHeight: 1.3 }}>
              {msg || (p.hint ? "Find the glowing number and click it." : "Click the called numbers on your card.")}
            </div>
          </div>
        </main>
      </div>
    );
  }

  const cells = card.map((v, i) => {
            const L = v ? letterOf(v) : "";
            const f = flash && flash.i === i ? flash : null;
            if (!v) return <span key={i} className="e-cell" role="img" aria-label="Free space" style={{ background: "#FFC531", boxShadow: "0 3px 0 #D98E00" }}><Icon name="star" size={30} color="#fff" fill="#fff" sw={1} /></span>;
            if (live.marked[i]) return <span key={i} className={`e-cell ${glow.includes(i) ? "e-glow" : ""}`} role="img" aria-label={`${L}${v}, marked`}><span className="e-dab" style={{ transform: `rotate(${(v * 7) % 17 - 8}deg)` }}>{v}</span></span>;
            const hint = p.hint && v === last;
            return (
              <button key={i} className={`e-cell ${hint ? "e-hint" : ""} ${f?.kind === "wrong" ? "e-wrong" : ""}`} aria-label={`${L}${v}`} onClick={() => tap(i)}>
                {v}
                {f?.kind === "good" && f.pts ? <span className="e-pop" key={f.id}>+{f.pts}</span> : null}
              </button>
            );
          });
  if (wide) return wideRound();
  return (
    <div className="e-root" style={{ padding: "14px 16px 0", ...(dab ? ({ "--d1": dab[0], "--d2": dab[1], "--d3": dab[2] } as CSSProperties) : null) }}>
      {pre && (
        <div role="status" aria-live="polite" style={{ position: "absolute", inset: 0, zIndex: 30, background: "rgba(14,62,156,.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <span className="e-ld" style={{ fontSize: 120, lineHeight: 1 }}>{Math.ceil(-el / 1000)}</span>
          <span style={{ fontSize: 18, fontWeight: 900 }}>Get ready</span>
        </div>
      )}
      <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
        <button aria-label="Leave round" onClick={onLeave} style={{ width: 52, height: 52, flexShrink: 0, border: 0, borderRadius: 16, background: "#fff", boxShadow: "0 4px 0 #0E3E9C", display: "flex", alignItems: "center", justifyContent: "center", color: "#14254F" }}>
          <Icon name="back" size={24} sw={3} />
        </button>
        <div role="timer" aria-label={`${Math.ceil(left)} seconds left`} className="e-panel" style={{ flex: 1, height: 52, boxShadow: "none", borderRadius: 16, padding: "6px 12px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 5 }}>
          <span style={{ display: "flex", alignItems: "baseline", gap: 4 }}><span className="e-ld" style={{ fontSize: 22, lineHeight: 1 }}>{Math.ceil(left)}</span><span style={{ fontSize: 12, fontWeight: 800, color: "#DCE7FF" }}>seconds left</span></span>
          <span aria-hidden="true" style={{ display: "block", height: 8, borderRadius: 99, background: "#0B2C6E", overflow: "hidden" }}><span style={{ display: "block", width: `${(left / total) * 100}%`, height: "100%", background: "#FFC531", borderRadius: 99 }} /></span>
        </div>
        <SoundButton />
        <div className="e-white" style={{ width: 84, height: 52, borderRadius: 16, boxShadow: "0 4px 0 #0E3E9C", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span className="e-sub" style={{ fontSize: 12, fontWeight: 900 }}>Score</span>
          <span className="e-ld" style={{ fontSize: 24, lineHeight: 1 }}>{live.score}</span>
        </div>
      </div>

      <section aria-label="Called number" className="e-panel" style={{ marginTop: 12, borderRadius: 24, padding: "12px 14px 10px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ position: "relative", width: 124, height: 124, flexShrink: 0 }}>
            <svg width="124" height="124" viewBox="0 0 124 124" aria-hidden="true" style={{ position: "absolute", left: 0, top: 0 }}>
              <circle cx="62" cy="62" r="58" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="6" />
              <circle cx="62" cy="62" r="58" fill="none" stroke="#FFC531" strokeWidth="6" strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - nextIn)} transform="rotate(-90 62 62)" />
            </svg>
            <div key={idx} className="e-drop" style={{ position: "absolute", left: 12, top: 12 }}><NumberBall n={last} size={100} /></div>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={{ fontSize: 12, fontWeight: 900, color: "#DCE7FF" }}>Just called</span>
            <span className="e-ld" style={{ fontSize: 30, lineHeight: 1 }}>{p.hint ? <>Look in <span style={{ color: "#7CF0A8" }}>{letter}</span></> : `${letter}${last}`}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#DCE7FF" }}>{p.hint ? `Find ${last} on your card` : "Is it on your card?"}</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 900, color: "#DCE7FF" }}>Still on the board</span>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${p.win}, minmax(0, 1fr))`, justifyItems: "center", minHeight: 94 }}>
            {onBoard.map((c) => (
              <div key={c.n} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                <NumberBall n={c.n} size={p.win > 4 ? 52 : 56} style={{ opacity: c.daubed ? 0.5 : 1 }} />
                <span aria-hidden="true" style={{ display: "block", width: 48, height: 6, borderRadius: 9, background: "#0B2C6E", overflow: "hidden" }}><span style={{ display: "block", width: `${c.rest * 100}%`, height: "100%", background: "#FFC531" }} /></span>
                <span style={{ height: 14, lineHeight: "14px", fontSize: 12, fontWeight: 900, color: c.daubed ? "#7CF0A8" : c.j === p.win - 1 ? "#FFC531" : "#fff" }}>
                  {c.daubed ? "DONE" : c.j === 0 ? "NEW" : c.j === p.win - 1 ? "LEAVING" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-label="Your card" className="e-white" style={{ marginTop: 12, padding: 10 }}>
        <div aria-hidden="true" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 6, marginBottom: 8 }}>
          {"BINGO".split("").map((L) => (
            <span key={L} style={{ display: "flex", justifyContent: "center" }}>
              <Ball tone={L as "B"} mode="l" letter={L} size={44} style={p.hint && L === letter ? { filter: "drop-shadow(0 0 7px #FFC531)" } : undefined} />
            </span>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 6 }}>
          {cells}
        </div>
      </section>

      <div role="status" className="e-panel" style={{ marginTop: 12, height: 56, boxShadow: "none", borderRadius: 18, padding: "0 14px", display: "flex", alignItems: "center", gap: 12 }}>
        {combos && <span className="e-ld" style={{ fontSize: 26, color: "#FFC531", lineHeight: 1 }}>x{mult}</span>}
        {!combos && lastPts !== null && lastPts > 0 && <span className="e-ld" style={{ fontSize: 26, color: "#FFC531", lineHeight: 1 }}>+{lastPts}</span>}
        <span style={{ fontSize: 15, fontWeight: 900, lineHeight: 1.25, flex: 1, minWidth: 0 }}>{msg || (p.hint ? "Find the glowing number and tap it." : "Tap the called numbers on your card.")}</span>
        {rival && <span className="e-tag" style={{ background: live.score >= rivalNow ? "#2EB872" : "#D6336C", whiteSpace: "nowrap", padding: "4px 10px", fontSize: 13 }}>{rival.name} {rivalNow}</span>}
      </div>
    </div>
  );
}
