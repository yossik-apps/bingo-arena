// Sample data for the sign-up pop-up's captures, one state per name. Local development only. Nothing here reaches the server:
// every call answers from here, so no sign-up, log-in, password or Google request is ever made.
import { friendly, signInText } from "../../lib/authText";
import type { OverlayCtx, OverlayFixture } from "../screens/contract";

type Ctx = OverlayCtx["auth"];
const none = () => undefined;
const guest = (b: Ctx): Ctx => ({ ...b, guest: true, reason: "Save your progress", welcome: null, saved: none });
const frame = (b: Ctx, st: "waiting" | "blocked" | "timeout" | "error"): Ctx => ({ ...b, crazyGames: true, inFrame: true, popupSignIn: (on) => { on(st, st === "error" ? "Sample: the small window closed early" : undefined); return none; } });

export const fixture: OverlayFixture<"auth"> = (base, state) => {
  switch (state) {
    case "reason": return { ...base, reason: "To play, create your free account" };
    case "log": return { ...base, mode: "log", reason: "Welcome back! Log in to continue" };
    case "guest": return guest(base);
    case "guestlog": return { ...guest(base), mode: "log" };
    // inside CrazyGames: no age words, and Google opens in a small window (press the Google button to see each answer)
    case "crazy": return frame(base, "waiting");
    case "blocked": return frame(base, "blocked");
    case "timeout": return frame(base, "timeout");
    case "popuperror": return frame(base, "error");
    case "guestframe": return { ...frame(guest(base), "waiting") };
    // after filling the form and pressing the button; errors come back already in Classic's words, as the auth group returns them
    case "sent": return { ...base, data: { ...base.data, signUp: async () => ({ error: null, session: false }) } };
    case "guestsent": return { ...guest(base), data: { ...base.data, addEmail: async () => ({ error: null, confirm: true }) } };
    case "taken": return { ...base, data: { ...base.data, signUp: async () => ({ error: friendly("User already registered"), session: false }) } };
    case "wrong": return { ...base, mode: "log", reason: "Welcome back! Log in to continue", data: { ...base.data, signIn: async () => ({ error: signInText("Invalid login credentials") }) } };
    default: return base;
  }
};
