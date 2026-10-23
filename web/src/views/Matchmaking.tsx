import { useEffect, useRef, useState } from "react";
import { callFn, errorText, rpcError, supabase, type MatchInfo } from "../lib/supabase";
import type { RoundStart } from "./Play";
import { Coins } from "../lib/ui";
import { LEVEL_NAME, type Arena } from "../lib/arena";

type OnlineP = { id: string; name: string; level: number; playing: boolean };

export default function Matchmaking({ level, fee, arena, onReady, onCancel, onGhost, onSwitch, onError }: {
  level: string; fee: number; arena?: Arena | null; onReady: (r: RoundStart) => void; onCancel: () => void; onGhost: () => void; onSwitch?: (level: string) => void; onError: (m: string) => void;
}) {
  const [waited, setWaited] = useState(0);
  const [note, setNote] = useState("Searching for an opponent…");
  const [online, setOnline] = useState<OnlineP[] | null>(null);
  const [invited, setInvited] = useState<Record<string, string>>({});
  const done = useRef(false);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    const tick = async () => {
      const { data, error } = await supabase.rpc("my_match");
      if (!alive || done.current || error) return;
      const m = data as MatchInfo;
      if (m.status === "queued") setWaited(m.waited ?? 0);
      if (m.status === "none") { done.current = true; onError("The search timed out. Please try again."); }
      if (m.status === "ready" && m.round_id) {
        done.current = true;
        const offset = Date.parse(m.server_now!) - Date.now(); // align with the server clock so both players start together
        onReady({
          roundId: m.round_id, seed: Number(m.seed), balance: 0, params: m.params as RoundStart["params"],
          startAt: Date.parse(m.start_at!) - offset, matchId: m.match_id, opponent: m.opponent,
        });
      }
    };
    void (async () => {
      try {
        await callFn("find-match", { level });
        if (!alive) return;
        await tick();
        timer = setInterval(() => void tick(), 1500); // also tells the server we are still here
      } catch (e) { done.current = true; onError(errorText((e as Error).message)); }
    })();
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
      if (!done.current) void supabase.rpc("cancel_queue"); // leaving the screen leaves the queue
    };
  }, [level]);

  // players who are online and could be invited
  useEffect(() => {
    let alive = true;
    const load = () => void supabase.rpc("online_players").then(({ data }) => { if (alive) setOnline((data as OnlineP[]) ?? []); }, () => undefined);
    load();
    const t = setInterval(load, 10e3);
    return () => { alive = false; clearInterval(t); };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setWaited((w) => w + 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { if (waited >= 25) setNote("Still searching. Invite someone who is online, or play against the ghost."); }, [waited]);

  const invite = async (p: OnlineP) => {
    setInvited({ ...invited, [p.id]: "…" });
    const { error } = await supabase.rpc("send_invite", { p_user: p.id, p_level: level });
    setInvited((x) => ({ ...x, [p.id]: error ? rpcError(error) : "Invited" }));
  };
  const cancel = async () => {
    const { data } = await supabase.rpc("cancel_queue");
    if (data === false) return; // a match was just made; the next poll picks it up
    done.current = true; onCancel();
  };
  const ghost = async () => {
    const { data } = await supabase.rpc("cancel_queue");
    if (data === false) return;
    done.current = true; onGhost();
  };
  const sentStatus = (name: string) => arena?.sent.find((s) => s.to === name)?.status;
  const elsewhere = (arena?.waiting ?? []).filter((w) => w.level !== level);
  const others = arena ? arena.online : null;

  return (
    <section className="mm">
      <div className="hero mm-hero" style={{ textAlign: "center" }}>
        <span className="eyebrow">Real-player match · {LEVEL_NAME[level] ?? level}</span>
        <div className="spin" aria-hidden="true" />
        <h2>Finding your opponent</h2>
        <p role="status">{note}</p>
        <p>Waiting {waited}s · entry <Coins n={fee} /> is charged only when a match starts</p>
        {others !== null && others > 0 && <p className="mm-told">🟢 {others} {others === 1 ? "player is" : "players are"} online. Everyone in the game now sees that you are waiting.</p>}
      </div>
      {elsewhere.length > 0 && onSwitch && (
        <div className="box mm-else">
          {elsewhere.map((w) => (
            <div className="mm-row" key={w.id + w.level}><span><b>{w.name}</b> is waiting at <b>{LEVEL_NAME[w.level] ?? w.level}</b></span><button className="btn sm" onClick={() => { done.current = true; void supabase.rpc("cancel_queue").then(() => onSwitch(w.level)); }}>Play them at {LEVEL_NAME[w.level] ?? w.level}</button></div>
          ))}
        </div>
      )}
      <div className="box mm-inv">
        <h3>Invite a player who is online</h3>
        {online === null && <div className="skel" style={{ height: 50 }} />}
        {online?.length === 0 && <p className="dim" style={{ margin: 0 }}>Nobody else is online right now. Stay a little, or play against the ghost: you will still earn XP and coins.</p>}
        {online?.map((p) => {
          const st = sentStatus(p.name);
          return (
            <div className="mm-row" key={p.id}>
              <span><b>{p.name}</b> <span className="dim">· level {p.level}{p.playing ? " · in a round" : ""}</span></span>
              {st === "declined" ? <span className="dim">Not now</span> : st === "accepted" ? <span className="tag ok">Joining…</span>
                : <button className="btn alt sm" disabled={!!invited[p.id]} onClick={() => void invite(p)}>{invited[p.id] ?? "Invite"}</button>}
            </div>
          );
        })}
      </div>
      <div className="row2">
        <button className="btn alt" onClick={() => void cancel()}>Cancel</button>
        {waited >= 20 && <button className="btn" onClick={() => void ghost()}>Play vs ghost instead</button>}
      </div>
    </section>
  );
}
