// Local development only: sample header data, so the screenshot harness can check the signed-in layout without an account.
// App.tsx uses this only behind import.meta.env.DEV, so it is not part of a production build.
import type { ShellPlayer } from "./NewShell";

const base: ShellPlayer = {
  name: "devFixtureLongName20", level: 12, xpPct: 64, xpText: "310 / 440 XP", title: "Sharp Dabber", coins: 12450, gems: 128, streak: 14, unread: 12, adminUnread: 0,
  isAdmin: false, guest: false, saveLabel: "Save", cal: { rewards: [20, 30, 40, 50, 75, 100, 200], day: 4, claimed_today: true, streak: 14, next: 75, shields: 1 },
  drillDone: false, styleName: "Steady Hand", dnaTag: "72",
};

export const devFixtures: Record<string, ShellPlayer> = {
  player: base,
  guest: { ...base, guest: true },
  admin: { ...base, isAdmin: true, adminUnread: 3 },
};
