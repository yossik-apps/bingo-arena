// Compete: live events, the weekly league, crews, the events calendar and new players. Same data, rules and words as Classic.
// Uses: profile, wallet, rounds, navigation, social, visitor, compete
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { needsAccount, type CompeteGroup, type CrewBoardRow, type Ev, type EventRow, type LeagueInfo, type LeagueRow, type NewPlayer, type Payout, type Race } from "../../lib/screenData";
import type { CrewInfo } from "../../lib/supabase";
import { OP_LABEL, opText, startsIn, timeLeft, when } from "../../lib/time";
import { Ball, type Tone } from "../Ball";
import { Button, Card, Chip, EmptyState, ErrorState, ListRow, ProgressBar, SectionHeader, Share, Sheet, Skeleton, Tabs, TextInput, Toast, Toggle } from "../components";
import { Coin, Icon, type IconName } from "../Icon";
import ScreenGuard from "../ScreenGuard";
import type { ScreenCtx, ScreenProps } from "./contract";
import {
  TABS, ago, autoLine, newPlayersOf, shownName, canJoinWithCode, chest, crewPct, eventLine, eventStatus, leagueNote, leagueRows, leftText, leftUntil, prizeNow, raceLine, raceRows, splitOps, weekEnd,
  type CompeteTab,
} from "./Compete.logic";
import "./compete.css";

const LEVEL_NAME: Record<string, string> = { beginner: "Beginner", medium: "Medium", hard: "Hard" };
const TONES: Tone[] = ["B", "I", "N", "G", "O"];
const toneFor = (name: unknown) => TONES[[...shownName(name)].reduce((n, c) => n + c.charCodeAt(0), 0) % TONES.length];
const Initial = ({ name, size = 34 }: { name?: string | null; size?: number }) => <Ball tone={toneFor(name)} size={size}><b className="nu-cp-initial">{[...shownName(name)][0]?.toUpperCase() ?? "?"}</b></Ball>;
const errText = (e: unknown) => (e instanceof Error && e.message ? e.message : "Something went wrong. Try again.");

/** Loads once, and again on `reload`. */
function useLoad<T>(load: () => Promise<T>) {
  const [s, setS] = useState<{ data?: T; failed?: boolean; error?: unknown }>({});
  const run = useCallback(() => { load().then((data) => setS({ data }), (error) => setS({ failed: true, error })); }, [load]);
  useEffect(run, [run]);
  return { ...s, reload: run };
}

/** What an action says when it finishes. */
function useNotice() {
  const [n, setN] = useState<{ text: string; error: boolean } | null>(null);
  const run = async (fn: () => Promise<void>, ok: string, after?: () => void | Promise<void>) => {
    setN(null);
    try { await fn(); setN({ text: ok, error: false }); await after?.(); } catch (e) { setN({ text: errText(e), error: true }); }
  };
  const view = n ? <Toast inline alert={n.error}>{n.text}</Toast> : null;
  return { run, view };
}

/** Classic's InfoTip: a help button that explains a rule. */
function Info({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="nu-cp-info" aria-label={`About ${label}`} onClick={() => setOpen(true)}><Icon name="help" size={20} /></button>
      {open && <Sheet label={`About ${label}`} title={`About ${label}`} onClose={() => setOpen(false)}><p className="nu-cp-tip">{text}</p></Sheet>}
    </>
  );
}
const Header = ({ title, info }: { title: string; info?: ReactNode }) => <div className="nu-cp-head"><SectionHeader title={title} />{info}</div>;

/** A ranked board on the blue page: the player's own row is white, as in the playground. */
function Board({ rows, label }: { rows: { key: string; rank: number; name: string; tail: ReactNode; sub?: ReactNode; me?: boolean; you?: boolean; isNew?: boolean }[]; label: string }) {
  return (
    <ol className="nu-cp-board" aria-label={label}>
      {rows.map((r) => (
        <li key={r.key} className={r.me ? "is-me" : ""}>
          <span className={`nu-cp-rank${r.rank <= 3 ? " is-top" : ""}`}>{r.rank}</span>
          <Initial name={r.name} />
          <span className="nu-cp-who">
            <span className="nu-cp-name"><span className="nu-cp-ellip" title={r.name}>{r.name}{r.me && r.you !== false ? " (you)" : ""}</span>{r.isNew && <Chip tone="pink">NEW</Chip>}</span>
            {r.sub && <span className="nu-cp-sub">{r.sub}</span>}
          </span>
          <b className="nu-cp-pts">{r.tail}</b>
        </li>
      ))}
    </ol>
  );
}

