// Matchmaking: "Finding your opponent", while the server looks for a real player. Classic views/Matchmaking.tsx; see Match.logic.ts.
// Uses: profile, rounds, navigation, social, match
import { useEffect, useRef, useState } from "react";
import { Ball } from "../Ball";
import { Button, Card, Chip, EmptyState, SectionHeader, Skeleton } from "../components";
import { Coin, Icon } from "../Icon";
import type { OnlinePlayer } from "../../lib/screenData";
import type { RoundsGroup, ScreenProps } from "./contract";
import {
  elsewhere, eyebrow, levelName, NOBODY, onlineText, ONLINE_MS, playerSub, POLL_MS, readyRound, SEARCHING, sentStatus, showsGhost, STILL, STILL_AT, stepOf, TIMED_OUT,
} from "./Match.logic";
import "./match.css";

/** rounds.matching: the level being searched and how to start the round the server made. */
type Matching = NonNullable<RoundsGroup["matching"]>;

export default function Match({ ctx }: ScreenProps) {
  const m = ctx.rounds.matching;
  if (!m) {
    return (
      <div className="nu-match">
        <EmptyState title="No search running" text="Pick Play a person in the lobby to find a real opponent." action={<Button onClick={() => ctx.navigation.go("lobby")}>Back to lobby</Button>} />
      </div>
    );
  }
  // a new level is a new search, as Classic's key={matchLevel}
  return <Search ctx={ctx} m={m} key={m.level} />;
}

function Search({ ctx, m }: ScreenProps & { m: Matching }) {
  const { level } = m;
  const rounds = ctx.rounds, match = ctx.match;
  const fee = rounds.cfg?.levels[level]?.fee ?? 0;
  const arena = ctx.social.arena;
  const [waited, setWaited] = useState(0);
  const [still, setStill] = useState(false);
  const [online, setOnline] = useState<OnlinePlayer[] | null>(null);
  const [invited, setInvited] = useState<Record<string, string>>({});
  const done = useRef(false);

  // join the queue, then ask every 1.5 s; leaving the screen leaves the queue
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    const tick = async () => {
      let s;
      try { s = await match.state(); } catch { return; } // a failed check is skipped, as in Classic
      if (!alive || done.current) return;
      const step = stepOf(s);
      if (step.kind === "wait" && step.waited !== null) setWaited(step.waited);
      if (step.kind === "timeout") { done.current = true; rounds.fail(TIMED_OUT); }
      if (step.kind === "ready") { done.current = true; m.ready(readyRound(s, Date.now())); }
    };
    void (async () => {
      try {
        await match.find(level);
        if (!alive) return;
        await tick();
        timer = setInterval(() => void tick(), POLL_MS);
      } catch (e) { done.current = true; rounds.fail((e as Error).message); }
    })();
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
      if (!done.current) void match.cancel().catch(() => undefined);
    };
  }, [level]);

  // players who are online and could be invited
  useEffect(() => {
    let alive = true;
    const load = () => void match.online().then((d) => { if (alive) setOnline(d); }, () => undefined);
    load();
    const t = setInterval(load, ONLINE_MS);
    return () => { alive = false; clearInterval(t); };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setWaited((w) => w + 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { if (waited >= STILL_AT) setStill(true); }, [waited]);

  const invite = (p: OnlinePlayer) => {
    setInvited((x) => ({ ...x, [p.id]: "…" }));
    match.invite(p.id, level).then(() => "Invited", (e: Error) => e.message).then((t) => setInvited((x) => ({ ...x, [p.id]: t })));
  };
  // false means a match was made just now: stay, and the next check picks it up
  const leave = async (then: () => void) => {
    const d = await match.cancel().catch(() => null);
    if (d === false) return;
    done.current = true;
    then();
  };
  const switchTo = (to: string) => { done.current = true; void match.cancel().catch(() => null).then(() => rounds.start("pvp", to, [])); };

  const others = elsewhere(arena, level);
  const told = onlineText(arena?.online);
  const me = (ctx.profile?.name ?? "You").slice(0, 1).toUpperCase();

  return (
    <div className="nu-match">
      <section className="nu-mm-hero" aria-labelledby="nu-mm-title">
        <Chip tone="dark">{eyebrow(level)}</Chip>
        <div className="nu-mm-vs" aria-hidden="true">
          <Ball tone="P" mode="n" size={84} className="nu-mm-ball"><b>{me}</b></Ball>
          <span className="nu-mm-vsword">VS</span>
          <Ball tone="X" mode="n" size={84} className="nu-mm-ball nu-jig"><b>?</b></Ball>
        </div>
        <h1 id="nu-mm-title">Finding your opponent</h1>
        <p className="nu-mm-note" role="status">{still ? STILL : SEARCHING}</p>
        <p className="nu-mm-wait">
          <span><Icon name="clock" size={18} /> Waiting <b>{waited}s</b></span>
          <span className="nu-mm-fee">entry <Coin size={18} /> <b>{fee}</b> is charged only when a match starts</span>
        </p>
        {told && <p className="nu-mm-told"><span className="nu-mm-dot" aria-hidden="true" />{told}</p>}
      </section>

      <div className="nu-mm-actions" data-must-see="cancel">
        {showsGhost(waited) && <Button size="lg" wide onClick={() => void leave(() => rounds.start("ghost", level, []))}><Icon name="ghost" size={22} /> Play vs ghost instead</Button>}
        <Button kind="white" wide onClick={() => void leave(() => ctx.navigation.go("lobby"))}>Cancel</Button>
      </div>

      {others.length > 0 && (
        <ul className="nu-mm-list" aria-label="Players waiting at another level">
          {others.map((w) => (
            <li key={w.id + w.level}>
              <Ball tone="I" mode="n" size={44}><b>{w.name.slice(0, 1).toUpperCase()}</b></Ball>
              <span className="nu-mm-person">
                <b className="nu-mm-name" title={w.name}>{w.name}</b>
                <span className="nu-mm-sub">is waiting at <b>{levelName(w.level)}</b></span>
              </span>
              <Button size="sm" onClick={() => switchTo(w.level)}>Play them at {levelName(w.level)}</Button>
            </li>
          ))}
        </ul>
      )}

      <Card label="Invite a player who is online">
        <div className="nu-mm-inv">
          <SectionHeader title="Invite a player who is online" />
          {online === null && <Skeleton rows={2} height={56} label="Loading players who are online" />}
          {online?.length === 0 && <p className="nu-mm-empty">{NOBODY}</p>}
          {online && online.length > 0 && (
            <ul className="nu-mm-people">
              {online.map((p) => {
                const st = sentStatus(arena, p.name);
                return (
                  <li key={p.id}>
                    <span className="nu-mm-person">
                      <b className="nu-mm-name" title={p.name}>{p.name}</b>
                      <span className="nu-mm-sub">{playerSub(p)}</span>
                    </span>
                    {st === "declined" ? <span className="nu-mm-sub">Not now</span>
                      : st === "accepted" ? <Chip tone="green">Joining…</Chip>
                      : <Button kind="white" size="sm" disabled={!!invited[p.id]} label={invited[p.id] ? undefined : `Invite ${p.name}`} onClick={() => invite(p)}>{invited[p.id] ?? "Invite"}</Button>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
