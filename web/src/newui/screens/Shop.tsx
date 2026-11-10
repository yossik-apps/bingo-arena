// The Shop: "Coins and gems" (the store, Bingo Club and the Coin Vault) and "Looks and boosters". Same products, prices,
// store modes and rules as Classic. No real payments: preview says "Coming soon", and only admins can test-buy in test mode.
// Uses: profile, wallet, platform, visitor, store, shop
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Product, StoreMode } from "../../lib/store";
import type { ShopItem } from "../../lib/supabase";
import { Ball } from "../Ball";
import { Button, Card, Chip, EmptyState, ErrorState, ListRow, ProgressBar, Skeleton, Tabs, Toast } from "../components";
import { Coin, Gem, Icon } from "../Icon";
import type { ScreenCtx, ScreenProps } from "./contract";
import {
  CATS, CLUB_PERKS, FOOT, GEM_SPENDS, boughtText, buyButton, byKind, catNote, clubLine, firstTab, itemButton, itemTag, itemsFor, storeClosed, storeMode, storeNote, vaultLine, vaultPct,
  type ShopTab, type StoreSection,
} from "./Shop.logic";
import "./shop.css";

const errText = (e: unknown) => (e instanceof Error && e.message ? e.message : "Something went wrong. Try again.");
const saved = () => { try { return sessionStorage.getItem("ba_shoptab"); } catch { return null; } };
const remember = (t: ShopTab) => { try { sessionStorage.setItem("ba_shoptab", t); } catch { /* ignore */ } };

/** A row of tabs that scrolls sideways when it does not fit, keeping the chosen one in view. */
function ScrollTabs<T extends string>({ value, onChange, options, label, small }: { value: T; onChange: (v: T) => void; options: { id: T; text: string }[]; label: string; small?: boolean }) {
  const row = useRef<HTMLDivElement>(null);
  // fade the edge where more tabs are hidden, so the row reads as scrollable (BA-18)
  const [edges, setEdges] = useState("");
  const fade = () => {
    const el = row.current;
    if (!el) return;
    setEdges(`${el.scrollLeft > 2 ? " is-l" : ""}${el.scrollLeft + el.clientWidth < el.scrollWidth - 2 ? " is-r" : ""}`);
  };
  useEffect(() => {
    fade();
    window.addEventListener("resize", fade);
    return () => window.removeEventListener("resize", fade);
  }, []);
  useLayoutEffect(() => {
    const el = row.current, on = el?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (!el || !on) return;
    const l = on.offsetLeft, r = l + on.offsetWidth;
    if (l < el.scrollLeft) el.scrollLeft = l - 8; else if (r > el.scrollLeft + el.clientWidth) el.scrollLeft = r - el.clientWidth + 8;
    fade();
  }, [value]);
  return <div className={`nu-sh-tabs${edges}`} ref={row} onScroll={fade}><Tabs small={small} label={label} value={value} onChange={onChange} options={options} /></div>;
}

