// Set a new password after a reset link: Classic's words and checks (views/SetPassword.tsx), kept exactly, as pure functions.

export const TITLE = "Choose a new password";
export const INTRO = "Pick a new password for your account.";
export const NEW_LABEL = "New password (8+ characters)";
export const REPEAT_LABEL = "Repeat new password";
export const SAVE = "Save new password";

/** Classic's two checks, in Classic's order. null: the password can be saved. */
export function check(pw: string, pw2: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters.";
  if (pw !== pw2) return "The two passwords do not match.";
  return null;
}
