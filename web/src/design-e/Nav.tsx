import { createContext, useCallback, useContext, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Coin, Gem, Icon, type IconName } from "./Icon";
import { featureLevel, LADDER, unlocked, type Feature } from "../lib/levels";
import { GEM_LEVEL } from "./data";

export type Tab = "play" | "journey" | "collect" | "compete" | "shop";

const TABS: { id: Tab; label: string; icon: IconName; feature: Feature }[] = [
  { id: "play", label: "Play", icon: "play", feature: "play" },
  { id: "journey", label: "Journey", icon: "map", feature: "journey" },
  { id: "collect", label: "Collect", icon: "book", feature: "quests" },
  { id: "compete", label: "Compete", icon: "trophy", feature: "league" },
  { id: "shop", label: "Shop", icon: "bag", feature: "shop" },
];

/** Which feature opens each tab. */
export const TAB_FEATURE: Record<Tab, Feature> = Object.fromEntries(TABS.map((t) => [t.id, t.feature])) as Record<Tab, Feature>;

/**
 * The bottom bar. In the retention ladder every tab is always there: tabs the player has not reached yet are grayed with a
 * lock, and tapping one says what unlocks it (players who can see what is coming have something to play toward).
 * The original ladder hid locked tabs, and still does, so the two can be compared.
 */