// ================= Coins and gems =================
function Store({ ctx }: { ctx: ScreenCtx }) {
  const { wallet, profile, platform, visitor, store: api } = ctx;
  const econ = wallet.economy;
  const [loaded, setLoaded] = useState<{ products: Product[]; mode: StoreMode } | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => { setFailed(false); api.loadProducts().then(setLoaded, () => setFailed(true)); }, [api]);
  useEffect(load, [load, econ?.mode]);
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState("");
  const [sub, setSub] = useState<StoreSection>("offers");
  const [ask18, setAsk18] = useState(false);

  // Classic: a visitor is asked to sign up, a guest (outside CrazyGames) to save their progress, before anything is bought
  const gate = visitor ? () => visitor.askSignUp("Create your free account to use the store")
    : profile?.guest && !platform.crazyGames ? profile.save : null;
  const mode = storeMode(econ, loaded?.mode ?? "preview");
  const who = { visitorOrGuest: !!gate, crazyGames: platform.crazyGames, busy: busy !== "" };
  const act = async (id: string, fn: () => Promise<string>) => {
    if (gate) { gate(); return; }
    setBusy(id); setMsg(null);
    try { setMsg({ text: await fn(), error: false }); }
    catch (e) { setMsg({ text: errText(e), error: true }); if (api.isAdultsOnly(e)) setAsk18(true); }
    setBusy("");
  };
  const confirm18 = async () => {
    try { await api.confirmAge(); setAsk18(false); setMsg({ text: "Thanks. You can buy now.", error: false }); } catch (e) { setMsg({ text: errText(e), error: true }); }
  };
  const buy = (p: Product) => void act(p.id, async () => boughtText(p, await api.buyTest(p.id)));
  const BuyBtn = ({ p, wide }: { p: Product; wide?: boolean }) => {
    const b = buyButton(p, mode, econ, who);
    // Coming soon, Owned and Not available here cannot change while the page is open: say so plainly instead of a faded button
    if (buyButton(p, mode, econ, { ...who, busy: false }).disabled) return <span className={`nu-sh-soon${wide ? " is-wide" : ""}`} role="status">{b.label}</span>;
    return <Button size="sm" wide={wide} disabled={b.disabled} onClick={() => buy(p)} label={`${p.name}: ${b.label}`}>{busy === p.id ? "…" : b.label}</Button>;
  };

  if (storeClosed(mode, econ)) return <EmptyState title="The store is closed right now." text="Everything in the game can be earned by playing." />;
  const products = loaded?.products ?? [];
  const one = (k: Product["kind"]) => byKind(products, k)[0];
  const starter = one("starter"), club = one("club"), vault = one("vault"), pass = one("pass"), treat = one("crew_treat");
  const member = !!econ?.club_until;

  const pack = (p: Product, gem: boolean) => (
    <div key={p.id} className="nu-sh-pack">
      {p.badge && <Chip tone="green">{p.badge}</Chip>}
      <span className="nu-sh-amount">{gem ? <Gem size={26} /> : <Coin size={26} />}{(gem ? p.gems : p.coins).toLocaleString("en-US")}</span>
      <span className="nu-sh-unit">{gem ? "gems" : "coins"}</span>
      <BuyBtn p={p} wide />
    </div>
  );

  return (
    <div className="nu-sh-stack">
      {msg && <Toast inline alert={msg.error}>{msg.text}</Toast>}
      {ask18 && !platform.crazyGames && (
        <Card label="Age check"><div className="nu-sh-card nu-sh-row"><p>Purchases are for players aged 18 or older.</p><Button size="sm" onClick={() => void confirm18()}>I am 18 or older</Button></div></Card>
      )}

      <div className="nu-sh-top">
        <div className="nu-sh-bals">
          <div className="nu-sh-bal"><Coin size={30} /><span><b>{wallet.coins.toLocaleString("en-US")}</b><small>coins</small></span></div>
          <div className="nu-sh-bal"><Gem size={30} /><span><b>{(econ?.gems ?? 0).toLocaleString("en-US")}</b><small>gems</small></span></div>
        </div>
        <Card label="Spend gems">
          <div className="nu-sh-card">
            <h2>Spend gems</h2>
            <div className="nu-sh-spends">
              {GEM_SPENDS.map((g) => (
                <Button key={g.what} size="sm" kind="panel" disabled={busy !== ""} label={`Swap ${g.gems} gems for ${g.get}`}
                  onClick={() => void act(g.what, async () => { await api.gemSpend(g.what); return g.done; })}><span className="nu-sh-swap">{g.gems}<Gem size={16} />→ {g.get}</span></Button>
              ))}
            </div>
            <p>Earn gems with your first drill each day, Bingo Club and gem packs.</p>
          </div>
        </Card>
        {platform.rewardAd("store")}
      </div>

      <ScrollTabs small label="Store sections" value={sub} onChange={setSub} options={[{ id: "offers", text: "Offers" }, { id: "coins", text: "Coins" }, { id: "gems", text: "Gems" }]} />
      {!gate && <p className={`nu-sh-note${mode === "test" && econ?.is_admin ? " is-test" : ""}`}>{storeNote(mode, econ)}</p>}

      {failed ? <ErrorState title="The store did not load" onRetry={load} />
        : !loaded ? <Skeleton rows={2} height={160} label="Loading the store" />
          : sub === "offers" ? (
            <div className="nu-sh-offers">
              {starter && !econ?.owned.includes(starter.id) && (
                <section className="nu-sh-starter" aria-label={starter.name}>
                  <div className="nu-sh-cardtop"><h2>{starter.name}</h2><Chip>{starter.badge || "Once only"}</Chip></div>
                  <p>{starter.descr}</p>
                  <div className="nu-sh-gets"><span><Coin size={20} />{starter.coins.toLocaleString("en-US")}</span><span><Gem size={20} />{starter.gems}</span></div>
                  <BuyBtn p={starter} wide />
                </section>
              )}
              {club && (
                <Card label="Bingo Club">
                  <div className="nu-sh-card">
                    <div className="nu-sh-cardtop"><h2><Ball tone="P" size={40}><Icon name="star" size={20} color="#14254F" /></Ball>Bingo Club</h2><Chip tone={member ? "green" : "gold"}>{member ? "You are a member" : club.badge || "Members"}</Chip></div>
                    <ul className="nu-sh-perks">{CLUB_PERKS.map((t) => <li key={t}><Icon name="check" size={18} sw={3} />{t}</li>)}</ul>
                    {member && <p>Member until {new Date(econ!.club_until!).toLocaleDateString(undefined, { day: "numeric", month: "long" })}.</p>}
                    {member && <Button wide disabled={econ!.club_claimed || busy !== ""} onClick={() => void act("claim", async () => { await api.clubClaim(); return "Daily gift claimed: +150 coins and +5 gems."; })}>{econ!.club_claimed ? "Today's gift claimed" : "Claim today's gift"}</Button>}
                    <BuyBtn p={club} wide />
                    <p className="nu-sh-small">{clubLine(club)}</p>
                  </div>
                </Card>
              )}
              {vault && (
                <Card label="Coin Vault">
                  <div className="nu-sh-card">
                    <h2><Ball tone="O" size={40}><Coin size={22} /></Ball>Coin Vault</h2>
                    <p>{vault.descr}</p>
                    <ProgressBar pct={vaultPct(econ)} label={`Coin Vault, ${(econ?.vault ?? 0).toLocaleString("en-US")} coins`} />
                    <div className="nu-sh-vrow"><b><Coin size={18} />{(econ?.vault ?? 0).toLocaleString("en-US")}</b><span>{vaultLine(econ)}</span></div>
                    <BuyBtn p={vault} wide />
                  </div>
                </Card>
              )}
              {pass && <ListRow title={pass.name} sub={pass.descr} lead={<Ball tone="G" size={44}><Icon name="trophy" size={22} color="#14254F" /></Ball>}
                trail={econ?.has_pass ? <span className="nu-sh-small">You have the pass for this season.</span> : <BuyBtn p={pass} />} />}
              {treat && <ListRow title={<span className="nu-sh-name">{treat.name}<Chip tone="pink">{treat.badge || "Social"}</Chip></span>} sub={treat.descr} lead={<Ball tone="N" size={44}><Icon name="gift" size={22} color="#14254F" /></Ball>}
                trail={econ && !econ.in_crew ? <span className="nu-sh-small">Join a crew in Compete to send treats.</span> : <BuyBtn p={treat} />} />}
            </div>
          ) : (
            <div className="nu-sh-packs">{byKind(products, sub).map((p) => pack(p, sub === "gems"))}</div>
          )}
      <p className="nu-sh-note">{FOOT}</p>
    </div>
  );
}

