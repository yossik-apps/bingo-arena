import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import "./fonts";
import "./tokens.css";
import "./visuals.css";
import "./shell.css";
import { DayStrip } from "./DailyPopup";
import { Bulbs } from "./Ball";
import { Badge, Button, ListRow, Sheet } from "./components";
import { shortAmount } from "./format";
import { Coin, Gem, Icon, type IconName } from "./Icon";
import type { ScreenCtx, ScreenName } from "./screens/contract";
import { FULLSCREEN } from "./screens/registry";

// The playground's order
const TABS: [ScreenName, string, IconName][] = [["lobby", "Play", "play"], ["journey", "Journey", "map"], ["collect", "Collect", "book"], ["compete", "Compete", "trophy"], ["shop", "Shop", "bag"]];
const TITLES: Partial<Record<ScreenName, string>> = { wallet: "Coins", profile: "You", help: "Help", inbox: "Inbox", refer: "Invite friends" };

/** A balance: short on phones, in full on desktop, and always in full for screen readers. */
const Amount = ({ n }: { n: number }) => (
  <span><span className="nu-short" aria-hidden="true">{shortAmount(n)}</span><span className="nu-full" aria-hidden="true">{n.toLocaleString("en-US")}</span></span>
);

/** The daily chip: gold with a dot while today's reward waits, then a quiet flame with the streak. It only opens the calendar. */
function DailyChip({ ctx, compact }: { ctx: ScreenCtx; compact: boolean }) {
  const { cal, openCalendar } = ctx.daily;
  const streak = ctx.profile?.streak ?? 0;
  if (cal && !cal.claimed_today) {
    return (
      <button type="button" className="nu-daily is-ready" onClick={openCalendar} aria-label={`Day ${cal.day} reward. Open daily rewards`}>
        <span><Icon name="gift" size={20} sw={2.4} />{!compact && `Day ${cal.day}`}<i className="nu-new" aria-hidden="true" /></span>
      </button>
    );
  }
  return (
    <button type="button" className="nu-daily" disabled={!cal} onClick={openCalendar} aria-label={cal ? `${streak}-day streak. Open daily rewards` : `${streak}-day streak`}>
      <span><Icon name="flame" size={20} color="#FFB347" sw={2.4} />{streak}</span>
    </button>
  );
}

function Wallet({ ctx, gems, plusGems }: { ctx: ScreenCtx; gems: boolean; plusGems: boolean }) {
  const w = ctx.wallet;
  return (
    <>
      <span className="nu-pill">
        <button type="button" className="nu-amount" aria-label={`${w.coins.toLocaleString("en-US")} coins. Open wallet`} onClick={w.openWallet}><Coin size={26} /><Amount n={w.coins} /></button>
        <button type="button" className="nu-plus" aria-label="Get more coins" onClick={w.openStore}><Icon name="plus" size={16} color="#3A2300" sw={3.2} /></button>
      </span>
      {gems && w.gems !== null && (
        <span className="nu-pill">
          <button type="button" className="nu-amount" aria-label={`${w.gems.toLocaleString("en-US")} gems. Open the store`} onClick={w.openStore}><Gem size={24} /><Amount n={w.gems} /></button>
          {plusGems && <button type="button" className="nu-plus nu-deskonly" aria-label="Get more gems" onClick={w.openStore}><Icon name="plus" size={16} color="#3A2300" sw={3.2} /></button>}
        </span>
      )}
    </>
  );
}

const RailRow = ({ icon, name, onClick, href, tag, hot, current }: { icon: IconName; name: string; onClick?: () => void; href?: string; tag?: string; hot?: boolean; current?: boolean }) => {
  const body = <><Icon name={icon} size={22} sw={2.2} />{name}{tag && <span className={`nu-tag${hot ? " is-hot" : ""}`}>{tag}</span>}</>;
  return href ? <a className="nu-ni nu-small" href={href} target="_blank" rel="noreferrer">{body}</a>
    : <button type="button" className="nu-ni nu-small" aria-current={current ? "page" : undefined} onClick={onClick}>{body}</button>;
};

