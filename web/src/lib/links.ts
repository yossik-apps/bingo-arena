// Links set by the admin (Admin → Config → Links). Hidden inside CrazyGames, where links to other sites are not allowed.
import { useEffect, useState } from "react";
import { configured, supabase } from "./supabase";
import { onCrazyGames } from "./platform";

let cache: { facebook: string } | null = null;
export function useLinks() {
  const [l, setL] = useState(cache);
  useEffect(() => {
    if (cache || !configured || onCrazyGames) return;
    void supabase.from("app_links").select("facebook").eq("id", 1).maybeSingle().then(({ data }) => { cache = { facebook: (data as { facebook?: string } | null)?.facebook ?? "" }; setL(cache); }, () => undefined);
  }, []);
  return onCrazyGames ? { facebook: "" } : l ?? { facebook: "" };
}
