// Sample states for the tour's captures. Local development only. The steps are the real guide (guide/content.ts), only the starting point changes.
import { GUIDE } from "../../guide/content";
import type { OverlayFixture } from "../screens/contract";

const at = (id: string) => GUIDE.slice(Math.max(0, GUIDE.findIndex((s) => s.id === id)));
const longest = [...GUIDE].sort((a, b) => b.body.join(" ").length - a.body.join(" ").length)[0];

export const fixture: OverlayFixture<"tour"> = (base, state) => {
  switch (state) {
    // after an update: only the steps newer than the player's last tour (here the newest one)
    case "new": return { ...base, kind: "new", heading: "What is new", steps: GUIDE.filter((s) => s.since === Math.max(...GUIDE.map((g) => g.since))) };
    case "howto": return { ...base, steps: at("howto") };
    case "open": return { ...base, steps: at("modes") };
    case "long": return { ...base, steps: [longest, ...GUIDE.filter((s) => s !== longest)] };
    case "replay": return { ...base, kind: "replay" };
    default: return base;
  }
};
