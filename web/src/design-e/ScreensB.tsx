import { useEffect, useRef, useState } from "react";
import { Ball, toneOf } from "./Ball";
import { Coin, Gem, Icon } from "./Icon";
import { Bar, LockedCard, Mini, Page, rowStyle, sectionTitle, Seg, useDesk, useToast, type Tab } from "./Nav";
import {
  chapterOpen, CHAPTER_NEED, CHAPTERS, CREW, CUP, CUP_BOTS, cupId, cupPrize, cupRank, EVENTS, FRIEND_WELCOME, goalText, h2hText, INVITE_STEPS, LEAGUE_PROTECTED, leagueBoard, LOOKS, PASS, passReward, passText, PLAYER,
  RANKS, rewardText, SEASON_TIERS, SEASON_XP, seasonReward, STAGES, stageOpen, usd, WELCOME,
  type Run, type Saved,
} from "./data";
import { featureLevel, levelOf, unlocked, xpForLevel } from "../lib/levels";
import { fx } from "./sound";
import { VolumeRow, VoicePick, VoiceSwitch } from "./SoundControl";
import { shareText } from "./share";
import { track } from "./track";

type Common = { level: number; s: Saved; onNav: (t: Tab | "daily") => void };

// ============ Journey (level 4), Season and Events (level 12) ============
export function Journey({ level, s, onPlayStage, onClaimTier, onClaimEvent, onBuyPass, onClaimPass, onNav }: Common & { onPlayStage: (i: number) => void; onClaimTier: () => void; onClaimEvent: (i: number) => void; onBuyPass: () => void; onClaimPass: () => void }) {
  const [tab, setTab] = useState<"journey" | "season" | "events">("journey");
  const seasonOn = unlocked("season", level), eventsOn = unlocked("events", level);
  const tiers = Math.min(SEASON_TIERS, Math.floor(s.season / SEASON_XP));
  const total = s.stars.reduce((a, b) => a + b, 0);
  const goldWaiting = s.pass ? Math.max(0, tiers - s.passClaimed) : 0;
  return (
    <Page title="Journey" level={level} tab="journey" onNav={(t) => onNav(t)} coins={s.coins} gems={s.gems}>
      <Seg label="Journey" value={tab} onChange={setTab} options={[{ id: "journey", text: "Stages" }, { id: "season", text: "Season", locked: !seasonOn }, { id: "events", text: "Events", locked: !eventsOn }]} />
      {tab === "journey" && (
        <>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#DCE7FF" }}>Win stars to open new chapters. {total} of {STAGES.length * 3} stars.</p>
          {CHAPTERS.map((cn, c) => {
            if (!chapterOpen(c, s.stars)) return <div key={cn} className="e-span"><LockedCard title={`Chapter ${c + 1}: ${cn}`} text={`Needs ${CHAPTER_NEED[c]} stars. You have ${total}.`} /></div>;
            const here = STAGES.map((st, i) => ({ st, i })).filter(({ st }) => st.chapter === c);
            const got = here.reduce((a, { i }) => a + (s.stars[i] ?? 0), 0);
            return (
              <div key={cn} className="e-span e-chapter" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <h2 style={{ ...sectionTitle, display: "flex", justifyContent: "space-between" }}><span>Chapter {c + 1} · {cn}</span><span>{got}/{here.length * 3}</span></h2>
                <div className="e-stages">
                {here.map(({ st, i }) => {
                  const open = stageOpen(i, s.stars);
                  const have = s.stars[i] ?? 0;
                  const left = i % 2 === 0;
                  return (
                    <button key={st.name} disabled={!open} onClick={() => onPlayStage(i)} className={open ? "e-white" : "e-panel"}
                      style={{ ...rowStyle, border: 0, font: "inherit", textAlign: "left", width: "calc(100% - 22px)", alignSelf: left ? "flex-start" : "flex-end", color: open ? "#14254F" : "#fff", boxShadow: open ? "0 4px 0 #0E3E9C" : "none", minHeight: 62, flexShrink: 0 }}>
                      <Ball tone={open ? toneOf(i * 6 + 3) : "X"} mode="n" num={i + 1} size={44} />
                      <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
                        <span className="e-ld" style={{ fontSize: 18, lineHeight: 1.1 }}>{st.name}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.25, color: open ? "#4A5A85" : "#DCE7FF" }}>{open ? goalText(st) : "Win a star on the stage before"}</span>
                      </span>
                      {open ? (
                        <span role="img" aria-label={`${have} of 3 stars`} style={{ display: "flex", gap: 2 }}>
                          {[0, 1, 2].map((k) => <Icon key={k} name="star" size={22} color={k < have ? "#D98E00" : "#B9C4DD"} fill={k < have ? "#FFC531" : "none"} sw={1.6} />)}
                        </span>
                      ) : <Icon name="lock" size={20} color="#DCE7FF" />}
                    </button>
                  );
                })}
                </div>
              </div>
            );
          })}
        </>
      )}
      {tab === "season" && (
        <>
          <div className="e-white e-span" style={{ ...rowStyle, flexDirection: "column", alignItems: "stretch", gap: 8, borderRadius: 22 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Ball tone="P" size={48} mode="n" num={tiers} />
              <span style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <span className="e-ld" style={{ fontSize: 20, lineHeight: 1.1 }}>Season 1: Bingo Night</span>
                <span className="e-sub" style={{ fontSize: 13, fontWeight: 700 }}>Tier {tiers} of {SEASON_TIERS} · 23 days left</span>
              </span>
            </span>
            <Bar pct={tiers >= SEASON_TIERS ? 100 : ((s.season % SEASON_XP) / SEASON_XP) * 100} />
          </div>
          <div className="e-span e-pass" role="group" aria-label="Season pass" style={{ ...rowStyle, borderRadius: 22, background: s.pass ? "#FFF1C2" : "#FFF8E1", color: "#14254F", flexWrap: "wrap" }}>
            <Ball tone="P" size={50}><Icon name="star" size={26} color="#14254F" /></Ball>
            <span style={{ flex: 1, minWidth: 150, display: "flex", flexDirection: "column", gap: 1 }}>
              <span className="e-ld" style={{ fontSize: 20, lineHeight: 1.1 }}>{s.pass ? "Gold pass is on" : `Season pass ${usd(PASS.usd)}`}</span>
              <span className="e-sub" style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.3 }}>{s.pass ? (goldWaiting ? `${goldWaiting} gold ${goldWaiting === 1 ? "reward is" : "rewards are"} waiting.` : "Gold rewards arrive as you pass each tier.") : "A gold reward on every tier, 3 looks and 1 extra streak freeze. It never adds points."}</span>
            </span>
            {s.pass ? (goldWaiting > 0 ? <Mini onClick={onClaimPass}>Claim gold</Mini> : <span className="e-tag" style={{ background: "#157A49" }}>ACTIVE</span>) : <Mini onClick={onBuyPass}>Get it</Mini>}
          </div>
          <div className="e-span e-tiers" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {Array.from({ length: SEASON_TIERS }, (_, t) => {
              const reached = t < tiers, claimed = t < s.seasonClaimed, next = t === s.seasonClaimed && reached;
              const rw = seasonReward(t + 1);
              const gold = passReward(t + 1), goldDone = s.pass && t < s.passClaimed, goldReady = s.pass && reached && !goldDone;
              return (
                <div key={t} className={reached ? "e-white" : "e-panel"} style={{ ...rowStyle, minHeight: 52, padding: "6px 10px 6px 8px", gap: 8, boxShadow: reached ? "0 3px 0 #0E3E9C" : "none", color: reached ? "#14254F" : "#fff" }}>
                  <Ball tone={reached ? "G" : "X"} size={36} mode="n" num={t + 1} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 900, display: "flex", alignItems: "center", gap: 4 }}>{rw.gems ? <Gem size={18} /> : null}{rewardText(rw, 99)}</span>
                  <span className="e-goldcell" data-on={s.pass || undefined} aria-label={`Gold reward: ${passText(gold, 99)}${goldDone ? ", claimed" : !s.pass ? ", needs the pass" : ""}`}
                    style={{ background: reached ? "#FFF1C2" : "rgba(255,197,49,.2)", color: reached ? "#6B3A00" : "#FFE9A0", boxShadow: goldReady ? "0 0 0 2px #FFC531" : undefined }}>
                    {goldDone ? <Icon name="check" size={14} color="#157A49" sw={3.4} /> : !s.pass ? <Icon name="lock" size={12} color={reached ? "#6B3A00" : "#FFE9A0"} /> : null}{passText(gold, 99)}
                  </span>
                  {claimed ? <span role="img" aria-label="Claimed" style={{ width: 24, height: 24, borderRadius: "50%", background: "#2EB872", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="check" size={14} color="#fff" sw={3.4} /></span>
                    : next ? <Mini onClick={onClaimTier}>Claim</Mini> : <Icon name="lock" size={18} color={reached ? "#4A5A85" : "#DCE7FF"} />}
                </div>
              );
            })}
          </div>
        </>
      )}
      {tab === "events" && EVENTS.map((e, i) => {
        const have = Math.min(e.goal, i === 0 ? s.eventScore : s.eventLines);
        const ready = have >= e.goal && !s.eventClaimed[i];
        return (
          <div key={e.title} className="e-white" style={{ ...rowStyle, flexDirection: "column", alignItems: "stretch", gap: 8, borderRadius: 22 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Ball tone={e.tone} size={52}><Icon name="star" size={26} color="#14254F" /></Ball>
              <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
                <span className="e-ld" style={{ fontSize: 20, lineHeight: 1.1 }}>{e.title}</span>
                <span className="e-sub" style={{ fontSize: 13, fontWeight: 700 }}>{e.desc}</span>
              </span>
              <span className="e-tag">{e.ends}</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ flex: 1 }}><Bar pct={(have / e.goal) * 100} /></span>
              <span className="e-sub" style={{ fontSize: 13, fontWeight: 900 }}>{have}/{e.goal}</span>
              {s.eventClaimed[i] ? <span className="e-tag" style={{ background: "#2EB872" }}>CLAIMED</span> : <Mini disabled={!ready} onClick={() => onClaimEvent(i)}>Claim</Mini>}
            </span>
            <span style={{ fontSize: 13, fontWeight: 800 }}>Prize: {rewardText(e.reward, 99)}</span>
          </div>
        );
      })}
    </Page>
  );
}

