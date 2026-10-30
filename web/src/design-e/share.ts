// Share a piece of text: the phone's share sheet when there is one, otherwise the clipboard.
export type ShareResult = "shared" | "copied" | "failed";

export async function shareText(text: string): Promise<ShareResult> {
  try {
    if (typeof navigator.share === "function") { await navigator.share({ text }); return "shared"; }
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") return "failed"; // the player closed the sheet
  }
  try { await navigator.clipboard.writeText(text); return "copied"; } catch { /* blocked */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok ? "copied" : "failed";
  } catch { return "failed"; }
}
