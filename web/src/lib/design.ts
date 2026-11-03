// Which design a viewer gets. Classic unless the Design flag says otherwise.
import { NEW_SCREENS as REGISTERED } from "../newui/screens/registry";
import type { FlagMode } from "./flags";

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

/** Screens the empty shell can be previewed on. The admin panel stays Classic, and so do rounds and their results. */
const PREVIEW_SCREENS: ReadonlySet<string> = new Set(["lobby", "journey", "compete", "collect", "shop", "wallet", "profile", "help", "inbox", "refer"]);

/**
 * Does this screen use the new shell? For players, only when the flag says New and the screen has a new version.
 * Previewing the unfinished shell needs ?design=new from a signed-in admin, or local development (dev is import.meta.env.DEV).
 */
export function shellAllowed(a: { screen: string; design: Design; isAdmin: boolean; override: Design | null; dev: boolean; screens?: ReadonlySet<string> }): boolean {
  if (screenDesign(a.screen, a.design, a.screens) === "new") return true;
  return a.override === "new" && (a.isAdmin || a.dev) && PREVIEW_SCREENS.has(a.screen);
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
