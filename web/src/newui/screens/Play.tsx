// The round itself. Same timing, taps and submission as Classic Play (views/Play.tsx); the server scores the round through ctx.rounds.submit.
// Uses: profile, wallet, rounds, settings
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { currentIndex, makeBoard, scoreTaps, status, type Tap } from "@engine";
import type { RoundStart } from "../../views/Play";
import { Ball, NumberBall, type Tone } from "../Ball";
import { Button, Chip, EmptyState, ProgressBar } from "../components";
import { Icon } from "../Icon";
import type { RoundsGroup, ScreenProps } from "./contract";
import {
  almostLines, combo, goodText, idleText, ignoresTap, label, leaveText, letter, levelText, lineText, lookFor, missText, modeName, newLines,
  onBoard, roundLevel, SCORING, scoreSub, showsLineHints, showsTip, TIP_KEY, tipText,
} from "./Play.logic";
import "./play.css";

type Flash = { i: number; kind: "good" | "wrong" | "late"; pts?: number; id: number };
const CIRC = 2 * Math.PI * 58;
const TAG: Record<string, string> = { new: "NEW", leaving: "LEAVING" };

const tipsSeen = () => { try { return Number(localStorage.getItem(TIP_KEY) ?? 0); } catch { return 2; } };

export default function Play({ ctx }: ScreenProps) {
  const round = ctx.rounds.active;
  if (!round) return <EmptyState title="No round is running" text="Start a round from the Play page." action={<Button onClick={ctx.rounds.leave}>Back to Play</Button>} />;
  return <Round key={`${round.roundId}:${round.seed}`} ctx={ctx} round={round} />;
}

