// Which design a viewer gets. The New design, for everyone (BA-05).
import { NEW_OVERLAYS as OVERLAYS_REGISTERED, NEW_SCREENS as REGISTERED } from "../newui/screens/registry";
import type { FlagMode } from "./flags";

/**
 * The design mode every page load uses: "all", so every viewer gets New from the first screen. Nothing is read from the
 * database or the device and nothing is waited for, so a slow or failed load can never fall back to Classic.
 * The design_new row in feature_flags stays in the database but no longer changes the game.
 * Only a test build of Classic sets VITE_DESIGN=classic (tools/classic-smoke.mjs), while the Classic code still exists.
 */
export const designMode = (env: { VITE_DESIGN?: string } | undefined): FlagMode => (env?.VITE_DESIGN === "classic" ? "off" : "all");
export const DESIGN_MODE: FlagMode = designMode((import.meta as { env?: { VITE_DESIGN?: string } }).env);

export type Design = "classic" | "new";
type Store = Pick<Storage, "getItem" | "setItem">;

const KEY = "ba_design";
const PARAM = "design";
const isDesign = (v: unknown): v is Design => v === "new" || v === "classic";

/** Screens that have a new version (newui/screens/registry.ts). A screen not listed there stays Classic even when the flag is on. */
export const NEW_SCREENS: ReadonlySet<string> = new Set(Object.keys(REGISTERED));

/** An admin's ?design= override wins. Everyone else follows the flag; "admins" counts only for a signed-in admin. */
export function chooseDesign(a: { mode: FlagMode; isAdmin: boolean; override: Design | null }): Design {
  if (a.isAdmin && a.override) return a.override;
  return a.mode === "all" || (a.mode === "admins" && a.isAdmin) ? "new" : "classic";
}

export const screenDesign = (screen: string, design: Design, screens: ReadonlySet<string> = NEW_SCREENS): Design =>
  design === "new" && screens.has(screen) ? "new" : "classic";

/** Overlays that have a new version (NEW_OVERLAYS in newui/screens/registry.ts). */
export const NEW_OVERLAYS: ReadonlySet<string> = new Set(Object.keys(OVERLAYS_REGISTERED));
/**
 * Does an overlay use its new version? Only when it is listed and drawn where the viewer gets the new design: in the new shell,
 * or, for the gates shown before the shell (terms, password), when the viewer's design is New. There is no preview of an
 * unlisted overlay on the live site; local development opens any overlay with ?overlay= (newui/DevOverlay.tsx).
 */
export const overlayNew = (overlay: string, newDesign: boolean, overlays: ReadonlySet<string> = NEW_OVERLAYS): boolean =>
  newDesign && overlays.has(overlay);

/** Screens the empty shell can be previewed on. The admin panel stays Classic, and so do rounds and their results. */
const PREVIEW_SCREENS: ReadonlySet<string> = new Set(["lobby", "journey", "compete", "collect", "shop", "wallet", "profile", "help", "inbox", "refer"]);
/** Local development also previews a real round and its result, for any signed-in account (one test round with a test account). */
const DEV_ROUND_SCREENS: ReadonlySet<string> = new Set(["play", "result"]);

/**
 * Does this screen use the new shell? For players, only when the flag says New and the screen has a new version.
 * Previewing the unfinished shell needs ?design=new from a signed-in admin, or local development (dev is import.meta.env.DEV).
 * In local development a signed-in account (signedIn) may also preview a round and its result; a visitor's free round may not.
 */
export function shellAllowed(a: { screen: string; design: Design; isAdmin: boolean; override: Design | null; dev: boolean; signedIn?: boolean; screens?: ReadonlySet<string> }): boolean {
  if (screenDesign(a.screen, a.design, a.screens) === "new") return true;
  if (a.override !== "new") return false;
  if (a.dev) return PREVIEW_SCREENS.has(a.screen) || (!!a.signedIn && DEV_ROUND_SCREENS.has(a.screen));
  return a.isAdmin && PREVIEW_SCREENS.has(a.screen);
}

/**
 * The screen a visitor sees in the new shell, or null for Classic. A free round's result waiting to be shown stays Classic
 * (GuestResult) until the new Result is allowed, so a visitor never gets a new screen that cannot draw it.
 */
export function visitorScreen(a: { screen: string; playing: boolean; freeResult: boolean; allowed: (screen: string) => boolean }): string | null {
  const s = a.playing ? "play" : a.freeResult ? "result" : a.screen;
  return a.allowed(s) ? s : null;
}

/** Reads ?design= from the address and remembers it. The value only ever takes effect through chooseDesign, for an admin. */
export function loadOverride(search: string, store: () => Store): Design | null {
  const asked = new URLSearchParams(search).get(PARAM);
  const fromLink = isDesign(asked) ? asked : null;
  try {
    if (fromLink) store().setItem(KEY, fromLink);
    const kept = store().getItem(KEY);
    return isDesign(kept) ? kept : fromLink;
  } catch { return fromLink; }
}

/** The address without ?design=, keeping everything else. */
export function withoutOverride(search: string): string {
  const p = new URLSearchParams(search);
  p.delete(PARAM);
  const left = p.toString();
  return left ? `?${left}` : "";
}
