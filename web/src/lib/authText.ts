// The sign-in messages Classic Auth shows, shared with the new screens' auth group (lib/screenData.ts) so both show the same text.

/** A readable message for a sign-up, Google, email or password error from Supabase Auth; anything else is shown as Supabase wrote it. */
export const friendly = (m: string) =>
  /error getting user email|email from external provider/i.test(m) ? "Facebook did not share an email address with the game. Allow email access for Bingo Arena in Facebook, or register with your email instead."
    : /access_denied|user denied|cancel/i.test(m) ? "Sign-in was cancelled. You can try again or use your email."
    : /bad_oauth|oauth state|flow state/i.test(m) ? "The sign-in took too long or was opened in another browser. Please try again."
    : /not enabled|unsupported provider/i.test(m) ? "This sign-in method is not switched on yet. Use email for now, or finish the setup in docs/SOCIAL_LOGIN_GUIDE.md."
    : /redirect/i.test(m) ? "Sign-in could not return to the game. The website address is missing from the allowed redirect list (see the social login guide)."
    : /already registered|already been registered/i.test(m) ? "That email is already registered. Log in instead."
    : /rate limit|too many/i.test(m) ? "Too many sign-ups right now. Please try again in a minute, or continue with Google."
    : /manual linking/i.test(m) ? "Saving with Google needs one more setting on our side. Please save with your email for now."
    : /identity.*(already|exists)|already linked/i.test(m) ? "That Google account already has a Bingo Arena account. Log in with it instead (the progress on this guest account stays here)."
    : /email_exists|already.*(registered|exists)/i.test(m) ? "That email already has an account. Log in instead."
    : m;

/** Classic Auth's log-in message: it never says whether the email exists. */
export const signInText = (m: string) => /confirm/i.test(m) ? "Please confirm your email first: open the link we sent you. Or continue with Google." : "Email or password is incorrect.";