// ================= Events =================
type EvInfo = { used: number; board: EventRow[] };
function Events({ api, ctx }: { api: CompeteGroup; ctx: ScreenCtx }) {
  const { profile, wallet, rounds, social } = ctx;
  const load = useCallback(async () => {
    const evs = await api.events();
    const info = Object.fromEntries(await Promise.all(evs.map(async (e) => {
      const [used, board] = await Promise.all([api.attempts_used(e.id).catch(() => 0), api.event_leaderboard(e.id).catch(() => [] as EventRow[])]);
      return [e.id, { used, board }] as const;
    })));
    return { evs, info: info as Record<string, EvInfo> };
  }, [api]);
  const s = useLoad(load);
  const [races, setRaces] = useState<Race[]>([]);
  useEffect(() => { api.live_races().then(setRaces, () => undefined); }, [api]);
  const cfg = rounds.cfg;
  if (needsAccount(s.error)) return <Teaser ctx={ctx} />;
  if (s.failed) return <ErrorState title="Events did not load" onRetry={s.reload} />;
  if (!s.data || !cfg) return <Skeleton rows={2} height={160} label="Loading events" />;
  const blocked = !!profile?.banned || cfg.g.maint || !cfg.g.paid;
  const uid = profile?.id ?? "";
  return (
    <div className="nu-cp-cols">
      {races.map((r) => (
        <Card key={r.id} label={r.title}>
          <div className="nu-cp-card">
            <div className="nu-cp-cardtop"><h2><Icon name="bolt" size={22} /> {r.title}</h2><Chip tone="green">XP race · {leftUntil(r.ends_at)}</Chip></div>
            <p>{raceLine(r)}</p>
            {r.board.length > 0 && (
              <ol className="nu-cp-mini" aria-label={`${r.title} leaders`}>
                {raceRows(r).map((b) => <li key={b.rank} className={b.me ? "is-me" : ""}><span>{b.rank}</span><span className="nu-cp-ellip" title={b.name}>{b.name}{b.me ? " (you)" : ""}</span><b>{b.points} XP</b></li>)}
              </ol>
            )}
          </div>
        </Card>
      ))}
      <div className="nu-cp-span"><SectionHeader title="Live events" /></div>
      {s.data.evs.length === 0 && <div className="nu-cp-span"><EmptyState title="No live events right now." text="A new event opens every day. Check back soon." /></div>}
      {s.data.evs.map((e: Ev) => {
        const i = s.data!.info[e.id] ?? { used: 0, board: [] };
        const mine = i.board.find((r) => r.user_id === uid);
        const st = eventStatus(e, i.used, wallet.coins, blocked);
        return (
          <Card key={e.id} label={e.name}>
            <div className="nu-cp-card">
              <div className="nu-cp-cardtop"><h2>{e.name}</h2><Chip>{LEVEL_NAME[e.level] ?? e.level}</Chip></div>
              {e.auto && <p className="nu-cp-strong">{autoLine(e)}</p>}
              {e.descr && <p>{e.descr}</p>}
              <p>{eventLine(e, i.used, mine)}</p>
              <div className="nu-cp-foot">
                <span className="nu-cp-fee">Entry <Coin size={20} />{e.fee}</span>
                <Button size="sm" disabled={st.disabled} onClick={() => rounds.startEvent(e.id)} label={st.cta === "Enter" ? `Enter ${e.name} for ${e.fee} coins` : undefined}>{st.cta}</Button>
              </div>
              {i.board.length > 0 && (
                <ol className="nu-cp-mini" aria-label={`${e.name} leaders`}>
                  {i.board.slice(0, 5).map((r) => (
                    <li key={r.user_id} className={r.user_id === uid ? "is-me" : ""}><span>{r.rank}</span><span className="nu-cp-ellip" title={r.display_name}>{r.display_name}</span>{social.newIds.has(r.user_id) && <Chip tone="pink">NEW</Chip>}<b>{r.best}</b></li>
                  ))}
                </ol>
              )}
            </div>
          </Card>
        );
      })}
      <p className="nu-cp-note nu-cp-span">Only your best score counts. Entry fees are play money. Prizes are paid when the event ends.</p>
    </div>
  );
}

