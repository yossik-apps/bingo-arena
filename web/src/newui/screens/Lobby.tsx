// The Lobby (the Play page). It sets the pattern for every other screen: see PATTERN.md.
// Uses: profile, wallet, rounds, navigation, social, daily, dna, platform, visitor
import { useEffect, useRef, useState } from "react";
import { DRILL_NAMES, SKILL_INFO, todaysDrill } from "../../lib/dna";
import { levelKeys, type DailyInfo } from "../../lib/supabase";
import { opText, timeLeft } from "../../lib/time";
import { Ball, type Tone } from "../Ball";
import { Badge, Button, Card, Chip, ListRow, SectionHeader, Sheet, Skeleton, Tabs, Toast } from "../components";
import { Globe } from "../Globe";
import { Coin, Icon, type IconName } from "../Icon";
import type { ScreenProps } from "./contract";
import { BOOSTERS, boostersToUse, dailyTier, firstMode, LEVEL_FEEL, LEVEL_NAME, LEVEL_TIP, lobbyStatus, MODE_TIP, ownedTotal, type LobbyMode } from "./Lobby.logic";
import "./lobby.css";

const saved = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const remember = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

/** The globe grows with the window, as in the playground: never taller than the window, never wider than its column. */
function useLayout(extra: number) {
  const calc = () => {
    const w = window.innerWidth, h = window.innerHeight, wide = w >= 1000;
    // phones: the globe takes what is left after the header, controls, Start button and bottom bar, so Start stays on screen
    const big = document.documentElement.classList.contains("big-text") ? 1.12 : 1;
    const others = (526 + extra) * big;
    if (!wide) return { wide, k: Math.max(0.46, Math.min(0.74, (w - 32) / 330, (h - others) / 378)) };
    const rail = w <= 1180 ? 200 : 248, stacked = w <= 1180;
    const pad = Math.min(64, Math.max(24, w * 0.04)), gap = Math.min(64, Math.max(32, w * 0.04));
    const inner = Math.min(1440, w - rail - 2 * pad), col = stacked ? inner : ((inner - gap) * 1.15) / 2.15;
    return { wide, k: Math.max(0.74, Math.min(1.08 + Math.max(0, Math.min(1, (w - 1280) / 640)) * 0.52, (h - 72 - 40 - 56) / 378, col / 330)) };
  };
  const [v, setV] = useState(calc);
  useEffect(() => {
    const f = () => setV(calc());
    f();
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, [extra]);
  return v;
}

const MODES: { id: LobbyMode; short: string; name: string; icon: IconName; tone: Tone }[] = [
  { id: "solo", short: "Practice", name: "Practice", icon: "user", tone: "B" },
  { id: "ghost", short: "Ghost", name: "Beat the Ghost", icon: "ghost", tone: "I" },
  { id: "pvp", short: "Person", name: "Play a person", icon: "users", tone: "N" },
];

export default function Lobby({ ctx }: ScreenProps) {
  const { profile, wallet, rounds, navigation, social, daily, dna, platform, visitor } = ctx;
  const cfg = rounds.cfg;
  const isNew = !!visitor || profile?.played === 0;
  const [mode, setModeS] = useState<LobbyMode>(() => firstMode(saved("ba_mode"), isNew));
  // room the globe gives up: the booster row, and the visitor banner above the page
  const { wide, k } = useLayout((ownedTotal(wallet.boosters) > 0 && mode !== "pvp" ? 64 : 0) + (visitor ? 72 : 0));
  const [levelS, setLevelS] = useState(() => saved("ba_level") ?? "beginner");
  const [armed, setArmed] = useState<string[]>([]);
  const [tips, setTips] = useState(false);
  const [info, setInfo] = useState<DailyInfo | null>(null);
  const [board, setBoard] = useState<{ open: boolean; rows: Awaited<ReturnType<typeof daily.loadLeaderboard>> | null }>({ open: false, rows: null });
  const dailyCard = useRef<HTMLDivElement>(null);
  useEffect(() => { void daily.loadChallenge().then(setInfo, () => setInfo(null)); }, [rounds.dailyKey]);

  if (!cfg) return <Skeleton rows={3} height={96} label="Loading the game" />;

  const level = cfg.levels[levelS] ? levelS : "beginner";
  const setMode = (m: LobbyMode) => { setModeS(m); remember("ba_mode", m); };
  const setLevel = (l: string) => { setLevelS(l); remember("ba_level", l); };
  const s = lobbyStatus({ cfg, mode, level, balance: wallet.coins, banned: !!profile?.banned, visitor: !!visitor, freeRounds: !!visitor?.freeRounds });
  const start = () => { if (s.blocked) return; rounds.start(mode, level, boostersToUse(mode, armed, wallet.boosters)); setArmed([]); };
  const modeInfo = MODES.find((m) => m.id === mode)!;
  const live = social.arena && (social.arena.online > 0 || social.arena.waiting.length > 0)
    ? `${social.arena.waiting.length ? `${social.arena.waiting.length} waiting now · ` : ""}${social.arena.online} online` : "";
  const tier = info ? dailyTier(info.played, info.goals) : null;
  const toggleBoard = async () => {
    const open = !board.open;
    setBoard((b) => ({ ...b, open }));
    if (open) { const rows = await daily.loadLeaderboard(); setBoard({ open: true, rows }); }
  };
  const levels = levelKeys(cfg.levels);
  const owned = ownedTotal(wallet.boosters);

  // ---- the fee, next to the globe ----
  const caption = (
    <p className="nu-lb-cap" data-must-see="fee" role="status">
      {s.paid
        ? <><Chip><Coin size={18} />{s.fee} coins to enter</Chip><span>{mode === "pvp" ? `Winner gets ${s.win}` : `Win ${s.win}`}</span></>
        : <><Chip tone="green">Free</Chip><span>{cfg.g.total} seconds. Highest score wins.</span></>}
    </p>
  );

  const modeControl = wide ? (
    <div className="nu-lb-group">
      <h2 className="nu-lb-h2">Choose your game</h2>
      <div className="nu-lb-rows" role="group" aria-label="Game mode">
        {MODES.map((m) => {
          const fee = cfg.levels[level].fee, win = Math.round(fee * cfg.g.pay);
          return (
            <ListRow key={m.id} selected={mode === m.id} onClick={() => setMode(m.id)} title={m.name}
              sub={m.id === "solo" ? "Play alone. Free. Beat your own best." : m.id === "ghost" ? `A practice rival. Entry ${fee} coins, win ${win}.` : `Live match on the same board. Winner gets ${win}.${live ? ` ${live}.` : ""}`}
              lead={<Ball tone={m.tone} size={52}><Icon name={m.icon} size={26} color="#14254F" /></Ball>}
              trail={m.id === "solo" ? <Chip tone="green">Free</Chip> : <span className="nu-lb-fee"><Coin size={20} />{fee}</span>} />
          );
        })}
      </div>
    </div>
  ) : (
    <>
      <Tabs label="Game mode" value={mode} onChange={setMode} options={MODES.map((m) => ({ id: m.id, text: m.short, icon: <Icon name={m.icon} size={18} /> }))} />
      {mode === "pvp" && live && <p className="nu-lb-note">{live}</p>}
    </>
  );

  const main = (
    <>
      {modeControl}
      <Tabs small label="Level" value={level} onChange={setLevel} options={levels.map((l) => ({ id: l, text: LEVEL_NAME[l] ?? l }))} />
      <p className="nu-lb-note">{LEVEL_FEEL[level]}</p>
      {owned > 0 && mode !== "pvp" && (
        <div className="nu-lb-boost" role="group" aria-label="Boosters for this round">
          {BOOSTERS.map(([key, name]) => {
            const have = wallet.boosters[key] ?? 0;
            return (
              <button key={key} type="button" aria-pressed={armed.includes(key)} disabled={have === 0} aria-label={`${name}, you have ${have}`}
                onClick={() => setArmed((a) => (a.includes(key) ? a.filter((x) => x !== key) : [...a, key]))}>
                <span>{name}</span><b>{have}</b>
              </button>
            );
          })}
        </div>
      )}
      {owned > 0 && mode === "pvp" && <p className="nu-lb-note">Boosters are not allowed in live matches, so everyone has the same chance.</p>}
      <Button size="lg" wide disabled={s.blocked} onClick={start}>{s.cta}{s.paid && <span className="nu-lb-ctafee"><Coin size={24} />{s.fee}</span>}</Button>
      <p className="nu-lb-hint">{s.hint}</p>
      {rounds.error && <p className="nu-lb-error" role="alert">{rounds.error}</p>}
      <div className="nu-lb-tipline"><Button kind="ghost" size="sm" onClick={() => setTips(true)}><Icon name="help" size={20} />How modes and levels work</Button></div>
    </>
  );

  const tiles = (daily.cal || info) && (
    <div className="nu-lb-tiles">
      {daily.cal && (
        <button type="button" className="nu-lb-tile" onClick={daily.openCalendar}>
          <Ball tone="P" size={wide ? 46 : 40}><Icon name="gift" size={wide ? 22 : 20} color="#14254F" /></Ball>
          <span><b>{daily.cal.claimed_today ? "Reward claimed" : `Day ${daily.cal.day} reward`}</b><small>{daily.cal.claimed_today ? `Streak ${profile?.streak ?? 0} · back tomorrow` : `Today: +${daily.cal.next} coins`}</small></span>
        </button>
      )}
      {info && (
        <button type="button" className="nu-lb-tile" onClick={() => dailyCard.current?.scrollIntoView({ behavior: "smooth", block: "center" })}>
          <Ball tone="G" size={wide ? 46 : 40}><Icon name="target" size={wide ? 22 : 20} color="#14254F" /></Ball>
          <span><b>Daily Challenge</b><small>{info.played?.status === "scored" ? `Played: ${info.played.score}` : "New board today"}</small></span>
        </button>
      )}
    </div>
  );

  const drill = todaysDrill(dna.dna);
  const c = rounds.challenge;

  return (
    <div className="nu-lobby">
      {/* the part the playground shows */}
      <div className="nu-lb-top">
        {wide && (
          <div className="nu-lb-stage">
            <Globe k={k} label={`Start: ${modeInfo.name}, ${LEVEL_NAME[level] ?? level}`} dim={s.blocked} disabled={s.blocked} onPlay={start} />
            {caption}
          </div>
        )}
        <div className="nu-lb-panel">
          {tiles}
          {!wide && (
            <div className="nu-lb-stage">
              <Globe k={k} label={`Start: ${modeInfo.name}, ${LEVEL_NAME[level] ?? level}`} dim={s.blocked} disabled={s.blocked} onPlay={start} />
              {caption}
            </div>
          )}
          {main}
        </div>
      </div>

      {/* everything else the live game has, each only when it applies */}
      <div className="nu-lb-more">
        {c && !c.mine && !c.played && !c.expired && (
          <Card label="Friend's challenge">
            <div className="nu-lb-card">
              <h2>{c.creator} challenged you!</h2>
              <p>Beat <b>{c.score}</b> points on {LEVEL_NAME[c.level] ?? c.level}, on the exact same board. Free, one try.</p>
              <div className="nu-lb-actions"><Button size="sm" onClick={() => rounds.acceptChallenge(c.code)}>Accept the challenge</Button><Button size="sm" kind="ghost" onClick={rounds.dismissChallenge}>Not now</Button></div>
            </div>
          </Card>
        )}
        {cfg.g.note && <Toast inline>{cfg.g.note}</Toast>}
        {isNew && (
          <Card label="Welcome">
            <div className="nu-lb-card"><h2>Start with a free practice round</h2><p>It takes under two minutes and costs nothing. The menu has help and the guide.</p></div>
          </Card>
        )}
        {rounds.ops.length > 0 && (
          <div className="nu-lb-group" role="status" aria-label="Events on now">
            <SectionHeader title="On now" />
            <div className="nu-lb-ops">
              {rounds.ops.map((o) => <ListRow key={o.id} title={o.title} sub={`${opText(o) || o.descr} · ${timeLeft(o.ends_at)}`} lead={<Ball tone="O" size={44}><Icon name="bolt" size={22} color="#14254F" /></Ball>} />)}
            </div>
          </div>
        )}
        {profile?.guest && profile.played >= 2 && (
          <ListRow title={platform.crazyGames ? "Keep your progress on every device" : "Don't lose your progress"}
            sub={`You have ${wallet.coins.toLocaleString("en-US")} coins and level ${profile.level}. ${platform.crazyGames ? "Log in to CrazyGames and they follow you everywhere." : "Save them with Google or email: it takes 10 seconds."}`}
            lead={<Ball tone="P" size={44}><Icon name="check" size={22} color="#14254F" /></Ball>} trail={<Button size="sm" onClick={profile.save}>{platform.crazyGames ? "Log in" : "Save"}</Button>} />
        )}
        {info && (
          <div ref={dailyCard}>
            <Card label="Daily Challenge">
              <div className="nu-lb-card">
                <div className="nu-lb-cardtop"><h2>Daily Challenge</h2><Chip tone="gold">{LEVEL_NAME[info.level] ?? info.level}{info.label ? ` · ${info.label}` : ""}</Chip></div>
                <p>The same board for everyone today. One try, free. Streak Shields: {info.shields}/2 · done {info.done}</p>
                <ul className="nu-lb-goals" aria-label="Rewards">
                  {info.goals.map((g, i) => <li key={i} className={tier !== null && tier > i ? "is-got" : ""}><Icon name="star" size={18} fill={tier !== null && tier > i ? "currentColor" : "none"} />{g}<span className="nu-lb-sr">{tier !== null && tier > i ? " points, reached" : " points"}</span></li>)}
                </ul>
                <div className="nu-lb-actions">
                  {info.played
                    ? <Button size="sm" kind="white" disabled>{info.played.status === "scored" ? `Done: ${info.played.score} pts${info.rank ? ` · #${info.rank}` : ""}` : "Round abandoned"}</Button>
                    : <Button size="sm" onClick={rounds.startDaily}>Play today's challenge</Button>}
                  <Button size="sm" kind="ghost" onClick={() => void toggleBoard()}><span aria-expanded={board.open}>{board.open ? "Hide leaderboard" : "Leaderboard"}</span></Button>
                </div>
                {board.open && !board.rows && <Skeleton rows={2} height={40} label="Loading the leaderboard" />}
                {board.open && board.rows && (
                  board.rows.length === 0 ? <p>Nobody has finished yet. Be the first!</p> : (
                    <ol className="nu-lb-board">
                      {board.rows.slice(0, 5).map((r) => (
                        <li key={r.user_id} className={r.user_id === profile?.id ? "is-me" : ""}><span>{r.rank}</span><span className="nu-lb-boardname" title={r.display_name}>{r.display_name}</span>{social.newIds.has(r.user_id) && <Chip tone="pink">NEW</Chip>}<b>{r.score}</b></li>
                      ))}
                    </ol>
                  )
                )}
              </div>
            </Card>
          </div>
        )}
        {!visitor && (
          <ListRow title={`Today's fix: ${DRILL_NAMES[drill]}`} sub={`60 seconds${dna.dna?.weakest ? ` to train your ${SKILL_INFO[dna.dna.weakest].name}` : ""}. ${daily.drillDone ? "Done today, train again any time." : "Free, +20 coins today."}`}
            lead={<Ball tone="G" size={44}><Icon name="target" size={22} color="#14254F" /></Ball>} onClick={rounds.startDrill} />
        )}
        {platform.rewardAd("lobby", true)}
        {social.newCount > 0 && (
          <ListRow title={`${social.newCount} new player${social.newCount === 1 ? "" : "s"}`} sub="Joined this week. Tap to say welcome."
            lead={<Ball tone="N" size={44}><Icon name="users" size={22} color="#14254F" /></Ball>} trail={<Badge count={social.newCount} label={`${social.newCount} new players`} />}
            onClick={() => { navigation.setCompeteTab("new"); navigation.go("compete"); }} />
        )}
        {social.invite && profile && (
          <ListRow title="Invite friends" sub="Earn coins and gems for every friend who plays." lead={<Ball tone="B" size={44}><Icon name="users" size={22} color="#14254F" /></Ball>} onClick={() => navigation.go("refer")} />
        )}
      </div>

      {tips && (
        <Sheet label="How modes and levels work" title="How it works" onClose={() => setTips(false)}>
          <p className="nu-lb-tip"><b>Modes.</b> {MODE_TIP}</p>
          <p className="nu-lb-tip"><b>Levels.</b> {LEVEL_TIP}</p>
        </Sheet>
      )}
    </div>
  );
}
