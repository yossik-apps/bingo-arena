import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { callFn, configured, DEFAULT_EQUIPPED, errorText, supabase, type Equipped, type GameCfg, type ShopItem } from "./lib/supabase";
import { applyLook } from "./lib/look";
import { Coins, Ic } from "./lib/ui";
import Auth from "./views/Auth";
import Lobby from "./views/Lobby";
import Play, { type RoundResult, type RoundStart } from "./views/Play";
import Result from "./views/Result";
import Wallet from "./views/Wallet";
import Shop from "./views/Shop";
import Quests from "./views/Quests";
import Events from "./views/Events";

const Admin = lazy(() => import("./views/admin/Admin"));

type Profile = { id: string; display_name: string; xp: number; streak: number; banned: boolean; role: string; equipped: Equipped };
type View = "lobby" | "play" | "result" | "events" | "quests" | "wallet" | "shop" | "admin";
const lvl = (xp: number) => Math.floor(Math.sqrt(xp / 40)) + 1;
const NAV: [View, string, string][] = [["lobby", "Play", "play"], ["events", "Events", "trophy"], ["quests", "Quests", "quest"], ["shop", "Shop", "shop"], ["wallet", "Wallet", "wallet"]];

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [cfg, setCfg] = useState<GameCfg | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [items, setItems] = useState<ShopItem[]>([]);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [boosters, setBoosters] = useState<Record<string, number>>({});
  const [achDefs, setAchDefs] = useState<Record<string, string>>({});
  const [balance, setBalance] = useState(0);
  const [view, setView] = useState<View>("lobby");
  const [round, setRound] = useState<RoundStart | null>(null);
  const [result, setResult] = useState<{ r: RoundResult; p: RoundStart["params"] } | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const replay = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!configured) { setReady(true); return; }
    void supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 6000); return () => clearTimeout(t); }, [toast]);

  const refresh = useCallback(async () => {
    const [{ data: c }, { data: pr }, { data: w }, { data: it }, { data: inv }, { data: bo }, { data: ad }] = await Promise.all([
      supabase.from("game_config").select("data").eq("id", 1).single(),
      supabase.from("profiles").select("id,display_name,xp,streak,banned,role,equipped").single(),
      supabase.from("wallet").select("balance").maybeSingle(),
      supabase.from("shop_items").select("*").eq("active", true).order("sort"),
      supabase.from("inventory").select("item_id"),
      supabase.from("user_boosters").select("key,qty"),
      supabase.from("ach_defs").select("id,label"),
    ]);
    if (c) setCfg(c.data as GameCfg);
    if (pr) setProfile({ ...(pr as Profile), equipped: { ...DEFAULT_EQUIPPED, ...((pr as Profile).equipped ?? {}) } });
    setBalance((w as { balance: number } | null)?.balance ?? 0);
    setItems((it as ShopItem[]) ?? []);
    setOwned(new Set(((inv as { item_id: string }[]) ?? []).map((x) => x.item_id)));
    setBoosters(Object.fromEntries(((bo as { key: string; qty: number }[]) ?? []).map((x) => [x.key, x.qty])));
    setAchDefs(Object.fromEntries(((ad as { id: string; label: string }[]) ?? []).map((x) => [x.id, x.label])));
  }, []);

  useEffect(() => {
    if (!session) { setProfile(null); return; }
    void (async () => {
      try {
        const d = await callFn<{ claimed: boolean; bonus: number; streak: number }>("daily-bonus");
        if (d.claimed) setToast(`Daily login bonus: +${d.bonus} coins (day ${d.streak} streak).`);
      } catch { /* the bonus is optional */ }
      await refresh();
    })();
  }, [session, refresh]);

  useEffect(() => { if (profile && items.length) applyLook(profile.equipped, items); }, [profile, items]);
  const titleName = useMemo(() => items.find((i) => i.slot === "title" && i.key === profile?.equipped.title)?.name, [items, profile]);

  const begin = async (body: Record<string, unknown>) => {
    setError("");
    try {
      const r = await callFn<RoundStart>("start-round", body);
      setRound(r); setBalance(r.balance); setView("play");
    } catch (e) { setError(errorText((e as Error).message)); setView(body.mode === "tour" ? "events" : "lobby"); }
  };
  const start = (mode: "solo" | "ghost", level: string, armed: string[]) => {
    replay.current = () => void begin({ mode, level, boosters: [] });
    return begin({ mode, level, boosters: armed });
  };
  const startEvent = (id: string) => {
    replay.current = () => void begin({ mode: "tour", eventId: id });
    return begin({ mode: "tour", eventId: id });
  };

  if (!configured) {
    return <div className="shell"><section><h1>Almost there</h1><p>The game is not connected to its database yet. Follow <b>docs/LAUNCH_GUIDE.md</b>, step 4, to add your two Supabase keys.</p></section></div>;
  }
  if (!ready) return <div className="shell"><div className="skel" /><div className="skel" /></div>;
  if (!session) return <div className="shell"><Auth /></div>;
  if (!cfg || !profile) return <div className="shell"><div className="skel" /><div className="skel" /><div className="skel" /></div>;

  const l = lvl(profile.xp), lo = 40 * (l - 1) ** 2, hi = 40 * l * l, pc = Math.round(((profile.xp - lo) / (hi - lo)) * 100);
  const inRound = view === "play";
  const isAdmin = profile.role === "admin";

  return (
    <>
      <div className={`shell ${view === "admin" ? "wide" : ""}`}>
        {!inRound && (
          <header className="appbar">
            <div className="who">
              <span className={`avatar ${profile.equipped.frame ? "fr-" + profile.equipped.frame : ""}`} aria-hidden="true">{profile.display_name.slice(0, 1).toUpperCase()}</span>
              <div className="wtxt">
                <b id="who">{profile.display_name}</b>
                <div className="xpline"><span className="lvb">Lv {l}</span><div className="xpbar" role="progressbar" aria-label="XP to next level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pc}><i style={{ width: `${pc}%` }} /></div></div>
                <span className="dim" style={{ fontSize: 12 }}>{titleName ? `${titleName} · ` : ""}{profile.xp - lo} / {hi - lo} XP</span>
              </div>
            </div>
            <div className="chips">
              <span className="chip2" role="group" aria-label="Coins"><Coins n={balance} /></span>
              <span className="chip2" role="group" aria-label="Day streak"><Ic n="flame" c="fl" /><b>{profile.streak}d</b></span>
              {isAdmin && <button className="iconbtn" aria-label="Open admin area" onClick={() => setView("admin")}><Ic n="shield" /></button>}
              <button className="iconbtn" aria-label="Log out" onClick={() => void supabase.auth.signOut()}><Ic n="out" /></button>
            </div>
          </header>
        )}
        {toast && !inRound && <p className="toast" role="status">{toast}</p>}
        {error && !inRound && view !== "lobby" && <p className="toast" role="alert">{error}</p>}
        {view === "lobby" && <Lobby cfg={cfg} balance={balance} banned={profile.banned} boosters={boosters} error={error} onStart={start} />}
        {view === "play" && round && (
          <Play round={round}
            onDone={(r, p) => { setResult({ r, p }); setBalance(r.balance); setView("result"); void refresh(); }}
            onError={(m) => { setError(m); setView("lobby"); void refresh(); }}
            onLeave={() => { setView("lobby"); void refresh(); }} />
        )}
        {view === "result" && result && (
          <Result r={result.r} p={result.p} achNames={(result.r.achievements ?? []).map((a) => achDefs[a] ?? a)} onReplay={replay.current}
            onAgain={() => setView(result.r.mode === "tour" ? "events" : "lobby")} />
        )}
        {view === "events" && <Events userId={profile.id} balance={balance} blocked={profile.banned || cfg.g.maint || !cfg.g.paid} onEnter={(id) => void startEvent(id)} />}
        {view === "quests" && <Quests onChange={refresh} />}
        {view === "wallet" && <Wallet balance={balance} />}
        {view === "shop" && <Shop items={items} owned={owned} boosters={boosters} equipped={profile.equipped} balance={balance} level={l} onChange={refresh} />}
        {view === "admin" && isAdmin && <Suspense fallback={<div className="skel" />}><Admin onBack={() => { setView("lobby"); void refresh(); }} /></Suspense>}
      </div>
      {!inRound && (
        <nav className="nav" aria-label="Main">
          <div className="brand">Bingo Arena</div>
          {NAV.map(([k, n, i]) => (
            <button key={k} className={`nb ${view === k || (k === "lobby" && view === "result") ? "on" : ""}`} aria-current={view === k ? "page" : undefined} onClick={() => { setView(k); setToast(""); setError(""); }}>
              <Ic n={i} /><span>{n}</span>
            </button>
          ))}
        </nav>
      )}
    </>
  );
}