// ================= League =================
function League({ api, ctx }: { api: CompeteGroup; ctx: ScreenCtx }) {
  const load = useCallback(async () => {
    const [rows, info, last] = await Promise.all([api.league_board(), api.league_info().catch(() => null), api.league_payouts().catch(() => null)]);
    return { rows, info, last } as { rows: LeagueRow[]; info: LeagueInfo | null; last: Payout | null };
  }, [api]);
  const s = useLoad(load);
  if (needsAccount(s.error)) return <Teaser ctx={ctx} />;
  if (s.failed) return <ErrorState title="The league did not load" onRetry={s.reload} />;
  if (!s.data) return <Skeleton rows={4} height={56} label="Loading the league" />;
  const { rows, info, last } = s.data;
  const uid = ctx.profile?.id ?? "";
  return (
    <div className="nu-cp-cols">
      <div className="nu-cp-stack">
        <SectionHeader title="This week" />
        <p className="nu-cp-note">{leftText(weekEnd() - Date.now())} · points = XP you earn from rounds. The top players win coins every week.</p>
        {info && info.prizes.length > 0 && (
          <Card label="Prizes this week">
            <div className="nu-cp-card">
              <h2><Icon name="trophy" size={22} /> Prizes this week</h2>
              <ol className="nu-cp-prizes">{info.prizes.map((p, i) => <li key={i} className={i < 3 ? `is-g${i + 1}` : ""}><b>{i + 1}</b><Coin size={16} />{p.toLocaleString("en-US")}</li>)}</ol>
              <p>{leagueNote(info)}</p>
            </div>
          </Card>
        )}
        {rows.length === 0 ? <EmptyState title="No scores yet this week." text="Play a round to enter the league." /> : (
          <Board label="Weekly league" rows={leagueRows(rows, uid).map((r) => ({ key: r.user_id, rank: r.rank, name: r.display_name, tail: r.points, me: r.user_id === uid, isNew: ctx.social.newIds.has(r.user_id), sub: prizeNow(info, r.rank) || undefined }))} />
        )}
      </div>
      <div className="nu-cp-stack">
        <SectionHeader title="Last paid week" />
        {!last ? <p className="nu-cp-note">No league prizes have been paid yet.</p> : (
          <Card label="Last paid week">
            <div className="nu-cp-card">
              <p>Week of {last.week}</p>
              <ol className="nu-cp-mini">{last.winners.map((w) => <li key={w.rank}><span>{w.rank}</span><span className="nu-cp-ellip" title={w.name}>{w.name}</span><b>+{w.prize} coins</b></li>)}</ol>
            </div>
          </Card>
        )}
        <p className="nu-cp-note">Coins are play money. Weeks run Monday to Sunday (UTC).</p>
      </div>
    </div>
  );
}

// ================= Crew =================
const CREW_TIP = "A crew is a team of up to 20 players. Everyone's XP counts toward a weekly crew goal. Reach it and the crew chest opens for everyone who helped.";
const GOAL_TIP = "Every member's XP this week adds up. The goal grows with your crew: 150 XP per player. XP you earned before joining does not count. It resets every Monday (UTC).";