// ============ Compete: league, friends, crew ============
export function Compete({ level, s, onMatch, onDuel, onSeeInbox, onCupEnter, onCupPlay, onCupClaim, onNav }: Common & {
  onMatch: () => void; onDuel: (name: string, via?: "inbox") => void; onSeeInbox: () => void; onCupEnter: () => void; onCupPlay: () => void; onCupClaim: () => void;
}) {
  const friendsOn = unlocked("friendDuels", level), crewOn = unlocked("crew", level), pvpOn = unlocked("pvp", level);
  // a friend answered a challenge: open on the Friends tab so the answer is the first thing seen
  const [tab, setTab] = useState<"league" | "friends" | "crew" | "cup">(() => (friendsOn && s.inbox.some((n) => !n.read) ? "friends" : "league"));
  const [toast, say] = useToast();
  const seen = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (tab !== "friends") return;
    const fresh = s.inbox.filter((n) => !n.read);
    if (fresh.length) { fresh.forEach((n) => seen.current.add(n.id)); onSeeInbox(); }
  }, [tab, s.inbox]); // eslint-disable-line react-hooks/exhaustive-deps
  const board = leagueBoard(s.weekly, s.friends);
  const inLeague = board.filter((p) => p.friend).length;
  const cup = s.tourn && s.tourn.id === cupId(s.dayOffset) ? s.tourn : null;
  const cupRankNow = cup && cup.tries > 0 ? cupRank(cup.best) : 0;
  const me = board.findIndex((p) => p.name === "You");
  const above = me > 0 ? board[me - 1] : null;
  const crewTotal = s.friends.reduce((a, f) => a + f.pts, 0) + s.crew;
  const invite = async () => {
    const link = `${location.origin}${location.pathname}?ref=${PLAYER.code}`;
    const how = await shareText(`Play Bingo Arena with me! Use my code ${PLAYER.code} and get a welcome gift (${rewardText(WELCOME, 99)}): ${link}`);
    track("invite_link_copied", { how });
    say(how === "copied" ? "Invite link copied. Paste it in WhatsApp." : how === "shared" ? "Invite sent" : "Could not share. Try again.");
  };
  return (
    <Page title="Compete" cls="e-cmp" level={level} tab="compete" onNav={(t) => onNav(t)} coins={s.coins} gems={s.gems} toast={toast}>
      {pvpOn ? (
        <button className="e-gold" onClick={onMatch} style={{ height: 60, flexShrink: 0, fontSize: 22 }}>
          <Icon name="users" size={26} color="#3A2300" />Play a person
        </button>
      ) : <LockedCard title="Play a person" text={`Live matches. Unlocks at level ${featureLevel.pvp}`} />}
      <Seg label="Compete" value={tab} onChange={setTab} options={[{ id: "league", text: "League" }, { id: "friends", text: s.inbox.some((n) => !n.read) ? "Friends •" : "Friends", locked: !friendsOn }, { id: "crew", text: "Crew", locked: !crewOn }, { id: "cup", text: "Cup" }]} />
      {tab === "league" && (
        <>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#DCE7FF" }}>
            {inLeague ? `Friends league · you, ${inLeague} ${inLeague === 1 ? "friend" : "friends"} and bots` : "Bronze league"} · ends in 3 days. Top 3 move up.{LEAGUE_PROTECTED ? " Welcome week: nobody moves down." : ""}
            {inLeague === 0 && friendsOn ? " Invite friends and they join your league." : ""}
          </p>
          {above && (
            <div className="e-white e-span e-board e-above" style={{ ...rowStyle, minHeight: 44, padding: "6px 14px", fontSize: 14, fontWeight: 800, borderRadius: 16 }}>
              You are {me + 1}{["st", "nd", "rd"][me] ?? "th"}. {above.pts - board[me].pts + 1} points to pass {above.name}.
            </div>
          )}
          <div className="e-span e-board" style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {board.map((p, i) => {
              const you = p.name === "You";
              const up = i < 3, down = !LEAGUE_PROTECTED && i >= board.length - 3;
              return (
                <div key={p.name} className={you ? "e-white e-ring" : "e-panel"} style={{ ...rowStyle, minHeight: 50, padding: "4px 12px 4px 8px", boxShadow: you ? undefined : "none", background: you ? "#FFF8E1" : undefined, color: you ? "#14254F" : "#fff" }}>
                  <span className="e-ld" style={{ width: 26, textAlign: "center", fontSize: 18, color: you ? "#14254F" : up ? "#7CF0A8" : down ? "#FF9C92" : "#DCE7FF" }}>{i + 1}</span>
                  <Ball tone={toneOf(p.name.length * 7 + 2)} size={34}><b style={{ fontSize: 15 }}>{p.name[0]}</b></Ball>
                  <span style={{ flex: 1, fontSize: 16, fontWeight: 900, display: "flex", alignItems: "center", gap: 6 }}>{you ? "You" : p.name}{p.friend && <span className="e-tag" style={{ background: "#2F6FE4" }}>FRIEND</span>}</span>
                  <span style={{ fontSize: 15, fontWeight: 900 }}>{p.pts}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
      {tab === "cup" && (
        <>
          <div className="e-white" style={{ ...rowStyle, flexDirection: "column", alignItems: "stretch", gap: 10, borderRadius: 22 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Ball tone="O" size={52}><Icon name="trophy" size={26} color="#14254F" /></Ball>
              <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
                <span className="e-ld" style={{ fontSize: 22, lineHeight: 1.1 }}>Weekend Cup</span>
                <span className="e-sub" style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.25 }}>One board for everyone. Best of {CUP.tries} tries counts. Ends in 2 days.</span>
              </span>
            </span>
            {!cup ? (
              <Mini onClick={onCupEnter} short={s.coins < CUP.entry} label={`Enter the cup for ${CUP.entry} coins`}><span style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>Enter <Coin size={18} />{CUP.entry}</span></Mini>
            ) : (
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 800, lineHeight: 1.35 }}>
                  {cup.tries === 0 ? `You are in. ${CUP.tries} tries to play.` : `Best ${cup.best} · place ${cupRankNow} of ${CUP_BOTS.length + 1} · ${CUP.tries - cup.tries} ${CUP.tries - cup.tries === 1 ? "try" : "tries"} left`}
                </span>
                {cup.claimed ? <span className="e-tag" style={{ background: "#157A49" }}>CLAIMED</span>
                  : cup.tries < CUP.tries ? <Mini onClick={onCupPlay} label="Play a cup try">Play</Mini> : <Mini onClick={onCupClaim}>Claim prize</Mini>}
              </span>
            )}
            <span style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12, fontWeight: 800 }}>
              <span className="e-sub">Prizes: places 1 to 3 win {rewardText(cupPrize(1), 99)}, 4 to 10 win {rewardText(cupPrize(4), 99)}, others {rewardText(cupPrize(11), 99)}.</span>
              <span className="e-sub">Entry is paid with coins you earned. Boosters are off in the cup.</span>
            </span>
          </div>
          {cup && cup.tries > 0 && (
            <div className="e-board" style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {[...CUP_BOTS.slice(0, 9).map((v, i) => ({ name: ["Mika", "Luna", "Omer", "Gal", "Shai", "Roni", "Eden", "Tom", "Nir"][i], pts: v })), { name: "You", pts: cup.best }].sort((a, b) => b.pts - a.pts).map((p, i) => {
                const you = p.name === "You";
                return (
                  <div key={p.name} className={you ? "e-white e-ring" : "e-panel"} style={{ ...rowStyle, minHeight: 46, padding: "4px 12px 4px 8px", boxShadow: you ? undefined : "none", background: you ? "#FFF8E1" : undefined, color: you ? "#14254F" : "#fff" }}>
                    <span className="e-ld" style={{ width: 26, textAlign: "center", fontSize: 18 }}>{you ? cupRankNow : i + 1}</span>
                    <span style={{ flex: 1, fontSize: 16, fontWeight: 900 }}>{p.name}</span>
                    <span style={{ fontSize: 15, fontWeight: 900 }}>{p.pts}</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      {tab === "friends" && (!friendsOn ? <LockedCard title="Friends" text={`Unlocks at level ${featureLevel.friendDuels}`} /> : (
        <>
          <div className="e-white" style={{ ...rowStyle, flexDirection: "column", alignItems: "stretch", gap: 10, borderRadius: 22 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Ball tone="I" size={48}><Icon name="share" size={22} color="#14254F" /></Ball>
              <span style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <span className="e-ld" style={{ fontSize: 20, lineHeight: 1.1 }}>Invite friends</span>
                <span className="e-sub" style={{ fontSize: 13, fontWeight: 700 }}>They get {rewardText(WELCOME, 99)} for their first challenge.</span>
              </span>
              <Mini onClick={invite}>Invite</Mini>
            </span>
            <span style={{ fontSize: 13, fontWeight: 900, background: "#EEF3FF", borderRadius: 12, padding: "6px 10px" }}>Your code: {PLAYER.code}</span>
            <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {INVITE_STEPS.map((st) => (
                <span key={st.text} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, fontWeight: 800 }}>
                  <span className="e-sub">Friend {st.text.toLowerCase()}</span><span>{rewardText(st.reward, level)}</span>
                </span>
              ))}
            </span>
          </div>
          {s.inbox.length > 0 && (
            <>
              <h2 style={sectionTitle}>Answers to your challenges</h2>
              {s.inbox.slice(0, 4).map((n) => {
                const won = n.mine > n.theirs, tied = n.mine === n.theirs;
                return (
                  <div key={n.id} className="e-white" style={{ ...rowStyle, minHeight: 60 }}>
                    <Ball tone={toneOf(n.from.length * 9)} size={38}><b style={{ fontSize: 16 }}>{n.from[0]}</b></Ball>
                    <span style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
                      <span style={{ fontSize: 15, fontWeight: 900, lineHeight: 1.2 }}>{n.from} scored {n.theirs}{(!n.read || seen.current.has(n.id)) && <span className="e-tag" style={{ marginLeft: 6 }}>NEW</span>}</span>
                      <span className="e-sub" style={{ fontSize: 12, fontWeight: 700 }}>You had {n.mine}. {tied ? "A tie." : won ? "You won." : `${n.from} won.`} {h2hText(s.h2h, n.from)}</span>
                    </span>
                    <Mini onClick={() => onDuel(n.from, "inbox")}>Rematch</Mini>
                  </div>
                );
              })}
            </>
          )}
          <h2 style={sectionTitle}>Your friends</h2>
          {s.friends.length === 0 ? (
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#DCE7FF" }}>No friends here yet. Send your invite. When a friend joins you can duel them on the same board.</p>
          ) : s.friends.map((f) => (
            <div key={f.name} className="e-white" style={{ ...rowStyle, minHeight: 54 }}>
              <Ball tone={toneOf(f.name.length * 9)} size={38}><b style={{ fontSize: 16 }}>{f.name[0]}</b></Ball>
              <span style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 16, fontWeight: 900 }}>{f.name}</span>
                <span className="e-sub" style={{ fontSize: 12, fontWeight: 700 }}>{f.step === 0 ? "Joined" : INVITE_STEPS[f.step - 1].text} · {h2hText(s.h2h, f.name)}</span>
              </span>
              <Mini onClick={() => onDuel(f.name)}>Duel</Mini>
            </div>
          ))}
        </>
      ))}
      {tab === "crew" && (!crewOn ? <LockedCard title="Crew" text={`Unlocks at level ${featureLevel.crew}`} /> : s.friends.length === 0 ? (
        <div className="e-white" style={{ ...rowStyle, flexDirection: "column", alignItems: "stretch", gap: 10, borderRadius: 22 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Ball tone="N" size={52}><Icon name="users" size={26} color="#14254F" /></Ball>
            <span style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <span className="e-ld" style={{ fontSize: 22, lineHeight: 1.1 }}>Create your crew</span>
              <span className="e-sub" style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>Invite 2 friends to open the team chest. Your crew is only the friends you invite.</span>
            </span>
          </span>
          <Bar pct={(s.friends.length / 2) * 100} />
          <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="e-sub" style={{ fontSize: 13, fontWeight: 900 }}>{s.friends.length} of 2 friends joined</span>
            <Mini onClick={invite}>Invite</Mini>
          </span>
        </div>
      ) : (
        <>
          <div className="e-white" style={{ ...rowStyle, flexDirection: "column", alignItems: "stretch", gap: 8, borderRadius: 22 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Ball tone="N" size={48}><Icon name="users" size={24} color="#14254F" /></Ball>
              <span style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <span className="e-ld" style={{ fontSize: 20, lineHeight: 1.1 }}>{CREW.name}</span>
                <span className="e-sub" style={{ fontSize: 13, fontWeight: 700 }}>Team chest: {Math.min(crewTotal, CREW.goal)} / {CREW.goal}</span>
              </span>
              <Mini onClick={invite}>Invite</Mini>
            </span>
            <Bar pct={(crewTotal / CREW.goal) * 100} />
          </div>
          <h2 style={sectionTitle}>Members</h2>
          {[...s.friends.map((f) => ({ name: f.name, pts: f.pts })), { name: "You", pts: s.crew }].sort((a, b) => b.pts - a.pts).map((m) => (
            <div key={m.name} className="e-panel" style={{ ...rowStyle, minHeight: 48, padding: "4px 12px 4px 8px", boxShadow: "none", color: "#fff" }}>
              <Ball tone={toneOf(m.name.length * 5 + 1)} size={34}><b style={{ fontSize: 15 }}>{m.name[0]}</b></Ball>
              <span style={{ flex: 1, fontSize: 16, fontWeight: 900 }}>{m.name}</span>
              <span style={{ fontSize: 15, fontWeight: 900 }}>{m.pts}</span>
            </div>
          ))}
        </>
      ))}
    </Page>
  );
}

// ============ Finding a player ============
export function Matching({ run, onStart, onCancel }: { run: Run; onStart: () => void; onCancel: () => void }) {
  const [found, setFound] = useState(false);
  useEffect(() => {
    const a = setTimeout(() => setFound(true), 1800);
    const b = setTimeout(onStart, 3200);
    return () => { clearTimeout(a); clearTimeout(b); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const name = run.rival?.name ?? "Player";
  const desk = useDesk();
  return (
    <div className={`e-root e-fade e-hero-bg${desk ? " e-desk-embed e-center" : ""}`} style={{ alignItems: "center", justifyContent: "center", gap: 18, padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Ball tone="P" size={92} style={{ border: "4px solid #fff" }}><b style={{ fontSize: 40 }}>S</b></Ball>
        <span className="e-ld" style={{ fontSize: 34, color: "#FFC531", textShadow: "0 3px 0 #123E91" }}>VS</span>
        {found ? <Ball tone="I" size={92} style={{ border: "4px solid #fff" }}><b style={{ fontSize: 40 }}>{name[0]}</b></Ball>
          : <Ball tone="X" size={92} className="e-jig" style={{ border: "4px solid #fff" }}><b style={{ fontSize: 40 }}>?</b></Ball>}
      </div>
      <h1 className="e-ld" style={{ margin: 0, fontSize: 30, textShadow: "0 3px 0 #123E91", textAlign: "center" }}>{found ? `${name} is ready!` : "Finding a player..."}</h1>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, textAlign: "center", maxWidth: 280 }}>{found ? "Same board, same numbers. Highest score wins." : "Looking for someone at your level."}</p>
      <button className="e-ghost" onClick={onCancel} style={{ marginTop: 18 }}>Cancel</button>
    </div>
  );
}

// ============ Profile: stats, Bingo DNA, Mastery, account and settings ============
export function Profile({ level, s, onBack, onNav, onSave, onDelete }: Common & { onBack: () => void; onSave: () => void; onDelete: () => void }) {
  const [, redraw] = useState(0);
  const [sure, setSure] = useState(false);
  const st = s.stats, n = Math.max(1, s.rounds);
  const lo = xpForLevel(levelOf(s.xp)), hi = xpForLevel(levelOf(s.xp) + 1);
  const skills = [
    { name: "Accuracy", v: s.rounds ? Math.round((st.accSum / n) * 100) : 0 },
    { name: "Speed", v: s.rounds ? Math.min(100, Math.round(st.scoreSum / n / 3)) : 0 },
    { name: "Focus", v: s.rounds ? Math.max(0, 100 - Math.round((st.wrong / n) * 12)) : 0 },
    { name: "Lines", v: Math.min(100, Math.round((st.lines / n) * 40)) },
    { name: "Stamina", v: Math.min(100, s.rounds * 8) },
  ];
  const weakest = skills.reduce((a, b) => (b.v < a.v ? b : a));
  const mastery = Math.floor(st.scoreSum / 400);
  const rank = RANKS[Math.min(RANKS.length - 1, Math.floor(mastery / 3))];
  const look = LOOKS.find((l) => l.id === s.look) ?? LOOKS[0];
  const tile = (big: string | number, small: string) => (
    <div className="e-white" style={{ flex: 1, borderRadius: 18, boxShadow: "0 4px 0 #0E3E9C", padding: "8px 4px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <span className="e-ld" style={{ fontSize: 26, lineHeight: 1.05 }}>{big}</span>
      <span className="e-sub" style={{ fontSize: 12, fontWeight: 800 }}>{small}</span>
    </div>
  );
  const toggle = (label: string, on: boolean, set: (v: boolean) => void) => (
    <button role="switch" aria-checked={on} onClick={() => { set(!on); redraw((x) => x + 1); }} className="e-white"
      style={{ ...rowStyle, border: 0, font: "inherit", minHeight: 52, justifyContent: "space-between", width: "100%" }}>
      <span style={{ fontSize: 16, fontWeight: 900 }}>{label}</span>
      <span aria-hidden="true" style={{ width: 52, height: 30, borderRadius: 99, background: on ? "#2EB872" : "#B9C4DD", position: "relative", flexShrink: 0 }}>
        <span style={{ position: "absolute", top: 3, left: on ? 25 : 3, width: 24, height: 24, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
      </span>
    </button>
  );
  return (
    <Page title="You" cls="e-prof" level={level} tab={null} onNav={(t) => onNav(t)} onBack={onBack} coins={s.coins} gems={s.gems}>
      <div className="e-pcol">
      <div className="e-panel" style={{ ...rowStyle, boxShadow: "none", gap: 14 }}>
        <Ball tone="P" size={72} style={{ border: "4px solid #fff" }}><b style={{ fontSize: 32 }}>S</b></Ball>
        <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
          <span className="e-ld" style={{ fontSize: 24, lineHeight: 1 }}>{PLAYER.name}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="e-tag">Lv {levelOf(s.xp)}</span>
            {level >= 2 && <span className="e-tag" style={{ background: "#2F6FE4" }}>{rank}</span>}
            <span style={{ flex: 1 }}><Bar dark pct={((s.xp - lo) / (hi - lo)) * 100} /></span>
          </span>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#DCE7FF" }}>Dabber: {look.name}</span>
        </span>
      </div>
      {s.linked === "guest" && (
        <div className="e-white" style={{ ...rowStyle, background: "#FFF8E1", flexDirection: "column", alignItems: "stretch", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.35 }}>Playing as a guest. Your progress is saved on this device only.</span>
          <Mini onClick={onSave}>Save progress</Mini>
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        {tile(s.rounds, "rounds")}{tile(s.best, "best score")}{tile(st.lines, "lines")}
      </div>
      <h2 style={sectionTitle}>Bingo DNA</h2>
      {unlocked("dna", level) ? (
        <div className="e-white" style={{ ...rowStyle, flexDirection: "column", alignItems: "stretch", gap: 9, borderRadius: 22 }}>
          {skills.map((k) => (
            <span key={k.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 70, fontSize: 14, fontWeight: 900 }}>{k.name}</span>
              <span style={{ flex: 1 }}><Bar pct={k.v} /></span>
              <span className="e-sub" style={{ width: 30, textAlign: "right", fontSize: 13, fontWeight: 900 }}>{k.v}</span>
            </span>
          ))}
          <span style={{ fontSize: 13, fontWeight: 800, background: "#FFF8E1", borderRadius: 12, padding: "8px 10px", lineHeight: 1.35 }}>
            <b className="e-ld" style={{ fontWeight: 400 }}>Coach Nova:</b> Your weakest skill is {weakest.name.toLowerCase()}. {s.rounds ? "Play a few rounds that focus on it." : "Play a round to see your DNA."}
          </span>
        </div>
      ) : <LockedCard title="Bingo DNA" text={`Your skill profile. Unlocks at level ${featureLevel.dna}`} />}
      <h2 style={sectionTitle}>Mastery rank</h2>
      {unlocked("mastery", level) ? (
        <div className="e-white" style={{ ...rowStyle, borderRadius: 22 }}>
          <Ball tone="P" size={56}><Icon name="trophy" size={28} color="#3A2300" /></Ball>
          <span style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <span className="e-ld" style={{ fontSize: 24, lineHeight: 1.1 }}>{rank}</span>
            <span className="e-sub" style={{ fontSize: 13, fontWeight: 700 }}>{mastery} mastery points · 1 point per 400 score</span>
          </span>
        </div>
      ) : <LockedCard title="Mastery" text={`${level >= 2 ? `You are ${rank}. ` : ""}The full rank screen unlocks at level ${featureLevel.mastery}`} />}
      </div>
      <div className="e-pcol">
      <h2 style={sectionTitle}>Settings</h2>
      <div className="e-white" style={{ ...rowStyle, flexDirection: "column", alignItems: "stretch", gap: 2, padding: "8px 14px" }}>
        <VolumeRow light />
        <VoiceSwitch light />
        <VoicePick light />
      </div>
      {toggle("Vibration", fx.haptics, (v) => fx.set({ haptics: v }))}
      <div className="e-white" style={{ ...rowStyle, minHeight: 52 }}>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 900 }}>{s.linked === "guest" ? "Guest account" : `Saved with ${s.linked[0].toUpperCase() + s.linked.slice(1)}`}</span>
        {s.linked === "guest" && <Mini onClick={onSave}>Save</Mini>}
      </div>
      <button className="e-ghost" onClick={() => { if (sure) { setSure(false); onDelete(); } else setSure(true); }} style={{ color: "#FFE1DD" }}>
        {sure ? "Tap again to delete everything" : "Delete my data"}
      </button>
      </div>
    </Page>
  );
}
