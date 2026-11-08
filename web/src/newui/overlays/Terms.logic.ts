// The terms gate: Classic's words (views/AgeGate.tsx), kept exactly, as pure functions.

export const title = (name: string, updated: boolean) => (updated ? "We updated our terms" : `Welcome, ${name}`);
export const intro = (updated: boolean) => (updated ? "Please review and accept the new Terms and Privacy Policy to keep playing." : "One last step before you play.");
/** The words before the two links. Inside CrazyGames there is no age line, as in Classic. */
export const consentStart = (crazyGames: boolean) => (crazyGames ? "I have read and agree to the " : "I am 18 or older, and I have read and agree to the ");
export const TERMS = { href: "/terms.html", text: "Terms of Service" };
export const PRIVACY = { href: "/privacy.html", text: "Privacy Policy" };
export const CONTINUE = "Continue";
export const LOG_OUT = "Log out";
/** Continue works only once the box is ticked, and not while the acceptance is being sent. */
export const canContinue = (ticked: boolean, busy: boolean) => ticked && !busy;
