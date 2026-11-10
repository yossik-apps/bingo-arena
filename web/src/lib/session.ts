// BA-13: calls about the player's own data wait for the player's session (a guest's too) and never go out without one.
// A visitor (no session) gets an empty answer and no request: no 401 from an edge function, no "user_id=eq." with an empty id.

type Auth = { getSession: () => Promise<{ data: { session: { user: { id: string } } | null } }> };

/**
 * The player's user id once the login library has finished restoring (or refreshing) the session, or "" for a visitor.
 * getSession waits for that start-up, so a call made right after the page loads still goes out with the player's token.
 */
export async function sessionUser(auth: Auth): Promise<string> {
  try { const { data } = await auth.getSession(); return data.session?.user.id ?? ""; } catch { return ""; }
}

/** Runs `call` only for a player with a session (signed in or guest). A visitor gets null and nothing is sent. */
export async function asPlayer<T>(auth: Auth, call: () => Promise<T>): Promise<T | null> {
  return (await sessionUser(auth)) ? call() : null;
}

/** What a read of the player's own rows gives when there is no player id: no rows, and no request (Classic views: `me.id ? … : NO_ROWS`). */
export const NO_ROWS: PromiseLike<{ data: null; error: null; count: null }> = Promise.resolve({ data: null, error: null, count: null });
