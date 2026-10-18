import { useState, type ReactNode } from "react";

/** The Shop page: "Coins and gems" (the store) and "Looks and boosters" (the item shop). */
export default function ShopHub({ store, looks }: { store: ReactNode; looks: ReactNode }) {
  const [tab, setTab] = useState<"store" | "looks">(() => { try { return sessionStorage.getItem("ba_shoptab") === "looks" ? "looks" : "store"; } catch { return "store"; } });
  const pick = (t: "store" | "looks") => { setTab(t); try { sessionStorage.setItem("ba_shoptab", t); } catch { /* ignore */ } };
  return (
    <div className="shophub">
      <div className="pf-tabs two sh-tabs" role="tablist" aria-label="Shop sections">
        <button role="tab" aria-selected={tab === "store"} className={tab === "store" ? "on" : ""} onClick={() => pick("store")}>Coins and gems</button>
        <button role="tab" aria-selected={tab === "looks"} className={tab === "looks" ? "on" : ""} onClick={() => pick("looks")}>Looks and boosters</button>
      </div>
      {tab === "store" ? store : looks}
    </div>
  );
}
