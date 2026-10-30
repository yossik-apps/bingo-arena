// Which design a viewer gets. Classic unless the Design flag says otherwise.
import type { FlagMode } from "./flags";

export type Design = "classic" | "new";
type Store = Pick<Storage, "getItem" | "setItem">;

const KEY = "ba_design";
const PARAM = "design";
const isDesign = (v: unknown): v is Design => v === "new" || v === "classic";

/** Screens that have a new version. A screen not listed here stays Classic even when the flag is on. */
export const NEW_SCREENS: ReadonlySet<string> = new Set<string>();

/** An admin's ?design= override wins. Everyone else follows the flag; "admins" counts only for a signed-in admin. */
export function chooseDesign(a: { mode: FlagMode; isAdmin: boolean; override: Design | null }): Design {
  if (a.isAdmin && a.override) return a.override;
  return a.mode === "all" || (a.mode === "admins" && a.isAdmin) ? "new" : "classic";
}

export const screenDesign = (screen: string, design: Design, screens: ReadonlySet<string> = NEW_SCREENS): Design =>
  design === "new" && screens.has(screen) ? "new" : "classic";

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
