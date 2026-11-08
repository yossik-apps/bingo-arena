// Sample states of the live-match bar, for captures (DevOverlay: ?overlay=arenaBar&state=…). Sample names only, never real players.
import type { OverlayFixture } from "../screens/contract";

const wait = (id: string, name: string, level: string) => ({ id, name, level, waited: 12, player_level: 9 });
const invite = (id: string, from_name: string, level: string) => ({ id, level, from_name, waiting: true, created_at: new Date(0).toISOString() });

export const fixture: OverlayFixture<"arenaBar"> = (base, state) => {
  // answer_invite, faked: accepting gives the invite's level back, as the server does
  const ctx = { ...base, answer: async (_id: string, yes: boolean) => (yes ? { level: "beginner" } : null) };
  const arena = base.arena!;
  switch (state) {
    case "wait": return { ...ctx, arena: { ...arena, invites: [] } };
    case "wait1": return { ...ctx, arena: { ...arena, invites: [], online: 1 } };
    case "long": return { ...ctx, arena: { ...arena, invites: [invite("i9", "devFixtureLongName20", "hard")] } };
    case "longwait": return { ...ctx, arena: { ...arena, invites: [], waiting: [wait("w9", "devFixtureLongName20", "hard")], online: 128 } };
    case "error": return { ...ctx, answer: async () => { throw new Error("This invite is no longer available."); } };
    case "none": return { ...ctx, arena: null };
    case "closed": return { ...ctx, canPlay: false };
    case "empty": return { ...ctx, arena: { ...arena, invites: [], waiting: [] } };
    default: return ctx; // "invite": an invite and someone waiting; the invite shows first
  }
};
