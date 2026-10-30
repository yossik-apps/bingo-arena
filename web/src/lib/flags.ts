// Feature flags from the database. Read once per page load and kept in memory for that load only: nothing is stored,
// so an open tab keeps its value until it is reloaded. Anything unexpected counts as off.
export type FlagMode = "off" | "admins" | "all";

/** How long the first screen waits for the flag before it carries on as off. */
export const FLAG_WAIT_MS = 800;

export const parseMode = (v: unknown): FlagMode => (v === "admins" || v === "all" ? v : "off");

export type FlagRead = () => PromiseLike<{ data: { mode?: unknown } | null; error: unknown }>;

/** One read. A missing table, a read error, an unknown value or a slow answer all give "off". */
export async function readFlag(read: FlagRead, waitMs = FLAG_WAIT_MS): Promise<FlagMode> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<FlagMode>((done) => { timer = setTimeout(() => done("off"), waitMs); });
  const answer = (async (): Promise<FlagMode> => {
    try {
      const { data, error } = await read();
      return error ? "off" : parseMode(data?.mode);
    } catch { return "off"; }
  })();
  try { return await Promise.race([answer, late]); } finally { clearTimeout(timer); }
}

let designFlag: Promise<FlagMode> | null = null;
/** The Design flag for this page load. Later calls get the same answer without another read. */
export const loadDesignFlag = (read: FlagRead) => (designFlag ??= readFlag(read));
/** Tests only. */
export const forgetDesignFlag = () => { designFlag = null; };
