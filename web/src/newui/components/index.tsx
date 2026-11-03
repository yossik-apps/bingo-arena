// Shared components of the new design, taken from the playground's styles.
// Screens import from here and do not edit this folder: if a screen needs a change, it lists it under "Needs a shared change".
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import "./components.css";
import { Ball, type Tone } from "../Ball";

// ---- Button ----
type ButtonProps = {
  children: ReactNode; onClick?: () => void; href?: string;
  /** gold is the main action. Sizes: lg 64 px, md 48 px, sm 44 px. */
  kind?: "gold" | "green" | "white" | "panel" | "ghost"; size?: "lg" | "md" | "sm"; wide?: boolean; disabled?: boolean;
  /** looks disabled but can still be tapped, so the game can answer "you need more" instead of nothing */
  short?: boolean;
  /** needed when the button shows only an icon */
  label?: string; autoFocus?: boolean;
};
export function Button({ children, onClick, href, kind = "gold", size = "md", wide, disabled, short, label, autoFocus }: ButtonProps) {
  const cls = `nu-btn nu-btn-${kind} nu-btn-${size}${wide ? " is-wide" : ""}`;
  if (href) return <a className={cls} href={href} target="_blank" rel="noreferrer" aria-label={label}>{children}</a>;
  return <button type="button" className={cls} onClick={onClick} disabled={disabled} aria-disabled={short || undefined} aria-label={label} autoFocus={autoFocus}>{children}</button>;
}

// ---- Card ----
export const Card = ({ children, tone = "white", label }: { children: ReactNode; tone?: "white" | "panel"; label?: string }) => (
  <section className={`nu-card nu-card-${tone}`} aria-label={label}>{children}</section>
);

// ---- Chip ----
export const Chip = ({ children, tone = "gold" }: { children: ReactNode; tone?: "gold" | "pink" | "green" | "dark" }) => (
  <span className={`nu-tagchip nu-tagchip-${tone}`}>{children}</span>
);

// ---- Badge ----
/** A count, or a dot when there is no count. `label` is what a screen reader hears. `over` places it on a button's corner. */
export const Badge = ({ count, label, over }: { count?: number; label: string; over?: boolean }) => (
  <span className={`nu-badge${count === undefined ? " is-dot" : ""}${over ? " is-over" : ""}`} role="img" aria-label={label}>
    {count !== undefined && <span aria-hidden="true">{count > 9 ? "9+" : count}</span>}
  </span>
);

// ---- Sheet and Modal ----
const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
/** Slides up on phones, centered from 1000 px. Tapping outside or pressing Escape closes it; focus stays inside and returns afterwards. */
export function Sheet({ label, title, onClose, children, modal }: { label: string; title?: string; onClose: () => void; children: ReactNode; /** always centered, on phones too */ modal?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const first = box.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? box.current)?.focus();
    return () => before?.focus?.();
  }, []);
  useEffect(() => {
    const k = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") close.current(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  const trap = (e: KeyboardEvent) => {
    if (e.key !== "Tab" || !box.current) return;
    const all = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (!all.length) { e.preventDefault(); return; }
    const first = all[0], last = all[all.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  return (
    <div className={`nu-scrim${modal ? " is-modal" : ""}`} onClick={onClose}>
      <div ref={box} className="nu-sheet" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} onKeyDown={trap} onClick={(e) => e.stopPropagation()}>
        {title && <div className="nu-sheethead"><h2>{title}</h2></div>}
        {children}
        <Button kind="ghost" size="md" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}
export const Modal = (p: { label: string; title?: string; onClose: () => void; children: ReactNode }) => <Sheet {...p} modal />;

// ---- Tabs ----
export type TabOption<T extends string> = { id: T; text: string; icon?: ReactNode; disabled?: boolean };
/** The playground's segmented control. Arrow keys move between options. */
export function Tabs<T extends string>({ value, options, onChange, label, small }: { value: T; options: TabOption<T>[]; onChange: (v: T) => void; label: string; small?: boolean }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (e: KeyboardEvent, i: number) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    for (let n = 1; n <= options.length; n++) {
      const j = (i + step * n + options.length * n) % options.length;
      if (!options[j].disabled) { onChange(options[j].id); refs.current[j]?.focus(); return; }
    }
  };
  return (
    <div role="radiogroup" aria-label={label} className={`nu-seg${small ? " is-small" : ""}`} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o, i) => (
        <button key={o.id} ref={(el) => { refs.current[i] = el; }} type="button" role="radio" aria-checked={value === o.id} tabIndex={value === o.id ? 0 : -1} disabled={o.disabled} onClick={() => onChange(o.id)} onKeyDown={(e) => move(e, i)}>
          {o.icon}{o.text}
        </button>
      ))}
    </div>
  );
}