function CrewTab({ api, ctx }: { api: CompeteGroup; ctx: ScreenCtx }) {
  const load = useCallback(async () => {
    const crew = await api.crew_info();
    const [board, hits] = await Promise.all([api.crew_board().catch(() => [] as CrewBoardRow[]), crew ? Promise.resolve([]) : api.search_crews("").catch(() => [])]);
    return { crew, board, hits };
  }, [api]);
  const s = useLoad(load);
  const n = useNotice();
  const [hits, setHits] = useState<Awaited<ReturnType<CompeteGroup["search_crews"]>> | null>(null);
  const [q, setQ] = useState("");
  const [code, setCode] = useState("");
  const [f, setF] = useState({ name: "", tag: "", descr: "", open: true });
  const [descr, setDescr] = useState<string | null>(null);
  if (needsAccount(s.error)) return <Teaser ctx={ctx} />;
  if (s.failed) return <ErrorState title="Your crew did not load" onRetry={s.reload} />;
  if (!s.data) return <Skeleton rows={3} height={96} label="Loading crews" />;
  const { crew, board } = s.data;
  const after = async () => { setHits(null); setDescr(null); s.reload(); };
  const act = (fn: () => Promise<void>, ok: string) => void n.run(fn, ok, after);
  const search = () => { api.search_crews(q).then(setHits, () => setHits([])); };
  const uid = ctx.profile?.id ?? "";

  const top = (
    <div className="nu-cp-stack">
      <SectionHeader title="Top crews this week" />
      {board.length === 0 ? <p className="nu-cp-note">No crew has earned XP this week yet.</p> : (
        <Board label="Top crews this week" rows={board.slice(0, 8).map((r) => ({ key: r.crew_id, rank: r.rank, name: `${r.name} · ${r.tag}`, tail: r.points, sub: `${r.members} players`, me: !!crew && r.crew_id === crew.id, you: false }))} />
      )}
    </div>
  );

  if (!crew) {
    const list = hits ?? s.data.hits;
    return (
      <div className="nu-cp-cols">
        <div className="nu-cp-stack">
          {n.view}
          <Header title="Join a crew" info={<Info label="crews" text={CREW_TIP} />} />
          <div className="nu-cp-inline"><TextInput label="Find a crew" value={q} onChange={setQ} placeholder="Crew name" onEnter={search} /><Button size="sm" kind="white" onClick={search}>Search</Button></div>
          {list.length === 0 && <p className="nu-cp-note">No open crews found. Create the first one!</p>}
          {list.map((h) => (
            <ListRow key={h.id} lead={<Initial name={h.name} size={44} />}
              title={<span className="nu-cp-name"><span className="nu-cp-ellip" title={h.name}>{h.name}</span><Chip>{h.tag}</Chip></span>}
              sub={<>{h.descr && <span className="nu-cp-block">{h.descr}</span>}{h.members}/20 players · {h.points} XP this week</>}
              trail={<Button size="sm" onClick={() => act(() => api.join_crew(h.id), `Welcome to ${h.name}!`)} label={`Join ${h.name}`}>Join</Button>} />
          ))}
          <SectionHeader title="Have an invite code?" />
          <div className="nu-cp-inline"><TextInput label="Crew code" value={code} maxLength={8} placeholder="ABC123" onChange={(v) => setCode(v.toUpperCase())} /><Button size="sm" kind="white" disabled={!canJoinWithCode(code)} onClick={() => act(() => api.join_crew(null, code), "You joined the crew!")}>Join with code</Button></div>
        </div>
        <div className="nu-cp-stack">
          <SectionHeader title="Start your own" />
          <Card label="Start your own crew">
            <div className="nu-cp-card nu-cp-form">
              <TextInput label="Crew name" maxLength={20} value={f.name} onChange={(v) => setF({ ...f, name: v })} />
              <TextInput label="Tag (2 to 4 letters or numbers)" maxLength={4} value={f.tag} onChange={(v) => setF({ ...f, tag: v.toUpperCase() })} />
              <TextInput label="About your crew (optional)" maxLength={120} value={f.descr} onChange={(v) => setF({ ...f, descr: v })} />
              <Toggle label="Anyone can join (turn off for invite-only)" checked={f.open} onChange={(v) => setF({ ...f, open: v })} />
              <Button wide onClick={() => act(() => api.create_crew(f), "Your crew is ready. Invite friends with your crew code!")}>Create crew</Button>
            </div>
          </Card>
          {top}
        </div>
      </div>
    );
  }

  const c: CrewInfo = crew;
  const small = c.size < c.min_members;
  const about = descr ?? c.descr;
  return (
    <div className="nu-cp-cols">
      <div className="nu-cp-stack">
        {n.view}
        <Card label="Your crew">
          <div className="nu-cp-card">
            <span className="nu-cp-eyebrow">Your crew · rank #{c.rank} this week</span>
            <div className="nu-cp-cardtop"><h2 className="nu-cp-ellip" title={c.name}>{c.name}</h2><Chip>{c.tag}</Chip></div>
            <p>{c.descr || "No description yet."}</p>
          </div>
        </Card>
        <Header title="Weekly goal" info={<Info label="the crew goal" text={GOAL_TIP} />} />
        <Card label="Weekly goal">
          <div className="nu-cp-card">
            <div className="nu-cp-cardtop"><b>{c.week_points} / {c.goal} XP</b><span>You: {c.my_points} XP</span></div>
            <ProgressBar pct={crewPct(c)} label={`Crew goal, ${c.week_points} of ${c.goal} XP`} />
            {small && <p>Chests unlock with {c.min_members} or more players. Invite friends with the code below.</p>}
          </div>
        </Card>
        {([1, 2] as const).map((t) => {
          const ch = chest(c, t);
          return (
            <ListRow key={t} lead={<Ball tone={t === 1 ? "G" : "O"} size={44}><Icon name="gift" size={22} color="#14254F" /></Ball>} title={ch.name} sub={`At ${ch.need} XP · ${ch.reward}`}
              trail={<Button size="sm" disabled={ch.disabled} onClick={() => act(() => api.claim_crew_chest(t), "Chest opened!")}>{ch.label}</Button>} />
          );
        })}
        <SectionHeader title="Invite friends" />
        <Card label="Invite friends">
          <div className="nu-cp-card">
            <p>Crew code: <b className="nu-cp-code">{c.invite_code}</b></p>
            <Share title="Share your invite" text={`Join my crew "${c.name}" on Bingo Arena! Crew code: ${c.invite_code}`} link={window.location.origin} />
          </div>
        </Card>
        {c.is_leader && (
          <Card label="Leader tools">
            <div className="nu-cp-card nu-cp-form">
              <h2>Leader tools</h2>
              <TextInput label="About your crew" maxLength={120} value={about} onChange={setDescr} />
              <Toggle label="Anyone can join" checked={c.open} onChange={(v) => act(() => api.update_crew(about, v), v ? "Anyone can join now." : "Now invite-only.")} />
              <div><Button size="sm" kind="panel" onClick={() => act(() => api.update_crew(about, c.open), "Saved.")}>Save description</Button></div>
            </div>
          </Card>
        )}
      </div>
      <div className="nu-cp-stack">
        <SectionHeader title={`Members (${c.size}/20)`} />
        {c.members.map((m) => {
          const me = m.user_id === uid;
          return (
            <ListRow key={m.user_id} selected={me || undefined} lead={<Ball tone={m.role === "leader" ? "O" : toneFor(m.name)} size={40}><Icon name={m.role === "leader" ? "star" : "user"} size={20} color="#14254F" /></Ball>}
              title={<span className="nu-cp-name"><span className="nu-cp-ellip" title={m.name}>{m.name}{me ? " (you)" : ""}</span>{ctx.social.newIds.has(m.user_id) && <Chip tone="pink">NEW</Chip>}</span>}
              sub={`${m.role === "leader" ? "Leader" : "Member"} · ${m.points} XP`}
              trail={c.is_leader && !me ? <Button size="sm" kind="panel" label={`Remove ${m.name}`} onClick={() => act(() => api.kick_crew_member(m.user_id), `${m.name} was removed.`)}>Remove</Button> : undefined} />
          );
        })}
        {top}
      </div>
      {/* Leaving is kept apart from everything else, as a solid danger button (white on pink passes contrast in both themes). Classic asks no confirmation, so neither does this */}
      <div className="nu-cp-span nu-cp-leave">
        <Button size="sm" kind="danger" onClick={() => act(() => api.leave_crew(), "You left the crew.")}>Leave crew</Button>
      </div>
    </div>
  );
}

