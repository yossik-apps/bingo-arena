// The store: products, the player's economy (gems, vault, club) and price formatting.
import { supabase } from "./supabase";

export type StoreMode = "off" | "preview" | "test" | "live";
export type Product = { id: string; kind: "coins" | "gems" | "starter" | "club" | "vault" | "pass" | "crew_treat"; name: string; descr: string; price_cents: number; coins: number; gems: number; days: number; one_time: boolean; badge: string; active: boolean; sort: number };
export type Economy = {
  mode: StoreMode; is_admin: boolean; gems: number; vault: number; vault_cap: number; vault_pct: number;
  club_until: string | null; club_claimed: boolean; limit_cents: number | null; month_cents: number; owned: string[]; in_crew: boolean; has_pass: boolean;
};
export type PurchaseRow = { id: string; product_id: string; name: string; price_cents: number; status: "test" | "paid" | "refunded"; created_at: string };

export const price = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export async function loadEconomy(): Promise<Economy | null> {
  const { data, error } = await supabase.rpc("my_economy");
  return error || !data ? null : (data as Economy); // null until the 0.17 database update is installed
}
export async function loadProducts(): Promise<{ products: Product[]; mode: StoreMode }> {
  const [{ data: p }, { data: s }] = await Promise.all([
    supabase.from("store_products").select("*").eq("active", true).order("sort"),
    supabase.from("store_settings").select("mode").eq("id", 1).maybeSingle(),
  ]);
  return { products: (p as Product[]) ?? [], mode: ((s as { mode: StoreMode } | null)?.mode ?? "off") };
}
