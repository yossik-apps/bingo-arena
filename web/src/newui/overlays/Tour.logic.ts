// The tour and "What is new": Classic's words (views/Tour.tsx), kept exactly, as pure functions. The steps come from guide/content.ts.
import type { IconName } from "../Icon";

export const counter = (heading: string, i: number, total: number) => `${heading} · ${i + 1} of ${total}`;
export const SKIP = "Skip";
export const OPEN_NOW = "Open it now";
export const BACK = "Back";
export const nextText = (last: boolean) => (last ? "Start playing" : "Next");
/** "Open it now" shows when the step has a screen and is not the last step, as in Classic. */
export const showOpen = (hasView: boolean, last: boolean) => hasView && !last;

/** The guide's icon names (Classic's sprite) mapped to the new icon set. coin and gem have their own drawings. */
export const ICONS: Record<string, IconName | "coin" | "gem"> = {
  play: "play", quest: "target", star: "star", users: "users", map: "map", coin: "coin", gem: "gem",
  trophy: "trophy", gift: "gift", mail: "mail", target: "target", zap: "bolt", help: "help",
};
export const iconFor = (name: string) => ICONS[name] ?? "star";

// ---- the practice board on the "How to play" step ----
export const DEMO_CELLS = [7, 22, 31, 45, 52, 60, 12, 38, 71];
export const DEMO_TARGET = 45;
/** Classic's ball label: the column letter and the number, like N45. */
export const ballLabel = (n: number) => "BINGO"[Math.floor((n - 1) / 15)] + n;
export const demoText = (done: boolean) => (done ? "Nice! That is how every tap works." : `The ball says ${ballLabel(DEMO_TARGET)}. Tap ${DEMO_TARGET} on the card.`);
export const DEMO_LABEL = "Practice board";
export const TRY_AGAIN = "Try again";
export const cellLabel = (n: number, done: boolean) => `${n}${done && n === DEMO_TARGET ? ", tapped" : ""}`;
