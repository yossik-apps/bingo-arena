// "Starting round…" (BA-12, BA-37): after a start button is pressed, it shows this and stays off until the round opens.
// The round screen replaces the page when the round opens, so the only things to catch are a failed start (rounds.error) and
// a start that never answers (the timeout, so a button is never stuck off).
import { useCallback, useEffect, useRef, useState } from "react";

export const STARTING = "Starting round…";
const GIVE_UP_MS = 20000;

export function useStarting(error: string): [boolean, <T>(go: () => T) => T | undefined] {
  const [starting, setStarting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const busy = useRef(false);
  useEffect(() => { if (error) { busy.current = false; setStarting(false); } }, [error]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const run = useCallback(<T,>(go: () => T): T | undefined => {
    if (busy.current) return undefined;
    busy.current = true;
    setStarting(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { busy.current = false; setStarting(false); }, GIVE_UP_MS);
    try { return go(); } catch (e) { busy.current = false; setStarting(false); throw e; }
  }, []);
  return [starting, run];
}
