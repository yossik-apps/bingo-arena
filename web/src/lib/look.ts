import type { Equipped, ShopItem } from "./supabase";

/** Applies the player's equipped cosmetics (dauber color, board, ball, stamp) to the whole page. */
export function applyLook(eq: Equipped, items: ShopItem[]) {
  const find = (slot: string, key: string) => items.find((i) => i.slot === slot && i.key === key);
  const root = document.documentElement.style;
  root.setProperty("--daub", find("theme", eq.theme)?.meta.color ?? "#d6336c");
  const b = find("board", eq.board)?.meta ?? { card: "var(--panel)", cell: "var(--cell)", ink: "var(--ink)" };
  root.setProperty("--bcard", b.card); root.setProperty("--bcell", b.cell); root.setProperty("--bink", b.ink);
  const ball = find("ball", eq.ball)?.meta ?? { bg: "#f5b50a", ink: "#221800" };
  root.setProperty("--ballbg", ball.bg); root.setProperty("--ballink", ball.ink);
  document.body.dataset.ds = eq.style || "";
}
