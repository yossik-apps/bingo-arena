import { useCallback, useEffect, useMemo, useState } from "react";
import { me, supabase, type Stage, type World } from "../lib/supabase";
import { NO_ROWS } from "../lib/session";
import { Coins, Ic } from "../lib/ui";

type Prog = Record<string, { stars: number; best_score: number; attempts: number }>;
const LEVEL: Record<string, string> = { beginner: "Beginner", medium: "Medium", hard: "Hard" };

const Stars = ({ n }: { n: number }) => (
  <span className="stars" role="img" aria-label={`${n} of 3 stars`}>{[1, 2, 3].map((i) => <Ic key={i} n="star" c={i <= n ? "on" : ""} />)}</span>
);

export default function Journey({ onPlay }: { onPlay: (stageId: string) => void }) {
  const [worlds, setWorlds] = useState<World[] | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [prog, setProg] = useState<Prog>({});
  const [wid, setWid] = useState<number | null>(null);
  const [sel, setSel] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [w, s, p] = await Promise.all([
      supabase.from("worlds").select("*").order("sort"),
      supabase.from("stages").select("id,world,idx,name,level,mods,s1,s2,s3,reward_coins").order("world").order("idx"),
      me.id ? supabase.from("user_stages").select("stage_id,stars,best_score,attempts").eq("user_id", me.id) : NO_ROWS,
    ]);
    setWorlds((w.data as World[]) ?? []);
    setStages((s.data as Stage[]) ?? []);
    setProg(Object.fromEntries(((p.data as { stage_id: string; stars: number; best_score: number; attempts: number }[]) ?? []).map((x) => [x.stage_id, x])));
  }, []);
  useEffect(() => { void load(); }, [load]);

  const total = useMemo(() => Object.values(prog).reduce((a, x) => a + x.stars, 0), [prog]);
  const worldOpen = (w: World) => total >= w.stars_needed;
  const stageOpen = (st: Stage, w: World) => {
    if (!worldOpen(w)) return false;
    if (st.idx === 1) return true;
    const prev = stages.find((x) => x.world === st.world && x.idx === st.idx - 1);
    return !!prev && (prog[prev.id]?.stars ?? 0) >= 1;
  };

  // open on the first world and stage the player still has to clear
  useEffect(() => {
    if (!worlds || stages.length === 0 || wid !== null) return;
    const w = [...worlds].reverse().find(worldOpen) ?? worlds[0];
    setWid(w.id);
    const next = stages.filter((s) => s.world === w.id).find((s) => (prog[s.id]?.stars ?? 0) === 0) ?? stages.find((s) => s.world === w.id);
    setSel(next?.id ?? null);
  }, [worlds, stages, prog]);

  if (!worlds || wid === null) return <><div className="skel" /><div className="skel" /></>;
  const world = worlds.find((w) => w.id === wid)!;
  const list = stages.filter((s) => s.world === wid);
  const earned = list.reduce((a, s) => a + (prog[s.id]?.stars ?? 0), 0);
  const stage = list.find((s) => s.id === sel) ?? list[0];
  const open = stage ? stageOpen(stage, world) : false;
  const pr = stage ? prog[stage.id] : undefined;

  return (
    <>
      <div className="atabs" role="group" aria-label="Worlds">
        {worlds.map((w) => (
          <button key={w.id} className={`at ${wid === w.id ? "on" : ""}`} aria-pressed={wid === w.id} onClick={() => { setWid(w.id); setSel(stages.find((s) => s.world === w.id && (prog[s.id]?.stars ?? 0) === 0)?.id ?? stages.find((s) => s.world === w.id)?.id ?? null); }}>
            {!worldOpen(w) && <Ic n="lock" />} {w.name}
          </button>
        ))}
      </div>
      <div className="cols2">
        <div>
          <section className="hero" style={{ marginTop: 0 }}>
            <span className="eyebrow">World {world.id} · {earned}/24 stars</span>
            <h2>{world.name}</h2>
            <p>{world.blurb}</p>
            {!worldOpen(world) && <p><b>Locked.</b> Collect {world.stars_needed - total} more star{world.stars_needed - total === 1 ? "" : "s"} in earlier worlds.</p>}
          </section>
          <div className="stages">
            {list.map((s) => {
              const o = stageOpen(s, world);
              return (
                <button key={s.id} className="snode" aria-pressed={stage?.id === s.id} onClick={() => setSel(s.id)} aria-label={`Stage ${s.idx}, ${s.name}${o ? "" : ", locked"}`}>
                  {o ? <b>{s.idx}</b> : <Ic n="lock" />}
                  <span className="dim" style={{ fontSize: 12, textAlign: "center" }}>{s.name}</span>
                  <Stars n={prog[s.id]?.stars ?? 0} />
                </button>
              );
            })}
          </div>
        </div>
        {stage && (
          <div className="box" style={{ marginTop: 10 }}>
            <h2>{stage.idx}. {stage.name}</h2>
            <p className="dim" style={{ margin: "4px 0" }}>{LEVEL[stage.level] ?? stage.level} · {stage.mods?.label ? <b>{stage.mods.label}</b> : "standard rules"} · same board every time, so you can learn it</p>
            <div className="goals" aria-label="Star goals">
              {[stage.s1, stage.s2, stage.s3].map((g, i) => <span key={i} className={(pr?.best_score ?? 0) >= g ? "got" : ""}><Ic n="star" c="star" />{i + 1} · {g} pts</span>)}
            </div>
            <p className="dim" style={{ margin: "6px 0" }}>Best score: <b>{pr?.best_score ?? 0}</b> · attempts: {pr?.attempts ?? 0}</p>
            <p className="dim" style={{ margin: "6px 0" }}>First clear: <Coins n={stage.reward_coins} /> and a stamp pack. Each extra star: +10 coins. Your first 3 stars: another pack. Replays are free.</p>
            <button className="btn big" disabled={!open} onClick={() => onPlay(stage.id)}>{open ? ((pr?.stars ?? 0) > 0 ? "Play again" : "Play stage") : "Locked"}</button>
            {!open && <p className="hint">{worldOpen(world) ? "Clear the previous stage first." : "Collect more stars to open this world."}</p>}
          </div>
        )}
      </div>
    </>
  );
}
