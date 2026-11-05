// CORS for the edge functions. Pure, so the node tests can check it.
// ALLOWED_ORIGIN unset: any origin, as before. Set: a comma-separated list, for example
//   https://bingo-arena-tan.vercel.app,http://localhost:5195
// and a caller gets its own origin back only when it is on the list.

const BASE = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** The list from ALLOWED_ORIGIN: trimmed, without a trailing slash, empty entries dropped. */
export const parseOrigins = (raw: string | undefined | null): string[] =>
  (raw ?? "").split(",").map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean);

/** The CORS headers for one request from `origin` (its Origin header). */
export function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  if (!allowed.length) return { ...BASE, "Access-Control-Allow-Origin": "*" };
  const ok = !!origin && allowed.includes(origin);
  return ok ? { ...BASE, "Access-Control-Allow-Origin": origin!, Vary: "Origin" } : { ...BASE, Vary: "Origin" };
}
