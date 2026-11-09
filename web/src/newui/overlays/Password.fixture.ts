// Sample data for the new-password page's captures, one state per name. Local development only.
// save answers from here, so no password is ever changed.
import type { OverlayFixture } from "../screens/contract";

export const fixture: OverlayFixture<"password"> = (base, state) => {
  switch (state) {
    // after both boxes are filled and Save is pressed: the server's answer, shown as it comes, as in Classic
    case "error": return { ...base, save: async () => ({ error: "New password should be different from the old password." }) };
    default: return base;
  }
};
