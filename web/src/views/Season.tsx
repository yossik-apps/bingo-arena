import { useCallback, useEffect, useState } from "react";
import { rpcError, supabase, type SeasonInfo, type ShopItem } from "../lib/supabase";
import { Coins, Ic } from "../lib/ui";
import { rewardText } from "../lib/reward";
import { timeLeft, when } from "../lib/time";
import Notice from "../lib/Notice";
import InfoTip from "../lib/InfoTip";

export default function Season({ items, balance, onChange }: { items: ShopItem[]; balance: number; onChange: () => Promise<void> }) {
  const [s, setS] = useState<SeasonInfo | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState(false);
  const load = useCallback(async () => { const { data } = await supabase.rpc("season_info"); setS(data as SeasonInfo); }, []);
  useEffect(() => { void load(); }, [load]);

  const run = async (fn: () => PromiseLike<{ error: { message: string } | null; data?: unknown }>, ok: string) => {
    setMsg(""); setErr(false);
    const { error } = await fn();
    if (error) { setMsg(rpcError(error)); setErr(true); } else { setMsg(ok); await load(); await onChange(); }
  };

  if (!s) return <div className="skel" />;
  if (!s.active) {
    return (
      <div className="box"><h2>No season right now</h2>
        <p className="dim" style={{ marginBottom: 0 }}>{s.next ? `The next season, ${s.next.name}, starts ${when(s.next.starts_at)}.` : "The next season will be announced soon."}</p></div>
    );
  }
  const per = s.xp_per_tier ?? 200, tier = s.tier ?? 0, into = (s.xp ?? 0) - tier * per;
  const pct = tier >= 30 ? 100 : Math.round((into / per) * 100);
  return (
    <>
      <Notice text={msg} error={err} />
      <section className="hero" style={{ marginTop: 0 }}>
        <span className="eyebrow">Season track · {s.over ? "ended, claim your rewards" : timeLeft(s.ends_at!)}</span>
        <h2>{s.name}</h2>
        <p>{s.blurb}</p>
      </section>
      <div className="box">
        <div className="qtop"><b>Tier {tier} of 30</b><span className="dim">{s.xp} season XP</span></div>
        <div className="prog" role="progressbar" aria-label="Progress to the next tier" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i style={{ width: `${pct}%` }} /></div>
        <p className="dim" style={{ margin: 0 }}>{tier >= 30 ? "You reached the top tier!" : `${per - into} XP to tier ${tier + 1}. You earn season XP from every round you play.`} <InfoTip label="season XP" text="Season XP is the XP you earn from your rounds while the season runs. Every 200 XP (or the amount shown by your season) opens the next tier. You can claim a tier's reward at any time before the season ends, plus 3 days." /></p>
      </div>
      {!s.pass && !s.over && (
        <div className="box">
          <h2>Season pass</h2>
          <p className="dim" style={{ margin: "4px 0" }}>Adds a second reward on every tier, including exclusive looks you cannot get anywhere else. Bought with coins, never with real money.</p>
          <button className="btn big" disabled={balance < (s.pass_price ?? 0)} onClick={() => void run(() => supabase.rpc("buy_season_pass"), "Season pass unlocked!")}>Get the pass · <Coins n={s.pass_price ?? 0} /></button>
          {balance < (s.pass_price ?? 0) && <p className="hint">You need {s.pass_price} coins. Keep playing to earn them.</p>}
        </div>
      )}
      {s.pass && <p className="toast">You have the season pass. Both tracks are open.</p>}
      <div className="tierhead" aria-hidden="true"><span /><b>Free</b><b>Pass</b></div>
      {(s.tiers ?? []).map((t) => {
        const reached = t.tier <= tier;
        const btn = (track: "free" | "premium", claimed: boolean) => {
          const locked = track === "premium" && !s.pass;
          return (
            <button className={`btn ${claimed || !reached || locked ? "alt" : ""}`} style={{ minHeight: 40, padding: "6px 8px", fontSize: 14, width: "100%" }}
              disabled={claimed || !reached || locked} onClick={() => void run(() => supabase.rpc("claim_season_tier", { p_tier: t.tier, p_track: track }), "Reward claimed!")}>
              {claimed ? "Claimed" : locked ? <><Ic n="lock" /> {rewardText(t.premium, items)}</> : <>{rewardText(track === "free" ? t.free : t.premium, items)}</>}
            </button>
          );
        };
        return (
          <div className={`tierrow ${reached ? "reached" : ""}`} key={t.tier}>
            <span className="tn" aria-label={`Tier ${t.tier}${reached ? ", reached" : ""}`}>{t.tier}</span>
            {btn("free", t.free_claimed)}{btn("premium", t.premium_claimed)}
          </div>
        );
      })}
    </>
  );
}
