// Where the game is running: on your own website, or inside another site's frame (CrazyGames).
// Remembered for the browser tab, because the referrer is only there on the first page load.

const read = (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } };

export const inFrame = (() => { try { return window.self !== window.top; } catch { return true; } })();

export const onCrazyGames = (() => {
  if (read("ba_platform") === "crazygames") return true;
  let hit = false;
  try {
    const anc = (location as Location & { ancestorOrigins?: DOMStringList }).ancestorOrigins;
    if (anc) for (let i = 0; i < anc.length; i++) if (/crazygames\./i.test(anc[i])) hit = true;
  } catch { /* ignore */ }
  if (!hit && inFrame && /crazygames\./i.test(document.referrer)) hit = true;
  if (!hit && /^(crazygames|cg)$/i.test(new URLSearchParams(location.search).get("utm_source") ?? "") && inFrame) hit = true;
  if (hit) write("ba_platform", "crazygames");
  return hit;
})();