// ================= Looks and boosters =================
const FRAME_ART: Record<string, string> = {
  gold: "#f5b50a", violet: "#8b5cf6", rainbow: "linear-gradient(135deg,#f43f5e,#f59e0b,#10b981,#3b82f6,#8b5cf6)",
  ember: "linear-gradient(135deg,#fde047,#f97316,#dc2626)", neonnights: "linear-gradient(135deg,#22d3ee,#a855f7,#ec4899)",
};
/** What the item looks like. Colours come from the item itself, as in Classic. */
function Preview({ it }: { it: ShopItem }) {
  const m = it.meta ?? {};
  if (it.slot === "theme") return <span className="nu-sh-pv is-round" style={{ background: m.color }} />;
  if (it.slot === "style") return <span className="nu-sh-pv" style={{ background: "#d6336c", color: "#fff", ...(m.style as CSSProperties) }}>12</span>;
  if (it.slot === "board") return <span className="nu-sh-pv nu-sh-mini" style={{ background: m.card }}>{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ background: m.cell }} />)}</span>;
  if (it.slot === "ball") return <span className="nu-sh-pv is-round" style={{ background: m.bg, color: m.ink }}>B7</span>;
  if (it.slot === "frame") return <span className="nu-sh-frame" style={{ background: FRAME_ART[it.key] ?? FRAME_ART.gold }}><span>A</span></span>;
  if (it.slot === "title") return <Chip tone="dark">{it.name}</Chip>;
  return <span className="nu-sh-pv is-plain"><Icon name={it.slot === "boost" ? "bolt" : "gift"} size={28} /></span>;
}

