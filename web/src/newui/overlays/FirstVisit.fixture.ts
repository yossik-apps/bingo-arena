// Sample data for the first-visit card's captures, one state per name. Local development only; the sample inviter is named as a sample.
import type { OverlayFixture } from "../screens/contract";

export const fixture: OverlayFixture<"firstVisit"> = (base, state) => {
  switch (state) {
    case "invited": return { ...base, inviter: "Sample friend" };
    // inside CrazyGames: no age words, and no "I have an account" (CrazyGames signs players in)
    case "crazy": return { ...base, crazyGames: true, logIn: null };
    case "busy": return { ...base, busy: true };
    default: return base;
  }
};