function Round({ ctx, round }: ScreenProps & { round: RoundStart }) {
  const p = round.params;
  const totalMs = p.total * 1000;
  const level = roundLevel(p);
  const beginner = level === "beginner";
  const hints = showsLineHints(level);
  const step = p.comboStep ?? 4, maxM = p.maxMult ?? 3;
  const { card, seq } = useMemo(() => makeBoard(round.seed), [round.seed]);
  const look = useMemo(() => lookFor(ctx.profile?.equipped, ctx.wallet.items), [ctx.profile?.equipped, ctx.wallet.items]);
  // ctx is rebuilt on every render of App; the clock below reads the latest one
  const rounds = useRef<RoundsGroup>(ctx.rounds);
  rounds.current = ctx.rounds;

  const t0 = useRef(performance.now() + (round.startAt ? Math.max(0, round.startAt - Date.now()) : 0));
  const taps = useRef<Tap[]>([]);
  const sent = useRef(false);
  const streak = useRef(0);
  const doneLines = useRef<Set<number>>(new Set());
  const [el, setEl] = useState(() => performance.now() - t0.current);
  const [msg, setMsg] = useState<{ text: string; tone: "info" | "good" | "bad" | "gold" }>({ text: "", tone: "info" });
  const [lastPts, setLastPts] = useState<number | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [glow, setGlow] = useState<number[]>([]);
  const [scoring, setScoring] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [showTip, setShowTip] = useState(() => showsTip(ctx.settings.settings.tips, tipsSeen()));
  const closeTip = () => { setShowTip(false); try { localStorage.setItem(TIP_KEY, "2"); } catch { /* ignore */ } };

  const finish = async () => {
    setScoring(true);
    try { localStorage.setItem(TIP_KEY, String(Number(localStorage.getItem(TIP_KEY) ?? 0) + 1)); } catch { /* ignore */ }
    const r = rounds.current;
    try { r.finish(await r.submit(round.roundId, taps.current), p); } catch (e) { r.fail((e as Error).message); }
  };

  const leave = async () => {
    sent.current = true;
    if (!round.local) await rounds.current.abandon(round.roundId);
    rounds.current.leave();
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
  // Phones: the cells shrink (down to 40 px) so the whole card and the message bar stay on screen, whatever shows above them
  const root = useRef<HTMLDivElement>(null);
  const [cellPx, setCellPx] = useState<number | null>(null);
  // the called number in one row, when the full panel would leave cells under 52 px
  const [compact, setCompact] = useState(false);
  const [size, setSize] = useState(0);
  useEffect(() => {
    const f = () => { setCompact(false); setSize((n) => n + 1); };
    window.addEventListener("resize", f);
    void document.fonts?.ready.then(f);
    return () => window.removeEventListener("resize", f);
  }, []);
  useLayoutEffect(() => {
    const fit = () => {
      const el = root.current, cells = el?.querySelector<HTMLElement>(".nu-pl-cells"), feed = el?.querySelector<HTMLElement>(".nu-pl-feed"), cardEl = el?.querySelector<HTMLElement>(".nu-pl-card");
      if (!el || !cells || !feed || !cardEl || window.innerWidth >= 1000) { setCellPx(null); setCompact(false); return; }
      // a phone on its side (play.css): fixed 46 px cells, the compact call
      if (window.matchMedia("(max-height: 520px) and (orientation: landscape)").matches) { setCellPx(null); setCompact(true); return; }
      const gap = parseFloat(getComputedStyle(cells).rowGap) || 0, between = parseFloat(getComputedStyle(cells.parentElement!.parentElement!).rowGap) || 0;
      const main = el.parentElement, pad = main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 0;
      const below = parseFloat(getComputedStyle(cardEl).paddingBottom) + between + feed.offsetHeight + pad;
      const avail = window.innerHeight - (cells.getBoundingClientRect().top + window.scrollY) - below - 4 * gap;
      const byWidth = (Math.min(window.innerWidth, 560) - 2 * 16 - 2 * parseFloat(getComputedStyle(cardEl).paddingLeft) - 4 * gap) / 5;
      const px = Math.floor(Math.max(44, Math.min(68, byWidth, avail / 5)));
      if (!compact && px < 52 && byWidth >= 52) setCompact(true);
      setCellPx(px);
    };
    fit();
  }, [showTip, leaving, !!p.goals, compact, size]);
  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 900); return () => clearTimeout(t); }, [flash]);
  useEffect(() => { if (!glow.length) return; const t = setTimeout(() => setGlow([]), 1200); return () => clearTimeout(t); }, [glow]);

  // the live score is for display only: the server scores the round
  const live = scoreTaps(round.seed, p, taps.current);
  const pre = el < 0;
  const now = Math.max(0, el);
  const idx = currentIndex(now, p.every, seq.length);
  const last = seq[idx];
  const left = Math.min(p.total, Math.max(0, totalMs - el) / 1000);
  const cmb = combo(streak.current, step, maxM);
  const board = onBoard(seq, card, live.marked, now, p);
  const nextIn = 1 - (now % p.every) / p.every;
  const almost = almostLines(live.marked, hints);
  const name = modeName(round);
  const lvl = levelText(level);
  const sub = scoreSub(round, now, totalMs, lastPts);
  const rival = round.opponent || p.ghost != null;

  // on a short phone the first-rounds tip sits in the message bar until the first tap, so the card keeps its room
  const tipInFeed = showTip && compact;

  const tap = (i: number) => {
    const t = Math.round(performance.now() - t0.current);
    const prev = taps.current[taps.current.length - 1];
    if (ignoresTap({ over: sent.current, marked: live.marked[i], t, prevT: prev ? prev.t : null })) return;
    // the tip in the message bar gives way to the first tap; without it the full called-number panel may fit again
    if (tipInFeed) { setShowTip(false); setCompact(false); }
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
      const lines = newLines(after.marked, doneLines.current);
      if (lines.length) {
        lines.forEach(({ k }) => doneLines.current.add(k));
        setGlow(lines.flatMap(({ ln }) => ln));
        setMsg({ text: lineText(p, lines.length), tone: "gold" });
      } else setMsg({ text: goodText(streak.current, step, maxM), tone: "good" });
    } else {
      streak.current = 0;
      setLastPts(after.score - before);
      setFlash({ i, kind: st === "late" ? "late" : "wrong", id });
      setMsg({ text: missText(st), tone: "bad" });
    }
    setEl(Math.min(performance.now() - t0.current, totalMs));
  };

  const vars = {
    ...(cellPx ? { "--cell": `${cellPx}px` } : null),
    ...(look.daub ? { "--nu-pl-daub": look.daub } : null),
    ...(look.board ? { "--nu-pl-cardbg": look.board.card, "--nu-pl-cell": look.board.cell, "--nu-pl-ink": look.board.ink } : null),
  } as CSSProperties;
  const ballLook = look.ball ? ({ "--c1": `color-mix(in srgb, ${look.ball.bg}, #fff 45%)`, "--c2": look.ball.bg, "--c3": `color-mix(in srgb, ${look.ball.bg}, #000 40%)` } as CSSProperties) : undefined;
  const pips = <span className="nu-pl-pips" role="img" aria-label={cmb.label}>{Array.from({ length: step }, (_, k) => <i key={k} className={k < cmb.pips ? "is-on" : ""} />)}</span>;
  const said = scoring ? SCORING : msg.text || idleText(beginner);
  const L = letter(last);

  return (
    <div ref={root} className={`nu-pl${compact ? " is-compact" : ""}`} style={vars} data-ds={look.style || undefined}>
      {pre && (
        <div className="nu-pl-count" role="status" aria-live="polite">
          <span className="nu-d">{Math.ceil(-el / 1000)}</span>
          <b>Get ready{round.opponent ? ` · vs ${round.opponent}` : ""}</b>
        </div>
      )}

      <header className="nu-pl-top">
        {leaving ? (
          <div className="nu-pl-confirm" role="alertdialog" aria-label="Leave this round?">
            <span>{leaveText(round)}</span>
            <span className="nu-pl-confirmbtns">
              <Button kind="white" size="sm" autoFocus onClick={() => setLeaving(false)}>Keep playing</Button>
              <Button kind="gold" size="sm" onClick={() => void leave()}>Leave</Button>
            </span>
          </div>
        ) : (
          <>
            <Button kind="white" size="md" label="Leave round" disabled={scoring} onClick={() => setLeaving(true)}><Icon name="back" size={24} sw={3} /></Button>
            <span className="nu-pl-name">
              <span className="nu-d" title={name}>{name}</span>
              {lvl && <small>{lvl}</small>}
            </span>
            <div className="nu-pl-timer" role="timer" aria-label={`${Math.ceil(left)} seconds left`} data-must-see="timer">
              <span className="nu-pl-tline" aria-hidden="true"><b className="nu-d">{Math.ceil(left)}</b><span>seconds left</span></span>
              <span className="nu-pl-mode">{name}{lvl ? ` · ${lvl}` : ""}</span>
              <ProgressBar pct={(left / p.total) * 100} label="Time left" dark />
            </div>
            <div className="nu-pl-scorepill">
              <small>Score</small><b className="nu-d">{live.score}</b>
            </div>
          </>
        )}
      </header>

      {showTip && !tipInFeed && (
        <div className="nu-pl-tip" role="note">
          <span>{tipText(p.win)}</span>
          <Button kind="white" size="sm" onClick={closeTip}>Got it</Button>
        </div>
      )}

      {p.goals && (
        <div className="nu-pl-goals" role="group" aria-label="Star goals">
          {p.goals.map((g, i) => (
            <Chip key={i} tone={live.score >= g ? "green" : "dark"}>
              <Icon name="star" size={16} fill="currentColor" sw={1} /> {i + 1} · {g}{live.score >= g ? <span className="nu-pl-sr"> reached</span> : null}
            </Chip>
          ))}
          {p.label ? <span className="nu-pl-goallabel"><Chip tone="gold">{p.label}</Chip></span> : null}
        </div>
      )}

      <div className="nu-pl-round">
        <section className="nu-pl-call" aria-label="Called number">
          <div className="nu-pl-callrow">
            <div className="nu-pl-ring">
              <svg viewBox="0 0 124 124" aria-hidden="true">
                <circle cx="62" cy="62" r="58" className="nu-pl-trk" />
                <circle cx="62" cy="62" r="58" className="nu-pl-run" strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - nextIn)} transform="rotate(-90 62 62)" />
              </svg>
              <span key={idx} className="nu-drop nu-pl-ball" aria-hidden="true"><NumberBall n={last} size={100} style={ballLook} /></span>
            </div>
            <span className="nu-pl-sr" role="status" aria-live="polite">Number {label(last)}</span>
            <div className="nu-pl-ask">
              <small>Just called</small>
              <b className="nu-d">{beginner ? <>Look in column <em>{L}</em></> : label(last)}</b>
              <span>{beginner ? `Find ${last} on your card` : "Is it on your card?"}</span>
            </div>
          </div>
          <div className="nu-pl-onboard">
            <small>Still on the board</small>
            <ul style={{ ["--n" as string]: p.win }}>
              {board.map((c) => (
                <li key={c.n} className={c.daubed ? "is-done" : ""} aria-label={`${label(c.n)}${c.daubed ? ", daubed" : c.tag === "new" ? ", new" : c.tag === "leaving" ? ", leaving" : ""}`}>
                  <NumberBall n={c.n} size={52} />
                  <span className="nu-pl-fuse" aria-hidden="true"><i style={{ width: `${c.rest * 100}%` }} /></span>
                  <span className={`nu-pl-tag is-${c.tag || "none"}`} aria-hidden="true">{c.daubed ? <Icon name="check" size={14} sw={3.4} /> : TAG[c.tag] ?? ""}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="nu-pl-card" aria-label="Your card" data-must-see="card">
          <div className="nu-pl-hd" aria-hidden="true">
            {[..."BINGO"].map((x) => <span key={x} className={p.hint && x === L ? "is-hint" : ""}><Ball tone={x as Tone} mode="l" letter={x} size={44} /></span>)}
          </div>
          <div className="nu-pl-cells">
            {card.map((v, i) => {
              const f = flash && flash.i === i ? flash : null;
              const m = live.marked[i];
              return (
                <button key={i} type="button" data-cell={i} disabled={scoring || !v} onClick={() => tap(i)}
                  className={`nu-pl-cell${m ? " is-m" : ""}${!v ? " is-free" : ""}${p.hint && !m && v && v === last ? " is-hint" : ""}${f ? ` is-${f.kind}` : ""}${glow.includes(i) ? " is-glow" : ""}`}
                  aria-label={`${v ? label(v) : "free space"}${m && v ? ", daubed" : ""}`}>
                  {!v ? <Icon name="star" size={30} color="currentColor" fill="currentColor" sw={1} />
                    : m ? <span className="nu-pl-dab" style={{ ["--r" as string]: `${(v * 7) % 17 - 8}deg` }}>{v}</span> : v}
                  {f?.kind === "good" && f.pts ? <span className="nu-pl-pop" key={f.id} aria-hidden="true">+{f.pts}</span> : null}
                  {f?.kind === "wrong" ? <span className="nu-pl-why" key={f.id} aria-hidden="true">Not called yet</span> : null}
                  {f?.kind === "late" ? <span className="nu-pl-why" key={f.id} aria-hidden="true">Already left</span> : null}
                </button>
              );
            })}
            {almost.map((k) => {
              const row = k % 2 === 0, n = Math.floor(k / 2);
              return <span key={k} className={`nu-pl-togo ${row ? "is-r" : "is-c"}`} style={row ? { top: `${(n + 0.5) * 20}%` } : { left: `${(n + 0.5) * 20}%` }} aria-hidden="true">1 to go</span>;
            })}
          </div>
        </section>

        <div className="nu-pl-score">
          <small>Score</small>
          <b className="nu-d">{live.score}</b>
          {sub && <span className={!rival && lastPts !== null && lastPts < 0 ? "is-neg" : rival ? "" : "is-pos"}>{sub}</span>}
        </div>
        <div className="nu-pl-combo">
          <b className="nu-d">x{cmb.mult}</b>
          <span><small>Combo</small>{pips}</span>
        </div>
        <div className={`nu-pl-feed is-${msg.tone}${tipInFeed && !msg.text && !scoring ? " has-tip" : ""}`} role="status">
          <b className="nu-d nu-pl-mx" aria-hidden="true">x{cmb.mult}</b>
          {tipInFeed && !msg.text && !scoring
            ? <span className="nu-pl-said nu-pl-feedtip" role="note">{tipText(p.win)}<Button kind="white" size="sm" onClick={closeTip}>Got it</Button></span>
            : <span className="nu-pl-said">{said}</span>}
          <span className="nu-pl-mpips">{pips}</span>
          {rival && <span className="nu-pl-rival">{sub}</span>}
        </div>
      </div>
    </div>
  );
}
