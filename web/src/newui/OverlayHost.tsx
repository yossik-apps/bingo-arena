// Shows an overlay's new version (NEW_OVERLAYS in screens/registry.ts). App loads this file only when an overlay is listed and
// the viewer gets the new design, so Classic players never download it. See overlayNew in lib/design.ts.
import { lazy, Suspense, useLayoutEffect, type ComponentType, type ReactNode } from "react";
import "./fonts";
import "./tokens.css";
import "./visuals.css";
import "./shell.css";
import type { OverlayCtx, OverlayName, OverlayProps } from "./screens/contract";
import { NEW_OVERLAYS } from "./screens/registry";

const cache: Partial<Record<OverlayName, ComponentType<OverlayProps<OverlayName>>>> = {};
const overlayFor = (name: OverlayName) => {
  const load = NEW_OVERLAYS[name] as (() => Promise<{ default: ComponentType<OverlayProps<OverlayName>> }>) | undefined;
  return load ? (cache[name] ??= lazy(load)) : null;
};

/**
 * `page`: a gate shown before the shell (terms, password) gets its own full-screen page in the new look.
 * Inside the new shell an overlay draws where Classic's does, already inside .nu-root.
 */
export default function OverlayHost<K extends OverlayName>({ name, ctx, page }: { name: K; ctx: OverlayCtx[K]; page?: boolean }) {
  const Overlay = overlayFor(name);
  if (!Overlay) return null;
  const body = <Suspense fallback={null}><Overlay ctx={ctx} /></Suspense>;
  return page ? <NewPage>{body}</NewPage> : body;
}

/** A full page in the new look outside the shell: sets html.nu-on as NewShell does, so Classic's page margins go away. */
export function NewPage({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    const html = document.documentElement;
    html.classList.add("nu-on");
    return () => html.classList.remove("nu-on");
  }, []);
  return <div className="nu-root nu-fullscreen"><div className="nu-fullmain">{children}</div></div>;
}
