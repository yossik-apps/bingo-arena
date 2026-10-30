import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import "@fontsource/lilita-one/400.css";
import "@fontsource/nunito/600.css";
import "@fontsource/nunito/700.css";
import "@fontsource/nunito/800.css";
import "@fontsource/nunito/900.css";
import "./tokens.css";
import "./visuals.css";
import "./shell.css";
import { CalendarStrip, type Cal } from "../views/LoginCalendar";
import { Ball, type Tone } from "./Ball";
import { Coin, Gem, Icon, type IconName } from "./Icon";
import SoundControl from "./SoundControl";

export type ShellPlayer = {
  name: string; level: number; xpPct: number; xpText: string; title?: string; frame?: string;
  coins: number; gems: number | null; streak: number; unread: number; adminUnread: number; isAdmin: boolean;
  guest: boolean; saveLabel: string; cal: Cal | null;
  /** today's box in the desktop menu */
  drillDone: boolean; styleName?: string; dnaTag: string;
};

export type ShellProps = {
  screen: string;
  onNav: (screen: string) => void;
  /** null for a visitor who has not started playing */
  player: ShellPlayer | null;
  onGems?: () => void; onSave?: () => void; onLogOut?: () => void; onDrill?: () => void;
  /** visitors: Log in is left out inside CrazyGames */
  onLogin?: () => void; onPlayFree?: () => void; starting?: boolean;
  invite: boolean; facebook?: string | null;
  /** live-match bar, notices and errors, shown above the page */
  banners?: ReactNode;
  /** pop-ups that sit over the shell */
  overlays?: ReactNode;
  children?: ReactNode;
};

const TABS: [string, string, IconName][] = [["lobby", "Play", "play"], ["journey", "Journey", "map"], ["compete", "Compete", "trophy"], ["collect", "Collect", "book"], ["shop", "Shop", "bag"]];
const count = (n: number) => (n > 9 ? "9+" : String(n));

/** A screen that has no new version yet. Players never reach this: see shellAllowed in lib/design.ts. */
export function EmptyPage({ screen }: { screen: string }) {
  const balls: [Tone, number][] = [["B", 7], ["I", 22], ["N", 41], ["G", 53], ["O", 68]];
  return (
    <section className="nu-page">
      <div className="nu-balls" aria-hidden="true">{balls.map(([t, n]) => <Ball key={t} tone={t} num={n} size={52} />)}</div>
      <h1>{TABS.find(([k]) => k === screen)?.[1] ?? screen}</h1>
      <p>This screen has no new design yet.</p>
    </section>
  );
}

