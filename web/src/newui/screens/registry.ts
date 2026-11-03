// The screens that have a new version. One line per screen, for example:  lobby: () => import("./Lobby"),
// A screen listed here shows to players once the Design flag allows it, so add its line only when the screen is finished.
import type { ScreenModule, ScreenName } from "./contract";

export const NEW_SCREENS: Partial<Record<ScreenName, () => Promise<ScreenModule>>> = {
};