// ---- List row ----
type RowProps = { title: ReactNode; sub?: ReactNode; lead?: ReactNode; trail?: ReactNode; onClick?: () => void; href?: string; selected?: boolean; locked?: boolean; label?: string };
export function ListRow({ title, sub, lead, trail, onClick, href, selected, locked, label }: RowProps) {
  const cls = `nu-row${selected ? " is-selected" : ""}${locked ? " is-locked" : ""}`;
  const body = (
    <>
      {lead && <span className="nu-rowlead">{lead}</span>}
      <span className="nu-rowtext"><span className="nu-rowtitle">{title}</span>{sub && <span className="nu-rowsub">{sub}</span>}</span>
      {trail && <span className="nu-rowtrail">{trail}</span>}
    </>
  );
  if (href) return <a className={cls} href={href} target="_blank" rel="noreferrer" aria-label={label}>{body}</a>;
  if (onClick) return <button type="button" className={cls} onClick={onClick} aria-label={label} aria-pressed={selected === undefined ? undefined : selected}>{body}</button>;
  return <div className={cls} role={label ? "group" : undefined} aria-label={label}>{body}</div>;
}

// ---- Empty state ----
const BALLS: [Tone, number][] = [["B", 7], ["I", 22], ["N", 41], ["G", 53], ["O", 68]];
export const EmptyState = ({ title, text, action }: { title: string; text: string; action?: ReactNode }) => (
  <Card>
    <div className="nu-state">
      <div className="nu-balls" aria-hidden="true">{BALLS.map(([t, n]) => <Ball key={t} tone={t} num={n} size={44} />)}</div>
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </div>
  </Card>
);

// ---- Loading skeleton ----
export const Skeleton = ({ rows = 3, height = 72, label = "Loading" }: { rows?: number; height?: number; label?: string }) => (
  <div className="nu-skels" role="status" aria-label={label}>
    {Array.from({ length: rows }, (_, i) => <div key={i} className="nu-skel" aria-hidden="true" style={{ height }} />)}
  </div>
);

// ---- Error state ----
export const ErrorState = ({ title = "That did not load", text = "Check your connection and try again.", onRetry }: { title?: string; text?: string; onRetry?: () => void }) => (
  <Card>
    <div className="nu-state" role="alert">
      <h2>{title}</h2>
      <p>{text}</p>
      {onRetry && <Button size="sm" onClick={onRetry}>Try again</Button>}
    </div>
  </Card>
);

// ---- Toast ----
/** `inline` keeps it in the page flow, for notices at the top of a screen. */
export const Toast = ({ children, alert, inline }: { children: ReactNode; alert?: boolean; inline?: boolean }) => (
  <div className={`nu-toast${inline ? " is-inline" : ""}`} role={alert ? "alert" : "status"}>{children}</div>
);

// ---- Progress bar ----
export function ProgressBar({ pct, label, showLabel, value, dark }: { pct: number; /** what a screen reader hears */ label: string; showLabel?: boolean; value?: string; /** for use on the blue page */ dark?: boolean }) {
  const id = useId();
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className="nu-barwrap">
      {showLabel && <div className="nu-barlabel"><span id={id}>{label}</span>{value && <span>{value}</span>}</div>}
      <span className={`nu-bar${dark ? " is-dark" : ""}`} role="progressbar" aria-labelledby={showLabel ? id : undefined} aria-label={showLabel ? undefined : label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v}>
        <i style={{ width: `${v}%` }} />
      </span>
    </div>
  );
}

// ---- Section header ----
export const SectionHeader = ({ title, trail }: { title: string; trail?: ReactNode }) => (
  <div className="nu-section"><h2>{title}</h2>{trail && <span>{trail}</span>}</div>
);
