import { createRoot } from "react-dom/client";
import "./styles.css";
import "./newui/fonts"; // the loading screen uses the new design fonts for everyone
import App from "./App";
import ErrorBoundary from "./ErrorBoundary";
import { initHeat } from "./lib/heat";

// After a new release, an already-open page can still point at old files that no longer exist. Reload once to get the new version.
window.addEventListener("vite:preloadError", (e) => {
  e.preventDefault();
  try { if (sessionStorage.getItem("ba_reloaded") === "1") return; sessionStorage.setItem("ba_reloaded", "1"); } catch { /* ignore */ }
  window.location.reload();
});
window.addEventListener("load", () => setTimeout(() => { try { sessionStorage.removeItem("ba_reloaded"); } catch { /* ignore */ } }, 10000));

createRoot(document.getElementById("root")!).render(<ErrorBoundary><App /></ErrorBoundary>);

// Heatmaps (flag "heatmaps", Off by default): records nothing unless the flag allows it for this viewer.
initHeat();
// an admin who switched on the heatmap overlay sees it on the game screens (loaded only then)
try { if (localStorage.getItem("ba_hm_overlay") === "1") void import("./views/admin/HeatOverlay").then((m) => m.setHeatOverlay(true)); } catch { /* ignore */ }
