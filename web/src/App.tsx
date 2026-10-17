import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { callFn, configured, DEFAULT_EQUIPPED, errorText, me, supabase, TERMS_VERSION, type ChallengeInfo, type Equipped, type GameCfg, type LiveOp, type ShopItem } from "./lib/supabase";
import { addMinute, loadSettings, minutesToday, saveSettings, type Settings } from "./lib/settings";
import { applyLook } from "./lib/look";
import { Coins, Ic } from "./lib/ui";
import Lobby from "./views/Lobby";
import Play, { type RoundResult, type RoundStart } from "./views/Play";
import Result from "./views/Result";
import Wallet from "./views/Wallet";
import Shop from "./views/Shop";
import Compete from "./views/Compete";
import JourneyHub from "./views/JourneyHub";
import Collect from "./views/Collect";
import Matchmaking from "./views/Matchmaking";
import AgeGate from "./views/AgeGate";
import SetPassword from "./views/SetPassword";
import ProfileView from "./views/Profile";
import Help from "./views/Help";
import Inbox from "./views/Inbox";
import AuthGate from "./views/AuthGate";
import GuestTeaser from "./views/GuestTeaser";
import FirstVisit from "./views/FirstVisit";
import GuestResult from "./views/GuestResult";
import { computeDna, drilledToday, todaysDrill, type DnaRound } from "./lib/dna";
import { NewIds } from "./lib/NewPlayers";
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
type View = "lobby" | "match" | "play" | "result" | "journey" | "compete" | "collect" | "wallet" | "shop" | "profile" | "help" | "inbox" | "admin";
const lvl = (xp: number) => Math.floor(Math.sqrt(xp / 40)) + 1;
// five tabs on a phone; the wallet opens from the coin counter at the top
const INTRO: Partial<Record<View, string>> = {
  inbox: "Messages from us, answers to your questions, and notifications such as welcomes from other players.",
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
  const [ops, setOps] = useState<LiveOp[]>([]);
  const [gate, setGate] = useState<{ reason: string; mode: "reg" | "log" } | null>(null);
  const [inbox, setInbox] = useState({ unread: 0, admin_unread: 0 });
  const prevUnread = useRef(0);
  const [compose, setCompose] = useState(false);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [newTotal, setNewTotal] = useState(0);
  const [competeTab, setCompeteTab] = useState<"events" | "league" | "crew" | "calendar" | "new">("events");
  const [tour, setTour] = useState<{ kind: "full" | "new" | "replay"; steps: GuideStep[] } | null>(null);
  const guideFor = useRef("");
  const [challenge, setChallenge] = useState<ChallengeInfo | null>(null);
  const [dnaRounds, setDnaRounds] = useState<DnaRound[] | null>(null);
  const dna = useMemo(() => computeDna(dnaRounds ?? []), [dnaRounds]);
  const drillDone = useMemo(() => drilledToday(dnaRounds ?? []), [dnaRounds]);
  // a visitor's one free round (scored on the device) and the first-visit question
  const [guestRound, setGuestRound] = useState<{ round: RoundStart; level: string } | null>(null);
  const [guestRes, setGuestRes] = useState<{ r: RoundResult; p: RoundStart["params"]; level: string } | null>(null);
  const [guestPlayed, setGuestPlayed] = useState((() => { try { return !!localStorage.getItem("ba_guest_played"); } catch { return false; } })());
  const [firstVisit, setFirstVisit] = useState(!(() => { try { return !!localStorage.getItem("ba_first_visit"); } catch { return false; } })());
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

  // Bingo DNA: worked out from the player's own last rounds
  const loadDna = useCallback(async () => {
    const { data, error } = await supabase.from("rounds").select("mode,level,finished_at,params,result").eq("user_id", me.id).eq("status", "scored").not("finished_at", "is", null).order("finished_at", { ascending: false }).limit(40);
    if (!error) setDnaRounds((data as DnaRound[]) ?? []);
  }, []);
  useEffect(() => { if (session) void loadDna(); else setDnaRounds(null); }, [session, loadDna]);
  // a new play style is a milestone worth telling the player about
  useEffect(() => {
    if (!dna?.style || !me.id) return;
    let prev: string | null = null;
    try { prev = localStorage.getItem("ba_style_" + me.id); localStorage.setItem("ba_style_" + me.id, dna.style.name); } catch { /* ignore */ }
    if (prev && prev !== dna.style.name) setToast(`New play style: ${dna.style.name}! See your Bingo DNA in your profile.`);
  }, [dna?.style?.name]);
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

  // Visitors (not signed in) can look around: load the public game settings and shop, and close the sign-up pop-up after login.
  useEffect(() => {
    if (!configured) return;
    if (session) { setGate(null); return; }
    setView("lobby");
    void Promise.all([
      supabase.from("game_config").select("data").eq("id", 1).single(),
      supabase.from("shop_items").select("*").eq("active", true).order("sort"),
    ]).then(([c, it]) => { if (c.data) setCfg(c.data.data as GameCfg); setItems((it.data as ShopItem[]) ?? []); });
    let code: string | null = null;
    try { code = sessionStorage.getItem("ba_challenge"); } catch { /* ignore */ }
    if (code) setGate({ reason: "A friend challenged you! Create a free account to accept.", mode: "reg" });
  }, [session]);

  // events that are running now (boosts and news), refreshed every few minutes (visitors see them too)
  useEffect(() => {
    const load = () => void supabase.from("liveops").select("*").eq("active", true).lte("starts_at", new Date().toISOString()).gt("ends_at", new Date().toISOString()).order("ends_at")
      .then(({ data }) => setOps((data as LiveOp[]) ?? []));
    load();
    const t = setInterval(load, 5 * 60000);
    return () => clearInterval(t);
  }, [session]);

  // the number on the inbox envelope: checked every minute and whenever you come back to the game
  const refreshInbox = useCallback(async () => {
    const { data, error } = await supabase.rpc("inbox_summary");
    if (error || !data) return; // the inbox is optional until the database update is installed
    const s = data as { unread: number; admin_unread: number };
    if (s.unread > prevUnread.current) setToast("You have a new message in your inbox.");
    prevUnread.current = s.unread;
    setInbox(s);
  }, []);
  useEffect(() => {
    if (!session) return;
    void refreshInbox();
    const t = setInterval(() => void refreshInbox(), 60000);
    const vis = () => { if (document.visibilityState === "visible") void refreshInbox(); };
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [session, refreshInbox]);

  // players who joined this week: they get a NEW tag in every list and a "say welcome" card
  useEffect(() => {
    if (!session) return;
    const load = () => void supabase.rpc("new_players", { p_limit: 50 }).then(({ data, error }) => {
      if (error || !data) return;
      const d = data as { total: number; players: { user_id: string }[] };
      setNewIds(new Set(d.players.map((p) => p.user_id))); setNewTotal(d.total);
    });
    load();
    const t = setInterval(load, 5 * 60000);
    return () => clearInterval(t);
  }, [session]);

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
  const startDrill = () => {
    const skill = todaysDrill(dna);
    replay.current = () => void begin({ mode: "drill", skill });
    return begin({ mode: "drill", skill });
  };
  const startEvent = (id: string) => {
    replay.current = () => void begin({ mode: "tour", eventId: id });
    return begin({ mode: "tour", eventId: id });
  };

  if (!configured) {
    return <div className="shell"><section><h1>Almost there</h1><p>The game is not connected to its database yet. Follow <b>docs/LAUNCH_GUIDE.md</b>, step 4, to add your two Supabase keys.</p></section></div>;
  }
  if (!ready) return <div className="shell"><div className="skel" /><div className="skel" /></div>;
  if (!session) {
    // Visitors see the real game: lobby, journey, shop and help. Anything that needs an account opens the sign-up pop-up.
    const ask = (reason: string, mode: "reg" | "log" = "reg") => setGate({ reason, mode });
    const join = () => ask("Create your free account");
    const gview = (["lobby", "journey", "compete", "collect", "shop", "help"] as View[]).includes(view) ? view : "lobby";
    const startGuest = (level: string) => {
      setFirstVisit(false);
      try { localStorage.setItem("ba_first_visit", "1"); } catch { /* ignore */ }
      if (guestPlayed) { ask("You played your free round. Create a free account to keep playing"); return; }
      if (!cfg) return;
      const lv = cfg.levels[level] ?? cfg.levels.beginner;
      setGuestRes(null);
      setGuestRound({ level, round: { roundId: "", seed: Math.floor(Math.random() * 2 ** 31), balance: 0, local: true, params: { ...lv, total: cfg.g.total, pay: cfg.g.pay, ghost: null } as RoundStart["params"] } });
    };
    if (guestRound) {
      return (
        <div className="shell"><div className="content">
          <Play round={guestRound.round} tips={settings.tips}
            onDone={(r, p) => { setGuestRes({ r, p, level: guestRound.level }); setGuestRound(null); setGuestPlayed(true); try { localStorage.setItem("ba_guest_played", "1"); } catch { /* ignore */ } }}
            onError={() => setGuestRound(null)} onLeave={() => setGuestRound(null)} />
        </div></div>
      );
    }
    return (
      <>
        <div className="shell">
          <header className="appbar">
            <div className="who">
              <span className="avatar" aria-hidden="true">B</span>
              <div className="wtxt"><b id="who">Bingo Arena</b><span className="dim" style={{ fontSize: 12 }}>Skill bingo · free to play</span></div>
            </div>
            <div className="chips">
              <button className="iconbtn" aria-label="Help and guide" onClick={() => setView("help")}><Ic n="help" /></button>
              <button className="btn alt" style={{ minHeight: 44, padding: "8px 14px" }} onClick={() => ask("Welcome back! Log in to continue", "log")}>Log in</button>
              <button className="btn" style={{ minHeight: 44, padding: "8px 14px" }} onClick={join}>Sign up free</button>
            </div>
          </header>
          <NewIds.Provider value={newIds}>
          <div className="content">
            {gview !== "help" && <p className="toast guestbar">You are looking around as a guest. <button className="linkbtn" style={{ padding: 0, minHeight: 0 }} onClick={join}>Sign up free</button> to play{cfg ? ` and get ${cfg.g.welcome} coins` : ""}.</p>}
            {guestRes && <GuestResult r={guestRes.r} total={guestRes.p.total} every={guestRes.p.every} level={guestRes.level} onJoin={() => ask("Reveal your Bingo DNA with a free account")} onBack={() => setGuestRes(null)} />}
            {!guestRes && INTRO[gview] && <PageIntro text={INTRO[gview]!} />}
            {!cfg && <><div className="skel" /><div className="skel" /></>}
            {!guestRes && gview === "lobby" && cfg && (
              <Lobby cfg={cfg} balance={0} banned={false} boosters={{}} error="" guest
                guestFree={!guestPlayed}
                onStart={(m, l) => m === "solo" && !guestPlayed ? startGuest(l) : ask(m === "pvp" ? "To play against real people, create your free account" : guestPlayed && m === "solo" ? "You played your free round. Create a free account to keep playing" : "To play, create your free account")}
                userId="" dailyKey={0} onDaily={() => ask("To play the Daily Challenge, create your free account")} challenge={null} onAccept={() => undefined} onDismiss={() => undefined}
                isNew ops={ops} newCount={0} onSayHi={() => undefined} />
            )}
            {gview === "journey" && <JourneyHub guest onJoin={join} onPlay={() => ask("To play this stage and earn stars, create your free account")} items={items} balance={0} onChange={async () => undefined} />}
            {gview === "compete" && (
              <GuestTeaser title="Compete for prizes" intro="Join tournaments, climb the weekly league and team up with friends." onJoin={join}
                points={[["trophy", "Events", "Tournaments with prize pools. Your best score counts."], ["star", "Weekly league", "The most active players win coins every week."], ["users", "Crews", "Team up with up to 20 players and open the crew chest together."], ["gift", "Calendar", "Double XP hours, coin rushes and cheaper entries."]]} />
            )}
            {gview === "collect" && (
              <GuestTeaser title="Collect and complete" intro="Every round brings you closer to a reward." onJoin={join}
                points={[["album", "Stamp album", "27 stamps across three worlds. Finish a page for coins and an exclusive board."], ["quest", "Daily quests", "Three new goals every day, each with a coin reward."], ["medal", "Badges", "Unlock badges for your best moments."]]} />
            )}
            {gview === "shop" && <Shop items={items} owned={new Set()} boosters={{}} equipped={DEFAULT_EQUIPPED} balance={0} level={1} onChange={async () => undefined} onGuest={() => ask("To buy or use items, create your free account")} />}
            {gview === "help" && <Help onReplay={() => ask("Create your free account, then take the tour")} onContact={() => ask("Log in or create a free account so we can answer you in your inbox")} />}
          </div>
          </NewIds.Provider>
        </div>
        <nav className="nav" aria-label="Main">
          <div className="brand">Bingo Arena</div>
          {NAV.map(([k, n, i]) => (
            <button key={k} className={`nb ${gview === k ? "on" : ""}`} aria-current={gview === k ? "page" : undefined} onClick={() => setView(k)}>
              <Ic n={i} /><span>{n}</span>
            </button>
          ))}
        </nav>
        {gate && <AuthGate reason={gate.reason} mode={gate.mode} onClose={() => setGate(null)} />}
        {firstVisit && !gate && cfg && !guestRes && <FirstVisit onPractice={() => startGuest("beginner")} onClose={() => { setFirstVisit(false); try { localStorage.setItem("ba_first_visit", "1"); } catch { /* ignore */ } }} />}
      </>
    );
  }
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
              <span className="badgewrap"><button className="iconbtn" aria-label={inbox.unread ? `Inbox, ${inbox.unread} new` : "Inbox"} onClick={() => { setCompose(false); setView("inbox"); setToast(""); }}><Ic n="mail" /></button>{inbox.unread > 0 && <span className="badgenum" aria-hidden="true">{inbox.unread > 9 ? "9+" : inbox.unread}</span>}</span>
              <button className="iconbtn" aria-label="Help and guide" onClick={() => { setView("help"); setToast(""); }}><Ic n="help" /></button>
              {isAdmin && <span className="badgewrap"><button className="iconbtn" aria-label={inbox.admin_unread ? `Admin area, ${inbox.admin_unread} unanswered messages` : "Admin area"} onClick={() => setView("admin")}><Ic n="gear" /></button>{inbox.admin_unread > 0 && <span className="badgenum" aria-hidden="true">{inbox.admin_unread > 9 ? "9+" : inbox.admin_unread}</span>}</span>}
              <button className="iconbtn" aria-label="Log out" onClick={() => void supabase.auth.signOut()}><Ic n="out" /></button>
            </div>
          </header>
        )}
        {toast && !inRound && <p className="toast" role="status">{toast}</p>}
        {error && !inRound && view !== "lobby" && <p className="toast" role="alert">{error}</p>}
        <NewIds.Provider value={newIds}>
        <div className="content">
        {INTRO[view] && <PageIntro text={INTRO[view]!} />}
        {view === "lobby" && <Lobby cfg={cfg} balance={balance} banned={profile.banned} boosters={boosters} error={error} onStart={start} userId={profile.id} dailyKey={dailyKey} onDaily={() => void startDaily()} challenge={challenge} onAccept={(c) => void startDuel(c)} onDismiss={() => setChallenge(null)} isNew={profile.played === 0} ops={ops} newCount={newTotal} onSayHi={() => { setCompeteTab("new"); setView("compete"); }} dna={dna} drillDone={drillDone} onDrill={() => void startDrill()} />}
        {view === "match" && <Matchmaking level={matchLevel} fee={cfg.levels[matchLevel].fee}
          onReady={(r) => { setRound(r); setView("play"); void refresh(); }}
          onCancel={() => setView("lobby")}
          onGhost={() => { void start("ghost", matchLevel, []); }}
          onError={(m) => { setError(m); setView("lobby"); }} />}
        {view === "play" && round && (
          <Play round={round} tips={settings.tips}
            onDone={(r, p) => { setResult({ r, p }); setBalance(r.balance); setView("result"); setDailyKey((k) => k + 1); void refresh(); void loadDna(); }}
            onError={(m) => { setError(m); setView("lobby"); void refresh(); }}
            onLeave={() => { setView("lobby"); void refresh(); }} />
        )}
        {view === "result" && result && (
          <Result r={result.r} p={result.p} achNames={(result.r.achievements ?? []).map((a) => achDefs[a] ?? a)} onReplay={replay.current}
            onAgain={() => setView(result.r.mode === "tour" ? "compete" : result.r.mode === "stage" ? "journey" : "lobby")} playerName={profile.display_name} onSettled={() => void refresh()} onGo={(v) => setView(v)} coach={settings.coach || "Coach Nova"} dna={dna} onDrill={() => void startDrill()} />
        )}
        {view === "compete" && <Compete key={competeTab} initial={competeTab} userId={profile.id} balance={balance} blocked={profile.banned || cfg.g.maint || !cfg.g.paid} onEnter={(id) => void startEvent(id)} onChange={refresh} />}
        {view === "journey" && <JourneyHub onPlay={(id) => void startStage(id)} items={items} balance={balance} onChange={refresh} />}
        {view === "collect" && <Collect items={items} onChange={refresh} />}
        {view === "wallet" && <Wallet balance={balance} />}
        {view === "profile" && <ProfileView name={profile.display_name} level={l} title={titleName} xpText={`${profile.xp - lo} / ${hi - lo} XP`} streak={profile.streak} shields={profile.shields} dailyDone={profile.daily_done} settings={settings} onSettings={setSettings} minutes={minutes} onReplay={() => setTour({ kind: "replay", steps: GUIDE })} onContact={() => { setCompose(true); setView("inbox"); }} dna={dna} played={dnaRounds?.length ?? 0} drillDone={drillDone} onDrill={() => void startDrill()} />}
        {view === "help" && <Help onReplay={() => setTour({ kind: "replay", steps: GUIDE })} onContact={() => { setCompose(true); setView("inbox"); }} />}
        {view === "inbox" && <Inbox key={String(compose)} startCompose={compose} onCount={() => void refreshInbox()} />}
        {view === "shop" && <Shop items={items} owned={owned} boosters={boosters} equipped={profile.equipped} balance={balance} level={l} onChange={refresh} />}
        {view === "admin" && isAdmin && <Suspense fallback={<div className="skel" />}><Admin onBack={() => { setView("lobby"); void refresh(); void refreshInbox(); }} onChange={refresh} unanswered={inbox.admin_unread} onCount={() => void refreshInbox()} /></Suspense>}
        </div>
        </NewIds.Provider>
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
