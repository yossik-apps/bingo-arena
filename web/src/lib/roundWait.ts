// WP5: a start refused because a round is still running says how long is left, from the server's answer.
// callFn turns { error: "round_in_progress", wait: 42 } into the code "round_in_progress:42"; errorText reads it here.

/** "42 seconds", "1 second", "3 minutes" */
export const waitText = (s: number) => (s < 90 ? `${s} second${s === 1 ? "" : "s"}` : `${Math.ceil(s / 60)} minutes`);

/** The message for "round_in_progress:N", or null for any other code (errorText then gives its usual text). */
export function waitMessage(raw: string): string | null {
  const [code, n] = raw.split(":");
  const wait = Number(n);
  return code === "round_in_progress" && Number.isFinite(wait) && wait > 0 ? `Your last round is still running. You can start a new one in ${waitText(Math.ceil(wait))}.` : null;
}

/** The code without the wait, for the usual lookup. */
export const baseCode = (raw: string) => raw.split(":")[0];
