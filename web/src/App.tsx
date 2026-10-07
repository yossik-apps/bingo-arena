import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { callFn, configured, DEFAULT_EQUIPPED, errorText, me, supabase, TERMS_VERSION, type ChallengeInfo, type Equipped, type GameCfg, type ShopItem } from "./lib/supabase";
import { addMinute, loadSettings, minutesToday, saveSettings, type Settings } from "./lib/settings";
import { applyLook } from "./lib/look";
import { Coins, Ic } from "./lib/ui";
import Auth from "./views/Auth";
import Lobby from "./views/Lobby";
import Play, { type RoundResult, type RoundStart } from "./views/Play";
import Result from "./views/Result";
import Wallet from "./views/Wallet";
import Shop from "./views/Shop";
import Compete from "./views/Compete";
import Journey from "./views/Journey";
import Collect from "./views/Collect";
import Matchmaking from "./views/Matchmaking";
import AgeGate from "./views/AgeGate";
import SetPassword from "./views/SetPassword";
import ProfileView from "./views/Profile";
import Help from "./views/Help";
import Tour from "./views/Tour";
import PageIntro from "./lib/PageIntro";
import { GUIDE, GUIDE_VERSION, type GuideStep } from "./guide/content";

// A shared challenge link looks like /?c=abc12345. Remember it so it survives the login screen.
{
  const code = new URLSearchParams(window.location.search).get("c");
  if (code && /^[a-z0-9]{6,12}$/.test(code)) { try { sessionStorage.setItem("ba_challenge", code); } catch { /* ignore */ } window.history.replaceState({}, "", window.location.pathname); }
}

// A password-reset link opens the game with type=recovery in the address; remember it before the login library cleans it up.
const openedFromReset = /type=recovery/.test(window.location.hash + window.location.search);

const Admin = lazy(() => import("./views/admin/Admin"));

