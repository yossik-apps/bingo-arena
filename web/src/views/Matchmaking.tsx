import { useEffect, useRef, useState } from "react";
import { callFn, errorText, supabase, type MatchInfo } from "../lib/supabase";
import type { RoundStart } from "./Play";
import { Coins } from "../lib/ui";

export default function Matchmaking({ level, fee, onReady, onCancel, onGhost, onError }: {
  level: string; fee: number; onReady: (r: RoundStart) => void; onCancel: () => void; onGhost: () => void; onError: (m: string) => void;
}) {
  const [waited, setWaited] = useState(0);
  const [note, setNote] = useState("Searching for an opponent…");
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
        timer = setInterval(() => void tick(), 1500);
      } catch (e) { done.current = true; onError(errorText((e as Error).message)); }
    })();
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
      if (!done.current) void supabase.rpc("cancel_queue"); // leaving the screen leaves the queue
    };
  }, [level]);

  useEffect(() => {
    const t = setInterval(() => setWaited((w) => w + 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { if (waited >= 20) setNote("Still searching. You can keep waiting or play against the ghost instead."); }, [waited]);

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

  return (
    <section>
      <div className="hero" style={{ textAlign: "center" }}>
        <span className="eyebrow">Real-player match</span>
        <div className="spin" aria-hidden="true" />
        <h2>Finding your opponent</h2>
        <p role="status">{note}</p>
        <p>Waiting {waited}s · entry <Coins n={fee} /> is charged only when a match starts</p>
      </div>
      <div className="row2">
        <button className="btn alt" onClick={() => void cancel()}>Cancel</button>
        {waited >= 20 && <button className="btn" onClick={() => void ghost()}>Play vs ghost instead</button>}
      </div>
    </section>
  );
}
