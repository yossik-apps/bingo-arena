// The Journey: worlds of stages, each with up to 3 stars. Looks follow the playground's Journey (chapters of stage rows);
// the data, rules and words are Classic's. The season track is Stage 2 and is left out.
// Uses: journey, rounds
import { useCallback, useEffect, useRef, useState } from "react";
import type { Stage, World } from "../../lib/supabase";
import { Ball, toneOf } from "../Ball";
import { Button, Chip, ErrorState, ListRow, SectionHeader, Sheet, Skeleton } from "../components";
import { Coin, Icon } from "../Icon";
import type { ScreenCtx, ScreenProps } from "./contract";
import {
  goalsGot, lockedHint, playLabel, REWARD_TEXT, rulesText, stageLabel, stageOpen, starsOf, startPoint, totalStars, worldLockText, worldOpen, worldStages, worldStars,
  type JourneyData,
} from "./Journey.logic";
import "./journey.css";

/** Until the shared PR adds `journey` to ScreenCtx: the shape agreed with the main chat. */
type JourneyGroup = { load: () => Promise<JourneyData> };
const journeyOf = (ctx: ScreenCtx) => (ctx as ScreenCtx & { journey: JourneyGroup }).journey;

const Stars = ({ n, size = 22 }: { n: number; size?: number }) => (
  <span className="nu-jn-stars" aria-hidden="true">
    {[0, 1, 2].map((k) => <span key={k} className={k < n ? "is-on" : ""}><Icon name="star" size={size} sw={1.8} fill={k < n ? "currentColor" : "none"} /></span>)}
  </span>
);

export default function Journey({ ctx }: ScreenProps) {
  const { rounds } = ctx;
  // ctx is rebuilt on every App render, so the loader is kept in a ref and the data loads once
  const journey = useRef(journeyOf(ctx));
  journey.current = journeyOf(ctx);
  const [data, setData] = useState<JourneyData | null>(null);
  const [failed, setFailed] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  // locked worlds show their card only, as in the playground; their stages open on request, so nothing Classic shows is lost
  const [shown, setShown] = useState<Record<number, boolean>>({});
  const scrolled = useRef(false);

  const load = useCallback(() => {
    setFailed(false);
    setData(null);
    journey.current.load().then(setData, () => setFailed(true));
  }, []);
  useEffect(load, [load]);

  // Classic opens on the world and stage the player still has to clear: bring that stage into view once.
  const start = data ? startPoint(data.worlds, data.stages, data.progress) : null;
  useEffect(() => {
    if (!start?.stage || scrolled.current || !data) return;
    scrolled.current = true;
    const el = document.getElementById(`nu-jn-${start.stage}`), bar = document.querySelector<HTMLElement>(".nu-tabsbar");
    if (el && el.getBoundingClientRect().bottom > window.innerHeight - (bar?.offsetHeight ?? 0)) el.scrollIntoView({ block: "center" });
  }, [data]);

  if (failed) return <ErrorState title="The Journey did not load" onRetry={load} />;
  if (!data) return <Skeleton rows={4} height={72} label="Loading the Journey" />;

  const { worlds, stages, progress } = data;
  const total = totalStars(progress);
  const max = stages.length * 3;
  const stage = sel ? stages.find((s) => s.id === sel) : undefined;
  const stageWorld = stage && worlds.find((w) => w.id === stage.world);

  const row = (st: Stage, w: World, i: number) => {
    const open = stageOpen(st, w, stages, progress), have = starsOf(progress, st.id), next = st.id === start?.stage;
    return (
      <div key={st.id} id={`nu-jn-${st.id}`} className={`nu-jn-row ${i % 2 === 0 ? "is-left" : "is-right"}`}>
        <ListRow locked={!open} onClick={() => setSel(st.id)} label={stageLabel(st, open, have, next)}
          lead={<Ball tone={open ? toneOf(i * 6 + 3) : "X"} mode="n" num={st.idx} size={44} />}
          title={<span className="nu-jn-name" title={st.name}>{st.name}</span>}
          sub={open ? <>{next && <Chip tone="green">Next</Chip>} {rulesText(st)}</> : lockedHint(worldOpen(w, total))}
          trail={open ? <Stars n={have} /> : undefined} />
      </div>
    );
  };

  return (
    <div className="nu-journey">
      <p className="nu-jn-intro">Win stars to open new worlds. {total} of {max} stars.</p>
      {worlds.map((w) => {
        const list = worldStages(stages, w.id), isOpen = worldOpen(w, total);
        return (
          <section key={w.id} className="nu-jn-world" aria-label={`World ${w.id}: ${w.name}`}>
            <SectionHeader title={`World ${w.id} · ${w.name}`} trail={`${worldStars(stages, w.id, progress)}/${list.length * 3}`} />
            {isOpen
              ? <p className="nu-jn-blurb">{w.blurb}</p>
              : <ListRow locked title={`World ${w.id}: ${w.name}`} sub={<><b>Locked.</b> {worldLockText(w, total)} {w.blurb}</>}
                  trail={<Button size="sm" kind="ghost" onClick={() => setShown((s) => ({ ...s, [w.id]: !s[w.id] }))}><span aria-expanded={!!shown[w.id]}>{shown[w.id] ? "Hide stages" : "Show stages"}</span></Button>} />}
            {(isOpen || shown[w.id]) && <div className="nu-jn-stages">{list.map((st, i) => row(st, w, i))}</div>}
          </section>
        );
      })}

      {stage && stageWorld && (() => {
        const open = stageOpen(stage, stageWorld, stages, progress), pr = progress[stage.id], got = goalsGot(stage, pr);
        return (
          <Sheet label={`Stage ${stage.idx}, ${stage.name}`} title={`${stage.idx}. ${stage.name}`} onClose={() => setSel(null)}>
            <div className="nu-jn-detail">
              <p>{rulesText(stage)} · same board every time, so you can learn it</p>
              <ul className="nu-jn-goals" aria-label="Star goals">
                {[stage.s1, stage.s2, stage.s3].map((g, i) => (
                  <li key={i} className={got[i] ? "is-got" : ""}><Icon name="star" size={18} fill={got[i] ? "currentColor" : "none"} />{i + 1} · {g} pts<span className="nu-jn-sr">{got[i] ? ", reached" : ""}</span></li>
                ))}
              </ul>
              <p>Best score: <b>{pr?.best_score ?? 0}</b> · attempts: {pr?.attempts ?? 0}</p>
              <p>First clear: <span className="nu-jn-coins"><Coin size={18} />{stage.reward_coins}</span> and a stamp pack. {REWARD_TEXT}</p>
              <Button size="lg" wide disabled={!open} onClick={() => { setSel(null); rounds.startStage(stage.id); }}>{playLabel(open, pr?.stars ?? 0)}</Button>
              {!open && <p className="nu-jn-hint">{lockedHint(worldOpen(stageWorld, total))}</p>}
            </div>
          </Sheet>
        );
      })()}
    </div>
  );
}
