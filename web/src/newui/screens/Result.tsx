// The Result screen, after every round. Everything it shows is the server's answer to submit-round; see Result.logic.ts.
// Uses: profile, wallet, rounds, navigation, daily, dna, platform, visitor, match
import { useEffect, useState, type CSSProperties } from "react";
import { DRILL_NAMES, singleRoundDna, todaysDrill } from "../../lib/dna";
import { scoreText } from "../../lib/score";
import type { MatchResult } from "../../lib/screenData";
import { Ball } from "../Ball";
import { Button, Card, Chip, EmptyState, ProgressBar, Share, Toast } from "../components";
import { Coin, Icon } from "../Icon";
import Radar from "../Radar";
import type { ScreenProps } from "./contract";
import {
  backText, backView, badgeText, boostText, canChallenge, coachInitial, coachTips, dailyOf, drillText, duelOf, freeText, levelBar, liveMatchLine, MATCH_POLL_MS, MATCH_POLL_TRIES,
  milestoneOf, saveCardText, scoreTag, shareText, shareTitle, showsNext, showsPrize, showsSaveCard, speedBonus, stageOf, titleOf, tomorrowText,
} from "./Result.logic";
import "./result.css";

/** The score ball takes its size from result.css (--ball), which changes with the screen. */
const BALL_SIZE = { ["--s" as string]: "var(--ball)" } as CSSProperties;
const RARITY:Record<string, "dark" | "green" | "pink"> = { common: "dark", rare: "green", epic: "pink" };

function Stars({ n, label }: { n: number; label: string }) {
  return (
    <div className="nu-rs-stars" role="img" aria-label={label}>
      {[1, 2, 3].map((i) => <span key={i} className={i <= n ? "is-on" : ""}><Icon name="star" size={34} fill="currentColor" sw={1.6} /></span>)}
    </div>
  );
}

export default function Result({ ctx }: ScreenProps) {
  const res = ctx.rounds.result;
  if (!res) {
    return (
      <div className="nu-result">
        <EmptyState title="No round to show" text="Play a round and your score shows here." action={<Button onClick={() => ctx.navigation.go("lobby")}>Back to lobby</Button>} />
      </div>
    );
  }
  const free = ctx.visitor?.freeResult;
  if (free) return <FreeResult ctx={ctx} free={free} />;
  return <Shown ctx={ctx} key={res.r.roundId ?? `${res.r.mode}:${res.r.score}`} />;
}