export default function NewShell({ ctx, calendarOpen, closeCalendar, banners, overlays, children }: { ctx: ScreenCtx; calendarOpen: boolean; closeCalendar: () => void; banners?: ReactNode; overlays?: ReactNode; children?: ReactNode }) {
  const { profile: p, navigation: nav, notices: n, social, visitor: v, daily } = ctx;
  const screen = nav.screen;
  const full = FULLSCREEN.has(screen);
  const [menu, setMenu] = useState(false);
  const wide = useDesktop();
  const rail = useRef<HTMLElement>(null);
  const head = useRef<HTMLElement>(null);
  // The header stays on one row. Short of room: 1 hides the streak chip, 2 also shrinks the title.
  const [fit, setFit] = useState(0);
  const [headWidth, setHeadWidth] = useState(0);

  useLayoutEffect(() => {
    const html = document.documentElement;
    html.classList.add("nu-on");
    return () => html.classList.remove("nu-on");
  }, []);

  // The Today box shows only when it fits completely, as in Classic.
  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const fit = () => { el.classList.remove("is-tight"); if (el.scrollHeight > el.clientHeight + 1) el.classList.add("is-tight"); };
    fit();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    ro?.observe(el);
    void document.fonts?.ready.then(fit);
    return () => ro?.disconnect();
  });

  const fitKey = `${screen}|${wide}|${headWidth}|${ctx.wallet.coins}|${ctx.wallet.gems}|${p?.streak}|${!!daily.cal?.claimed_today}`;
  useLayoutEffect(() => { setFit(0); }, [fitKey]);
  useLayoutEffect(() => {
    const el = head.current;
    if (!el || fit >= 2 || (screen === "lobby" && !wide)) return;
    const css = getComputedStyle(el), room = el.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight), gap = parseFloat(css.columnGap) || 0;
    const kids = [...el.children].filter((k) => (k as HTMLElement).offsetWidth > 0) as HTMLElement[];
    const need = kids.reduce((sum, k) => sum + (k.classList.contains("nu-title") ? k.scrollWidth : k.offsetWidth), 0) + gap * (kids.length - 1);
    if (need > room) setFit(fit + 1);
  }, [fit, fitKey]);
  useEffect(() => {
    const el = head.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setHeadWidth(el.clientWidth));
    ro.observe(el);
    void document.fonts?.ready.then(() => setHeadWidth(el.clientWidth + 0.001));
    return () => ro.disconnect();
  }, [full]);

  const isTab = TABS.some(([k]) => k === screen);
  const title = TABS.find(([k]) => k === screen)?.[1] ?? TITLES[screen] ?? "";
  const go = (s: ScreenName) => () => { setMenu(false); nav.go(s); };
  const showWallet = !!p;
  const gemsCompact = p && ctx.wallet.gems !== null;
  const facebook = !ctx.platform.crazyGames ? social.facebook : null;
  const invite = social.invite && !!p;
  const avatar = p ? p.name.slice(0, 1).toUpperCase() : "B";

  const backBtn = !isTab && <button type="button" className="nu-back" aria-label="Back" onClick={go("lobby")}><Icon name="back" size={22} sw={3} /></button>;

  // ---- Play page header, phones only ----
  const lobbyHead = screen === "lobby" && (
    <>
      {p ? (
        <button type="button" className="nu-who" title={p.name} aria-label={`${p.name}, level ${p.level}, ${p.xpPct} percent to the next level. Open the menu`} aria-expanded={menu} onClick={() => setMenu(true)}>
          <span className={`nu-avatar ${p.frame ? "fr-" + p.frame : ""}`} aria-hidden="true">{avatar}</span>
          <span className="nu-idtext"><span className="nu-name">{p.name}</span><span className="nu-levelrow"><span className="nu-level">Lv {p.level}</span><span className="nu-xp" aria-hidden="true"><i style={{ width: `${p.xpPct}%` }} /></span></span></span>
        </button>
      ) : (
        <button type="button" className="nu-who" aria-label="Bingo Arena. Open the menu" aria-expanded={menu} onClick={() => setMenu(true)}><span className="nu-avatar" aria-hidden="true">{avatar}</span><span className="nu-idtext"><span className="nu-name">Bingo Arena</span><span className="nu-sub">Skill bingo · free to play</span></span></button>
      )}
    </>
  );

  // A round fills the page, as in Classic: no header, tabs, side panel, banners (live-match bar, toasts, errors), menus or pop-ups.
  if (full) return <div className="nu-root nu-fullscreen"><main className="nu-fullmain">{children}</main></div>;

  return (
    <div className="nu-root">
      <div className="nu-frame">
        {/* desktop: the blue side panel */}
        <nav className="nu-rail" aria-label="Main" ref={rail}>
          <div className="nu-sign"><Bulbs n={9} /><h1 className="nu-d">Bingo Arena</h1><Bulbs n={9} /></div>
          {p ? (
            <button type="button" className="nu-ni nu-me" title={p.name} aria-current={screen === "profile" ? "page" : undefined} aria-label={`${p.name}, level ${p.level}, ${p.xpPct} percent to the next level. Open your profile`} onClick={go("profile")}>
              <span className={`nu-avatar ${p.frame ? "fr-" + p.frame : ""}`} aria-hidden="true">{avatar}</span>
              <span className="nu-idtext"><span className="nu-name">{p.name}</span><span className="nu-levelrow"><span className="nu-level">Lv {p.level}</span><span className="nu-xp" aria-hidden="true"><i style={{ width: `${p.xpPct}%` }} /></span></span></span>
            </button>
          ) : (
            <div className="nu-ni nu-me"><span className="nu-avatar" aria-hidden="true">{avatar}</span><span className="nu-idtext"><span className="nu-name">Bingo Arena</span><span className="nu-sub">Skill bingo · free to play</span></span></div>
          )}
          {TABS.map(([k, name, icon]) => (
            <button key={k} type="button" className="nu-ni" aria-current={screen === k ? "page" : undefined} onClick={go(k)}>
              <Icon name={icon} size={24} sw={2.2} />{name}
              {k === "lobby" && screen !== "lobby" && n.unread > 0 && <span className="nu-dot" role="img" aria-label={`${n.unread} new messages`} />}
            </button>
          ))}
          <span className="nu-railgap" />
          {p && (
            <div className="nu-today" role="group" aria-label="Today">
              <button type="button" className="nu-ni" onClick={ctx.rounds.startDrill}><Icon name={daily.drillDone ? "check" : "bolt"} size={20} /><span><b>Daily drill</b><small>{daily.drillDone ? "Done today" : "60 s · +20 coins"}</small></span></button>
              {ctx.dna.dna?.style && <button type="button" className="nu-ni" onClick={go("profile")}><Icon name="target" size={20} /><span><b>{ctx.dna.dna.style.name}</b><small>Your play style</small></span></button>}
            </div>
          )}
          {p && <RailRow icon="mail" name="Inbox" current={screen === "inbox"} onClick={go("inbox")} tag={n.unread ? String(n.unread) : undefined} hot />}
          <RailRow icon="target" name="Bingo DNA" current={screen === "profile" && !p} onClick={go("profile")} tag={p ? (ctx.dna.dna ? String(ctx.dna.dna.overall) : undefined) : "Demo"} />
          {invite && <RailRow icon="users" name="Invite friends" current={screen === "refer"} onClick={go("refer")} />}
          <RailRow icon="help" name="Help and guide" current={screen === "help"} onClick={go("help")} />
          {p?.isAdmin && <RailRow icon="gear" name="Admin" onClick={go("admin")} tag={n.adminUnread ? String(n.adminUnread) : undefined} hot />}
          {facebook && <RailRow icon="ext" name="Our Facebook" href={facebook} />}
          {p?.guest && <span className="nu-railgold"><Button size="sm" wide onClick={p.save}>{p.saveLabel}</Button></span>}
          {p && !p.guest && <RailRow icon="out" name="Log out" onClick={p.logOut} />}
          {v && <span className="nu-railgold"><Button size="sm" wide disabled={v.starting} onClick={v.playFree}>{v.starting ? "Starting…" : "Play free"}</Button></span>}
          {v?.logIn && <RailRow icon="user" name="Log in" onClick={v.logIn} />}
        </nav>

        <div className="nu-column">
          <header className="nu-head" ref={head}>
            {backBtn}
            {lobbyHead}
            <h1 className={`nu-title${screen === "lobby" ? " nu-deskonly" : ""}${fit >= 2 ? " is-small" : ""}`} title={title}>{title}</h1>
            <div className="nu-wallet">
              {showWallet && screen !== "lobby" && fit < 1 && <DailyChip ctx={ctx} compact={!!gemsCompact && !wide} />}
              {showWallet && <Wallet ctx={ctx} gems={screen !== "lobby" || wide} plusGems />}
              {v && !wide && <Button size="sm" disabled={v.starting} onClick={v.playFree}>{v.starting ? "Starting…" : "Play free"}</Button>}
              {screen === "lobby" && (
                <button type="button" className="nu-menu" aria-label={n.unread ? `Menu, ${n.unread} new messages` : "Menu"} aria-expanded={menu} onClick={() => setMenu(true)}>
                  <Icon name="menu" size={24} />{n.unread > 0 && <Badge count={n.unread} label={`${n.unread} new messages`} over />}
                </button>
              )}
            </div>
          </header>

          <div className="nu-main">
            <div className="nu-banners">
              {v && screen !== "help" && screen !== "profile" && (
                <p className="nu-guestbar">No sign-up needed: <button type="button" className="nu-linkbtn" onClick={v.playFree}>press Play</button> and you get {v.welcome !== null ? `${v.welcome} coins` : "free coins"} to start.<span aria-hidden="true"> · </span><button type="button" className="nu-linkbtn" onClick={go("profile")}>See a demo profile</button></p>
              )}
              {banners}
            </div>
            <div className="nu-pagewrap">{children}</div>
          </div>
        </div>

        {/* phone: the white bottom bar */}
        <nav className="nu-tabsbar" aria-label="Main">
          {TABS.map(([k, name, icon]) => (
            <button key={k} type="button" className="nu-nb" aria-current={screen === k ? "page" : undefined} onClick={go(k)}>
              <Icon name={icon} size={24} sw={2.2} />{name}
              {k === "lobby" && screen !== "lobby" && n.unread > 0 && <i className="nu-new" role="img" aria-label={`${n.unread} new messages`} />}
            </button>
          ))}
        </nav>
      </div>

      {menu && (
        <Sheet label="Menu" title="Menu" onClose={() => setMenu(false)}>
          <div className="nu-menurows">
            {p && <ListRow title="Inbox" sub="Messages and support" lead={<Icon name="mail" size={26} />} trail={n.unread > 0 ? <Badge count={n.unread} label={`${n.unread} new messages`} /> : undefined} onClick={go("inbox")} />}
            <ListRow title={p ? "Profile and Bingo DNA" : "Bingo DNA"} sub={p ? "Your stats, skills and settings" : "See a demo profile"} lead={<Icon name="target" size={26} />} onClick={go("profile")} />
            {p && daily.cal && <ListRow title="Daily rewards" sub={`${p.streak}-day streak`} lead={<Icon name="gift" size={26} />} onClick={() => { setMenu(false); daily.openCalendar(); }} />}
            {p && <ListRow title="Daily drill" sub={daily.drillDone ? "Done today" : "60 s · +20 coins"} lead={<Icon name={daily.drillDone ? "check" : "bolt"} size={26} />} onClick={() => { setMenu(false); ctx.rounds.startDrill(); }} />}
            {invite && <ListRow title="Invite friends" sub="Earn coins and gems" lead={<Icon name="users" size={26} />} onClick={go("refer")} />}
            <ListRow title="Help and guide" lead={<Icon name="help" size={26} />} onClick={go("help")} />
            {p?.isAdmin && <ListRow title="Admin" lead={<Icon name="gear" size={26} />} trail={n.adminUnread > 0 ? <Badge count={n.adminUnread} label={`${n.adminUnread} unanswered messages`} /> : undefined} onClick={go("admin")} />}
            {facebook && <ListRow title="Our Facebook" lead={<Icon name="ext" size={26} />} href={facebook} />}
            {p?.guest && <ListRow title={p.saveLabel} sub="Keep your progress on every device" lead={<Icon name="check" size={26} />} onClick={() => { setMenu(false); p.save(); }} />}
            {p && !p.guest && <ListRow title="Log out" lead={<Icon name="out" size={26} />} onClick={p.logOut} />}
            {v?.logIn && <ListRow title="Log in" lead={<Icon name="user" size={26} />} onClick={() => { setMenu(false); v.logIn?.(); }} />}
          </div>
        </Sheet>
      )}
      {calendarOpen && daily.cal && (
        <Sheet label="Daily rewards" title={`${p?.streak ?? 0}-day streak`} onClose={closeCalendar}>
          <DayStrip cal={daily.cal} />
          <p className="nu-calnote">{daily.cal.claimed_today ? `Today's reward is collected. Tomorrow: +${daily.cal.next} coins.` : `Today: +${daily.cal.next} coins, added when the game opens.`}</p>
        </Sheet>
      )}
      {overlays}
    </div>
  );
}

function useDesktop() {
  const [wide, setWide] = useState(() => matchMedia("(min-width: 1000px)").matches);
  useEffect(() => {
    const m = matchMedia("(min-width: 1000px)");
    const on = () => setWide(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return wide;
}
