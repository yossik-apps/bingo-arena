// Live-match status for logged-in players: who is online, who is waiting for a match, and invites for me.
// Polled every 15 seconds while the game is visible (one small database call).
import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export type Waiting = { id: string; name: string; level: string; waited: number; player_level: number };
export type Invite = { id: string; level: string; from_name: string; waiting: boolean; created_at: string };
export type Arena = { online: number; waiting: Waiting[]; invites: Invite[]; sent: { to: string; status: string }[] };

export function useArena(enabled: boolean): Arena | null {
  const [a, setA] = useState<Arena | null>(null);
  useEffect(() => {
    if (!enabled) { setA(null); return; }
    let alive = true;
    const load = () => {
      if (document.visibilityState !== "visible") return;
      void supabase.rpc("arena_status").then(({ data, error }) => { if (alive && !error && data) setA(data as Arena); });
    };
    load();
    const t = setInterval(load, 15e3);
    const vis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", vis);
    return () => { alive = false; clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [enabled]);
  return a;
}

export const LEVEL_NAME: Record<string, string> = { beginner: "Beginner", medium: "Medium", hard: "Hard" };
