// Local development only: sample data for each overlay, so captures need no account. DevOverlay.tsx uses it behind import.meta.env.DEV.
// An overlay's own <Name>.fixture.ts (exporting `fixture: OverlayFixture<…>`) changes it for a state, as screens do.
import { GUIDE } from "../../guide/content";
import type { OverlayCtx, OverlayName } from "../screens/contract";
import { sampleData, visitorData } from "../screens/dataFixture";

const none = () => undefined;
// the same sample player and entry fees as screens/baseFixture.ts
const NAME = "devFixtureLongName20";
const FEES = { beginner: 10, medium: 20, hard: 40 };

/** The sample data an overlay gets for a fixture kind: visitor, player, guest, admin or unclaimed. */
export function overlayFixture<K extends OverlayName>(name: K, kind: string): OverlayCtx[K] {
  const guest = kind === "guest";
  const data = kind === "visitor" ? visitorData() : sampleData();
  const all: OverlayCtx = {
    auth: {
      reason: guest ? "Save your progress" : "Create your free account", mode: "reg", welcome: guest ? null : 50, guest, crazyGames: false,
      inFrame: false, popupSignIn: (onState) => { onState("waiting"); return none; }, track: none, suggestName: () => "LuckyDabber42",
      data: data.auth, saved: guest ? none : null, close: none,
    },
    terms: { name: NAME, updated: false, crazyGames: false, accept: async () => ({ error: null }), done: async () => undefined, logOut: none },
    password: { save: async () => ({ error: null }), done: none },
    firstVisit: { crazyGames: false, inviter: null, busy: false, play: none, logIn: none, close: none },
    tour: { kind: "full", heading: "Quick tour", steps: GUIDE, close: none, go: none },
    arenaBar: {
      arena: {
        online: 14, sent: [],
        waiting: [{ id: "w1", name: "Sample rival", level: "medium", waited: 12, player_level: 9 }],
        invites: [{ id: "i1", level: "beginner", from_name: "Sample friend", waiting: true, created_at: new Date(0).toISOString() }],
      },
      fees: FEES, canPlay: true, play: none,
    },
  };
  return all[name];
}

/** Which kind of viewer sees an overlay, when the harness does not say: visitors get the welcome card and the sign-up pop-up. */
export const OVERLAY_VIEWER: Record<OverlayName, string> = { auth: "visitor", terms: "player", password: "player", firstVisit: "visitor", tour: "player", arenaBar: "player" };
/** The gates App shows before the shell, on a page of their own. */
export const OVERLAY_PAGES: ReadonlySet<OverlayName> = new Set<OverlayName>(["terms", "password"]);
