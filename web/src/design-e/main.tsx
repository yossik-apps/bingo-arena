import { createRoot } from "react-dom/client";
import "./e.css";
import Playground from "./Playground";

// Entry point of the design playground (web/design.html). It does not load the real app, styles.css or Supabase.
createRoot(document.getElementById("root")!).render(<Playground />);
