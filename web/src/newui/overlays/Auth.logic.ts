// The sign-up, log-in and save-progress pop-up: Classic's words and checks (views/AuthGate.tsx and views/Auth.tsx), kept exactly, as pure functions.

export type Mode = "reg" | "log";
export type PopupState = "" | "waiting" | "blocked" | "timeout" | "error";

/**
 * Classic's words for a sign-in error live in lib/authText.ts, shared with Classic Auth. The auth group (lib/screenData.ts)
 * already returns them, so the pop-up shows its answers as they come and applies friendly only where Classic does it itself:
 * Google's small window and an error Google sends back in the page address.
 */
import { friendly } from "../../lib/authText";
export { friendly };

/** A guest saving progress adds Google or email to the same account; only in the sign-up mode. */
export const isSaving = (guest: boolean, mode: Mode) => guest && mode === "reg";

// ---- the frame ----
export const topLine = (guest: boolean) => (guest ? "Free · keeps everything you earned" : "Free · takes 20 seconds");
export const NOT_NOW = "Not now";

// ---- the heading ----
export const heading = (reason: string | null | undefined, saving: boolean, mode: Mode) =>
  reason ?? (saving ? "Save your progress" : mode === "reg" ? "Create your free account" : "Welcome back");
export type Perk = { icon: "coin" | "trophy" | "check" | "user"; text: string };
/** Classic's three lines under the heading. The emoji become the new icon set; the words stay. */
export const perks = (saving: boolean, mode: Mode, welcome: number | null): Perk[] =>
  saving ? [{ icon: "check", text: "Keep your coins and level" }, { icon: "user", text: "Play on any device" }, { icon: "trophy", text: "Keep your prizes" }]
    : mode === "reg" ? [{ icon: "coin", text: `${welcome ?? 50} free coins after your first round` }, { icon: "trophy", text: "Prizes every week" }, { icon: "check", text: "Progress saved" }]
    : [];

// ---- Google ----
/** Inside a frame, a guest saving progress gets email only, as in Classic. */
export const showGoogle = (saving: boolean, inFrame: boolean) => !(saving && inFrame);
export const googleLabel = (busy: boolean, saving: boolean, mode: Mode): { text: string; tap: boolean } =>
  busy ? { text: "Opening Google…", tap: false }
    : saving ? { text: "Save with Google", tap: true }
    : mode === "reg" ? { text: "Sign up with Google", tap: true }
    : { text: "Log in with Google", tap: false };
export const TAP = " · 1 tap";
/** The small line under the Google button. */
export const googleHint = (saving: boolean, mode: Mode, inFrame: boolean) =>
  saving ? "Your coins, level, stamps and streak stay exactly as they are."
    : mode === "reg" ? (inFrame ? "Google opens in a small window. Sign in there and you come straight back to the game." : "Fastest: no password to remember. You confirm you are 18+ on the next screen.")
    : null;
export const GUEST_LOG_NOTE = "Logging in to another account leaves this guest account on this device.";
/** The small-window sign-in inside a frame: what the player sees while it runs or after it stops. */
export const popupText = (s: PopupState): { title: string; text: string | null } | null =>
  s === "waiting" ? { title: "Finish signing in with Google in the small window…", text: "This screen updates by itself when you are done." }
    : s === "blocked" ? { title: "Your browser blocked the Google window.", text: "Allow pop-ups for this game and press the Google button again, or sign up with email below." }
    : s === "timeout" ? { title: "The Google window took too long.", text: "Press the Google button to try again, or use email below." }
    : s === "error" ? { title: "Sign-in did not finish.", text: null }
    : null;
export const POPUP_FAILED = "Sign-in did not finish. Please try again.";
export const OR_EMAIL = "or with email";

// ---- the email form ----
export const NAME_LABEL = "Player name";
export const NAME_HINT = "Shown on leaderboards. Change it any time.";
export const NAME_MAX = 20;
export const EMAIL_LABEL = "Email";
export const PASSWORD_LABEL = "Password (8+ characters)";
export const showText = (shown: boolean) => (shown ? "Hide" : "Show");
/** The words before the two links; inside CrazyGames there is no age line, as in Classic. */
export const consentStart = (crazyGames: boolean) => (crazyGames ? "I agree to the " : "I am 18+ and agree to the ");
export const TERMS = { href: "/terms.html", text: "Terms" };
export const PRIVACY = { href: "/privacy.html", text: "Privacy Policy" };
export const submitLabel = (busy: boolean, saving: boolean, mode: Mode) =>
  busy ? "One moment…" : saving ? "Save my progress" : mode === "reg" ? "Create free account" : "Log in";
export const FORGOT = "Forgot password?";
export const FACEBOOK_NOTE = "Signed up with Facebook before? Use “Forgot password?” with the same email as your Facebook account.";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const validEmail = (email: string) => EMAIL.test(email.trim());
/** Classic's checks, in Classic's order. null: the form can be sent. */
export function check(f: { email: string; password: string; name: string; ticked: boolean; mode: Mode; saving: boolean; crazyGames: boolean }): string | null {
  if (!validEmail(f.email)) return "Enter a valid email address.";
  if (f.password.length < 8) return "Password must be at least 8 characters.";
  if (f.saving || f.mode !== "reg") return null;
  if (f.name.trim().length < 2) return "Choose a player name (2+ characters).";
  if (!f.ticked) return f.crazyGames ? "Please tick the box to accept the Terms." : "Please tick the box to confirm you are 18+ and accept the Terms.";
  return null;
}
export const FORGOT_NEEDS_EMAIL = "Enter your email above first.";
export const RESET_SENT = "If that email has an account, a reset link is on its way.";

// ---- the line at the bottom ----
export const switchLine = (saving: boolean, mode: Mode, guest: boolean): { text: string; button: string; to: Mode } =>
  saving || mode === "reg" ? { text: "Already have an account?", button: "Log in", to: "log" }
    : { text: guest ? "Want to keep this account?" : "New here?", button: guest ? "Save your progress" : "Create a free account", to: "reg" };

// ---- after sign-up: the email waits to be confirmed ----
export const SENT_TITLE = "Almost there! Check your email";
export const sentText = (guest: boolean, welcome: number | null) =>
  guest ? "Open it on this device to save your progress." : `Open it on this device to start playing${welcome ? ` and get your ${welcome} free coins after your first round` : ""}.`;
export const SENT_SPAM = "Not there after a minute? Look in your spam or promotions folder.";
export const RESEND = "Send the link again";
export const RESENT = "Sent again. Check your inbox and your spam folder.";
export const USE_GOOGLE = "Use Google instead";

/** An error Google sends back in the web address after a redirect, as Classic reads it; null when there is none. */
export function returnedError(search: string, hash: string): string | null {
  const q = new URLSearchParams(search.replace(/^\?/, "") + "&" + hash.replace(/^#/, ""));
  const err = q.get("error_description") ?? q.get("error");
  return err ? friendly(err.replace(/\+/g, " ")) : null;
}
