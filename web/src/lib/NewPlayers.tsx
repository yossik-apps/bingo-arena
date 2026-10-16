import { createContext, useContext } from "react";

/** The ids of players who joined this week, so any list of names can show a NEW tag. */
export const NewIds = createContext<Set<string>>(new Set());
export function NewTag({ id }: { id: string }) {
  const s = useContext(NewIds);
  return s.has(id) ? <span className="tag new" style={{ marginLeft: 6 }}>NEW</span> : null;
}
export const ago = (iso: string) => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  return d <= 0 ? "joined today" : d === 1 ? "joined yesterday" : `joined ${d} days ago`;
};
