import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./App";
import ErrorBoundary from "./ErrorBoundary";

// After a new release, an already-open page can still point at old files that no longer exist. Reload once to get the new version.
window.addEventListener("vite:preloadError", (e) => {
  e.preventDefault();
  try { if (sessionStorage.getItem("ba_reloaded") === "1") return; sessionStorage.setItem("ba_reloaded", "1"); } catch { /* ignore */ }
  window.location.reload();
});
window.addEventListener("load", () => setTimeout(() => { try { sessionStorage.removeItem("ba_reloaded"); } catch { /* ignore */ } }, 10000));

createRoot(document.getElementById("root")!).render(<ErrorBoundary><App /></ErrorBoundary>);
