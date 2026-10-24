// Fingerprints for fraud checks (self-referrals). The IP address is never stored: only a salted one-way hash.
export function clientIp(req: Request): string | null {
  const ip = req.headers.get("cf-connecting-ip") ?? (req.headers.get("x-forwarded-for") ?? "").split(",")[0] ?? "";
  return ip.trim() || null;
}
export async function hashIp(ip: string | null): Promise<string | null> {
  if (!ip) return null;
  const salt = Deno.env.get("REF_SALT") ?? (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "bingo").slice(-24);
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + "|" + ip));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
}
/** The device fingerprint and browser ID sent by the game, checked before use. */
export function cleanMarks(body: { dev?: unknown; vid?: unknown }) {
  const dev = typeof body.dev === "string" && /^[a-f0-9]{16,64}$/.test(body.dev) ? body.dev.slice(0, 40) : null;
  const vid = typeof body.vid === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.vid) ? body.vid.toLowerCase() : null;
  return { dev, vid };
}