export function BottomNav({ level, current, onNav }: { level: number; current: Tab | null; onNav: (t: Tab) => void }) {
  const daily = useContext(DailyCtx);
  const tabs = LADDER === "original" ? TABS.filter((t) => unlocked(t.feature, level)) : TABS;
  if (tabs.filter((t) => unlocked(t.feature, level)).length < 2 && LADDER === "original") return null;
  return (
    <nav aria-label="Main" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 84, background: "#fff", borderRadius: "26px 26px 0 0", padding: "8px 10px 18px", display: "grid", gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`, gap: 4, zIndex: 10 }}>
      {tabs.map((t) => {
        const open = unlocked(t.feature, level);
        return (
          <button key={t.id} className={`e-nb${open ? "" : " e-lk"}`} aria-current={t.id === current ? "page" : undefined}
            aria-label={open ? t.label : `${t.label}, locked. Unlocks at level ${featureLevel[t.feature]}`} onClick={() => onNav(t.id)}>
            <Icon name={t.icon} size={24} sw={2.2} />{t.label}
            {!open && <span className="e-lkb" aria-hidden="true"><Icon name="lock" size={11} color="#fff" sw={3} /></span>}
            {open && featureLevel[t.feature] === level && t.id !== "play" && <span className="e-new" role="img" aria-label="New" />}
            {open && t.id === "compete" && current !== "compete" && !!daily?.unread && featureLevel[t.feature] !== level && <span className="e-new" role="img" aria-label="A friend answered your challenge" />}
            {t.id === "play" && current !== "play" && daily?.unlocked && daily.any && <span className="e-new" role="img" aria-label="A reward is waiting" />}
          </button>
        );
      })}
    </nav>
  );
}

export function useToast(): [string, (m: string) => void] {
  const [t, setT] = useState("");
  useEffect(() => { if (!t) return; const id = setTimeout(() => setT(""), 2200); return () => clearTimeout(id); }, [t]);
  return [t, useCallback((m: string) => setT(m), [])];
}

export const rowStyle: CSSProperties = { borderRadius: 20, boxShadow: "0 4px 0 #0E3E9C", padding: "10px 12px", display: "flex", alignItems: "center", gap: 12 };

/** What the shell needs to show the daily reward on every screen. `on` is false where it would repeat the Play screen tile or the reward screen itself. */
export type DailyInfo = {
  on: boolean; unlocked: boolean; ready: boolean; day: number; streak: number; open: () => void;
  /** the free bonus box is ready */
  box: boolean;
  /** something waits in the daily rewards: the day's reward or the bonus box */
  any: boolean;
  /** friends who answered a challenge and were not looked at yet */
  unread: number;
  /** open the store (null while the player has nothing to buy yet) */
  store: ((focus?: "coins" | "gems") => void) | null;
  /** gems are known at this level */
  gemsOn: boolean;
};
export const DailyCtx = createContext<DailyInfo | null>(null);

/** Top bar button: a gold "Day N" button with a dot while a reward waits, then a quiet flame with the streak once it is claimed. */
export function DailyChip({ compact }: { compact?: boolean }) {
  const d = useContext(DailyCtx);
  if (!d || !d.on) return null;
  if (d.ready || d.box) {
    return (
      <button className={`e-dchip e-dready${compact ? " e-dc" : ""}`} onClick={d.open} aria-label={d.ready ? `Day ${d.day + 1} reward is ready. Open daily rewards` : "Your free bonus box is ready. Open daily rewards"}>
        <Icon name="gift" size={20} color="#3A2300" sw={2.4} />{compact ? null : d.ready ? `Day ${d.day + 1}` : "Free box"}<span className="e-new" aria-hidden="true" />
      </button>
    );
  }
  return (
    <button className="e-dchip" onClick={d.open} aria-label={`${d.streak}-day streak. Open daily rewards`}>
      <Icon name="flame" size={20} color="#FFB347" sw={2.4} />{d.streak}
    </button>
  );
}

/** The small "+" on a balance: opens the store. It exists from level 5, when the first thing worth buying appears. */
export function Plus({ label, focus }: { label: string; focus: "coins" | "gems" }) {
  const d = useContext(DailyCtx);
  if (!d?.store) return null;
  const open = d.store;
  return <button className="e-plus" aria-label={label} onClick={() => open(focus)}><Icon name="plus" size={16} color="#3A2300" sw={3.2} /></button>;
}

export function Wallet({ coins, gems, level, wide }: { coins: number; gems: number; level: number; wide?: boolean }) {
  const chip: CSSProperties = { display: "flex", alignItems: "center", gap: 5, height: 40, padding: "0 12px 0 7px", borderRadius: 999, background: "#123E91", fontSize: 15, fontWeight: 900 };
  const plus: CSSProperties = { paddingRight: 6 };
  /** on a phone, once gems show, the reward chip keeps its icon and dot and drops its words so the title and balances still fit */
  const compact = level >= GEM_LEVEL && !wide;
  return (
    <span style={{ display: "flex", gap: 6 }}>
      <DailyChip compact={compact} />
      <span style={{ ...chip, ...plus }}><span role="status" aria-label={`${coins} coins`} style={{ display: "flex", alignItems: "center", gap: 5 }}><Coin size={26} />{coins}</span><Plus label="Get more coins" focus="coins" /></span>
      {level >= GEM_LEVEL && <span style={{ ...chip, ...(wide ? plus : null) }}><span role="status" aria-label={`${gems} gems`} style={{ display: "flex", alignItems: "center", gap: 5 }}><Gem size={24} />{gems}</span>{wide && <Plus label="Get more gems" focus="gems" />}</span>}
    </span>
  );
}

/** True inside the desktop shell: pages drop their own header and bottom bar and lay their content out in columns. */
export const DeskCtx = createContext(false);
export const useDesk = () => useContext(DeskCtx);

/**
 * Screen frame: title row, scrolling content, bottom bar, toast.
 * On desktop the shell already has the title, wallet and navigation, so a page is only its content in a responsive grid.
 * `narrow` keeps a single centered column (forms and short lists), `max` sets the widest the grid may get.
 */
export function Page({ title, level, tab, onNav, onBack, coins, gems, toast, children, narrow, max, cls }: {
  title: string; level: number; tab: Tab | null; onNav: (t: Tab) => void; onBack?: () => void; coins: number; gems: number; toast?: string; children: ReactNode;
  narrow?: boolean; max?: number; cls?: string;
}) {
  const desk = useDesk();
  if (desk) {
    return (
      <div className={`e-deskcols e-fade${narrow ? " e-narrow" : ""}${cls ? ` ${cls}` : ""}`} style={max ? { maxWidth: max } : undefined} aria-label={title} role="region">
        {children}
        {toast && <div className="e-toast e-toast-desk" role="status">{toast}</div>}
      </div>
    );
  }
  return (
    <div className="e-root e-fade">
      <header style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 16px 12px", flexShrink: 0, position: "relative", zIndex: 2, background: "#1F5FD6", boxShadow: "0 8px 10px -6px rgba(8,30,90,.45)" }}>
        {onBack && (
          <button aria-label="Back" onClick={onBack} style={{ width: 44, height: 44, border: 0, borderRadius: 14, background: "#fff", boxShadow: "0 4px 0 #0E3E9C", display: "flex", alignItems: "center", justifyContent: "center", color: "#14254F", flexShrink: 0 }}>
            <Icon name="back" size={22} sw={3} />
          </button>
        )}
        <h1 className="e-ld" style={{ margin: 0, fontSize: 28, lineHeight: 1.05, textShadow: "0 3px 0 #123E91", flex: 1 }}>{title}</h1>
        <Wallet coins={coins} gems={gems} level={level} />
      </header>
      <div className="e-scroll">{children}</div>
      <BottomNav level={level} current={tab} onNav={onNav} />
      {toast && <div className="e-toast" role="status">{toast}</div>}
    </div>
  );
}

export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; text: string; locked?: boolean }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="e-seg" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`, flexShrink: 0 }}>
      {options.map((o) => (
        <button key={o.id} role="radio" aria-checked={value === o.id} disabled={o.locked} onClick={() => onChange(o.id)}>
          {o.locked && <Icon name="lock" size={14} color="#DCE7FF" />}{o.text}
        </button>
      ))}
    </div>
  );
}