// ================= Calendar =================
function Calendar({ api, ctx }: { api: CompeteGroup; ctx: ScreenCtx }) {
  const s = useLoad(api.liveops);
  if (needsAccount(s.error)) return <Teaser ctx={ctx} />;
  if (s.failed) return <ErrorState title="The calendar did not load" onRetry={s.reload} />;
  if (!s.data) return <Skeleton rows={2} height={96} label="Loading the calendar" />;
  const { live, soon } = splitOps(s.data);
  const card = (o: (typeof live)[number], on: boolean) => (
    <ListRow key={o.id} lead={<Ball tone={on ? "G" : "O"} size={44}><Icon name={on ? "bolt" : "clock"} size={22} color="#14254F" /></Ball>}
      title={<span className="nu-cp-name"><span className="nu-cp-ellip" title={o.title}>{o.title}</span><Chip tone={on ? "green" : "gold"}>{on ? "On now" : OP_LABEL[o.kind]}</Chip></span>}
      sub={<>{o.descr && <span className="nu-cp-block">{o.descr}</span>}{opText(o) && <b className="nu-cp-block">{opText(o)}</b>}{on ? timeLeft(o.ends_at) : `Starts ${startsIn(o.starts_at)} · ${when(o.starts_at)}`}</>} />
  );
  return (
    <div className="nu-cp-cols">
      <div className="nu-cp-stack">
        <SectionHeader title="On now" />
        {live.length === 0 ? <p className="nu-cp-note">Nothing special is on right now. Check the schedule below.</p> : live.map((o) => card(o, true))}
      </div>
      <div className="nu-cp-stack">
        <SectionHeader title="Coming up" />
        {soon.length === 0 ? <p className="nu-cp-note">No events scheduled yet. New boosts are announced here.</p> : soon.map((o) => card(o, false))}
      </div>
      <p className="nu-cp-note nu-cp-span">Boosts switch on by themselves while an event is running. You do not need to do anything.</p>
    </div>
  );
}

