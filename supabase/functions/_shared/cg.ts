// The CrazyGames game check for cg-login. Pure, so the node tests can check it.

/** With CG_GAME_ID set, the token must name exactly that game; a token without a game ID is refused. Unset: no game check, as before. */
export function gameIdOk(expected: string | undefined | null, got: unknown): boolean {
  const want = (expected ?? "").trim();
  if (!want) return true;
  return got !== undefined && got !== null && String(got) !== "" && String(got) === want;
}
