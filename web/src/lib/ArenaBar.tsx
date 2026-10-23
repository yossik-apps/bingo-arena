import { useState } from "react";
import { rpcError, supabase } from "./supabase";
import { LEVEL_NAME, type Arena } from "./arena";
import { Coins, Ic } from "./ui";

const seenKey = "ba_arena_dismissed";
const loadSeen = (): string[] => { try { return JSON.parse(sessionStorage.getItem(seenKey) ?? "[]") as string[]; } catch { return []; } };

/** A small banner on every screen (not during a round): an invite to a live match, or someone waiting for one. */
export default function ArenaBar({ arena, fees, canPlay, onPlay }: { arena: Arena | null; fees: Record<string, number>; canPlay: boolean; onPlay: (level: string) => void }) {
  const [seen, setSeen] = useState<string[]>(loadSeen);
  const [msg, setMsg] = useState("");
  if (!arena || !canPlay) return null;
  const dismiss = (k: string) => { const n = [...seen, k]; setSeen(n); try { sessionStorage.setItem(seenKey, JSON.stringify(n.slice(-50))); } catch { /* ignore */ } };
  const inv = arena.invites.find((i) => !seen.includes("i" + i.id));
  const wait = arena.waiting.find((w) => !seen.includes(`w${w.id}${w.level}`));
  if (!inv && !wait) return null;

  const answer = async (id: string, yes: boolean, level: string) => {
    setMsg("");
    const { data, error } = await supabase.rpc("answer_invite", { p_id: id, p_accept: yes });
    dismiss("i" + id);
    if (error) { setMsg(rpcError(error)); return; }
    if (yes) onPlay((data as { level: string })?.level ?? level);
  };

  return (
    <div className="arena-bar" role="status" aria-live="polite">
      <span className="ab-ic" aria-hidden="true"><Ic n="users" /></span>
      {inv ? (
        <>
          <span className="ab-t"><b>{inv.from_name} invites you to a live match</b><span className="dim">{LEVEL_NAME[inv.level] ?? inv.level} · entry <Coins n={fees[inv.level] ?? 0} /></span></span>
          <span className="ab-acts"><button className="btn sm" onClick={() => void answer(inv.id, true, inv.level)}>Accept</button><button className="btn alt sm" onClick={() => void answer(inv.id, false, inv.level)}>Not now</button></span>
        </>
      ) : wait ? (
        <>
          <span className="ab-t"><b>{wait.name} is waiting for a live match</b><span className="dim">{LEVEL_NAME[wait.level] ?? wait.level} · entry <Coins n={fees[wait.level] ?? 0} />{arena.online > 1 ? <> · {arena.online} online</> : null}</span></span>
          <span className="ab-acts"><button className="btn sm" onClick={() => { dismiss(`w${wait.id}${wait.level}`); onPlay(wait.level); }}>Play now</button><button className="iconbtn ab-x" aria-label="Hide" onClick={() => dismiss(`w${wait.id}${wait.level}`)}><Ic n="x" /></button></span>
        </>
      ) : null}
      {msg && <span className="ab-msg">{msg}</span>}
    </div>
  );
}
