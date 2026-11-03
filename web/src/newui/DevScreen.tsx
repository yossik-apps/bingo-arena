// Local development only (App loads it behind import.meta.env.DEV, so it is not part of a production build).
// Opens one screen by name with sample data, for captures of screens no tab button reaches, such as Play:
//   ?screen=play&fixture=player&state=practice      the new screen, in the new shell
//   ?screen=play&fixture=player&state=practice&design=classic      the Classic screen, where it can be opened from sample data
// The screen does not have to be listed in NEW_SCREENS yet.
import { useEffect, useLayoutEffect, useState, type ComponentType } from "react";
import Play from "../views/Play";
import { EmptyState } from "./components";
import NewShell from "./NewShell";
import { baseFixture } from "./screens/baseFixture";
import type { ScreenCtx, ScreenFixture, ScreenMoment, ScreenName, ScreenProps } from "./screens/contract";

const SCREENS = import.meta.glob<{ default: ComponentType<ScreenProps> }>("./screens/[A-Z]*.tsx");
const FIXTURES = import.meta.glob<{ fixture: ScreenFixture; moments?: Record<string, ScreenMoment> }>("./screens/*.fixture.ts");
const file = (name: string, end: string) => `./screens/${name[0].toUpperCase()}${name.slice(1)}${end}`;

declare global { interface Window { __nuT0?: number } }

/** Marks when the screen first draws, so the screenshot tool can time its taps from the start of the round. */
function Started() {
  useLayoutEffect(() => { window.__nuT0 = performance.now(); }, []);
  return null;
}

export default function DevScreen({ screen, kind, state, classic }: { screen: ScreenName; kind: string; state: string | null; classic: boolean }) {
  const [view, setView] = useState<ScreenName>(screen);
  const [calendar, setCalendar] = useState(false);
  const [loaded, setLoaded] = useState<{ ctx: ScreenCtx; Screen: ComponentType<ScreenProps> | null } | null>(null);

  useEffect(() => {
    let live = true;
    const base = baseFixture(kind, view, setView, () => setCalendar(true));
    void Promise.all([FIXTURES[file(view, ".fixture.ts")]?.(), SCREENS[file(view, ".tsx")]?.()]).then(([f, s]) => {
      if (live) setLoaded({ ctx: f ? f.fixture(base, state) : base, Screen: s?.default ?? null });
    });
    return () => { live = false; };
  }, [view, kind, state]);

  if (!loaded) return null;
  const { ctx, Screen } = loaded;
  const none = () => undefined;
  if (classic) {
    if (view !== "play" || !ctx.rounds.active) return <div className="shell"><div className="content"><p>Classic {view} cannot be opened from sample data.</p></div></div>;
    // exactly how App shows a round in Classic; ending it goes nowhere
    return <div className="shell"><div className="content"><Play round={ctx.rounds.active} tips={false} onDone={none} onError={none} onLeave={none} /><Started /></div></div>;
  }
  return (
    <NewShell ctx={ctx} calendarOpen={calendar} closeCalendar={() => setCalendar(false)}>
      {Screen ? <><Screen ctx={ctx} /><Started /></> : <EmptyState title="Not redesigned yet" text={`There is no screens/${file(view, ".tsx").slice(10)} yet.`} />}
    </NewShell>
  );
}