export default function NewShell({ screen, onNav, player: p, onGems, onSave, onLogOut, onDrill, onLogin, onPlayFree, starting, invite, facebook, banners, overlays, children }: ShellProps) {
  const [calOpen, setCalOpen] = useState(false);
  useLayoutEffect(() => {
    const html = document.documentElement;
    html.classList.add("nu-on");
    return () => html.classList.remove("nu-on");
  }, []);
  useEffect(() => {
    if (!calOpen) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setCalOpen(false); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [calOpen]);
  const go = (v: string) => () => onNav(v);
  const current = (v: string) => (screen === v ? { "aria-current": "page" as const } : {});
  const help = <button className="nu-icon" aria-label="Help and guide" onClick={go("help")}><Icon name="help" size={22} /></button>;

  const wide: [string, IconName, string, string][] = p
    ? [["profile", "target", "Bingo DNA", p.dnaTag], ["wallet", "bolt", "Coins", p.coins.toLocaleString()], ["inbox", "mail", "Inbox", p.unread ? String(p.unread) : ""], ...(invite ? [["refer", "users", "Invite friends", ""] as [string, IconName, string, string]] : []), ["help", "help", "Help and guide", ""]]
    : [["profile", "target", "Bingo DNA", "Demo"], ["help", "help", "Help and guide", ""]];

  return (
    <div className="nu-root">
      <div className="nu-frame">
        <nav className="nu-nav" aria-label="Main">
          <div className="nu-brand">Bingo Arena</div>
          <span className="nu-navlabel">Play</span>
          <div className="nu-tabs">
            {TABS.map(([k, name, icon]) => <button key={k} className="nu-nb" {...current(k)} onClick={go(k)}><Icon name={icon} size={24} sw={2.2} /><span>{name}</span></button>)}
          </div>
          <span className="nu-navlabel">You</span>
          <div className="nu-navwide">
            {wide.map(([k, icon, name, tag]) => (
              <button key={k} className="nu-nb" {...current(k)} onClick={go(k)}><Icon name={icon} size={22} sw={2.2} /><span>{name}</span>{tag && <em className={`nu-navtag ${k === "inbox" ? "nu-hot" : ""}`} style={{ fontStyle: "normal" }}>{tag}</em>}</button>
            ))}
            {p?.isAdmin && <button className="nu-nb" onClick={go("admin")}><Icon name="gear" size={22} sw={2.2} /><span>Admin</span>{p.adminUnread > 0 && <em className="nu-navtag nu-hot" style={{ fontStyle: "normal" }}>{p.adminUnread}</em>}</button>}
            {facebook && <a className="nu-nb" href={facebook} target="_blank" rel="noreferrer"><Icon name="ext" size={22} sw={2.2} /><span>Our Facebook</span></a>}
          </div>
          <div className="nu-today">
            {p ? (
              <>
                <span className="nu-navlabel">Today</span>
                <div className="nu-todaybox">
                  <button className="nu-trow" onClick={onDrill}><Icon name={p.drillDone ? "check" : "bolt"} size={20} /><span><b>Daily drill</b><small>{p.drillDone ? "Done today" : "60 s · +20 coins"}</small></span></button>
                  <div className="nu-trow"><Icon name="flame" size={20} /><span><b>{p.streak}-day streak</b><small>Keep it going</small></span></div>
                  {p.styleName && <button className="nu-trow" onClick={go("profile")}><Icon name="target" size={20} /><span><b>{p.styleName}</b><small>Your play style</small></span></button>}
                </div>
              </>
            ) : <button className="nu-btn nu-btn-gold nu-wide" disabled={starting} onClick={onPlayFree}>{starting ? "Starting…" : "Play free"}</button>}
          </div>
        </nav>

        <div className="nu-column">
          <header className="nu-top">
            {p ? (
              <button className="nu-who" aria-label={`Open your profile. ${p.name}, level ${p.level}`} onClick={go("profile")}>
                <span className={`nu-avatar ${p.frame ? "fr-" + p.frame : ""}`} aria-hidden="true">{p.name.slice(0, 1).toUpperCase()}</span>
                <span className="nu-idtext">
                  <span className="nu-name">{p.name}</span>
                  <span className="nu-levelrow">
                    <span className="nu-level">Lv {p.level}</span>
                    <span className="nu-xp" role="progressbar" aria-label="XP to next level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.xpPct}><i style={{ width: `${p.xpPct}%` }} /></span>
                  </span>
                  <span className="nu-sub">{p.title ? `${p.title} · ` : ""}{p.xpText}</span>
                </span>
              </button>
            ) : (
              <div className="nu-who">
                <span className="nu-avatar" aria-hidden="true">B</span>
                <span className="nu-idtext"><span className="nu-name">Bingo Arena</span><span className="nu-sub">Skill bingo · free to play</span></span>
              </div>
            )}

            {p && (
              <div className="nu-chips">
                <button className="nu-chip" aria-label={`Open wallet, ${p.coins} coins`} onClick={go("wallet")}><Coin size={22} />{p.coins.toLocaleString()}</button>
                {p.gems !== null && <button className="nu-chip" aria-label={`Open the store, ${p.gems} gems`} onClick={onGems}><Gem size={22} />{p.gems}</button>}
                <button className="nu-chip" disabled={!p.cal} aria-label={p.cal ? `Daily rewards, ${p.streak}-day streak` : `${p.streak}-day streak`} onClick={() => setCalOpen(true)}>
                  <Icon name={p.cal ? "gift" : "flame"} size={20} />{p.streak}d
                </button>
              </div>
            )}

            <div className="nu-tools">
              <SoundControl />
              {p ? (
                <>
                  <button className="nu-icon" aria-label={p.unread ? `Inbox, ${p.unread} new` : "Inbox"} onClick={go("inbox")}><Icon name="mail" size={22} />{p.unread > 0 && <span className="nu-badge" aria-hidden="true">{count(p.unread)}</span>}</button>
                  {help}
                  {p.isAdmin && <button className="nu-icon" aria-label={p.adminUnread ? `Admin area, ${p.adminUnread} unanswered messages` : "Admin area"} onClick={go("admin")}><Icon name="gear" size={22} />{p.adminUnread > 0 && <span className="nu-badge" aria-hidden="true">{count(p.adminUnread)}</span>}</button>}
                  {p.guest ? <button className="nu-btn nu-btn-gold" onClick={onSave}><Icon name="check" size={18} /><span>{p.saveLabel}</span></button>
                    : <button className="nu-icon" aria-label="Log out" onClick={onLogOut}><Icon name="out" size={22} /></button>}
                </>
              ) : (
                <>
                  {help}
                  {onLogin && <button className="nu-btn nu-btn-plain" onClick={onLogin}>Log in</button>}
                  <button className="nu-btn nu-btn-gold" disabled={starting} onClick={onPlayFree}>{starting ? "Starting…" : "Play free"}</button>
                </>
              )}
            </div>
          </header>

          <div className="nu-main">
            <div className="nu-banners">{banners}</div>
            {children ?? <EmptyPage screen={screen} />}
          </div>
        </div>
      </div>

      {calOpen && p?.cal && (
        <>
          <button className="nu-popback" aria-label="Close daily rewards" onClick={() => setCalOpen(false)} />
          <div className="nu-pop nu-calpop" role="dialog" aria-label="Daily rewards" style={{ position: "fixed", top: 96, right: 16 }}>
            <h2>{p.streak}-day streak</h2>
            <CalendarStrip cal={p.cal} title={false} />
            <p>{p.cal.claimed_today ? `Today's reward is collected. Tomorrow: +${p.cal.next} coins.` : `Today: +${p.cal.next} coins, added when you open the game.`}</p>
          </div>
        </>
      )}
      {overlays}
    </div>
  );
}
