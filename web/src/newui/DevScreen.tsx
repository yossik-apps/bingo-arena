// Local development only (App loads it behind import.meta.env.DEV, so it is not part of a production build).
// Opens any screen by name with sample data, for captures, including screens no tab button reaches (Play, Result, the menu screens):
//   ?screen=play&fixture=player&state=practice      the new screen, in the new shell
//   ?screen=play&fixture=player&state=practice&design=classic      the Classic screen, where it can be drawn from sample data
// The screen does not have to be listed in NEW_SCREENS yet.
import { useEffect, useLayoutEffect, useState, type ComponentType, type ReactNode } from "react";
import Help from "../views/Help";
import Play from "../views/Play";
import Result from "../views/Result";
import Wallet from "../views/Wallet";
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

const none = () => undefined;
/**
 * The Classic screens that can be drawn from sample data alone, exactly as App draws them, with actions that go nowhere.
 * The others (Inbox, Refer, Matchmaking, Admin and the tab screens) load their own data from the server, so they cannot.
 */
const CLASSIC: Partial<Record<ScreenName, (ctx: ScreenCtx) => ReactNode>> = {
  play: (c) => c.rounds.active && <Play round={c.rounds.active} tips={false} onDone={none} onError={none} onLeave={none} />,
  result: (c) => c.rounds.result && (
    <Result r={c.rounds.result.r} p={c.rounds.result.p} achNames={(c.rounds.result.r.achievements ?? []).map((a) => c.rounds.achievementNames[a] ?? a)} onReplay={none} onAgain={none}
      playerName={c.profile?.name} onGo={none} coach={c.dna.coach} dna={c.dna.dna} onDrill={none} />
  ),
  help: () => <Help onReplay={none} onContact={none} />,
  wallet: (c) => <Wallet econ={c.wallet.economy} balance={c.wallet.coins} onGo={none} onDrill={none} drillDone={c.daily.drillDone} />,
};

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
  if (classic) {
    const drawn = CLASSIC[view]?.(ctx);
    if (!drawn) return <div className="shell"><div className="content"><p>Classic {view} cannot be opened from sample data: {CLASSIC[view] ? "this state has no sample for it." : "it loads its own data from the server."}</p><Started /></div></div>;
    return <div className="shell"><div className="content">{drawn}<Started /></div></div>;
  }
  return (
    <NewShell ctx={ctx} calendarOpen={calendar} closeCalendar={() => setCalendar(false)}>
      {Screen ? <Screen ctx={ctx} /> : <EmptyState title="Not redesigned yet" text={`There is no screens/${file(view, ".tsx").slice(10)} yet.`} />}<Started />
    </NewShell>
  );
}