function Looks({ ctx }: { ctx: ScreenCtx }) {
  const { wallet, profile, visitor, shop: api } = ctx;
  const [cat, setCat] = useState("deals");
  const [deals, setDeals] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState("");
  useEffect(() => { api.dailyDeals().then(setDeals, () => setDeals([])); }, [api]);
  const run = async (id: string, fn: () => Promise<void>, ok: string) => {
    if (visitor) { visitor.askSignUp("To buy or use items, create your free account"); return; }
    setBusy(id); setMsg(null);
    try { await fn(); setMsg({ text: ok, error: false }); } catch (e) { setMsg({ text: errText(e), error: true }); }
    setBusy("");
  };
  const list = itemsFor(cat, wallet.items, deals);
  const note = catNote(cat);
  const opts = { owned: wallet.owned, equipped: profile?.equipped ?? { theme: "rose", style: "", board: "classic", ball: "gold", frame: "", title: "" }, deals, coins: wallet.coins, level: profile?.level ?? 1, visitor: !!visitor, busy: busy !== "" };
  return (
    <div className="nu-sh-stack">
      <ScrollTabs small label="Shop categories" value={cat} onChange={setCat} options={CATS.map(([id, text]) => ({ id, text }))} />
      {note && <p className="nu-sh-note">{note}</p>}
      {msg && <Toast inline alert={msg.error}>{msg.text}</Toast>}
      {wallet.items.length === 0 ? <Skeleton rows={2} height={180} label="Loading the shop" />
        : list.length === 0 ? <EmptyState title="Nothing here today." text="Come back tomorrow for new deals." /> : (
          <div className="nu-sh-grid">
            {list.map((it) => {
              const b = itemButton(it, opts);
              const go = () => void (b.action === "buy" ? run(it.id, () => api.buy(it.id), `${it.name} purchased.`)
                : run(it.id, () => api.equip(it.id, b.action === "equip"), b.action === "equip" ? `${it.name} equipped.` : `${it.name} removed.`));
              return (
                <div key={it.id} className={`nu-sh-item${b.eq ? " is-on" : ""}`}>
                  <Preview it={it} />
                  <b className="nu-sh-iname" title={it.name}>{it.name}</b>
                  {it.descr && <span className="nu-sh-idesc">{it.descr}</span>}
                  <Chip tone={b.eq ? "green" : "gold"}>{b.eq ? "Equipped" : itemTag(it, deals, b.own)}</Chip>
                  <Button size="sm" wide kind={b.action === "buy" ? "gold" : "panel"} disabled={b.disabled} onClick={b.action ? go : undefined}
                    label={b.action === "buy" ? `Buy ${it.name} for ${(b as { price: number }).price} coins` : undefined}>
                    {busy === it.id ? "…" : b.action === "buy" ? <span className="nu-sh-swap">Buy <Coin size={18} />{(b as { price: number }).price}</span> : b.label}
                  </Button>
                  {it.slot === "boost" && <span className="nu-sh-small">Owned: {wallet.boosters[it.key] ?? 0}</span>}
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}

// ================= The screen =================
export default function Shop({ ctx }: ScreenProps) {
  const [tab, setTabS] = useState<ShopTab>(() => firstTab(saved()));
  const setTab = (t: ShopTab) => { setTabS(t); remember(t); };
  const body: ReactNode = tab === "store" ? <Store ctx={ctx} /> : <Looks ctx={ctx} />;
  return (
    <div className="nu-shop">
      <div data-must-see="the Shop tabs"><Tabs label="Shop sections" value={tab} onChange={setTab} options={[{ id: "store", text: "Coins and gems" }, { id: "looks", text: "Looks and boosters" }]} /></div>
      <div className="nu-sh-body" data-must-peek="the first section">{body}</div>
    </div>
  );
}
