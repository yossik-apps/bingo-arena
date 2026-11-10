import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as L from "../../web/src/newui/overlays/Auth.logic.ts";
import { signInText } from "../../web/src/lib/authText.ts";

const read = (p: string) => readFileSync(new URL(`../../web/src/${p}`, import.meta.url), "utf8");
// Classic's sign-in words moved to lib/authText.ts (#45); Classic Auth and the auth group both use that file.
const classic = read("views/Auth.tsx") + read("views/AuthGate.tsx") + read("lib/authText.ts");
const has = (s: string) => assert.ok(classic.includes(s), `Classic has "${s}"`);

test("the error words are Classic's own (lib/authText.ts), shown as the auth group returns them", () => {
  assert.match(read("views/Auth.tsx"), /import \{ friendly, signInText \} from "\.\.\/lib\/authText"/, "Classic uses the shared words");
  const logic = read("newui/overlays/Auth.logic.ts");
  assert.match(logic, /import \{ friendly \} from "\.\.\/\.\.\/lib\/authText";\s+export \{ friendly \};/, "the pop-up uses the same file, not a copy");
  assert.doesNotMatch(logic, /error getting user email/, "no copied mapping");
  const tsx = read("newui/overlays/Auth.tsx");
  assert.doesNotMatch(tsx, /friendly\((r|p)\.error\)/, "the auth group's answers are already in Classic's words, so they are not mapped twice");
  assert.match(tsx, /friendly\(m\)/, "Google's small window is mapped, as in Classic");
  assert.equal(L.friendly("User already registered"), "That email is already registered. Log in instead.");
  assert.equal(L.friendly("access_denied"), "Sign-in was cancelled. You can try again or use your email.");
  assert.equal(L.friendly("Something else"), "Something else", "anything unknown is shown as it came");
});

test("headings, perks and the frame's words are Classic's", () => {
  assert.equal(L.heading("To play, create your free account", false, "reg"), "To play, create your free account");
  assert.equal(L.heading(null, true, "reg"), "Save your progress");
  assert.equal(L.heading(null, false, "reg"), "Create your free account");
  assert.equal(L.heading(null, false, "log"), "Welcome back");
  assert.deepEqual(L.perks(false, "reg", null).map((p) => p.text), ["50 free coins after your first round", "Prizes every week", "Progress saved"]);
  assert.equal(L.perks(false, "reg", 120)[0].text, "120 free coins after your first round");
  assert.deepEqual(L.perks(true, "reg", null).map((p) => p.text), ["Keep your coins and level", "Play on any device", "Keep your prizes"]);
  assert.deepEqual(L.perks(false, "log", 50), []);
  for (const p of [...L.perks(false, "reg", null), ...L.perks(true, "reg", null)]) has(p.text.replace(/^50 /, "").replace(/ after your first round$/, "")); // the new design adds "after your first round" (BA-21)
  for (const s of [L.topLine(true), L.topLine(false), L.NOT_NOW]) has(s);
});

test("the Google button follows Classic: hidden only for a guest saving inside a frame", () => {
  assert.equal(L.showGoogle(true, true), false);
  assert.equal(L.showGoogle(true, false), true);
  assert.equal(L.showGoogle(false, true), true);
  assert.deepEqual(L.googleLabel(false, true, "reg"), { text: "Save with Google", tap: true });
  assert.deepEqual(L.googleLabel(false, false, "reg"), { text: "Sign up with Google", tap: true });
  assert.deepEqual(L.googleLabel(false, false, "log"), { text: "Log in with Google", tap: false });
  assert.equal(L.googleLabel(true, false, "reg").text, "Opening Google…");
  assert.equal(L.googleHint(false, "log", false), null);
  for (const s of [L.googleHint(true, "reg", false)!, L.googleHint(false, "reg", true)!, L.googleHint(false, "reg", false)!, L.GUEST_LOG_NOTE, L.POPUP_FAILED, L.OR_EMAIL, L.TAP]) has(s);
  for (const st of ["waiting", "blocked", "timeout", "error"] as const) { const p = L.popupText(st)!; has(p.title); if (p.text) has(p.text); }
  assert.equal(L.popupText(""), null);
});

