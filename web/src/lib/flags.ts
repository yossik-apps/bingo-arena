// Feature flags from the database. Read once per page load and kept in memory for that load: an open tab keeps its value
// until it is reloaded. Anything unexpected counts as off.
// The Design flag's last answer is also remembered on the device, only so a page load can start at once when that answer can
// only mean Classic for this viewer. A remembered value never shows the new design: New always waits for the database.
export type FlagMode = "off" | "admins" | "all";

/** How long the first screen waits for the flag before it carries on as off. */
export const FLAG_WAIT_MS = 800;

export const parseMode = (v: unknown): FlagMode => (v === "admins" || v === "all" ? v : "off");

export type FlagRead = () => PromiseLike<{ data: { mode?: unknown } | null; error: unknown }>;

/**
 * One read. A missing table, a read error, an unknown value or a slow answer all give "off".
 * `answered` gets the database's own answer whenever it comes, even after the wait is over; never a timeout or an error.
 */
export async function readFlag(read: FlagRead, waitMs = FLAG_WAIT_MS, answered?: (mode: FlagMode) => void): Promise<FlagMode> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<FlagMode>((done) => { timer = setTimeout(() => done("off"), waitMs); });
  const answer = (async (): Promise<FlagMode> => {
    try {
      const { data, error } = await read();
      if (error) return "off";
      const mode = parseMode(data?.mode);
      try { answered?.(mode); } catch { /* remembering is optional */ }
      return mode;
    } catch { return "off"; }
  })();
  try { return await Promise.race([answer, late]); } finally { clearTimeout(timer); }
}

let designFlag: Promise<FlagMode> | null = null;
/** The Design flag for this page load. Later calls get the same answer without another read. */
export const loadDesignFlag = (read: FlagRead, answered?: (mode: FlagMode) => void) => (designFlag ??= readFlag(read, FLAG_WAIT_MS, answered));
/** Tests only. */
export const forgetDesignFlag = () => { designFlag = null; };

type Store = Pick<Storage, "getItem" | "setItem">;
const KEY = "ba_flag_design";

/** The Design flag's last answer on this device, or null if there is none (or storage is blocked). */
export function storedDesignFlag(store: () => Store): FlagMode | null {
  try { const v = store().getItem(KEY); return v === "off" || v === "admins" || v === "all" ? v : null; } catch { return null; }
}
/** Remembers the database's answer for the next page load. */
export function rememberDesignFlag(mode: FlagMode, store: () => Store): void {
  try { store().setItem(KEY, mode); } catch { /* private mode or full: the next load waits for the database, as before */ }
}

/**
 * The Design flag to start with before the database answers, or null to wait for it (at most FLAG_WAIT_MS).
 * Only a remembered answer that means Classic for this viewer counts: "off", or "admins" for a visitor (not signed in).
 * A signed-in player might be an admin, and "all" means New, so both wait for the database, as before.
 */
export function classicAtOnce(stored: FlagMode | null, signedIn: boolean): "off" | null {
  return stored === "off" || (stored === "admins" && !signedIn) ? "off" : null;
}
