import { useEffect, useMemo, useRef, useState } from "react";
import { currentIndex, makeBoard, scoreTaps, status, type Params, type Tap } from "@engine";
import { callFn, errorText } from "../lib/supabase";
import { label, L } from "../lib/ui";

export type RoundStart = { roundId: string; seed: number; balance: number; params: Params & { total: number; pay: number; ghost: number | null } };
export type RoundResult = {
  score: number; daubs: number; wrong: number; late: number; lines: number; maxMult: number; accuracy: number;
  avgReactionMs: number | null; win: boolean; prize: number; xp: number; ghost: number | null; best: number | null;
  balance: number; level: number;
};

export default function Play({ round, onDone, onError }: { round: RoundStart; onDone: (r: RoundResult, p: RoundStart["params"]) => void; onError: (m: string) => void }) {
  const p = round.params;
  const totalMs = p.total * 1000;
  const { card, seq } = useMemo(() => makeBoard(round.seed), [round.seed]);
  const t0 = useRef(performance.now());
  const taps = useRef<Tap[]>([]);
  const sent = useRef(false);
  const [el, setEl] = useState(0);
  const [msg, setMsg] = useState("Get ready…");
  const [scoring, setScoring] = useState(false);
  const [shake, setShake] = useState(-1);

  const finish = async () => {
    setScoring(true);
    try {
      const r = await callFn<RoundResult>("submit-round", { roundId: round.roundId, taps: taps.current });
      onDone(r, p);
    } catch (e) { onError(errorText((e as Error).message)); }
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

  const live = scoreTaps(round.seed, p, taps.current);
  const idx = currentIndex(el, p.every, seq.length);
  const last = seq[idx];
  const board = seq.slice(Math.max(0, idx - p.win + 1), idx + 1).reverse();
  const left = Math.max(0, totalMs - el) / 1000;

  const tap = (i: number) => {
    if (sent.current || live.marked[i]) return;
    const t = Math.round(performance.now() - t0.current);
    const prev = taps.current[taps.current.length - 1];
    if (prev && t - prev.t < 100) return; // ignore accidental double taps (the server rejects superhuman speed)
    taps.current = [...taps.current, { i, t }];
    const st = status(seq, card[i], t, p);
    if (st === "live") setMsg("");
    else { setMsg(st === "late" ? "That one already left the board." : "Not called yet."); setShake(i); setTimeout(() => setShake(-1), 300); }
    setEl(Math.min(performance.now() - t0.current, totalMs));
  };

  return (
    <section id="play">
      <div className="hud">
        <div className="stat"><b>{Math.ceil(left)}</b><span>seconds</span></div>
        <div className="stat"><b>{live.score}</b><span>you</span></div>
        <div className="stat"><b>{p.ghost != null ? Math.round(p.ghost * (el / totalMs)) : "–"}</b><span>{p.ghost != null ? "ghost" : "practice"}</span></div>
      </div>
      <div className="bar"><i style={{ width: `${(left / p.total) * 100}%` }} /></div>
      <div className="stage">
        <div className="ball roll" key={idx}>{label(last)}</div>
        <div>
          <div className="hist">On the board: {board.map((n, k) => <span key={n} className={`chip ${k ? "old" : ""}`}>{label(n)}</span>)}</div>
          <p className="msg" role="status">{scoring ? "Scoring your round…" : msg}</p>
        </div>
      </div>
      <div className="card">
        <div className="grid">
          {[...L].map((x) => <div className="hd" key={x}>{x}</div>)}
          {card.map((v, i) => (
            <button key={i} disabled={scoring}
              className={`cell ${live.marked[i] ? "m" : ""} ${p.hint && !live.marked[i] && v && v === last ? "hint" : ""} ${shake === i ? "shake" : ""}`}
              aria-label={`${v ? label(v) : "free space"}${live.marked[i] ? ", daubed" : ""}`} onClick={() => tap(i)}>
              {v || "★"}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