test("the form's checks come in Classic's order, with Classic's words", () => {
  const f = { email: "a@b.co", password: "12345678", name: "Sam", ticked: true, mode: "reg" as const, saving: false, crazyGames: false };
  assert.equal(L.check({ ...f, email: "nope" }), "Enter a valid email address.");
  assert.equal(L.check({ ...f, email: "nope", password: "" }), "Enter a valid email address.", "the email first");
  assert.equal(L.check({ ...f, password: "short" }), "Password must be at least 8 characters.");
  assert.equal(L.check({ ...f, name: " a " }), "Choose a player name (2+ characters).");
  assert.equal(L.check({ ...f, ticked: false }), "Please tick the box to confirm you are 18+ and accept the Terms.");
  assert.equal(L.check({ ...f, ticked: false, crazyGames: true }), "Please tick the box to accept the Terms.");
  assert.equal(L.check({ ...f, ticked: false, name: "", saving: true }), null, "a guest saving has no name or box");
  assert.equal(L.check({ ...f, ticked: false, name: "", mode: "log" }), null, "logging in has no name or box");
  assert.equal(L.check(f), null);
  assert.equal(signInText("Email not confirmed"), "Please confirm your email first: open the link we sent you. Or continue with Google.");
  assert.equal(signInText("Invalid login credentials"), "Email or password is incorrect.");
  for (const k of ["Enter a valid email address.", "Password must be at least 8 characters.", "Choose a player name (2+ characters).", "Please tick the box to accept the Terms.", "Please tick the box to confirm you are 18+ and accept the Terms.", signInText("confirm"), signInText("x"), L.FORGOT_NEEDS_EMAIL, L.RESET_SENT]) has(k);
});

test("labels, buttons, consent and the bottom line are Classic's", () => {
  for (const s of [L.NAME_LABEL, L.NAME_HINT, `maxLength={${L.NAME_MAX}}`, `>${L.EMAIL_LABEL}<`, L.PASSWORD_LABEL, L.consentStart(true), L.consentStart(false), L.TERMS.href, L.PRIVACY.href, `>${L.TERMS.text}<`, `>${L.PRIVACY.text}<`, L.FORGOT, L.FACEBOOK_NOTE]) has(s);
  assert.equal(L.showText(true), "Hide"); assert.equal(L.showText(false), "Show");
  assert.equal(L.submitLabel(true, false, "reg"), "One moment…");
  assert.equal(L.submitLabel(false, true, "reg"), "Save my progress");
  assert.equal(L.submitLabel(false, false, "reg"), "Create free account");
  assert.equal(L.submitLabel(false, false, "log"), "Log in");
  for (const s of ["One moment…", "Save my progress", "Create free account", '"Log in"']) has(s);
  assert.deepEqual(L.switchLine(true, "reg", true), { text: "Already have an account?", button: "Log in", to: "log" });
  assert.deepEqual(L.switchLine(false, "log", false), { text: "New here?", button: "Create a free account", to: "reg" });
  assert.deepEqual(L.switchLine(false, "log", true), { text: "Want to keep this account?", button: "Save your progress", to: "reg" });
  for (const s of ["Already have an account?", "New here?", "Want to keep this account?", "Create a free account"]) has(s);
});

test("the check-your-email screen is Classic's", () => {
  for (const s of [L.SENT_TITLE, L.SENT_SPAM, L.RESEND, L.RESENT, L.USE_GOOGLE, "We sent a link to ", L.sentText(true, null)]) has(s);
  assert.equal(L.sentText(false, 50), "Open it on this device to start playing and get your 50 free coins after your first round.");
  assert.equal(L.sentText(false, null), "Open it on this device to start playing.");
  has("Open it on this device to start playing");
  has(" and get your ${welcome} free coins"); // Classic stops there; the new design adds "after your first round" (BA-21)
});

test("an error Google sends back in the address is shown, as Classic reads it", () => {
  assert.equal(L.returnedError("?error=access_denied&error_description=User+denied", ""), "Sign-in was cancelled. You can try again or use your email.");
  assert.equal(L.returnedError("", "#error_description=Something+odd"), "Something odd");
  assert.equal(L.returnedError("?overlay=auth", ""), null);
});

test("the pop-up makes only the auth group's calls, and never talks to Supabase itself", () => {
  const src = read("newui/overlays/Auth.tsx");
  assert.doesNotMatch(src, /supabase|lib\/supabase|fetch\(/);
  for (const call of ["data.signUp", "data.signIn", "data.google", "data.linkGoogle", "data.addEmail", "data.setPassword", "data.markSaved", "data.resend", "data.resetPassword", "ctx.popupSignIn", "ctx.track"]) assert.ok(src.includes(call), call);
});

test("a new message is brought into view, since it sits under the button at the bottom of a phone's sheet", () => {
  const src = read("newui/overlays/Auth.tsx");
  assert.equal((src.match(/<p ref=\{msgLine\} className="nu-au-msg" role="alert">\{msg\}<\/p>/g) ?? []).length, 2, "both message lines");
  assert.match(src, /msgLine\.current\?\.scrollIntoView\(\{ block: "nearest"/);
  assert.match(src, /prefers-reduced-motion: reduce/, "no smooth scrolling for reduced motion");
});