/** A visitor's free round, scored on the device: Classic GuestResult's content and words, in the new look. */
function FreeResult({ ctx, free }: ScreenProps & { free: NonNullable<NonNullable<ScreenProps["ctx"]["visitor"]>["freeResult"]> }) {
  const { r, p } = ctx.rounds.result!;
  const welcome = ctx.visitor?.welcome ?? 50;
  const t = freeText(r.score, free.left, welcome);
  const dna = singleRoundDna({ mode: "solo", level: free.level, finished_at: new Date().toISOString(), params: { every: p.every, total: p.total }, result: r });
  return (
    <div className="nu-result">
      <div className="nu-rs-left">
        <div className="nu-rs-head">
          <h1>{t.title}</h1>
          <p className="nu-rs-dots" aria-label={t.dots}>
            {[0, 1, 2].map((i) => <i key={i} className={i < t.used ? "is-on" : ""} aria-hidden="true" />)}
            <span aria-hidden="true">{t.left}</span>
          </p>
        </div>
        <div className="nu-rs-ballwrap" data-must-see="score">
          <Ball tone="P" mode="n" className="nu-rs-ball" style={BALL_SIZE} label={`${scoreText(r.score)} points`}><span className="nu-rs-pts"><b>{scoreText(r.score)}</b><i>points</i></span></Ball>
        </div>
        <div className="nu-rs-stats is-free">
          <div className="nu-rs-stat is-big"><b>{r.daubs}</b><span>Daubed</span></div>
          <div className="nu-rs-stat is-big"><b>{r.lines}</b><span>{r.lines === 1 ? "Line" : "Lines"}</span></div>
          <div className="nu-rs-stat is-big"><b>{Math.round(r.accuracy * 100)}%</b><span>Accuracy</span></div>
          <div className="nu-rs-stat"><b>{r.wrong + r.late}</b><span>Wrong taps</span></div>
          <div className="nu-rs-stat"><b>x{r.maxMult}</b><span>Best combo</span></div>
        </div>
      </div>
      <div className="nu-rs-right">
        <div className="nu-rs-actions is-stacked" data-should-see="actions">
          <Button size="lg" wide autoFocus onClick={free.join}>{t.join}</Button>
          {free.again ? <Button kind="white" wide onClick={free.again}>{t.again}</Button> : <Button kind="white" wide onClick={free.back}>Back to lobby</Button>}
          {free.again && <Button kind="ghost" wide onClick={free.back}>Back to lobby</Button>}
        </div>
        <Card label="What a free account gives you">
          <div className="nu-rs-gets">
            <b>Free account, 20 seconds:</b>
            <ul>{t.gets.map(([ic, text]) => <li key={text}><span aria-hidden="true">{ic}</span>{text}</li>)}</ul>
          </div>
        </Card>
        <Card label="Your Bingo DNA">
          <div className="nu-rs-dna">
            <h2>Your Bingo DNA is ready</h2>
            <div className="nu-rs-blur" aria-hidden="true"><Radar dna={dna} size={200} /></div>
            <p>See your six skills and your play style</p>
            <Button onClick={free.join}>Sign up free to reveal</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Shown({ ctx }: ScreenProps) {
  const { r, p, xpBefore } = ctx.rounds.result!;
  const rounds = ctx.rounds, go = ctx.navigation.go;

  // a live match: Classic asks for the result every 2 s until it is settled, then refreshes the wallet
  const [m, setM] = useState<MatchResult | null>(null);
  useEffect(() => {
    if (r.mode !== "pvp" || !r.matchId) return;
    let alive = true, tries = 0;
    const poll = async () => {
      const res = await ctx.match.result(r.matchId!).catch(() => null);
      if (!alive) return;
      if (res) setM(res);
      if (res?.status === "settled") { void ctx.wallet.refresh(); return; }
      if (++tries < MATCH_POLL_TRIES) setTimeout(poll, MATCH_POLL_MS);
    };
    void poll();
    return () => { alive = false; };
  }, [r.matchId]);

  // the shared link: a challenge link prepared ahead for Practice and the Ghost, otherwise the site
  const challenge = canChallenge(r, p);
  const [link, setLink] = useState("");
  useEffect(() => {
    const home = window.location.origin;
    if (!challenge) { setLink(home); return; }
    let alive = true;
    ctx.match.challenge(r.roundId!).then((code) => { if (alive) setLink(`${home}/?c=${code}`); }).catch(() => { if (alive) setLink(home); });
    return () => { alive = false; };
  }, [r.roundId]);

  const achNames = (r.achievements ?? []).map((a) => rounds.achievementNames[a] ?? a);
  const milestone = milestoneOf(r, m, achNames);
  const sr = stageOf(r), dr = dailyOf(r), du = duelOf(r);
  const tag = scoreTag(r);
  const bonus = speedBonus(r, p);
  const boost = boostText(r.boost);
  const badges = badgeText(achNames);
  const coach = ctx.dna.coach || "Coach Nova";
  const tips = coachTips(r, p, ctx.dna.dna);
  const prof = ctx.profile;
  const save = prof && showsSaveCard(prof.guest, prof.played, r.score) ? saveCardText(ctx.platform.crazyGames, ctx.wallet.coins, prof.level) : null;
  const tomorrow = tomorrowText(ctx.daily.cal);
  const replay = rounds.replay;
  const modeCard = r.mode === "drill" || !!sr || !!dr || !!du || (r.mode === "pvp" && !!m);
  // the level bar fills from where the player was to where the server's XP puts them (a level-up fills it)
  const bar = xpBefore ? levelBar(xpBefore.xp, r.xp) : null;
  const levelUp = !!xpBefore && r.level > xpBefore.level;
  const [pct, setPct] = useState(bar?.startPct ?? 0);
  useEffect(() => {
    if (!bar) return;
    const end = levelUp ? 100 : bar.endPct;
    const t = setTimeout(() => setPct(end), 350);
    return () => clearTimeout(t);
  }, []);
  const wrongTaps = r.wrong + r.late;

  const stats = (
    <div className="nu-rs-stats">
      <div className="nu-rs-stat is-big"><b>{r.daubs}</b><span>Daubed</span></div>
      <div className="nu-rs-stat is-big"><b>{r.lines}</b><span>{r.lines === 1 ? "Line" : "Lines"}</span></div>
      <div className="nu-rs-stat is-big"><b>{Math.round(r.accuracy * 100)}%</b><span>Accuracy</span></div>
      <div className="nu-rs-stat"><b>{wrongTaps}</b><span>Wrong taps</span></div>
      <div className="nu-rs-stat"><b>x{r.maxMult}</b><span>Best combo</span></div>
      <div className="nu-rs-stat"><b>{scoreText(r.score)}</b><span>Score</span></div>
    </div>
  );

  const head = (
    <div className="nu-rs-head">
      <h1>{titleOf(r, p, m)}</h1>
      {milestone && <p className="nu-rs-milestone" role="status"><Icon name="medal" size={18} /><span><span className="nu-rs-sr">Milestone: </span>{milestone.head}</span></p>}
    </div>
  );

  const score = (
    <div className="nu-rs-ballwrap" data-must-see="score">
      <Ball tone="P" mode="n" className="nu-rs-ball" style={BALL_SIZE} label={`${scoreText(r.score)} points`}><span className="nu-rs-pts"><b>{scoreText(r.score)}</b><i>points</i></span></Ball>
      {tag && <span className={`nu-rs-tag${tag.best ? " is-best" : ""}`}>{tag.text}</span>}
    </div>
  );
  // balance v2 rounds only: a row of its own under the ball (inside the ball wrapper it would be squeezed to the ball's width)
  const bonusRow = bonus && (
    <p className="nu-rs-bonus" role="status">
      <b><Icon name="bolt" size={18} /> Speed bonus {bonus.points}</b>
      <span>{bonus.hint ?? bonus.detail}</span>
    </p>
  );

  const modeBox = modeCard && (
    <Card label="Round rewards">
      <div className="nu-rs-mode" role="status">
        {r.mode === "drill" && (() => { const d = drillText(r.drill); return <><b>{d.head}</b><span className="nu-rs-dim">{d.sub}</span></>; })()}
        {sr && (
          <>
            <Stars n={sr.stars} label={`${sr.stars} of 3 stars`} />
            {sr.stars === 0 && p.goals && <span className="nu-rs-dim">You need {p.goals[0]} points for the first star.</span>}
            {sr.coins > 0 && <b className="nu-rs-coins"><Coin size={20} />+{sr.coins} coins</b>}
            {sr.packs.map((k) => (
              <span key={k.stamp_id} className="nu-rs-pack">
                <span>Stamp pack: <b>{k.name}</b></span> <Chip tone={RARITY[k.rarity] ?? "dark"}>{k.rarity}</Chip>{" "}
                {k.is_new ? <Chip tone="green">NEW</Chip> : <span className="nu-rs-dim">duplicate, +{k.dust} dust</span>}
              </span>
            ))}
            {sr.world_cleared && <b>World cleared! Check the Journey for the next world.</b>}
          </>
        )}
        {dr && (
          <>
            <Stars n={dr.tier} label={`${dr.tier} of 3 stars`} />
            <b className="nu-rs-coins"><Coin size={20} />+{dr.coins} coins · you are #{dr.rank} today</b>
            {dr.pack && <span className="nu-rs-pack"><span>Gold reward, stamp pack: <b>{dr.pack.name}</b></span> <Chip tone={RARITY[dr.pack.rarity] ?? "dark"}>{dr.pack.rarity}</Chip></span>}
            {dr.shield_earned && <b>You earned a Streak Shield! It saves your login streak if you miss a day.</b>}
            <span className="nu-rs-dim">Come back tomorrow for a new board.</span>
          </>
        )}
        {du && <b>You {r.score} · {du.creator} {du.creator_score}</b>}
        {r.mode === "pvp" && m && <b>{liveMatchLine(m)}</b>}
      </div>
    </Card>
  );

  // XP and level: the playground's level bar when the XP before the round is known, otherwise Classic's "level N" line
  const prize = showsPrize(r.mode) && <span className="nu-rs-prize">prize <Coin size={18} /><b>{r.prize}</b></span>;
  const xp = bar && xpBefore ? (
    <section className="nu-rs-xp" aria-label="XP and level">
      <Ball tone="X" mode="n" num={xpBefore.level} size={44} label={`Level ${xpBefore.level}`} />
      <span className="nu-rs-xpbody">
        <span className="nu-rs-xpline">
          <b>+{r.xp} XP</b>
          {prize}
          <span className="nu-rs-xpnext">{levelUp ? "Level up!" : `${bar.toNext} to level ${xpBefore.level + 1}`}</span>
        </span>
        <ProgressBar pct={pct} dark label={levelUp ? `Level up! You are now level ${r.level}` : `${Math.round(bar.endPct)} percent to level ${xpBefore.level + 1}`} />
      </span>
      <Ball tone={levelUp ? "P" : "X"} mode="n" num={levelUp ? r.level : xpBefore.level + 1} size={52} label={levelUp ? `Now level ${r.level}` : `Next: level ${xpBefore.level + 1}`} />
    </section>
  ) : (
    <section className="nu-rs-xp" aria-label="XP and level">
      <Ball tone="X" mode="n" num={r.level} size={44} label={`Level ${r.level}`} />
      <span className="nu-rs-xpline">
        <b>+{r.xp} XP</b>
        {prize}
        <span>level {r.level}</span>
      </span>
    </section>
  );

  const notes = (
    <>
      {boost && <Toast inline>{boost}</Toast>}
      {r.mode === "tour" && <p className="nu-rs-note">Your best score in the event counts. See the Events tab for the leaderboard. Prizes are paid when the event ends.</p>}
      {badges && <p className="nu-rs-badges"><Icon name="medal" size={20} />{badges}</p>}
    </>
  );

  const actions = (
    <div className="nu-rs-actions" data-should-see="actions">
      {replay && <Button size="lg" wide autoFocus onClick={() => rounds.afterRound(() => replay())}><Icon name="play" size={22} /> Play again</Button>}
      <Button kind="white" wide onClick={() => rounds.afterRound(() => go(backView(r.mode)))}>{backText(r.mode)}</Button>
    </div>
  );

  const extras = (
    <>
      {save && prof && (
        <Card label="Save your progress">
          <div className="nu-rs-row" role="note">
            <span className="nu-rs-ic" aria-hidden="true">💾</span>
            <span className="nu-rs-rowtext"><b>{save.head}</b><span className="nu-rs-dim">{save.text}</span></span>
            <Button size="sm" onClick={prof.save}>{prof.saveLabel}</Button>
          </div>
        </Card>
      )}
      {tomorrow && (
        <Card label="Tomorrow">
          <div className="nu-rs-row" role="note">
            <span className="nu-rs-ic" aria-hidden="true">{tomorrow.gift ? "🎁" : "📅"}</span>
            <span className="nu-rs-rowtext"><b>{tomorrow.head}</b><span className="nu-rs-dim">{tomorrow.text}</span></span>
          </div>
        </Card>
      )}
      {ctx.platform.rewardAd("result")}
    </>
  );

  const coachCard = (
    <Card label="Coach tip">
      <div className="nu-rs-coach">
        <div className="nu-rs-coachhead">
          <span className="nu-rs-coachav" aria-hidden="true">{coachInitial(coach)}</span>
          <span><h2>{coach}</h2><span className="nu-rs-dim">Your coach</span></span>
        </div>
        <ul>{tips.map((t) => <li key={t}>{t}</li>)}</ul>
        {prof && r.mode !== "drill" && <Button kind="white" onClick={() => rounds.startDrill()}>Train it: {DRILL_NAMES[todaysDrill(ctx.dna.dna)]} (60 s)</Button>}
      </div>
    </Card>
  );

  const share = <Card><Share title={shareTitle(r, p, milestone)} text={shareText(r, p, milestone)} link={link} /></Card>;

  const next = showsNext(r.mode) && (
    <nav className="nu-rs-next" aria-label="What next?">
      <span>What next?</span>
      <div>
        <Button kind="white" size="sm" onClick={() => go("journey")}><Icon name="map" size={20} /> Journey</Button>
        <Button kind="white" size="sm" onClick={() => go("collect")}><Icon name="book" size={20} /> Quests and album</Button>
        <Button kind="white" size="sm" onClick={() => go("shop")}><Icon name="bag" size={20} /> Shop</Button>
      </div>
    </nav>
  );

  return (
    <div className="nu-result">
      <div className="nu-rs-left">
        {head}
        {score}
        {bonusRow}
        {stats}
      </div>
      <div className="nu-rs-right">
        {actions}
        {modeBox}
        {xp}
        {notes}
        {extras}
        {coachCard}
        {share}
        {next}
      </div>
    </div>
  );
}
