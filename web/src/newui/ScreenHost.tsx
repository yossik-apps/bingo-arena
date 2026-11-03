import { lazy, Suspense, useEffect, useMemo, useState, type ComponentType } from "react";
import { EmptyState, Skeleton } from "./components";
import type { ScreenCtx, ScreenFixture, ScreenName, ScreenProps } from "./screens/contract";
import { NEW_SCREENS } from "./screens/registry";

const cache: Partial<Record<ScreenName, ComponentType<ScreenProps>>> = {};
const screenFor = (name: ScreenName) => {
  const load = NEW_SCREENS[name];
  return load ? (cache[name] ??= lazy(load)) : null;
};

// Each screen's <Name>.fixture.ts, for captures. Local development only: the glob is not part of a production build.
const FIXTURES = import.meta.env.DEV ? import.meta.glob<{ fixture: ScreenFixture }>("./screens/*.fixture.ts") : {};
const fixtureFile = (name: string) => `./screens/${name[0].toUpperCase()}${name.slice(1)}.fixture.ts`;

/** Shows a screen's new version, or the empty page if it has none yet. Players never reach the empty page: see shellAllowed in lib/design.ts. */
export default function ScreenHost({ ctx, useFixture }: { ctx: ScreenCtx; useFixture?: boolean }) {
  const name = ctx.navigation.screen;
  const [fixed, setFixed] = useState<ScreenFixture | null>(null);
  useEffect(() => {
    setFixed(null);
    const load = useFixture ? FIXTURES[fixtureFile(name)] : undefined;
    if (load) void load().then((m) => setFixed(() => m.fixture));
  }, [name, useFixture]);
  const data = useMemo(() => (fixed ? fixed(ctx, new URLSearchParams(window.location.search).get("state")) : ctx), [fixed, ctx]);
  const Screen = screenFor(name);
  if (useFixture && FIXTURES[fixtureFile(name)] && !fixed) return <Skeleton />;
  if (!Screen) return <EmptyState title="Not redesigned yet" text="This screen has no new design yet." />;
  return <Suspense fallback={<Skeleton />}><Screen ctx={data} /></Suspense>;
}