export function Bar({ pct, dark }: { pct: number; dark?: boolean }) {
  return (
    <span aria-hidden="true" style={{ display: "block", height: 10, borderRadius: 99, background: dark ? "#0B2C6E" : "#DCE4F5", overflow: "hidden", flexShrink: 0 }}>
      <span style={{ display: "block", width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", background: "#FFC531", borderRadius: 99 }} />
    </span>
  );
}

/** `short` looks like a disabled button but can still be tapped: the app answers "you need more" with the store, not with silence. */
export function Mini({ children, onClick, disabled, green, short, label }: { children: ReactNode; onClick?: () => void; disabled?: boolean; green?: boolean; short?: boolean; label?: string }) {
  const off = disabled || short;
  return (
    <button onClick={onClick} disabled={disabled} aria-disabled={short || undefined} aria-label={label} className="e-ld"
      style={{ height: 40, minWidth: 76, border: 0, borderRadius: 14, padding: "0 14px", fontSize: 16, flexShrink: 0, background: off ? "#DCE4F5" : green ? "#2EB872" : "#FFC531", color: off ? "#4A5A85" : green ? "#fff" : "#3A2300", boxShadow: off ? "none" : green ? "0 3px 0 #1B8A55" : "0 3px 0 #D98E00" }}>
      {children}
    </button>
  );
}

export function LockedCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="e-mode e-locked" aria-disabled="true" style={{ minHeight: 72 }}>
      <Icon name="lock" size={26} color="#DCE7FF" />
      <span style={{ display: "flex", flexDirection: "column", gap: 1, flex: 1 }}>
        <span className="e-ld" style={{ fontSize: 20 }}>{title}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#DCE7FF" }}>{text}</span>
      </span>
    </div>
  );
}

export const sectionTitle: CSSProperties = { margin: "6px 2px 0", fontSize: 14, fontWeight: 900, color: "#FFE9A0", letterSpacing: 0.5, textTransform: "uppercase" };
