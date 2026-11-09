// The live-match bar, in the new design: an invite to a live match, or someone waiting for one. It shows above every screen except
// during a round and on the match screen. Classic's rules and words (lib/ArenaBar.tsx); only the look is new.
// Uses: OverlayCtx["arenaBar"] (arena, fees, canPlay, play, answer)
import { useState } from "react";
import "./arenabar.css";
import { Ball } from "../Ball";
import { Button } from "../components";
import { Coin, Icon } from "../Icon";
import type { OverlayProps } from "../screens/contract";
import { SEEN_KEY, SEEN_MAX, barOf, inviteKey, levelName, onlineNote, playLevel, title, waitKey } from "./ArenaBar.logic";

const loadSeen = (): string[] => { try { return JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? "[]") as string[]; } catch { return []; } };

export default function ArenaBar({ ctx }: OverlayProps<"arenaBar">) {
  const [seen, setSeen] = useState<string[]>(loadSeen);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const bar = barOf(ctx.arena, ctx.canPlay, seen);
  if (!bar) return msg ? <div className="nu-ab"><p className="nu-ab-msg" role="status">{msg}</p></div> : null;

  const hide = (k: string) => { const n = [...seen, k]; setSeen(n); try { sessionStorage.setItem(SEEN_KEY, JSON.stringify(n.slice(-SEEN_MAX))); } catch { /* ignore */ } };
  const answer = async (yes: boolean) => {
    if (bar.kind !== "invite") return;
    setMsg(""); setBusy(true);
    try {
      const r = await ctx.answer(bar.id, yes);
      hide(inviteKey(bar.id));
      if (yes) ctx.play(playLevel(r, bar.level));
    } catch (e) {
      hide(inviteKey(bar.id));
      setMsg(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };
  const online = onlineNote(bar);
  const name = bar.kind === "invite" ? bar.from : bar.name;

  return (
    <div className="nu-ab">
      <div className="nu-ab-row" role="status" aria-live="polite">
        <div className="nu-ab-main">
          <Ball tone="P" size={44}><Icon name="users" size={22} color="#14254F" /></Ball>
          <div className="nu-ab-text">
            <p className="nu-ab-title">{title(bar)}</p>
            <p className="nu-ab-sub">
              <span>{levelName(bar.level)}</span><span aria-hidden="true">·</span>
              <span className="nu-ab-fee">entry <Coin size={16} />{ctx.fees[bar.level] ?? 0}<span className="nu-sr"> coins</span></span>
              {online && <><span aria-hidden="true">·</span><span>{online}</span></>}
            </p>
          </div>
        </div>
        <div className="nu-ab-acts">
          {bar.kind === "invite" ? (
            <>
              <Button size="sm" disabled={busy} onClick={() => void answer(true)}>Accept</Button>
              <Button size="sm" kind="white" disabled={busy} onClick={() => void answer(false)}>Not now</Button>
            </>
          ) : (
            <>
              <Button size="sm" label={`Play now with ${name}`} onClick={() => { hide(waitKey(bar)); ctx.play(bar.level); }}>Play now</Button>
              <button type="button" className="nu-ab-x" aria-label="Hide" onClick={() => hide(waitKey(bar))}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </>
          )}
        </div>
      </div>
      {msg && <p className="nu-ab-msg" role="status">{msg}</p>}
    </div>
  );
}
