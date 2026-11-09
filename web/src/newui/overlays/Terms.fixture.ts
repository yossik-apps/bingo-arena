// Sample data for the terms gate's captures, one state per name. Local development only. Nothing here reaches the server.
import type { OverlayFixture } from "../screens/contract";

export const fixture: OverlayFixture<"terms"> = (base, state) => {
  switch (state) {
    case "crazy": return { ...base, crazyGames: true };
    case "updated": return { ...base, updated: true };
    case "longname": return { ...base, name: "Sample player with a very long display name indeed" };
    // after ticking the box and pressing Continue: the server's answer, as ctx.terms.accept gives it today
    case "error": return { ...base, accept: async () => ({ error: "Sample server error: the terms could not be saved." }) };
    default: return base;
  }
};
