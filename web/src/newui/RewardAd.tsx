// "Watch a short video for coins", in the new design. New screens get it through ctx.platform.rewardAd(placement).
// The rules, calls and messages are Classic's (lib/RewardAd.tsx), line for line; only the look is new. Classic screens keep the Classic button.
import { useState } from "react";
import "./rewardad.css";
import { rpcError, supabase } from "../lib/supabase";
import { adsActive, showReward, type AdStatus } from "../lib/ads";
import { cgActive, cgRewarded } from "../lib/crazy";
import { Ball } from "./Ball";
import { Coin, Icon } from "./Icon";

/** The look alone, so the gallery can show every state. msg is read out when it changes. */
export function RewardAdView({ coins, left, busy, msg, compact, onWatch }: { coins: number; left: number; busy: boolean; msg: string; compact?: boolean; onWatch: () => void }) {
  return (
    <div className={`nu-ra${compact ? " is-compact" : ""}`}>
      <button type="button" className="nu-row nu-ra-btn" disabled={busy} aria-busy={busy || undefined} onClick={onWatch}>
        <span className="nu-rowlead"><Ball tone="G" size={44}><Icon name="play" size={22} color="#14254F" /></Ball></span>
        <span className="nu-rowtext">
          <span className="nu-rowtitle">{busy ? "Loading video…" : "Watch a short video"}</span>
          <span className="nu-rowsub">{left} left today</span>
        </span>
        <span className="nu-rowtrail nu-ra-coins"><Coin size={20} />+{coins}<span className="nu-sr"> coins</span></span>
      </button>
      {msg && <p className="nu-ra-msg" role="status">{msg}</p>}
    </div>
  );
}

/** Hidden when ads are off, for Club members, or when today's videos are used up, as in Classic. */
export default function RewardAd({ ads, placement, onDone, compact }: { ads: AdStatus | null; placement: string; onDone: () => Promise<void> | void; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  // inside CrazyGames only their reward videos may be used
  const cg = cgActive() && !!ads?.cg_enabled && !ads.club;
  if ((!cg && !adsActive(ads)) || !ads || ads.left_today <= 0) return msg ? <div className="nu-ra"><p className="nu-ra-msg" role="status">{msg}</p></div> : null;
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
  return <RewardAdView coins={ads.reward_coins} left={ads.left_today} busy={busy} msg={msg} compact={compact} onWatch={() => void go()} />;
}
