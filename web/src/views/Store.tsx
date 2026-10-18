import { useEffect, useState } from "react";
import { rpcError, supabase } from "../lib/supabase";
import { loadProducts, price, type Economy, type Product, type StoreMode } from "../lib/store";
import { Ic } from "../lib/ui";
import Notice from "../lib/Notice";

/** Coins and gems: the store with Bingo Club, Coin Vault, packs, Season Pass Premium and Crew Treat. */
export default function Store({ econ, coins, onChange, onGuest, reward }: { econ: Economy | null; coins: number; onChange: () => Promise<void>; onGuest?: () => void; reward?: React.ReactNode }) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [mode, setMode] = useState<StoreMode>("preview");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");
  const [sub, setSub] = useState<"offers" | "coins" | "gems">("offers");
  useEffect(() => { void loadProducts().then((r) => { setProducts(r.products); setMode(r.mode); }); }, [econ?.mode]);

  const m = econ?.mode ?? mode;
  const canTest = !onGuest && m === "test" && !!econ?.is_admin;
  const act = async (id: string, rpc: string, args: Record<string, unknown>, ok: (d: Record<string, unknown>) => string) => {
    if (onGuest) { onGuest(); return; }
    setBusy(id); setMsg("");
    const { data, error } = await supabase.rpc(rpc, args);
    if (error) setMsg(rpcError(error)); else { setMsg(ok(data as Record<string, unknown>)); await onChange(); }
    setBusy("");
  };
  const buy = (p: Product) => act(p.id, "buy_test", { p_product: p.id }, (d) => `Test purchase done: ${p.name}.${d.coins ? ` +${d.coins} coins.` : ""}${d.gems ? ` +${d.gems} gems.` : ""} No money was charged.`);
  const BuyBtn = ({ p, wide }: { p: Product; wide?: boolean }) => {
    const owned = p.one_time && econ?.owned.includes(p.id);
    const label = onGuest ? `Sign up · ${price(p.price_cents)}` : owned ? "Owned" : canTest ? `Test buy · ${price(p.price_cents)}` : `${price(p.price_cents)} · Coming soon`;
    return <button className={`btn st-buy ${wide ? "wide" : ""}`} disabled={!onGuest && (owned || !canTest || busy !== "")} onClick={() => void buy(p)}>{busy === p.id ? "…" : label}</button>;
  };

  if (m === "off" && !econ?.is_admin) return <p className="dim">The store is closed right now. Everything in the game can be earned by playing.</p>;
  const by = (k: Product["kind"]) => (products ?? []).filter((p) => p.kind === k);
  const one = (k: Product["kind"]) => by(k)[0];
  const starter = one("starter"), club = one("club"), vault = one("vault"), pass = one("pass"), treat = one("crew_treat");
  const member = !!econ?.club_until;
  const vaultPct = econ && econ.vault_cap ? Math.min(100, (econ.vault / econ.vault_cap) * 100) : 0;

  return (
    <div className="st">
      <Notice text={msg} />

      <div className="st-top">
        <div className="st-bal"><span className="st-coin" aria-hidden="true"><Ic n="coin" c="coin" /></span><div><b>{coins.toLocaleString()}</b><span>coins</span></div></div>
        <div className="st-bal"><span className="st-gem" aria-hidden="true"><Ic n="gem" /></span><div><b>{(econ?.gems ?? 0).toLocaleString()}</b><span>gems</span></div></div>
        <div className="st-spend">
          <span className="dim">Spend gems</span>
          <div className="row2">
            <button className="btn alt" disabled={busy !== ""} onClick={() => void act("g1", "gem_spend", { p_what: "coins_s" }, () => "Swapped 10 gems for 600 coins.")}>10 <Ic n="gem" /> → 600 coins</button>
            <button className="btn alt" disabled={busy !== ""} onClick={() => void act("g2", "gem_spend", { p_what: "coins_l" }, () => "Swapped 50 gems for 3,500 coins.")}>50 <Ic n="gem" /> → 3,500 coins</button>
            <button className="btn alt" disabled={busy !== ""} onClick={() => void act("g3", "gem_spend", { p_what: "shield" }, () => "You got a Streak Shield.")}>20 <Ic n="gem" /> → Streak Shield</button>
          </div>
          <span className="dim st-hint">Earn gems with your first drill each day, Bingo Club and gem packs.</span>
          {reward}
        </div>
      </div>
      <div className="st-sub" role="tablist" aria-label="Store sections">
        {([["offers", "Offers"], ["coins", "Coins"], ["gems", "Gems"]] as const).map(([k, n]) => <button key={k} role="tab" aria-selected={sub === k} className={`at ${sub === k ? "on" : ""}`} onClick={() => setSub(k)}>{n}</button>)}
        {!onGuest && <span className={`st-note ${m === "test" && econ?.is_admin ? "test" : ""}`}>{m === "test" && econ?.is_admin ? "Test mode: purchases are free and only admins can make them. Nothing is charged." : "Purchases open soon. Everything here can also be earned by playing."}</span>}
      </div>

      {!products && <><div className="skel" /><div className="skel" /></>}

      {sub === "offers" && <><div className="st-feature">
        {starter && !econ?.owned.includes(starter.id) && (
          <section className="st-card st-starter">
            <span className="st-badge">{starter.badge || "Once only"}</span>
            <h2>{starter.name}</h2>
            <p>{starter.descr}</p>
            <div className="st-gets"><span><Ic n="coin" c="coin" /> {starter.coins.toLocaleString()}</span><span><Ic n="gem" /> {starter.gems}</span></div>
            <BuyBtn p={starter} wide />
          </section>
        )}
        {club && (
          <section className="st-card st-club">
            <span className="st-badge">{member ? "You are a member" : club.badge || "Members"}</span>
            <h2>Bingo Club</h2>
            <ul>
              <li>150 coins and 5 gems every day</li>
              <li>A Club badge next to your name</li>
              <li>Bingo DNA with your last 50 games</li>
            </ul>
            {member ? (
              <>
                <p className="dim" style={{ margin: 0 }}>Member until {new Date(econ!.club_until!).toLocaleDateString(undefined, { day: "numeric", month: "long" })}.</p>
                <button className="btn wide" disabled={econ!.club_claimed || busy !== ""} onClick={() => void act("claim", "club_claim", {}, () => "Daily gift claimed: +150 coins and +5 gems.")}>{econ!.club_claimed ? "Today's gift claimed" : "Claim today's gift"}</button>
                <BuyBtn p={club} wide />
              </>
            ) : <BuyBtn p={club} wide />}
            <span className="dim st-hint">{price(club.price_cents)} for {club.days} days. It does not renew by itself.</span>
          </section>
        )}
        {vault && (
          <section className="st-card st-vault">
            <h2>Coin Vault</h2>
            <p>{vault.descr}</p>
            <div className="st-vbar" role="progressbar" aria-label="Coin Vault" aria-valuemin={0} aria-valuemax={econ?.vault_cap ?? 0} aria-valuenow={econ?.vault ?? 0}><i style={{ width: `${vaultPct}%` }} /></div>
            <div className="st-vrow"><b><Ic n="coin" c="coin" /> {(econ?.vault ?? 0).toLocaleString()}</b><span className="dim">of {(econ?.vault_cap ?? 3000).toLocaleString()} · fills with {econ?.vault_pct ?? 10}% of your wins</span></div>
            <BuyBtn p={vault} wide />
          </section>
        )}
      </div>

      </>}
      {sub === "coins" && <div className="st-grid">
        {by("coins").map((p) => (
          <div className="st-pack" key={p.id}>
            {p.badge && <span className="st-badge sm">{p.badge}</span>}
            <span className="st-pic" aria-hidden="true"><Ic n="coin" c="coin" /></span>
            <b>{p.coins.toLocaleString()}</b><span className="dim">coins</span>
            <BuyBtn p={p} />
          </div>
        ))}
      </div>}
      {sub === "gems" && <div className="st-grid">
        {by("gems").map((p) => (
          <div className="st-pack" key={p.id}>
            {p.badge && <span className="st-badge sm">{p.badge}</span>}
            <span className="st-pic gem" aria-hidden="true"><Ic n="gem" /></span>
            <b>{p.gems.toLocaleString()}</b><span className="dim">gems</span>
            <BuyBtn p={p} />
          </div>
        ))}
      </div>}

      {sub === "offers" && (pass || treat) && <section className="st-card st-minis" aria-label="More offers">
        {pass && (
          <div className="st-mini">
            <div><b>{pass.name}</b><span>{pass.descr}</span></div>
            {econ?.has_pass ? <span className="dim">You have the pass for this season.</span> : <BuyBtn p={pass} />}
          </div>
        )}
        {treat && (
          <div className="st-mini">
            <div><b>{treat.name} <span className="st-badge sm2">{treat.badge || "Social"}</span></b><span>{treat.descr}</span></div>
            {econ && !econ.in_crew ? <span className="dim">Join a crew in Compete to send treats.</span> : <BuyBtn p={treat} />}
          </div>
        )}
      </section>}
      <p className="dim st-foot">Coins and gems are play money. They have no cash value and cannot be cashed out, sold or transferred. There are no random packs: you always see exactly what you get. You can set a monthly spending limit in Profile, then Settings.</p>
    </div>
  );
}