type Profile = { id: string; display_name: string; xp: number; streak: number; banned: boolean; role: string; played: number; adult_confirmed: boolean; terms_version: string | null; shields: number; daily_done: number; equipped: Equipped };
type View = "lobby" | "match" | "play" | "result" | "journey" | "compete" | "collect" | "wallet" | "shop" | "profile" | "help" | "admin";
const lvl = (xp: number) => Math.floor(Math.sqrt(xp / 40)) + 1;
// five tabs on a phone; the wallet opens from the coin counter at the top
const INTRO: Partial<Record<View, string>> = {
  journey: "Clear stages to earn up to 3 stars each. Stars open new worlds. A stage is the same board every time, so you can learn it.",
  compete: "Join tournaments for prizes and climb the weekly league.",
  collect: "Find stamps for your album, and finish daily quests and badges.",
  shop: "Spend your coins on looks and boosters. Three daily deals change every day.",
  wallet: "Your coins, and everything you earned or spent. Coins are play money.",
};
const NAV: [View, string, string][] = [["lobby", "Play", "play"], ["journey", "Journey", "map"], ["compete", "Compete", "trophy"], ["collect", "Collect", "album"], ["shop", "Shop", "shop"]];

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
  const [matchLevel, setMatchLevel] = useState("beginner");
  const [recovery, setRecovery] = useState(openedFromReset);
  const [settings, setSettingsS] = useState<Settings>(loadSettings());
  const [minutes, setMinutes] = useState(minutesToday());
  const [dailyKey, setDailyKey] = useState(0);
  const [tour, setTour] = useState<{ kind: "full" | "new" | "replay"; steps: GuideStep[] } | null>(null);
  const guideFor = useRef("");
  const [challenge, setChallenge] = useState<ChallengeInfo | null>(null);
  const setSettings = (s: Settings) => { setSettingsS(s); saveSettings(s); };

  useEffect(() => {
    if (!configured) { setReady(true); return; }
    void supabase.auth.getSession().then(({ data }) => { me.id = data.session?.user.id ?? ""; setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((e, s) => { me.id = s?.user.id ?? ""; setSession(s); if (e === "PASSWORD_RECOVERY") setRecovery(true); });
    return () => data.subscription.unsubscribe();
  }, []);

  // Play Pulse: counts active minutes today, shows a gentle break reminder and enforces the player's own daily limit.
  useEffect(() => {
    if (!session) return;
    let sessionMinutes = 0;
    const t = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      sessionMinutes += 1;
      setMinutes(addMinute());
      if (settings.pulse > 0 && sessionMinutes % settings.pulse === 0) setToast(`You have been playing for ${sessionMinutes} minutes. A short break helps you stay sharp.`);
    }, 60000);
    return () => clearInterval(t);
  }, [session, settings.pulse]);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 6000); return () => clearTimeout(t); }, [toast]);

  const refresh = useCallback(async () => {
    const [{ data: c }, { data: pr }, { data: w }, { data: it }, { data: inv }, { data: bo }, { data: ad }] = await Promise.all([
      supabase.from("game_config").select("data").eq("id", 1).single(),
      supabase.from("profiles").select("id,display_name,xp,streak,banned,role,played,adult_confirmed,terms_version,shields,daily_done,equipped").eq("id", me.id).single(),
      supabase.from("wallet").select("balance").eq("user_id", me.id).maybeSingle(),
      supabase.from("shop_items").select("*").eq("active", true).order("sort"),
      supabase.from("inventory").select("item_id").eq("user_id", me.id),
      supabase.from("user_boosters").select("key,qty").eq("user_id", me.id),
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
        const d = await callFn<{ claimed: boolean; bonus: number; streak: number; shield_used?: boolean; pack?: { name: string; is_new: boolean } | null }>("daily-bonus");
        if (d.claimed) setToast(`Daily login bonus: +${d.bonus} coins (day ${d.streak} streak).${d.shield_used ? " Your Streak Shield saved your streak!" : ""}${d.pack ? ` Streak reward: a free stamp, ${d.pack.name}!` : ""}`);
      } catch { /* the bonus is optional */ }
      await refresh();
    })();
  }, [session, refresh]);

  useEffect(() => { if (profile && items.length) applyLook(profile.equipped, items); }, [profile, items]);
  // The intro tour: everyone sees it once; after an update they see only what is new. The ? button replays all of it.
  useEffect(() => {
    if (!profile || !profile.adult_confirmed || profile.terms_version !== TERMS_VERSION || guideFor.current === me.id) return;
    guideFor.current = me.id;
    void (async () => {
      let seen = 0;
      try { seen = Number(localStorage.getItem("ba_guide_" + me.id) ?? 0); } catch { /* ignore */ }
      const { data, error } = await supabase.from("profiles").select("guide_seen").eq("id", me.id).maybeSingle();
      if (!error && data) seen = Math.max(seen, (data as { guide_seen: number }).guide_seen ?? 0);
      if (seen === 0) setTour({ kind: "full", steps: GUIDE });
      else if (seen < GUIDE_VERSION) setTour({ kind: "new", steps: GUIDE.filter((s) => s.since > seen) });
    })();
  }, [profile]);
  const closeTour = () => {
    if (tour && tour.kind !== "replay") {
      try { localStorage.setItem("ba_guide_" + me.id, String(GUIDE_VERSION)); } catch { /* ignore */ }
      void supabase.rpc("set_guide_seen", { p_version: GUIDE_VERSION }); // remembered on every device once the database update is installed
    }
    setTour(null);
  };
  useEffect(() => { document.documentElement.classList.toggle("big-text", settings.bigText); }, [settings.bigText]);

  const titleName = useMemo(() => items.find((i) => i.slot === "title" && i.key === profile?.equipped.title)?.name, [items, profile]);

  // a shared challenge link: look it up once the player is signed in
  useEffect(() => {
    if (!session || !profile?.adult_confirmed) return;
    let code: string | null = null;
    try { code = sessionStorage.getItem("ba_challenge"); } catch { /* ignore */ }
    if (!code) return;
    void supabase.rpc("get_challenge", { p_code: code }).then(({ data, error }) => {
      try { sessionStorage.removeItem("ba_challenge"); } catch { /* ignore */ }
      if (error) setToast("That challenge link is not valid any more.");
      else setChallenge(data as ChallengeInfo);
    });
  }, [session, profile?.adult_confirmed]);

  const limitReached = settings.limit > 0 && minutes >= settings.limit;
  const blockedByLimit = () => {
    if (!limitReached) return false;
    setError(`You reached your daily time limit of ${settings.limit} minutes, so new rounds are paused until tomorrow. You can change this in your profile.`);
    return true;
  };

  const begin = async (body: Record<string, unknown>) => {
    setError("");
    if (blockedByLimit()) return;
    try {
      const r = await callFn<RoundStart>("start-round", body);
      setRound(r); setBalance(r.balance); setView("play");
    } catch (e) { setError(errorText((e as Error).message)); setView(body.mode === "tour" ? "compete" : body.mode === "stage" ? "journey" : "lobby"); }
  };
  const findMatch = (level: string) => {
    setError(""); if (blockedByLimit()) return; setMatchLevel(level);
    replay.current = () => findMatch(level);
    setView("match");
  };
  const start = (mode: "solo" | "ghost" | "pvp", level: string, armed: string[]) => {
    if (mode === "pvp") { findMatch(level); return; }
    replay.current = () => void begin({ mode, level, boosters: [] });
    return begin({ mode, level, boosters: armed });
  };
  const startStage = (id: string) => {
    replay.current = () => void begin({ mode: "stage", stageId: id });
    return begin({ mode: "stage", stageId: id });
  };
  const startDaily = () => { replay.current = null; return begin({ mode: "daily" }); };
  const startDuel = (code: string) => { setChallenge(null); replay.current = null; return begin({ mode: "duel", code }); };
  const startEvent = (id: string) => {
    replay.current = () => void begin({ mode: "tour", eventId: id });
    return begin({ mode: "tour", eventId: id });
  };

  if (!configured) {
    return <div className="shell"><section><h1>Almost there</h1><p>The game is not connected to its database yet. Follow <b>docs/LAUNCH_GUIDE.md</b>, step 4, to add your two Supabase keys.</p></section></div>;
  }
  if (!ready) return <div className="shell"><div className="skel" /><div className="skel" /></div>;
  if (!session) return <div className="shell auth"><div className="content"><Auth /></div></div>;
  if (recovery) return <div className="shell auth"><div className="content"><SetPassword onDone={() => { setRecovery(false); window.history.replaceState({}, "", window.location.pathname); }} /></div></div>;
  if (!cfg || !profile) return <div className="shell"><div className="skel" /><div className="skel" /><div className="skel" /></div>;
  if (!profile.adult_confirmed || profile.terms_version !== TERMS_VERSION) return <div className="shell"><AgeGate name={profile.display_name} updated={profile.adult_confirmed} onDone={refresh} /></div>;

  const l = lvl(profile.xp), lo = 40 * (l - 1) ** 2, hi = 40 * l * l, pc = Math.round(((profile.xp - lo) / (hi - lo)) * 100);
  const inRound = view === "play";
  const isAdmin = profile.role === "admin";

  return (
    <>
      <div className={`shell ${view === "admin" ? "wide" : ""}`}>
        {!inRound && (
          <header className="appbar">
            <div className="who" role="button" tabIndex={0} aria-label="Open your profile" style={{ cursor: "pointer" }} onClick={() => { setView("profile"); setToast(""); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { setView("profile"); setToast(""); } }}>
              <span className={`avatar ${profile.equipped.frame ? "fr-" + profile.equipped.frame : ""}`} aria-hidden="true">{profile.display_name.slice(0, 1).toUpperCase()}</span>
              <div className="wtxt">
                <b id="who">{profile.display_name}</b>
                <div className="xpline"><span className="lvb">Lv {l}</span><div className="xpbar" role="progressbar" aria-label="XP to next level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pc}><i style={{ width: `${pc}%` }} /></div></div>
                <span className="dim" style={{ fontSize: 12 }}>{titleName ? `${titleName} · ` : ""}{profile.xp - lo} / {hi - lo} XP</span>
              </div>
            </div>
            <div className="chips">
              <button className="chip2" aria-label={`Open wallet, ${balance} coins`} onClick={() => { setView("wallet"); setToast(""); }} style={{ cursor: "pointer", color: "inherit", font: "inherit" }}><Coins n={balance} /></button>
              <span className="chip2" role="group" aria-label="Day streak"><Ic n="flame" c="fl" /><b>{profile.streak}d</b></span>
              <button className="iconbtn" aria-label="Help and guide" onClick={() => { setView("help"); setToast(""); }}><Ic n="help" /></button>
              {isAdmin && <button className="iconbtn" aria-label="Open admin area" onClick={() => setView("admin")}><Ic n="shield" /></button>}
              <button className="iconbtn" aria-label="Log out" onClick={() => void supabase.auth.signOut()}><Ic n="out" /></button>
            </div>
          </header>
        )}
        {toast && !inRound && <p className="toast" role="status">{toast}</p>}
        {error && !inRound && view !== "lobby" && <p className="toast" role="alert">{error}</p>}
        <div className="content">
        {INTRO[view] && <PageIntro text={INTRO[view]!} />}
        {view === "lobby" && <Lobby cfg={cfg} balance={balance} banned={profile.banned} boosters={boosters} error={error} onStart={start} userId={profile.id} dailyKey={dailyKey} onDaily={() => void startDaily()} challenge={challenge} onAccept={(c) => void startDuel(c)} onDismiss={() => setChallenge(null)} isNew={profile.played === 0} />}
        {view === "match" && <Matchmaking level={matchLevel} fee={cfg.levels[matchLevel].fee}
          onReady={(r) => { setRound(r); setView("play"); void refresh(); }}
          onCancel={() => setView("lobby")}
          onGhost={() => { void start("ghost", matchLevel, []); }}
          onError={(m) => { setError(m); setView("lobby"); }} />}
        {view === "play" && round && (
          <Play round={round} tips={settings.tips}
            onDone={(r, p) => { setResult({ r, p }); setBalance(r.balance); setView("result"); setDailyKey((k) => k + 1); void refresh(); }}
            onError={(m) => { setError(m); setView("lobby"); void refresh(); }}
            onLeave={() => { setView("lobby"); void refresh(); }} />
        )}
        {view === "result" && result && (
          <Result r={result.r} p={result.p} achNames={(result.r.achievements ?? []).map((a) => achDefs[a] ?? a)} onReplay={replay.current}
            onAgain={() => setView(result.r.mode === "tour" ? "compete" : result.r.mode === "stage" ? "journey" : "lobby")} playerName={profile.display_name} onSettled={() => void refresh()} onGo={(v) => setView(v)} />
        )}
        {view === "compete" && <Compete userId={profile.id} balance={balance} blocked={profile.banned || cfg.g.maint || !cfg.g.paid} onEnter={(id) => void startEvent(id)} />}
        {view === "journey" && <Journey onPlay={(id) => void startStage(id)} />}
        {view === "collect" && <Collect items={items} onChange={refresh} />}
        {view === "wallet" && <Wallet balance={balance} />}
        {view === "profile" && <ProfileView name={profile.display_name} level={l} title={titleName} xpText={`${profile.xp - lo} / ${hi - lo} XP`} streak={profile.streak} shields={profile.shields} dailyDone={profile.daily_done} settings={settings} onSettings={setSettings} minutes={minutes} onReplay={() => setTour({ kind: "replay", steps: GUIDE })} />}
        {view === "help" && <Help onReplay={() => setTour({ kind: "replay", steps: GUIDE })} />}
        {view === "shop" && <Shop items={items} owned={owned} boosters={boosters} equipped={profile.equipped} balance={balance} level={l} onChange={refresh} />}
        {view === "admin" && isAdmin && <Suspense fallback={<div className="skel" />}><Admin onBack={() => { setView("lobby"); void refresh(); }} onChange={refresh} /></Suspense>}
        </div>
      </div>
      {!inRound && (
        <nav className="nav" aria-label="Main">
          <div className="brand">Bingo Arena</div>
          {NAV.map(([k, n, i]) => (
            <button key={k} className={`nb ${view === k || (k === "lobby" && view === "result" && result?.r.mode !== "stage") || (k === "journey" && view === "result" && result?.r.mode === "stage") ? "on" : ""}`} aria-current={view === k ? "page" : undefined} onClick={() => { setView(k); setToast(""); setError(""); }}>
              <Ic n={i} /><span>{n}</span>
            </button>
          ))}
        </nav>
      )}
      {tour && !inRound && <Tour steps={tour.steps} heading={tour.kind === "new" ? "What is new" : "Quick tour"} onClose={closeTour} onGo={(v) => { setView(v); closeTour(); }} />}
    </>
  );
}
