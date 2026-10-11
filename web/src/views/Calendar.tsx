import { useEffect, useState } from "react";
import { supabase, type LiveOp } from "../lib/supabase";
import { OP_LABEL, opText, startsIn, timeLeft, when } from "../lib/time";

export default function Calendar() {
  const [ops, setOps] = useState<LiveOp[] | null>(null);
  useEffect(() => {
    void supabase.from("liveops").select("*").eq("active", true).gt("ends_at", new Date().toISOString()).order("starts_at")
      .then(({ data }) => setOps((data as LiveOp[]) ?? []));
  }, []);
  if (!ops) return <div className="skel" />;
  const now = Date.now();
  const live = ops.filter((o) => new Date(o.starts_at).getTime() <= now);
  const soon = ops.filter((o) => new Date(o.starts_at).getTime() > now);
  const card = (o: LiveOp, on: boolean) => (
    <div className="qcard" key={o.id}>
      <div className="qtop"><b>{o.title}</b><span className={`tag ${on ? "ok" : ""}`}>{on ? "On now" : OP_LABEL[o.kind]}</span></div>
      {o.descr && <p className="dim" style={{ margin: "6px 0" }}>{o.descr}</p>}
      {opText(o) && <p style={{ margin: "4px 0", fontWeight: 700 }}>{opText(o)}</p>}
      <p className="dim" style={{ margin: "4px 0" }}>{on ? timeLeft(o.ends_at) : `Starts ${startsIn(o.starts_at)} · ${when(o.starts_at)}`}</p>
    </div>
  );
  return (
    <>
      <h2 className="sec" style={{ marginTop: 8 }}>On now</h2>
      {live.length === 0 && <p className="dim">Nothing special is on right now. Check the schedule below.</p>}
      {live.map((o) => card(o, true))}
      <h2 className="sec">Coming up</h2>
      {soon.length === 0 && <p className="dim">No events scheduled yet. New boosts are announced here.</p>}
      {soon.map((o) => card(o, false))}
      <p className="dim">Boosts switch on by themselves while an event is running. You do not need to do anything.</p>
    </>
  );
}
