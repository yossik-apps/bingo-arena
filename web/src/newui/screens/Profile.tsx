// The profile: Bingo DNA, drills, stats, settings and the account. Looks follow the playground's "You" page;
// the data, rules and words are Classic's. A visitor sees Classic's demo profile, and every action asks them to sign up.
// Uses: profile, wallet, rounds, navigation, notices, social, daily, dna, settings, platform, visitor, account
import { useEffect, useMemo, useRef, useState } from "react";
import { DEMO_MASTERY } from "../../lib/demo";
import { DRILL_NAMES, SKILL_INFO, SKILLS, todaysDrill } from "../../lib/dna";
import { computePattern, SCORE_BANDS, scoreBand } from "../../lib/pattern";
import type { MasteryRow } from "../../lib/supabase";
import { Ball } from "../Ball";
import {
  Button, Card, Chip, ErrorState, ListRow, Modal, ProgressBar, SectionHeader, Select, Share, Skeleton, Switch, Tabs, TextField, Toast,
} from "../components";
import { Icon } from "../Icon";
import Radar from "../Radar";
import type { ScreenProps } from "./contract";
import {
  ago, ASK_DNA, ASK_DRILL, bandRange, BREAK_OPTIONS, canChangePassword, canDelete, coachAfterBlur, coachInitial, DELETE_TEXT, DEMO, DEMO_NOTE, dnaEmpty, dnaProgress, dnaSince,
  drillNote, firstTab, gamesEmpty, GUEST_LOGOUT, GUEST_TEXT, LEVEL, LIMIT_NOTE, LIMIT_OPTIONS, logOutLabel, MASTERY_EMPTY, masteryNext, masteryPct, masteryScore, MODE_ICON,
  PASSWORD_CHANGED, plural, rankColor, realEmail, removeAccount, RESULT_WORD, saveLabel, setLimit, shareText, shieldPct, shieldText, SPEND_OPTIONS, spendValue, spentText, submitPassword,
  xpLine, type ProfileTab,
} from "./Profile.logic";
import "./profile.css";

const savedTab = () => { try { return sessionStorage.getItem("ba_ptab"); } catch { return null; } };
const rememberTab = (t: string) => { try { sessionStorage.setItem("ba_ptab", t); } catch { /* ignore */ } };