// ================= New players =================
function NewPlayers({ api, ctx }: { api: CompeteGroup; ctx: ScreenCtx }) {
  const load = useCallback(async () => newPlayersOf(await api.new_players(30)), [api]);
  const s = useLoad(load);
  const n = useNotice();
  if (needsAccount(s.error)) return <Teaser ctx={ctx} />;
  if (s.failed) return <ErrorState title="New players did not load" onRetry={s.reload} />;
  if (!s.data) return <Skeleton rows={3} height={72} label="Loading new players" />;
  return (
    <div className="nu-cp-stack">
      {n.view}
      <SectionHeader title="Players who joined this week" />
      <p className="nu-cp-note">A friendly welcome appears in their inbox and helps new players feel at home. You can send up to 5 a day.</p>
      {s.data.length === 0 && <EmptyState title="No new players this week." text="Invite friends and they will show up here." />}
      <div className="nu-cp-grid">
        {s.data.map((p: NewPlayer) => (
          <ListRow key={p.user_id} selected={p.is_me || undefined} lead={<Initial name={p.name} size={44} />}
            title={<span className="nu-cp-name"><span className="nu-cp-ellip" title={p.name}>{p.name}{p.is_me ? " (you)" : ""}</span><Chip tone="pink">NEW</Chip></span>}
            sub={`Level ${p.level} · ${ago(p.joined_at)}`}
            trail={p.is_me ? undefined : <Button size="sm" kind={p.waved ? "ghost" : "panel"} disabled={p.waved} label={p.waved ? `${p.name} welcomed` : `Say welcome to ${p.name}`}
              onClick={() => void n.run(() => api.wave_hello(p.user_id), `Your welcome was sent to ${p.name}.`, s.reload)}>{p.waved ? "Welcomed" : "Say welcome"}</Button>} />
        ))}
      </div>
    </div>
  );
}

