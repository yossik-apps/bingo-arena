// The screens that have a new version. One line per screen, for example:  lobby: () => import("./Lobby"),
// A screen listed here shows to players once the Design flag allows it, so add its line only when the screen is finished.
import type { OverlayModule, OverlayName, ScreenModule, ScreenName } from "./contract";

/** Screens shown full screen: no header, tab bar, side panel, live-match bar, toasts or shell errors, as Classic does during a round. */
export const FULLSCREEN: ReadonlySet<ScreenName> = new Set<ScreenName>(["play"]);

export const NEW_SCREENS: Partial<Record<ScreenName, () => Promise<ScreenModule>>> = {
  lobby: () => import("./Lobby"),
  play: () => import("./Play"),
  journey: () => import("./Journey"),
  collect: () => import("./Collect"),
  profile: () => import("./Profile"),
  shop: () => import("./Shop"),
  compete: () => import("./Compete"),
  help: () => import("./Help"),
};

/** Every overlay (OverlayName in contract.ts). */
export const OVERLAY_NAMES: readonly OverlayName[] = ["auth", "terms", "password", "firstVisit", "tour", "arenaBar"];

// The overlays that have a new version, one line each, for example:
//   auth: () => import("../overlays/Auth"),
// An unlisted overlay stays Classic for everyone. A listed one shows wherever the viewer gets the new design, so add it when finished.
export const NEW_OVERLAYS: { [K in OverlayName]?: () => Promise<OverlayModule<K>> } = {
};
