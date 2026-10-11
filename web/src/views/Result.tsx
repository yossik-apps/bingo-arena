import { useEffect, useState } from "react";
import type { RoundResult, RoundStart } from "./Play";
import { callFn, errorText, supabase } from "../lib/supabase";
import { shareCard, shareLink } from "../lib/share";
import { Ic } from "../lib/ui";
import { Coins } from "../lib/ui";

type MatchRes = { status: "waiting" | "settled"; result?: string; my_score?: number; opp_score?: number | null; opponent?: string; prize?: number };
const MATCH_TITLE: Record<string, string> = {
  win: "You beat your opponent!", lose: "Your opponent wins this round", tie: "Tie! Entry refunded", forfeit_win: "Opponent left. You win!",
  forfeit_loss: "You left the match", cancelled: "Match cancelled. Entry refunded",
};

export default function Result({ r, p, achNames, onAgain, onReplay, onSettled, playerName, onGo }: { r: RoundResult; p: RoundStart["params"]; achNames: string[]; onAgain: () => void; onReplay: (() => void) | null; onSettled?: () => void; playerName?: string; onGo?: (v: "lobby" | "journey" | "collect" | "shop") => void }) {
  const [m, setM] = useState<MatchRes | null>(null);
  const [note, setNote] = useState("");
  useEffect(() => {
    if (r.mode !== "pvp" || !r.matchId) return;
    let alive = true, tries = 0;
    const poll = async () => {
      const { data } = await supabase.rpc("match_result", { p_match: r.matchId });
      if (!alive) return;
      const res = data as MatchRes | null;
      if (res) setM(res);
      if (res?.status === "settled") { onSettled?.(); return; }
      if (++tries < 80) setTimeout(poll, 2000);
    };
    void poll();
    return () => { alive = false; };
  }, [r.matchId]);
  const missed = Math.max(0, r.late);
  const tips: string[] = [];
  tips.push(missed >= 3 ? `You let ${missed} matching numbers slip off the board. Scan your card every time a new ball drops, starting with the column letter.` : "Good attention: very few numbers slipped away.");
  tips.push(r.wrong + r.late >= 3 ? `${r.wrong + r.late} wrong taps reset your combo. Check the letter and number before tapping.` : "Few wrong taps, so your combo stayed healthy.");
  if (r.avgReactionMs !== null) tips.push(r.avgReactionMs > p.every * 1.4 ? `Average reaction ${(r.avgReactionMs / 1000).toFixed(1)}s is slow for this level. Aim to daub before the next ball lands.` : `Average reaction ${(r.avgReactionMs / 1000).toFixed(1)}s fits this level well.`);
  const sr = r.mode === "stage" ? r.stage : null;
  const dr = r.mode === "daily" ? r.daily : null;
  const du = r.mode === "duel" ? r.duel : null;
  const canChallenge = (r.mode === "solo" || r.mode === "ghost") && !(p.boosters && p.boosters.length) && !!r.roundId;
  const shareImage = async () => {
    const title = r.mode === "stage" ? (sr?.stage_name ?? "Journey stage") : r.mode === "daily" ? "Daily Challenge" : r.mode === "duel" ? "Challenge result" : r.mode === "pvp" ? "Real-player match" : r.mode === "solo" ? "Solo round" : "Round result";
    const res = await shareCard({ title, line: `${r.score} pts`, stars: sr ? sr.stars : dr ? dr.tier : undefined, name: playerName ?? "Bingo Arena player" });
    setNote(res === "downloaded" ? "Picture saved to your downloads." : "");
  };
  const challengeFriend = async () => {
    setNote("");
    try {
      const d = await callFn<{ code: string }>("create-challenge", { roundId: r.roundId });
      const res = await shareLink(`${window.location.origin}/?c=${d.code}`, `Can you beat my ${r.score} points on Bingo Arena?`);
      setNote(res === "copied" ? "Challenge link copied. Send it to a friend!" : res === "failed" ? `Copy this link: ${window.location.origin}/?c=${d.code}` : "");
    } catch (e) { setNote(errorText((e as Error).message)); }
  };
  const title = r.mode === "daily" ? (dr ? ["Daily Challenge done", "Daily bronze", "Daily silver", "Daily gold"][dr.tier] ?? "Daily Challenge done" : "Daily Challenge") : r.mode === "duel" ? (du ? (du.win ? "You beat " + du.creator + "!" : du.tie ? "A tie with " + du.creator : du.creator + " keeps the crown") : "Challenge") : r.mode === "stage" ? (sr && sr.stars > 0 ? `Stage cleared! ${sr.stars} star${sr.stars > 1 ? "s" : ""}` : "Not quite. Try again") : r.mode === "pvp" ? (m?.status === "settled" ? MATCH_TITLE[m.result ?? ""] ?? "Match finished" : "Waiting for your opponent…") : r.mode === "tour" ? "Event score submitted" : r.ghost == null ? (r.win ? "New personal best!" : "Round complete") : r.win ? "You beat the ghost!" : "Ghost wins this round";
  return (
    <section>
      <h1>{title}</h1>
      {sr && (
        <div className="box" role="status">
          <div className="stars" style={{ justifyContent: "center", gap: 6 }} role="img" aria-label={`${sr.stars} of 3 stars`}>{[1, 2, 3].map((i) => <Ic key={i} n="star" c={i <= sr.stars ? "on big" : "big"} />)}</div>
          {sr.stars === 0 && p.goals && <p className="dim" style={{ textAlign: "center" }}>You need {p.goals[0]} points for the first star.</p>}
          {sr.coins > 0 && <p style={{ fontWeight: 700, textAlign: "center", margin: "6px 0" }}>+{sr.coins} coins</p>}
          {sr.packs.map((k) => (
            <p key={k.stamp_id} style={{ margin: "4px 0", textAlign: "center" }}>
              Stamp pack: <b>{k.name}</b> <span className="tag">{k.rarity}</span> {k.is_new ? <b style={{ color: "var(--ok)" }}>NEW</b> : <span className="dim">duplicate, +{k.dust} dust</span>}
            </p>
          ))}
          {sr.world_cleared && <p style={{ fontWeight: 700, textAlign: "center" }}>World cleared! Check the Journey for the next world.</p>}
        </div>
      )}
      {dr && (
        <div className="box" role="status">
          <div className="stars" style={{ justifyContent: "center", gap: 6 }} role="img" aria-label={`${dr.tier} of 3 stars`}>{[1, 2, 3].map((i) => <Ic key={i} n="star" c={i <= dr.tier ? "on big" : "big"} />)}</div>
          <p style={{ fontWeight: 700, textAlign: "center", margin: "6px 0" }}>+{dr.coins} coins · you are #{dr.rank} today</p>
          {dr.pack && <p style={{ textAlign: "center", margin: "4px 0" }}>Gold reward, stamp pack: <b>{dr.pack.name}</b> <span className="tag">{dr.pack.rarity}</span></p>}
          {dr.shield_earned && <p style={{ textAlign: "center", margin: "4px 0", fontWeight: 700 }}>You earned a Streak Shield! It saves your login streak if you miss a day.</p>}
          <p className="dim" style={{ textAlign: "center", margin: "4px 0" }}>Come back tomorrow for a new board.</p>
        </div>
      )}
      {du && <p className="toast" role="status">You {r.score} · {du.creator} {du.creator_score}</p>}
      {r.mode === "pvp" && m && (
        <p className="toast" role="status">{m.status === "settled" ? `You ${m.my_score} · ${m.opponent ?? "Opponent"} ${m.opp_score ?? "–"}${m.prize ? ` · prize +${m.prize} coins` : ""}` : `${m.opponent ?? "Your opponent"} is still playing. Your score is locked in.`}</p>
      )}
      <div className="cols2"><div>
      <table><tbody>
        <tr><td>Score</td><td><b>{r.score}</b>{r.ghost != null ? ` (ghost ${r.ghost})` : r.best != null ? ` (best ${r.best})` : ""}</td></tr>
        <tr><td>Daubed</td><td>{r.daubs}</td></tr>
        <tr><td>Wrong taps</td><td>{r.wrong + r.late}</td></tr>
        <tr><td>Lines</td><td>{r.lines}</td></tr>
        <tr><td>Best combo</td><td>x{r.maxMult}</td></tr>
        <tr><td>Accuracy</td><td>{Math.round(r.accuracy * 100)}%</td></tr>
      </tbody></table>
      {r.boost && (r.boost.xp > 1 || r.boost.coins > 1) && <p className="toast" role="status">Event boost applied: {[r.boost.xp > 1 ? `${r.boost.xp}x XP` : "", r.boost.coins > 1 ? `${r.boost.coins}x coin prizes` : ""].filter(Boolean).join(" and ")}.</p>}
      <p style={{ fontWeight: 700 }}>+{r.xp} XP{r.mode === "tour" || r.mode === "pvp" || r.mode === "stage" || r.mode === "daily" || r.mode === "duel" ? "" : <> · prize <Coins n={r.prize} /></>} · level {r.level}</p>
      {r.mode === "tour" && <p className="dim">Your best score in the event counts. See the Events tab for the leaderboard. Prizes are paid when the event ends.</p>}
      {achNames.length > 0 && <p style={{ fontWeight: 700 }}>New badge{achNames.length > 1 ? "s" : ""}: {achNames.join(", ")}</p>}
      </div><div>
      <div className="box coach"><h2>Your coach</h2><ul style={{ paddingLeft: 20 }}>{tips.map((t) => <li key={t}>{t}</li>)}</ul></div>
      </div></div>
      {note && <p className="toast" role="status">{note}</p>}
      {onGo && r.mode !== "stage" && r.mode !== "tour" && (
        <div style={{ margin: "14px 0 4px" }}>
          <p className="dim" style={{ margin: "0 0 6px" }}>What next?</p>
          <div className="row2"><button className="btn alt" onClick={() => onGo("journey")}>Try the Journey</button><button className="btn alt" onClick={() => onGo("collect")}>Quests and album</button><button className="btn alt" onClick={() => onGo("shop")}>Spend coins</button></div>
        </div>
      )}
      <div className="row2">{onReplay && <button className="btn" onClick={onReplay}>Play again</button>}{canChallenge && <button className="btn alt" onClick={() => void challengeFriend()}>Challenge a friend</button>}<button className="btn alt" onClick={() => void shareImage()}>Share result</button><button className="btn alt" onClick={onAgain}>{r.mode === "stage" ? "Back to Journey" : "Back to lobby"}</button></div>
    </section>
  );
}