// ================= Visitor =================
const TEASER: [IconName, string, string][] = [["trophy", "Events", "Tournaments with prize pools. Your best score counts."], ["star", "Weekly league", "The most active players win coins every week."], ["users", "Crews", "Team up with up to 20 players and open the crew chest together."], ["gift", "Calendar", "Double XP hours, coin rushes and cheaper entries."]];
const TONE_OF: Tone[] = ["O", "G", "N", "P"];
function Teaser({ ctx }: { ctx: ScreenCtx }) {
  const v = ctx.visitor;
  return (
    <div className="nu-cp-cols">
      <Card label="Compete for prizes">
        <div className="nu-cp-card">
          <span className="nu-cp-eyebrow">Free account</span>
          <h2>Compete for prizes</h2>
          <p>Join tournaments, climb the weekly league and team up with friends.</p>
          <div data-must-see="Play free to unlock"><Button size="lg" wide disabled={!!v?.starting} onClick={() => v?.playFree()}>{v?.starting ? "Starting…" : "Play free to unlock"}</Button></div>
          <p>Already have an account? The same button lets you log in.</p>
        </div>
      </Card>
      <div className="nu-cp-stack" data-must-peek="what Compete has">
        {TEASER.map(([icon, head, text], i) => <ListRow key={head} lead={<Ball tone={TONE_OF[i]} size={44}><Icon name={icon} size={22} color="#14254F" /></Ball>} title={head} sub={text} />)}
      </div>
    </div>
  );
}

// ================= The screen =================
export default function Compete({ ctx }: ScreenProps) {
  const { navigation, visitor } = ctx;
  const [tab, setTab] = useState<CompeteTab>(navigation.competeTab);
  useEffect(() => setTab(navigation.competeTab), [navigation.competeTab]);
  const row = useRef<HTMLDivElement>(null);
  // fade the edges of the tab row on a phone where more tabs are hidden, so it reads as scrollable
  const [edges, setEdges] = useState("");
  const fade = useCallback(() => {
    const el = row.current;
    if (!el) return;
    const l = el.scrollLeft > 2, r = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setEdges(`${l ? " is-l" : ""}${r ? " is-r" : ""}`);
  }, []);
  useEffect(() => {
    fade();
    window.addEventListener("resize", fade);
    return () => window.removeEventListener("resize", fade);
  }, [fade]);
  // the opening tab may be off to the right on a phone: bring it into view without moving the page
  useLayoutEffect(() => {
    const el = row.current, on = el?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (!el || !on) return;
    const l = on.offsetLeft, r = l + on.offsetWidth;
    if (l < el.scrollLeft) el.scrollLeft = l - 8; else if (r > el.scrollLeft + el.clientWidth) el.scrollLeft = r - el.clientWidth + 8;
    fade();
  }, [tab, fade]);
  if (visitor) return <div className="nu-compete"><Teaser ctx={ctx} /></div>;
  const api = ctx.compete;
  return (
    <div className="nu-compete">
      <p className="nu-cp-intro">Join tournaments for prizes and climb the weekly league.</p>
      <div className={`nu-cp-tabs${edges}`} ref={row} onScroll={fade} data-must-see="the Compete tabs">
        <Tabs label="Compete" value={tab} onChange={setTab} options={TABS.map(([id, text]) => ({ id, text }))} />
      </div>
      <div className="nu-cp-body" data-must-peek="the first section">
        {/* each tab has its own guard: one failing tab shows "This part could not load" and the others keep working */}
        <ScreenGuard resetKey={tab} label={`Compete tab ${tab}`}>
          {tab === "events" ? <Events api={api} ctx={ctx} />
            : tab === "league" ? <League api={api} ctx={ctx} />
              : tab === "crew" ? <CrewTab api={api} ctx={ctx} />
                : tab === "calendar" ? <Calendar api={api} ctx={ctx} />
                  : <NewPlayers api={api} ctx={ctx} />}
        </ScreenGuard>
      </div>
    </div>
  );
}
