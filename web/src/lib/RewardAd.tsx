import { useState } from "react";
import { rpcError, supabase } from "./supabase";
import { adsActive, showReward, type AdStatus } from "./ads";
import { cgActive, cgRewarded } from "./crazy";
import { Ic } from "./ui";

/** "Watch a short video for coins". Hidden when ads are off, for Club members, or when today's videos are used up. */
export default function RewardAd({ ads, placement, onDone, compact }: { ads: AdStatus | null; placement: string; onDone: () => Promise<void> | void; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  // inside CrazyGames only their reward videos may be used
  const cg = cgActive() && !!ads?.cg_enabled && !ads.club;
  if ((!cg && !adsActive(ads)) || !ads || ads.left_today <= 0) return msg ? <p className="dim ra-msg" role="status">{msg}</p> : null;
  const go = async () => {
    setBusy(true); setMsg("");
    const r = cg ? ((await cgRewarded()) === "done" ? "viewed" : "unavailable") : await showReward(placement);
    if (r === "viewed") {
      const { data, error } = await supabase.rpc("claim_ad_reward", { p_placement: cg ? "cg_" + placement : placement });
      if (error) setMsg(rpcError(error));
      else { setMsg(`+${(data as { coins: number }).coins} coins. Thanks for watching!`); await onDone(); }
    } else setMsg(r === "dismissed" ? "The video was closed early, so there is no reward this time." : "No video is available right now. Please try again later.");
    setBusy(false);
  };
  return (
    <div className={`ra ${compact ? "compact" : ""}`}>
      <button className="btn alt ra-btn" disabled={busy} onClick={() => void go()}>
        <Ic n="play" /><span>{busy ? "Loading video…" : <>Watch a short video · <b>+{ads.reward_coins} coins</b></>}</span>
      </button>
      <span className="dim ra-left">{ads.left_today} left today</span>
      {msg && <p className="dim ra-msg" role="status">{msg}</p>}
    </div>
  );
}
