// Sample data for Help's captures. Local development only. Help loads nothing, so the states only change the Facebook link;
// a visitor is --fixture visitor, and an open section is --click "<its title>".
import type { ScreenFixture } from "./contract";

export const fixture: ScreenFixture = (base, state) => {
  switch (state) {
    // no link set, or on CrazyGames: Classic hides the Facebook button
    case "nofacebook": return { ...base, social: { ...base.social, facebook: null } };
    default: return base;
  }
};