export default function Profile({ ctx }: ScreenProps) {
  const { profile, wallet, rounds, dna: dnaGroup, settings: set, visitor } = ctx;
  const demo = !profile;
  const ask = (reason: string) => visitor?.askSignUp(reason);
  const [tab, setTabS] = useState<ProfileTab>(() => firstTab(savedTab(), demo));
  const setTab = (t: ProfileTab) => { setTabS(t); rememberTab(t); };
  const [explain, setExplain] = useState(false);
  const [share, setShare] = useState(false);

  // mastery and the account's email: account.load (Classic's rpc mastery and the session). The demo uses Classic's demo ranks.
  const account = useRef(ctx.account);
  account.current = ctx.account;
  const [loaded, setLoaded] = useState<{ mastery: MasteryRow[]; email: string } | null>(demo ? { mastery: DEMO_MASTERY, email: "" } : null);
  const [loadFailed, setLoadFailed] = useState(false);
  const load = () => {
    if (demo) return;
    setLoadFailed(false);
    account.current.load().then(setLoaded, () => setLoadFailed(true));
  };
  useEffect(load, [demo]);

  const dna = dnaGroup.dna;
  const coach = set.settings.coach || "Coach Nova";
  const member = !!wallet.economy?.club_until;
  const pattern = useMemo(() => computePattern(dnaGroup.rounds, member ? 50 : 10), [dnaGroup.rounds, member]);
  const drill = todaysDrill(dna);
  const p = profile
    ? { name: profile.name, level: profile.level, title: profile.title, frame: profile.frame, xpText: profile.xpText, xpPct: profile.xpPct, xpLeft: profile.xpLeft, coins: wallet.coins, streak: profile.streak, shields: profile.shields, dailyDone: profile.dailyDone }
    : { ...DEMO, title: undefined, frame: undefined };
  const startDrill = () => (demo ? ask(ASK_DRILL) : rounds.startDrill());

  // ---- header and facts, the playground's player panel and tiles ----
  const header = (
    <div className="nu-pf-hero">
      <Ball tone="P" size={72} className={`nu-pf-av${p.frame ? ` fr-${p.frame}` : ""}`}><b className="nu-pf-initial">{p.name.slice(0, 1).toUpperCase()}</b></Ball>
      <div className="nu-pf-who">
        <h1 className={`nu-pf-name${p.name.length > 14 ? " is-long" : ""}`} title={p.name} aria-label={p.name}>{p.name}</h1>
        <div className="nu-pf-tags">
          <Chip>Level {p.level}</Chip>
          {dna?.style && <Chip tone="green">{dna.style.name}</Chip>}
          {p.title && <Chip tone="dark">{p.title}</Chip>}
          {member && <Chip tone="pink">Club</Chip>}
        </div>
        <ProgressBar dark pct={p.xpPct} label="XP to next level" />
        <span className="nu-pf-xp">{xpLine(p.xpText, p.xpLeft, p.level)}</span>
      </div>
    </div>
  );
  const facts = (
    <div className="nu-pf-facts">
      <button type="button" className="nu-pf-fact" onClick={() => setExplain(true)} aria-label={`DNA score ${dna ? `${dna.overall}, ${scoreBand(dna.overall).name}` : "not yet known"}. What does my DNA score mean?`}>
        <b>{dna ? dna.overall : "–"}</b><span>DNA score{dna ? ` · ${scoreBand(dna.overall).name}` : ""} <Icon name="help" size={14} /></span>
      </button>
      <div className="nu-pf-fact"><b>{plural(p.streak, "day")}</b><span>login streak</span></div>
      <div className="nu-pf-fact"><b>{p.coins.toLocaleString("en-US")}</b><span>coins</span></div>
    </div>
  );

  // ---- My stats ----
  const dnaCard = (
    <Card label="Your Bingo DNA">
      <div className="nu-pf-card">
        <div className="nu-pf-head">
          <div><h2>Your Bingo DNA</h2><span className="nu-pf-sub">{dnaSince(dna)}</span></div>
          <div className="nu-pf-btns">
            <Button size="sm" kind="white" onClick={() => setExplain(true)}><Icon name="help" size={18} />What does it mean?</Button>
            {dna?.style && <Button size="sm" kind="white" onClick={() => (demo ? ask(ASK_DNA) : setShare(!share))}><Icon name="share" size={18} /><span aria-expanded={share}>Share</span></Button>}
          </div>
        </div>
        {share && dna?.style && <Share title="Share your play style" text={shareText(dna.style.name)} link={window.location.origin} />}
        {!dna ? (
          <div className="nu-pf-empty">
            <p>{dnaEmpty(dnaGroup.rounds.length)}</p>
            <ProgressBar pct={dnaProgress(dnaGroup.rounds.length)} label="Rounds towards your Bingo DNA" />
          </div>
        ) : (
          <>
            <div className="nu-pf-dnabody">
              <div className="nu-pf-radar"><Radar dna={dna} size={250} /></div>
              <div className="nu-pf-skills">
                {SKILLS.map((k) => (
                  <div key={k} className={`nu-pf-skill${dna.weakest === k ? " is-weak" : ""}`} title={SKILL_INFO[k].what}>
                    <span>{SKILL_INFO[k].name}{dna.weakest === k ? " · weakest" : ""}</span>
                    <ProgressBar pct={dna.skills[k] ?? 0} label={SKILL_INFO[k].name} />
                    <b>{dna.skills[k] ?? "?"}</b>
                  </div>
                ))}
                {dna.skills.pressure === null && <span className="nu-pf-note">Pressure appears after a Hard round or a fast stage.</span>}
              </div>
            </div>
            {dna.weakest && (
              <div className="nu-pf-coach">
                <span><b>Weakest: {SKILL_INFO[dna.weakest].name}</b> {SKILL_INFO[dna.weakest].tip}</span>
                <Button size="sm" onClick={startDrill}>Train: {DRILL_NAMES[drill]} · 60 s</Button>
              </div>
            )}
            <span className="nu-pf-note">{drillNote(ctx.daily.drillDone)}</span>
          </>
        )}
      </div>
    </Card>
  );

  const masteryCard = (
    <Card label="Mastery ranks">
      <div className="nu-pf-card">
        <div className="nu-pf-head"><h2>Mastery ranks</h2><span className="nu-pf-sub">Best score per level</span></div>
        {loadFailed && !loaded ? <ErrorState title="Your ranks did not load" onRetry={load} />
          : !loaded ? <Skeleton rows={2} height={48} label="Loading your ranks" />
            : loaded.mastery.length === 0 ? <p className="nu-pf-sub">{MASTERY_EMPTY}</p>
              : loaded.mastery.map((m) => (
                <div key={m.level} className="nu-pf-rank">
                  <span className="nu-pf-medal" style={{ background: rankColor(m.name) }} aria-hidden="true"><Icon name="medal" size={22} color="#14254F" /></span>
                  <div className="nu-pf-rk">
                    <div><b>{LEVEL[m.level] ?? m.level} · {m.name}</b><span>{masteryScore(m)}</span></div>
                    <ProgressBar pct={masteryPct(m)} label={`${LEVEL[m.level] ?? m.level} progress`} />
                  </div>
                  <span className="nu-pf-next">{masteryNext(m)}</span>
                </div>
              ))}
      </div>
    </Card>
  );

  const streakCard = (
    <Card label="Streaks">
      <div className="nu-pf-card">
        <h2>Streaks</h2>
        <div className="nu-pf-tiles">
          <div><Icon name="flame" size={22} /><b>{p.streak}</b><span>days logged in</span></div>
          <div><Icon name="shield" size={22} /><b>{p.shields} / 2</b><span>Streak Shields</span></div>
          <div><Icon name="star" size={22} /><b>{p.dailyDone}</b><span>Daily Challenges</span></div>
        </div>
        <ProgressBar pct={shieldPct(p.shields, p.dailyDone)} label="Next Streak Shield" showLabel value={shieldText(p.shields, p.dailyDone)} />
        <span className="nu-pf-note">A shield saves your login streak if you miss one day.</span>
      </div>
    </Card>
  );

  // ---- Last 10 games ----
  const games = !pattern ? (
    <Card label="Your last 10 games"><div className="nu-pf-card"><h2>Your last 10 games</h2><p className="nu-pf-sub">{gamesEmpty(dnaGroup.rounds.length, coach)}</p></div></Card>
  ) : (
    <div className="nu-pf-grid">
      <Card label="Your last 10 games">
        <div className="nu-pf-card">
          <div className="nu-pf-head">
            <h2>Your last {pattern.games.length} games {member && <Chip tone="pink">Club</Chip>}</h2>
            <span className="nu-pf-sub">{Math.round(pattern.avgAcc * 100)}% average accuracy{pattern.contests ? ` · ${pattern.wins} of ${pattern.contests} contests won` : ""}</span>
          </div>
          <ul className="nu-pf-games">
            {pattern.games.map((g, i) => (
              <li key={g.when + i}>
                <Ball tone="B" size={36}><Icon name={MODE_ICON[g.mode] ?? "play"} size={18} color="#14254F" /></Ball>
                <span className="nu-pf-gt"><b>{g.modeName}</b><span>{g.levelName} · {ago(g.when)}</span></span>
                <span className="nu-pf-gacc"><ProgressBar pct={g.acc * 100} label={`${Math.round(g.acc * 100)}% accuracy`} /><span>{Math.round(g.acc * 100)}%</span></span>
                <b className="nu-pf-gs">{g.score}</b>
                <span className={`nu-pf-gr is-${g.result ?? "none"}`}>{g.result ? RESULT_WORD[g.result] : ""}</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>
      <Card label={`${coach}'s read`}>
        <div className="nu-pf-card">
          <div className="nu-pf-coachhead">
            <Ball tone="G" size={44}><b className="nu-pf-initial is-small">{coachInitial(coach)}</b></Ball>
            <span><h2>{coach}'s read</h2><span className="nu-pf-sub">{pattern.headline}</span></span>
          </div>
          <span className="nu-pf-sub">Accuracy per game, oldest to newest</span>
          <div className="nu-pf-chart" role="img" aria-label={`Accuracy per game, oldest to newest: ${[...pattern.games].reverse().map((g) => `${Math.round(g.acc * 100)}%`).join(", ")}`}>
            {[...pattern.games].reverse().map((g, i) => <i key={i} title={`${g.modeName}: ${Math.round(g.acc * 100)}%`} style={{ height: `${Math.max(4, Math.round(g.acc * 100))}%` }} className={g.mode === "pvp" || g.mode === "tour" ? "is-vs" : ""} />)}
          </div>
          {pattern.insights.map((x) => <div key={x.title} className={`nu-pf-ins is-${x.tone}`}><b>{x.title}</b><span>{x.text}</span></div>)}
          <span className="nu-pf-note">Based on your own games. It updates after every round.</span>
        </div>
      </Card>
    </div>
  );

  return (
    <div className="nu-profile">
      {demo && (
        <div className="nu-pf-demo" role="note">
          <span><b>Demo profile.</b> {DEMO_NOTE}</span>
          <Button size="sm" onClick={() => ask(ASK_DNA)}>Sign up free</Button>
        </div>
      )}
      <div className="nu-pf-top">{header}{facts}</div>
      {profile?.guest && (
        <div className="nu-pf-guest">
          <span><b>You are playing as a guest.</b> {GUEST_TEXT}</span>
          <Button size="sm" onClick={profile.save}>{saveLabel(ctx.platform.crazyGames)}</Button>
        </div>
      )}
      <Tabs label="Profile sections" value={tab} onChange={setTab}
        options={[{ id: "stats", text: "My stats" }, { id: "games", text: "Last 10 games" }, ...(demo ? [] : [{ id: "settings" as const, text: "Settings" }])]} />
      {tab === "stats" && <div className="nu-pf-grid">{dnaCard}<div className="nu-pf-side">{masteryCard}{streakCard}</div></div>}
      {tab === "games" && games}
      {tab === "settings" && profile && <Settings ctx={ctx} email={loaded?.email ?? ""} />}

      {explain && (
        <Modal label="What your DNA score means" title="What your DNA score means" onClose={() => setExplain(false)}>
          <div className="nu-pf-explain">
            <p>Your DNA score{dna ? <> (<b>{dna.overall}</b>, {scoreBand(dna.overall).name})</> : ""} is the average of your six skills, each from 0 to 100. It comes from your last 20 rounds, so it changes as you play. You need 3 rounds to get one.</p>
            <ul className="nu-pf-bands">
              {SCORE_BANDS.map((b, i) => <li key={b.name} className={dna && scoreBand(dna.overall).name === b.name ? "is-on" : ""}><b>{bandRange(i)} · {b.name}</b><span>{b.text}</span></li>)}
            </ul>
            <h3>The six skills</h3>
            <ul className="nu-pf-skl">
              {SKILLS.map((k) => <li key={k}><b>{SKILL_INFO[k].name}{dna && dna.skills[k] !== null ? ` (${dna.skills[k]})` : ""}:</b> {SKILL_INFO[k].what}</li>)}
            </ul>
            <p className="nu-pf-sub">Your play style is your strongest skill. "Up" or "down since last week" compares your score with the rounds you played before then. The fastest way to raise your score is the daily drill for your weakest skill.</p>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** The Settings tab: play settings, play-time and spending limits, and the account. Only for a player with an account. */
function Settings({ ctx, email }: ScreenProps & { email: string }) {
  const profile = ctx.profile!;
  const { settings: set, wallet, navigation, notices, social } = ctx;
  const s = set.settings;
  const econ = wallet.economy;
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [delOpen, setDelOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [delMsg, setDelMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [askLogOut, setAskLogOut] = useState(false);

  // the three account actions make exactly Classic's calls, through ctx.account
  const changePassword = async () => {
    setPwMsg("");
    setBusy(true);
    const r = await submitPassword(ctx.account, pw, pw2);
    setBusy(false);
    if (r.ok) { setPw(""); setPw2(""); setPwOpen(false); }
    setPwMsg(r.msg);
  };
  const remove = async () => {
    setDelMsg("");
    setBusy(true);
    setDelMsg(await removeAccount(ctx.account, confirm));
    setBusy(false);
  };
  const logOut = () => (profile.guest ? setAskLogOut(true) : profile.logOut());

  return (
    <div className="nu-pf-grid">
      <Card label="Play settings">
        <div className="nu-pf-card nu-pf-form">
          <h2>Play settings</h2>
          <Select label="Break reminder" hint="A gentle nudge to rest" value={String(s.pulse)} options={BREAK_OPTIONS} onChange={(v) => set.update({ ...s, pulse: Number(v) })} />
          <Select label="Daily time limit" hint={`Played today: ${set.minutesToday} min on this device`} value={String(s.limit)} options={LIMIT_OPTIONS} onChange={(v) => set.update({ ...s, limit: Number(v) })} />
          <Switch label="Helpful tips" sub="Short hints in your first rounds" checked={s.tips} onChange={(v) => set.update({ ...s, tips: v })} />
          <Switch label="Larger text" sub="Easier to read everywhere" checked={s.bigText} onChange={(v) => set.update({ ...s, bigText: v })} />
          <TextField label="Coach's name" hint="Gives you tips after each round" maxLength={24} value={s.coach} onChange={(v) => set.update({ ...s, coach: v })} onBlur={() => { if (coachAfterBlur(s.coach) !== s.coach) set.update({ ...s, coach: coachAfterBlur(s.coach) }); }} />
          <ListRow title="Intro tour" sub="See how the game works again" trail={<Button size="sm" kind="white" onClick={set.replayTour}>Show again</Button>} />
          {econ && <Select label="Monthly spending limit" hint={spentText(econ.month_cents)} value={spendValue(econ.limit_cents)} options={SPEND_OPTIONS} onChange={(v) => void setLimit(ctx.account, v)} />}
          <p className="nu-pf-note">{LIMIT_NOTE}</p>
        </div>
      </Card>

      <Card label="Account">
        <div className="nu-pf-card nu-pf-form">
          <h2>Account</h2>
          {profile.guest && (
            <div className="nu-pf-save">
              <b>You are playing as a guest.</b><span>{GUEST_TEXT}</span>
              <Button size="sm" onClick={profile.save}>{saveLabel(ctx.platform.crazyGames)}</Button>
            </div>
          )}
          {realEmail(email) && <div className="nu-pf-line"><span>Email</span><b className="nu-pf-mail" title={email}>{email}</b></div>}
          {canChangePassword(profile.guest, email) && (
            <div className="nu-pf-line">
              <span>Password</span><b>{pwMsg && !pwOpen ? pwMsg : "••••••••"}</b>
              <Button size="sm" kind="white" onClick={() => { setPwOpen(!pwOpen); setPwMsg(""); }}><span aria-expanded={pwOpen}>{pwOpen ? "Cancel" : "Change"}</span></Button>
            </div>
          )}
          {pwOpen && (
            <div className="nu-pf-sub-form">
              <TextField label="New password (8+ characters)" type="password" autoComplete="new-password" value={pw} onChange={setPw} />
              <TextField label="Repeat it" type="password" autoComplete="new-password" value={pw2} onChange={setPw2} error={pwMsg || undefined} onEnter={() => void changePassword()} />
              <Button disabled={busy} onClick={() => void changePassword()}>Save new password</Button>
            </div>
          )}
          <div className="nu-pf-links">
            {social.invite && <ListRow title="Invite friends and earn rewards" lead={<Icon name="users" size={22} />} onClick={() => navigation.go("refer")} />}
            <ListRow title="Contact us" lead={<Icon name="mail" size={22} />} onClick={notices.contactUs} />
            <ListRow title="Help and guide" lead={<Icon name="help" size={22} />} onClick={() => navigation.go("help")} />
            <ListRow title={logOutLabel(profile.guest)} lead={<Icon name="out" size={22} />} onClick={logOut} />
          </div>
          <div className="nu-pf-foot">
            <span><a href="/terms.html" target="_blank" rel="noreferrer">Terms of Service</a> · <a href="/privacy.html" target="_blank" rel="noreferrer">Privacy Policy</a></span>
            <Button size="sm" kind="ghost" onClick={() => setDelOpen(!delOpen)}><span className="nu-pf-danger" aria-expanded={delOpen}>Delete account</span></Button>
          </div>
          {delOpen && (
            <div className="nu-pf-sub-form">
              <p>{DELETE_TEXT}</p>
              <TextField label="Confirmation" autoComplete="off" value={confirm} onChange={setConfirm} error={delMsg || undefined} />
              <Button disabled={!canDelete(confirm) || busy} onClick={() => void remove()}>Delete everything</Button>
            </div>
          )}
        </div>
      </Card>
      {askLogOut && (
        <Modal label="Log out" title="Log out?" onClose={() => setAskLogOut(false)}>
          <p className="nu-pf-sub">{GUEST_LOGOUT}</p>
          <Button kind="white" onClick={() => { setAskLogOut(false); profile.logOut(); }}>Log out anyway</Button>
        </Modal>
      )}
      {pwMsg === PASSWORD_CHANGED && <Toast>{PASSWORD_CHANGED}</Toast>}
    </div>
  );
}
