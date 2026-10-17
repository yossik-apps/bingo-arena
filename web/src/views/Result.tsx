import { useEffect, useState } from "react";
import type { RoundResult, RoundStart } from "./Play";
import { callFn, supabase } from "../lib/supabase";
import ShareBar from "../lib/ShareBar";
import { Ic } from "../lib/ui";
import { Coins } from "../lib/ui";
import { DRILL_NAMES, SKILL_INFO, todaysDrill, type Dna } from "../lib/dna";

type MatchRes = { status: "waiting" | "settled"; result?: string; my_score?: number; opp_score?: number | null; opponent?: string; prize?: number };
const MATCH_TITLE: Record<string, string> = {
  win: "You beat your opponent!", lose: "Your opponent wins this round", tie: "Tie! Entry refunded", forfeit_win: "Opponent left. You win!",
  forfeit_loss: "You left the match", cancelled: "Match cancelled. Entry refunded",
};

export default function Result({ r, p, achNames, onAgain, onReplay, onSettled, playerName, onGo, coach = "Coach Nova", dna, onDrill }: { r: RoundResult; p: RoundStart["params"]; achNames: string[]; onAgain: () => void; onReplay: (() => void) | null; onSettled?: () => void; playerName?: string; onGo?: (v: "lobby" | "journey" | "collect" | "shop") => void; coach?: string; dna?: Dna | null; onDrill?: () => void }) {
  const [m, setM] = useState<MatchRes | null>(null);
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
  if (dna?.weakest) tips.push(`Your Bingo DNA says ${SKILL_INFO[dna.weakest].name} is your weakest skill. ${SKILL_INFO[dna.weakest].tip}`);
  const sr = r.mode === "stage" ? r.stage : null;
  const dr = r.mode === "daily" ? r.daily : null;
  const du = r.mode === "duel" ? r.duel : null;
  const canChallenge = (r.mode === "solo" || r.mode === "ghost") && !(p.boosters && p.boosters.length) && !!r.roundId;
  // The link shared after a game. For Practice and Beat the Ghost it is a challenge link prepared ahead of time, so the buttons open at once.
  const [link, setLink] = useState("");
  useEffect(() => {
    const home = window.location.origin;
    if (!canChallenge) { setLink(home); return; }
    let alive = true;
    callFn<{ code: string }>("create-challenge", { roundId: r.roundId }).then((d) => { if (alive) setLink(`${home}/?c=${d.code}`); }).catch(() => { if (alive) setLink(home); });
    return () => { alive = false; };
  }, [r.roundId]);
  // Milestones: big moments get their own card and a ready-made share message.
  const won = du?.win || m?.result === "win" || m?.result === "forfeit_win";
  const milestone: { head: string; share: string } | null =
    r.mode === "solo" && r.win ? { head: `New personal best: ${r.score} points`, share: `New personal best in Bingo Arena: ${r.score} points!` }
    : sr && sr.stars === 3 ? { head: `3 stars on ${sr.stage_name}`, share: `I got all 3 stars on ${sr.stage_name} in Bingo Arena!` }
    : dr && dr.tier === 3 ? { head: "Daily gold", share: "I got gold in today's Bingo Arena Daily Challenge!" }
    : won ? { head: `You beat ${du ? du.creator : m?.opponent ?? "a real player"}`, share: `I just beat a real player in Bingo Arena with ${r.score} points!` }
    : achNames.length ? { head: `New badge: ${achNames[0]}`, share: `I unlocked the "${achNames[0]}" badge in Bingo Arena!` }
    : null;
  const shareText = milestone ? milestone.share : r.mode === "stage" ? `I got ${sr?.stars ?? 0} star${sr?.stars === 1 ? "" : "s"} on ${sr?.stage_name ?? "a stage"} in Bingo Arena!`
    : r.mode === "daily" ? `I finished today's Daily Challenge in Bingo Arena${dr ? ` (rank #${dr.rank})` : ""}!`
    : canChallenge ? `I scored ${r.score} points in Bingo Arena. Can you beat me?` : `I scored ${r.score} points in Bingo Arena!`;
  const title = r.mode === "drill" ? `Drill done: ${p.label ?? "training"}` : r.mode === "daily" ? (dr ? ["Daily Challenge done", "Daily bronze", "Daily silver", "Daily gold"][dr.tier] ?? "Daily Challenge done" : "Daily Challenge") : r.mode === "duel" ? (du ? (du.win ? "You beat " + du.creator + "!" : du.tie ? "A tie with " + du.creator : du.creator + " keeps the crown") : "Challenge") : r.mode === "stage" ? (sr && sr.stars > 0 ? `Stage cleared! ${sr.stars} star${sr.stars > 1 ? "s" : ""}` : "Not quite. Try again") : r.mode === "pvp" ? (m?.status === "settled" ? MATCH_TITLE[m.result ?? ""] ?? "Match finished" : "Waiting for your opponent…") : r.mode === "tour" ? "Event score submitted" : r.ghost == null ? (r.win ? "New personal best!" : "Round complete") : r.win ? "You beat the ghost!" : "Ghost wins this round";
  return (
    <section>
      <h1>{title}</h1>
      {milestone && <div className="box milestone" role="status"><span className="eyebrow">Milestone</span><b>{milestone.head}</b></div>}
      {r.mode === "drill" && (
        <div className="box" role="status">
          <p style={{ margin: 0, fontWeight: 700 }}>{r.drill?.first_today ? `+${r.drill.coins} coins for your first drill today` : "Training counts toward your Bingo DNA."}</p>
          <p className="dim" style={{ margin: "4px 0 0" }}>{r.drill?.first_today ? "Come back tomorrow for a new drill and more coins." : "Drill coins come once a day. Keep training whenever you like."}</p>
        </div>
      )}
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
      <p style={{ fontWeight: 700 }}>+{r.xp} XP{r.mode === "tour" || r.mode === "pvp" || r.mode === "stage" || r.mode === "daily" || r.mode === "duel" || r.mode === "drill" ? "" : <> · prize <Coins n={r.prize} /></>} · level {r.level}</p>
      {r.mode === "tour" && <p className="dim">Your best score in the event counts. See the Events tab for the leaderboard. Prizes are paid when the event ends.</p>}
      {achNames.length > 0 && <p style={{ fontWeight: 700 }}>New badge{achNames.length > 1 ? "s" : ""}: {achNames.join(", ")}</p>}
      </div><div>
      <div className="box coach">
        <div className="coachhead"><span className="avatar coachav" aria-hidden="true">{coach.replace(/^coach\s+/i, "").slice(0, 1).toUpperCase() || "N"}</span><span><h2 style={{ margin: 0 }}>{coach}</h2><span className="dim" style={{ fontSize: 13 }}>Your coach</span></span></div>
        <ul style={{ paddingLeft: 20 }}>{tips.map((t) => <li key={t}>{t}</li>)}</ul>
        {onDrill && r.mode !== "drill" && <button className="btn alt" onClick={onDrill}>Train it: {DRILL_NAMES[todaysDrill(dna ?? null)]} (60 s)</button>}
      </div>
      </div></div>
      {onGo && r.mode !== "stage" && r.mode !== "tour" && (
        <div style={{ margin: "14px 0 4px" }}>
          <p className="dim" style={{ margin: "0 0 6px" }}>What next?</p>
          <div className="row2"><button className="btn alt" onClick={() => onGo("journey")}>Try the Journey</button><button className="btn alt" onClick={() => onGo("collect")}>Quests and album</button><button className="btn alt" onClick={() => onGo("shop")}>Spend coins</button></div>
        </div>
      )}
      <ShareBar title={milestone ? "Share this milestone" : canChallenge ? "Challenge a friend" : "Share your result"} text={shareText} link={link} />
      <div className="row2">{onReplay && <button className="btn" onClick={onReplay}>Play again</button>}<button className="btn alt" onClick={onAgain}>{r.mode === "stage" ? "Back to Journey" : "Back to lobby"}</button></div>
    </section>
  );
}
