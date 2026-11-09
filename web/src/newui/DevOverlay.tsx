// Local development only (App loads it behind import.meta.env.DEV, so it is not part of a production build).
// Opens one overlay with sample data, for captures:
//   ?overlay=auth&fixture=visitor&state=log      the new version (newui/overlays/Auth.tsx), drawn where App draws it
//   ?overlay=auth&fixture=visitor&design=classic  the Classic one, with the same sample values
// The overlay does not have to be listed in NEW_OVERLAYS yet. Pop-ups show over the lobby; the live-match bar above it;
// the terms and new-password gates on a page of their own, as App shows them before the shell.
import { useEffect, useState, type ComponentType } from "react";
import ArenaBar from "../lib/ArenaBar";
import AgeGate from "../views/AgeGate";
import AuthGate from "../views/AuthGate";
import FirstVisit from "../views/FirstVisit";
import SetPassword from "../views/SetPassword";
import Tour from "../views/Tour";
import { EmptyState } from "./components";
import NewShell from "./NewShell";
import { NewPage } from "./OverlayHost";
import ScreenHost from "./ScreenHost";
import { OVERLAY_PAGES, OVERLAY_VIEWER, overlayFixture } from "./overlays/overlayFixture";
import { baseFixture } from "./screens/baseFixture";
import type { OverlayCtx, OverlayFixture, OverlayName, OverlayProps, ScreenName } from "./screens/contract";

const OVERLAYS = import.meta.glob<{ default: ComponentType<OverlayProps<OverlayName>> }>("./overlays/[A-Z]*.tsx");
const FIXTURES = import.meta.glob<{ fixture: OverlayFixture<OverlayName> }>("./overlays/*.fixture.ts");
const file = (name: string, end: string) => `./overlays/${name[0].toUpperCase()}${name.slice(1)}${end}`;

/** The Classic overlay with the same values, exactly as App draws it. */
function Classic({ name, ctx }: { name: OverlayName; ctx: OverlayCtx[OverlayName] }) {
  const o = ctx as never;
  switch (name) {
    case "auth": { const c: OverlayCtx["auth"] = o; return <AuthGate reason={c.reason} mode={c.mode} welcome={c.welcome ?? undefined} guest={c.guest || undefined} onSaved={c.saved ?? undefined} onClose={c.close} />; }
    case "terms": { const c: OverlayCtx["terms"] = o; return <div className="shell"><AgeGate name={c.name} updated={c.updated} crazy={c.crazyGames} onDone={c.done} /></div>; }
    case "password": { const c: OverlayCtx["password"] = o; return <div className="shell auth"><div className="content"><SetPassword onDone={c.done} /></div></div>; }
    case "firstVisit": { const c: OverlayCtx["firstVisit"] = o; return <FirstVisit crazy={c.crazyGames} inviter={c.inviter} busy={c.busy} onPlay={c.play} onLogin={c.logIn ?? undefined} onClose={c.close} />; }
    case "tour": { const c: OverlayCtx["tour"] = o; return <Tour steps={c.steps} heading={c.heading} onClose={c.close} onGo={c.go} />; }
    case "arenaBar": { const c: OverlayCtx["arenaBar"] = o; return <ArenaBar arena={c.arena} fees={c.fees} canPlay={c.canPlay} onPlay={c.play} />; }
  }
}

export default function DevOverlay({ name, kind, state, classic }: { name: OverlayName; kind: string | null; state: string | null; classic: boolean }) {
  const viewer = kind ?? OVERLAY_VIEWER[name];
  const [ctx, setCtx] = useState<OverlayCtx[OverlayName] | null>(null);
  const [has, setHas] = useState(false);
  const [screen, setScreen] = useState<ScreenName>("lobby");
  useEffect(() => {
    let live = true;
    const base = overlayFixture(name, viewer);
    void Promise.all([FIXTURES[file(name, ".fixture.ts")]?.(), OVERLAYS[file(name, ".tsx")]?.()]).then(([f, m]) => {
      if (live) { setCtx(f ? f.fixture(base, state) : base); setHas(!!m); }
    });
    return () => { live = false; };
  }, [name, viewer, state]);
  if (!ctx) return null;

  const page = OVERLAY_PAGES.has(name);
  if (classic) return page ? <Classic name={name} ctx={ctx} /> : <div className="shell"><div className="content"><Classic name={name} ctx={ctx} /></div></div>;
  // not listed yet, so OverlayHost (which only shows listed overlays) cannot be used: load the file directly
  const missing = <EmptyState title="Not redesigned yet" text={`There is no overlays/${file(name, ".tsx").slice(11)} yet.`} />;
  if (!has) return <NewPage>{missing}<Ready name={name} /></NewPage>;
  const shown = <Direct name={name} ctx={ctx} />;
  if (page) return <NewPage>{shown}</NewPage>;
  const shell = baseFixture(viewer, screen, setScreen, () => undefined);
  return (
    <NewShell ctx={shell} calendarOpen={false} closeCalendar={() => undefined}
      banners={name === "arenaBar" ? shown : undefined} overlays={name === "arenaBar" ? undefined : shown}>
      <ScreenHost ctx={shell} useFixture />
    </NewShell>
  );
}

/**
 * Marks the page ready for a picture: <html data-overlay-ready="name">. Rendered after the overlay, so its effect runs once the
 * overlay's code has loaded and the overlay has drawn, also when it draws nothing (the live-match bar with no bar) or has no
 * dialog (terms, password). tools/shots.mjs waits for it.
 */
function Ready({ name }: { name: OverlayName }) {
  useEffect(() => {
    document.documentElement.dataset.overlayReady = name;
    return () => { delete document.documentElement.dataset.overlayReady; };
  }, [name]);
  return null;
}

const cache: Partial<Record<OverlayName, ComponentType<OverlayProps<OverlayName>>>> = {};
function Direct({ name, ctx }: { name: OverlayName; ctx: OverlayCtx[OverlayName] }) {
  const [C, setC] = useState<ComponentType<OverlayProps<OverlayName>> | null>(() => cache[name] ?? null);
  useEffect(() => { void OVERLAYS[file(name, ".tsx")]?.().then((m) => { cache[name] = m.default; setC(() => m.default); }); }, [name]);
  return C ? <><C ctx={ctx} /><Ready name={name} /></> : null;
}
