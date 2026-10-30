import { useEffect, useRef, useState } from "react";
import { levelOf, xpFor } from "@engine";
import Lobby, { type Mode, type Speed } from "./Lobby";
import Game, { type RoundSummary } from "./Game";
import { LevelUp, Results } from "./Results";
import Roadmap from "./Roadmap";
import { DeskLobby, DeskShell } from "./Desktop";
import { Collect, DailyRewards, Prep, Shop } from "./ScreensA";
import { Compete, Journey, Matching, Profile } from "./ScreensB";
import { ChallengeIn, CheckoutSheet, LockSheet, NotifySheet, SaveSheet, StoreSheet } from "./Sheets";
import { DailyCtx, TAB_FEATURE, useToast, type DailyInfo, type Tab } from "./Nav";
import {
  avgRoundXp, BOOSTERS, BOX_MS, BOX_SKIP_GEMS, boxLeft, boxReward, CARD, cardGrid, cardSeed, CHAPTER_NEED, CHAPTERS, challengeLink, CUP, CUP_BOTS, cupId, cupPrize, cupRank, cupSeed, DAILY, dayLabel, DEFAULT, EVENTS,
  freezeMax, FREEZE_PRICE, FRIEND_POOL, GEM_LEVEL, ghostFee, GHOST_FREE, give, goalText, h2hText, INVITE_STEPS, LOOKS, nextGoals, nowMs, parseChallenge, PASS, passReward, passText, PLAYER, questOf, REPAIR_COINS, REPAIR_GEMS, REPAIR_MIN,
  REROLL_PRICE, rewardText, RIVAL_NAMES, rivalTarget, SEASON_TIERS, SEASON_XP, seasonReward, SET_NAMES, SET_REWARD, setDone, STAGES, stageStars, STAMPS, usd, WELCOME,
  type Boost, type Bonus, type Challenge, type Goal, type Linked, type Notice, type Run, type Saved, type StoreItem,
} from "./data";
import { LADDER, LAST_UNLOCK_LEVEL, LEVEL_UNLOCKS, setLadder, unlocked, xpForLevel, type Feature } from "../lib/levels";
import { clearEvents, onTrack, readEvents, track } from "./track";
import { buzz, sfx } from "./sound";
import { shareText } from "./share";

type Screen = "lobby" | "game" | "results" | "levelup" | "path" | "daily" | "journey" | "collect" | "compete" | "shop" | "profile" | "prep" | "match" | "challengeIn";
type Res = { r: RoundSummary; prevXp: number; newXp: number; isBest: boolean; bonus: Bonus[]; doubleXp: boolean; run: Run | null; goals: Goal[]; nearMiss?: string };
type Sheet =
  | { kind: "lock"; feature: Feature } | { kind: "save"; reason: "rounds" | "streak" | "league" } | { kind: "notify" }
  | { kind: "store"; focus?: "coins" | "gems"; reason?: string } | { kind: "checkout"; item: StoreItem } | null;


const KEY = "design_e_playground_v2";
const PREFS = "design_e_prefs_v1";
const LEVELS = [...LEVEL_UNLOCKS.map((u) => u.level), LAST_UNLOCK_LEVEL + 2];
const SAMPLE: RoundSummary = {
  score: 260, daubs: 14, lines: 1, wrong: 1, accuracy: 0.88, seconds: 60, speed: "chill", seed: 1, bestStreak: 6,
  marked: Array.from({ length: 25 }, (_, i) => [0, 1, 6, 7, 12, 13, 18, 19, 20, 24, 3, 9, 15, 22, 11].includes(i)),
};
const EMPTY_TODAY = { rounds: 0, daubs: 0, lines: 0, done: [false, false, false], challenge: false, cardScore: -1, qv: [0, 0, 0] };

/** saved values may come from an older build or be edited by hand: take only what has the right shape */
const rec = (x: unknown): Record<string, unknown> => (x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {});
const num = (x: unknown): number => (typeof x === "number" && isFinite(x) ? x : 0);

const load = (): Saved => {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? "");
    if (typeof p.xp === "number") {
      return {
        ...DEFAULT, ...p,
        daily: { ...DEFAULT.daily, ...p.daily }, today: { ...DEFAULT.today, ...p.today, qv: Array.isArray(p.today?.qv) ? p.today.qv : [0, 0, 0] }, boosters: { ...DEFAULT.boosters, ...p.boosters },
        stats: { ...DEFAULT.stats, ...p.stats }, prompts: { ...DEFAULT.prompts, ...p.prompts },
        setClaimed: Array.isArray(p.setClaimed) ? p.setClaimed : DEFAULT.setClaimed, friends: Array.isArray(p.friends) ? p.friends : [],
        stars: Array.isArray(p.stars) ? p.stars.map((x: number | null) => x ?? 0) : [],
        owned: Array.isArray(p.owned) ? p.owned : DEFAULT.owned,
        box: { ...DEFAULT.box, ...rec(p.box) }, iap: { ...DEFAULT.iap, ...rec(p.iap) },
        inbox: Array.isArray(p.inbox) ? p.inbox.filter((n: unknown) => !!n && typeof n === "object" && typeof (n as { from?: unknown }).from === "string").map((n: Record<string, unknown>) => ({ id: num(n.id), from: String(n.from), mine: num(n.mine), theirs: num(n.theirs), speed: n.speed === "normal" || n.speed === "fast" ? n.speed : "chill", seed: num(n.seed), read: n.read === true })) : [],
        pending: Array.isArray(p.pending) ? p.pending.filter((n: unknown) => !!n && typeof n === "object" && typeof (n as { to?: unknown }).to === "string").map((n: Record<string, unknown>) => ({ id: num(n.id), to: String(n.to), seed: num(n.seed), score: num(n.score), speed: n.speed === "normal" || n.speed === "fast" ? n.speed : "chill" })) : [],
        h2h: Object.fromEntries(Object.entries(rec(p.h2h)).filter(([, v]) => !!v && typeof v === "object").map(([k, v]) => [k, { w: num((v as { w?: unknown }).w), l: num((v as { l?: unknown }).l) }])),
        tourn: p.tourn && typeof p.tourn === "object" ? { id: num(p.tourn.id), tries: num(p.tourn.tries), best: num(p.tourn.best), claimed: p.tourn.claimed === true } : null,
        lost: p.lost && typeof p.lost === "object" ? { streak: num(p.lost.streak), claimed: num(p.lost.claimed) } : null,
      };
    }
  } catch { /* first visit */ }
  return DEFAULT;
};
const loadPrefs = (): { mode: Mode; speed: Speed } => {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS) ?? "{}");
    return { mode: p.mode === "ghost" || p.mode === "person" ? p.mode : "practice", speed: p.speed === "normal" || p.speed === "fast" ? p.speed : "chill" };
  } catch { return { mode: "practice", speed: "chill" }; }
};
const incomingFromUrl = () => { try { return parseChallenge(new URLSearchParams(location.search).get("c")); } catch { return null; } };

/** Friends answer the challenges the player sent: each plays the same board and gets a score near the player's own. */
function resolvePending(n: Saved): { n: Saved; first?: Notice } {
  if (!n.pending.length) return { n };
  let nid = n.nid;
  const notes: Notice[] = [];
  const h2h = { ...n.h2h };
  for (const p of n.pending) {
    const theirs = Math.max(20, Math.round(p.score * (0.7 + Math.random() * 0.6)));
    notes.push({ id: nid++, from: p.to, mine: p.score, theirs, speed: p.speed, seed: p.seed, read: false });
    const r = h2h[p.to] ?? { w: 0, l: 0 };
    if (p.score > theirs) h2h[p.to] = { ...r, w: r.w + 1 };
    else if (theirs > p.score) h2h[p.to] = { ...r, l: r.l + 1 };
  }
  return { n: { ...n, pending: [], nid, h2h, inbox: [...[...notes].reverse(), ...n.inbox].slice(0, 10) }, first: notes[0] };
}

/** Dev-only page: the whole E design on one screen, playable without Supabase. Open /design.html while the dev server runs. */
export default function Playground() {
  const [s, setS] = useState<Saved>(load);
  const [screen, setScreen] = useState<Screen>(() => (incomingFromUrl() ? "challengeIn" : "lobby"));
  const [incoming, setIncoming] = useState<Challenge | null>(incomingFromUrl);
  const [speed, setSpeed] = useState<Speed>(() => loadPrefs().speed);
  const [mode, setMode] = useState<Mode>(() => loadPrefs().mode);
  const [gameKey, setGameKey] = useState(0);
  const [run, setRun] = useState<Run | null>(null);
  const [boost, setBoost] = useState<Boost | null>(null);
  const [res, setRes] = useState<Res | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [scale, setScale] = useState(1);
  // on a phone the page shows only the game; the tools (level picker, jump to a screen) open from a small button
  // wide screens get the desktop layout, narrower ones the phone layout; the tools can switch it
  const [view, setView] = useState<"desktop" | "phone">(() => (window.innerWidth >= 1000 ? "desktop" : "phone"));
  const pinned = useRef(false);
  const [tools, setTools] = useState(() => window.innerWidth >= 760 && window.innerWidth < 1000);
  useEffect(() => {
    const f = () => { if (!pinned.current) setView(window.innerWidth >= 1000 ? "desktop" : "phone"); };
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  const desk = view === "desktop";
  const chooseView = (v: "desktop" | "phone") => { pinned.current = true; setView(v); setTools(v === "phone"); };
  const [toast, say] = useToast();
  const [, redraw] = useState(0);
  const level = levelOf(s.xp);
  const avgXp = avgRoundXp(s);
  const storeOn = unlocked("boosters", level);
  const boxReady = unlocked("dailyRewards", level) && boxLeft(s) === 0;
  const unread = s.inbox.filter((n) => !n.read).length;
  // the bonus box fills while the player is away: redraw the moment it opens
  useEffect(() => {
    const ms = s.box.readyAt - nowMs(s.skew);
    if (ms <= 0) return;
    const id = setTimeout(() => redraw((n) => n + 1), Math.min(ms + 50, 2147483000));
    return () => clearTimeout(id);
  }, [s.box.readyAt, s.skew]);

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ } }, [s]);
  useEffect(() => { try { localStorage.setItem(PREFS, JSON.stringify({ mode, speed })); } catch { /* private mode */ } }, [mode, speed]);
  useEffect(() => {
    const fit = () => setScale(Math.max(0.5, Math.min(1, (window.innerHeight - (window.innerWidth < 760 ? 100 : 40)) / 844, (window.innerWidth - 20) / 390)));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  useEffect(() => { track("app_open", { level, ladder: LADDER }); return onTrack(() => redraw((n) => n + 1)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // the first time a guest is back in the lobby after 3 rounds, offer to save their progress (once)
  useEffect(() => {
    if (screen === "lobby" && !sheet && s.rounds >= 3 && s.linked === "guest" && !s.prompts.saveRounds) {
      setS((p) => ({ ...p, prompts: { ...p.prompts, saveRounds: true } }));
      setSheet({ kind: "save", reason: "rounds" });
      track("save_progress_shown", { reason: "rounds" });
    }
  }, [screen, sheet, s.rounds, s.linked, s.prompts.saveRounds]);

  // the speed the lobby really uses: a locked speed falls back to chill
  const eff: Speed = speed === "normal" && !unlocked("normalSpeed", level) ? "chill" : speed === "fast" && !unlocked("fastSpeed", level) ? "chill" : speed;

  // ---- the store (play money: nothing is charged) ----
  const openStore = (focus?: "coins" | "gems", reason?: string) => {
    setSheet({ kind: "store", focus, reason });
    track("store_opened", { reason: reason ? "shortfall" : "button", focus: focus ?? "any" });
  };
  /** the player wanted something and could not pay: say so and offer the way out (the store), never a silent grey button */
  const shortfall = (item: string, need: number, have: number, currency: "coins" | "gems") => {
    track("shop_shortfall", { item, need, have, currency, level });
    if (!storeOn || (currency === "gems" && level < GEM_LEVEL)) { say(`Not enough ${currency} yet. Play a round to earn more.`); return; }
    openStore(currency, `Not enough ${currency} for ${item}. You need ${need - have} more.`);
  };
  const startCheckout = (item: StoreItem) => { track("iap_checkout_started", { item: item.id, usd: item.usd }); setSheet({ kind: "checkout", item }); };
  const payCheckout = (item: StoreItem) => {
    setS((p) => {
      let n = give(p, item.reward);
      if (item.look && !n.owned.includes(item.look)) n = { ...n, owned: [...n.owned, item.look] };
      n = { ...n, iap: { count: n.iap.count + 1, usd: Math.round((n.iap.usd + item.usd) * 100) / 100, starter: n.iap.starter || item.kind === "starter" } };
      return item.kind === "pass" ? { ...n, pass: true } : n;
    });
    track("iap_completed", { item: item.id, usd: item.usd, first: s.iap.count === 0 });
    sfx("claim"); buzz(20);
    setSheet(null);
    say(item.kind === "pass" ? "Season pass is on. See Journey, Season." : `${item.name} added (test purchase, no money taken)`);
  };
  const cancelCheckout = (item: StoreItem) => { track("iap_cancelled", { item: item.id }); setSheet(item.kind === "pass" ? null : { kind: "store" }); };

  // ---- starting a round ----
  const begin = (r: Run, b: Boost | null) => {
    setS((p) => {
      let n = p;
      if (r.kind === "ghost") n = { ...n, coins: n.coins - (r.fee ?? 0), ghostPlays: n.ghostPlays + 1 };
      if (b) n = { ...n, boosters: { ...n.boosters, [b]: Math.max(0, n.boosters[b] - 1) } };
      return n;
    });
    track("round_start", { kind: r.kind, speed: r.speed, level, first: s.rounds === 0 });
    setRun(r);
    setBoost(b);
    setGameKey((k) => k + 1);
    setScreen("game");
  };
  const request = (r: Run) => {
    setRun(r);
    // the daily card is the same board for everyone, so no boosters there
    if (unlocked("boosters", level) && r.kind !== "challenge") setScreen("prep");
    else begin(r, null);
  };
  const playLobby = (m: Mode) => {
    if (m === "person") { startMatch(); return; }
    const ghost = m === "ghost";
    const fee = ghostFee(s, level);
    if (ghost && s.coins < fee) { shortfall("a Ghost race", fee, s.coins, "coins"); return; }
    request(ghost
      ? { kind: "ghost", speed: eff, label: "Beat the Ghost", fee, rival: { name: "The Ghost", target: rivalTarget(eff), person: false } }
      : { kind: "free", speed: eff, label: "Practice" });
  };
  const playCard = () => request({ kind: "challenge", speed: CARD.speed, label: "Daily card", seed: cardSeed(s.dayOffset), scored: s.today.cardScore < 0 });
  const startMatch = (name?: string) => {
    const nm = name ?? RIVAL_NAMES[Math.floor(Math.random() * RIVAL_NAMES.length)];
    setRun({ kind: "person", speed: eff, label: name ? `Duel with ${name}` : "Play a person", rival: { name: nm, target: rivalTarget(eff), person: true } });
    setScreen("match");
  };
  const again = () => {
    if (!run) return playLobby("practice");
    if (run.kind === "challenge") return request({ ...run, scored: s.today.cardScore < 0 });
    if (run.kind === "ghost") return playLobby("ghost");
    if (run.kind === "cup") return s.tourn && s.tourn.tries < CUP.tries ? begin(run, null) : home();
    if (run.kind === "person") return begin(run, null); // never boosters against a person
    return request(run);
  };

  // ---- a friend's challenge link ----
  const dropLink = () => { try { history.replaceState(null, "", location.pathname); } catch { /* not allowed here */ } };
  const acceptChallenge = () => {
    if (!incoming) return;
    track("challenge_opened", { score: incoming.score, level });
    begin({ kind: "person", speed: incoming.speed, label: `Challenge from ${incoming.name}`, seed: incoming.seed, welcome: !s.welcome, rival: { name: incoming.name, target: incoming.score, person: true } }, null);
    setIncoming(null);
    dropLink();
  };
  const declineChallenge = () => { setIncoming(null); dropLink(); setScreen("lobby"); };

  // ---- the end of a round ----
  const done = (r: RoundSummary) => {
    const firstToday = s.today.rounds === 0;
    const scoredCard = run?.kind === "challenge" && !!run.scored;
    const gain = xpFor(r.score, 1, 1, false) * (firstToday ? 2 : 1) + (scoredCard ? CARD.xp : 0);
    const prevXp = s.xp, newXp = s.xp + gain;
    const lvBefore = levelOf(prevXp), lvAfter = levelOf(newXp);
    const bonus: Bonus[] = [];
    let n: Saved = { ...s, xp: newXp, best: Math.max(s.best, r.score), rounds: s.rounds + 1, coins: s.coins + Math.round(r.score / 10) + (lvAfter - lvBefore) * 30 };

    if (r.rival && run) {
      // a match against a person keeps a running tally, so there is always a reason to play them again
      if (run.kind === "person") {
        const h = n.h2h[r.rival.name] ?? { w: 0, l: 0 };
        n = { ...n, h2h: { ...n.h2h, [r.rival.name]: r.rival.won ? { ...h, w: h.w + 1 } : { ...h, l: h.l + 1 } } };
      }
      const tally = run.kind === "person" ? h2hText(n.h2h, r.rival.name) : "";
      if (r.rival.won) {
        const w = run.kind === "person" ? 25 : (run.fee ?? 0) + 8;
        n = give(n, { coins: w });
        bonus.push({ title: `You beat ${r.rival.name}!`, text: `+${w} coins · ${r.score} to ${r.rival.target}${tally ? ` · ${tally}` : ""}`, tone: "G" });
      } else {
        bonus.push({ title: `${r.rival.name} won this time`, text: `${r.rival.target} to your ${r.score}. ${tally || "Try again."}`, tone: "I" });
      }
    }
    if (run?.welcome && !n.welcome) {
      n = give({ ...n, welcome: true }, WELCOME);
      bonus.push({ title: "Welcome gift!", text: rewardText(WELCOME, level), tone: "P" });
      track("welcome_gift", { coins: WELCOME.coins ?? 0 });
    }
    if (run?.kind === "cup" && n.tourn) {
      const t = { ...n.tourn, tries: n.tourn.tries + 1, best: Math.max(n.tourn.best, r.score) };
      n = { ...n, tourn: t };
      bonus.push({ title: `Cup try ${t.tries} of ${CUP.tries}`, text: `Best ${t.best} · place ${cupRank(t.best)} of ${CUP_BOTS.length + 1}${t.tries >= CUP.tries ? ". Claim your prize in Compete, Cup." : ""}`, tone: "O" });
      track("cup_try", { score: r.score, try: t.tries });
    }
    if (run?.kind === "journey" && run.stage !== undefined) {
      const stage = STAGES[run.stage];
      const st = stageStars(stage, { score: r.score, daubs: r.daubs, wrong: r.wrong, streak: r.bestStreak });
      const before = n.stars.reduce((a, b) => a + b, 0);
      const stars = Array.from({ length: STAGES.length }, (_, i) => n.stars[i] ?? 0);
      stars[run.stage] = Math.max(stars[run.stage], st);
      n = { ...n, stars };
      const after = stars.reduce((a, b) => a + b, 0);
      bonus.push({ title: `${stage.name}: ${"★".repeat(st)}${"☆".repeat(3 - st)}`, text: st ? "The next stage opens when you win a star." : `Goal: ${goalText(stage)}. Try again.`, tone: "O" });
      CHAPTER_NEED.forEach((need, c) => { if (c > 0 && before < need && after >= need) bonus.push({ title: `Chapter ${c + 1} unlocked!`, text: CHAPTERS[c], tone: "P" }); });
      if (st) track("stage_completed", { stage: run.stage + 1, stars: st });
    }
    if (run?.kind === "challenge") {
      if (scoredCard) {
        const extra = r.score >= CARD.bonusScore;
        n = give({ ...n, today: { ...n.today, challenge: true, cardScore: r.score } }, extra ? { coins: (CARD.reward.coins ?? 0) + (CARD.bonus.coins ?? 0) } : CARD.reward);
        bonus.push({ title: "Daily card done!", text: `+${(CARD.reward.coins ?? 0) + (extra ? CARD.bonus.coins ?? 0 : 0)} coins · +${CARD.xp} XP${extra ? "" : ` · ${CARD.bonusScore}+ for +${CARD.bonus.coins} more`}`, tone: "P" });
        track("daily_card_played", { score: r.score });
      } else {
        bonus.push({ title: "Practice replay", text: `Your scored try today was ${s.today.cardScore}. This one does not count.`, tone: "N" });
      }
    }
    if (unlocked("album", lvBefore)) {
      const pool = STAMPS.map((_, i) => i).filter((i) => !n.stamps.includes(i));
      if (pool.length) {
        const pick = pool[Math.floor(Math.random() * pool.length)];
        n = { ...n, stamps: [...n.stamps, pick] };
        bonus.push({ title: `New stamp: ${STAMPS[pick]}`, text: "See it in Collect, Album.", tone: "B" });
        track("stamp_won", { stamp: pick });
        const k = Math.floor(pick / 6);
        if (!n.setClaimed[k] && setDone(k, n.stamps)) {
          n = give({ ...n, setClaimed: n.setClaimed.map((c, i) => (i === k ? true : c)) }, SET_REWARD);
          bonus.push({ title: `${SET_NAMES[k]} complete!`, text: rewardText(SET_REWARD, 99), tone: "P" });
        }
      }
    }
    n = {
      ...n,
      today: { ...n.today, rounds: n.today.rounds + 1, daubs: n.today.daubs + r.daubs, lines: n.today.lines + r.lines },
      weekly: n.weekly + r.score,
      season: n.season + Math.round(r.score / 2),
      eventScore: n.eventScore + r.score,
      eventLines: n.eventLines + r.lines,
      crew: n.crew + r.daubs,
      friends: n.friends.map((f) => ({ ...f, pts: f.pts + 10 + Math.floor(Math.random() * 50) })),
      stats: { daubs: n.stats.daubs + r.daubs, lines: n.stats.lines + r.lines, wrong: n.stats.wrong + r.wrong, accSum: n.stats.accSum + r.accuracy, scoreSum: n.stats.scoreSum + r.score },
    };
    // friends answer the challenges sent before this round
    if (unlocked("friendDuels", lvAfter)) {
      const rs = resolvePending(n);
      n = rs.n;
      if (rs.first) {
        bonus.push({ title: `${rs.first.from} answered!`, text: `${rs.first.theirs} to your ${rs.first.mine}. See Compete, Friends.`, tone: "I" });
        track("challenge_answered", { from: rs.first.from, mine: rs.first.mine, theirs: rs.first.theirs });
      }
    }
    // the nearest targets, and one specific "so close" line, so the next round has a reason
    const goals = nextGoals(n, lvAfter);
    let nearMiss: string | undefined;
    if (r.rival && !r.rival.won && r.rival.target - r.score <= Math.max(25, r.rival.target * 0.15)) nearMiss = `Only ${r.rival.target - r.score + 1} points short of ${r.rival.name}!`;
    else if (run?.kind === "journey" && run.stage !== undefined) {
      const stg = STAGES[run.stage];
      const got = stageStars(stg, { score: r.score, daubs: r.daubs, wrong: r.wrong, streak: r.bestStreak });
      const need = stg.kind === "score" && got < 3 ? stg.need[got] - r.score : 0;
      if (need > 0 && need <= stg.need[got] * 0.25) nearMiss = `${need} more points for ${got === 0 ? "your first star" : `star ${got + 1}`}!`;
    } else if (s.best > 0 && r.score <= s.best && r.score >= s.best * 0.85) nearMiss = `${s.best - r.score + 1} points from a new best!`;
    track("round_end", { kind: run?.kind ?? "free", score: r.score, daubs: r.daubs, lines: r.lines, accuracy: Math.round(r.accuracy * 100), xp: gain, first_today: firstToday });
    if (lvAfter > lvBefore) {
      track("level_up", { level: lvAfter });
      LEVEL_UNLOCKS.filter((u) => u.level > lvBefore && u.level <= lvAfter).flatMap((u) => u.features).forEach((f) => track("feature_unlocked", { feature: f }));
      sfx("level");
      buzz([30, 40, 60]);
    }
    setRes({ r, prevXp, newXp, isBest: r.score > s.best, bonus, doubleXp: firstToday, run, goals, nearMiss });
    setS(n);
    setScreen("results");
  };

  // ---- sharing ----
  const shareResult = async () => {
    if (!res) return;
    const r = res.r;
    const card = res.run?.kind === "challenge";
    const link = challengeLink({ seed: r.seed, score: r.score, speed: r.speed, name: PLAYER.name });
    const text = card
      ? `Bingo Arena daily card · ${dayLabel(s.dayOffset)}\n${r.score} points · ${r.daubs} marked\n${cardGrid(r.marked)}\nBeat me: ${link}`
      : `I scored ${r.score} on Bingo Arena. Beat me on the same board:\n${link}`;
    track(card ? "share_tapped" : "challenge_created", { score: r.score });
    const how = await shareText(text);
    // a friend will answer the challenge after the next round (the real game does this with a push notice)
    if (!card && how !== "failed" && unlocked("friendDuels", level)) {
      setS((p) => {
        const pool = p.friends.length ? p.friends.map((f) => f.name) : FRIEND_POOL;
        return { ...p, nid: p.nid + 1, pending: [...p.pending, { id: p.nid, to: pool[Math.floor(Math.random() * pool.length)], seed: r.seed, score: r.score, speed: r.speed }].slice(-3) };
      });
    }
    say(how === "copied" ? "Copied. Paste it in WhatsApp." : how === "shared" ? "Shared" : "Could not share. Try again.");
  };

  // ---- rewards, streak and shop ----
  const claimDaily = () => {
    if (!s.daily.ready) return;
    const day = s.daily.claimed % 7;
    const streak = s.streak + 1;
    const askSave = s.daily.claimed === 1 && s.linked === "guest" && !s.prompts.saveStreak;
    const askNotify = !askSave && s.daily.claimed === 1 && !s.prompts.notify;
    setS((p) => give({
      ...p, daily: { claimed: p.daily.claimed + 1, ready: false }, streak: p.streak + 1, note: "", lost: null,
      prompts: { ...p.prompts, saveStreak: p.prompts.saveStreak || askSave, notify: p.prompts.notify || askNotify },
    }, DAILY[day]));
    sfx("claim"); buzz(20);
    track("daily_reward_claimed", { day: day + 1 });
    track("streak_changed", { streak });
    if (askSave) { setSheet({ kind: "save", reason: "streak" }); track("save_progress_shown", { reason: "streak" }); }
    else if (askNotify) { setSheet({ kind: "notify" }); track("notification_prompt_shown", { reason: "streak" }); }
  };
  /** playground only: jump to the next day */
  const nextDay = () => setS((p) => {
    const missed = p.daily.ready; // yesterday's reward was never claimed
    let n: Saved = { ...p, dayOffset: p.dayOffset + 1, daily: { ...p.daily, ready: true }, today: { ...EMPTY_TODAY, done: [false, false, false], qv: [0, 0, 0] }, note: "", lost: null };
    if (missed && p.streak > 0) {
      if (p.freezes > 0) n = { ...n, freezes: p.freezes - 1, note: "A streak freeze saved your streak yesterday." };
      else {
        const canRepair = p.streak >= REPAIR_MIN;
        n = { ...n, streak: 0, daily: { claimed: 0, ready: true }, lost: canRepair ? { streak: p.streak, claimed: p.daily.claimed } : null,
          note: `You missed a day, so your ${p.streak}-day streak ended.${canRepair ? " You can bring it back below." : ""} A new one starts today.` };
      }
    }
    return n;
  });
  const buyFreeze = () => {
    if (s.freezes >= freezeMax(s)) return;
    if (s.coins < FREEZE_PRICE) { shortfall("a streak freeze", FREEZE_PRICE, s.coins, "coins"); return; }
    setS((p) => ({ ...p, coins: p.coins - FREEZE_PRICE, freezes: p.freezes + 1 }));
    sfx("claim");
    track("shop_purchase", { item: "streak_freeze" });
  };
  /** bring back a streak that broke yesterday (a coin sink for the early game, a gem sink later) */
  const repairStreak = (pay: "coins" | "gems") => {
    const lost = s.lost;
    if (!lost || !s.daily.ready || lost.streak < REPAIR_MIN) return;
    const price = pay === "gems" ? REPAIR_GEMS : REPAIR_COINS, have = pay === "gems" ? s.gems : s.coins;
    if (have < price) { shortfall("a streak repair", price, have, pay); return; }
    setS((p) => ({
      ...p, coins: pay === "coins" ? p.coins - price : p.coins, gems: pay === "gems" ? p.gems - price : p.gems,
      streak: lost.streak, daily: { claimed: lost.claimed, ready: true }, lost: null, note: `Your ${lost.streak}-day streak is back. Claim today to keep it going.`,
    }));
    sfx("claim"); buzz(20);
    track("streak_repaired", { streak: lost.streak, pay });
  };
  const claimQuest = (i: number) => {
    const q = questOf(i, s.today.qv[i] ?? 0);
    if (s.today.done[i] || s.today[q.key] < q.goal) return;
    setS((p) => give({ ...p, today: { ...p.today, done: p.today.done.map((d, k) => (k === i ? true : d)) } }, q.reward));
    sfx("claim"); track("quest_claimed", { quest: i + 1 });
  };
  /** swap an unfinished quest for another version of the same slot */
  const rerollQuest = (i: number) => {
    const q = questOf(i, s.today.qv[i] ?? 0);
    if (s.today.done[i] || s.today[q.key] >= q.goal) return;
    if (s.coins < REROLL_PRICE) { shortfall("a new quest", REROLL_PRICE, s.coins, "coins"); return; }
    setS((p) => ({ ...p, coins: p.coins - REROLL_PRICE, today: { ...p.today, qv: p.today.qv.map((v, k) => (k === i ? v + 1 : v)) } }));
    track("quest_rerolled", { slot: i + 1 });
    say("New quest. It stays for today.");
  };
  // ---- the free bonus box: fills over a few hours, comes in a fixed order ----
  const openBox = (early = false) => {
    if (!early && boxLeft(s) > 0) return;
    const rw = boxReward(s.box.n);
    setS((p) => give({ ...p, gems: early ? p.gems - BOX_SKIP_GEMS : p.gems, box: { readyAt: nowMs(p.skew) + BOX_MS, n: p.box.n + 1 } }, rw));
    sfx("claim"); buzz(20);
    track("box_opened", { n: s.box.n + 1, early });
    say(`Box opened: ${rewardText(rw, level)}`);
  };
  const skipBox = () => {
    if (s.gems < BOX_SKIP_GEMS) { shortfall("opening the box now", BOX_SKIP_GEMS, s.gems, "gems"); return; }
    openBox(true);
  };
  // ---- the weekend cup: pay coins, play three tries on one board, win gems ----
  const cupNow = s.tourn && s.tourn.id === cupId(s.dayOffset) ? s.tourn : null;
  const enterCup = () => {
    if (cupNow) return;
    if (s.coins < CUP.entry) { shortfall("the cup entry", CUP.entry, s.coins, "coins"); return; }
    setS((p) => ({ ...p, coins: p.coins - CUP.entry, tourn: { id: cupId(p.dayOffset), tries: 0, best: 0, claimed: false } }));
    sfx("claim"); track("cup_entered", { cost: CUP.entry });
  };
  const playCup = () => { if (cupNow && cupNow.tries < CUP.tries) begin({ kind: "cup", speed: CUP.speed, label: "Weekend Cup", seed: cupSeed(cupNow.id) }, null); };
  const claimCup = () => {
    if (!cupNow || cupNow.tries < CUP.tries || cupNow.claimed) return;
    const rank = cupRank(cupNow.best), rw = cupPrize(rank);
    setS((p) => give({ ...p, tourn: p.tourn ? { ...p.tourn, claimed: true } : p.tourn }, rw));
    sfx("claim"); track("cup_claimed", { rank });
    say(`Place ${rank}: ${rewardText(rw, level)}`);
  };
  // ---- the season pass ----
  const claimPass = () => {
    const reached = Math.min(SEASON_TIERS, Math.floor(s.season / SEASON_XP));
    if (!s.pass || reached <= s.passClaimed) return;
    setS((p) => {
      let n = p;
      for (let t = p.passClaimed + 1; t <= reached; t++) {
        const rw = passReward(t);
        n = give(n, rw);
        if (rw.look && !n.owned.includes(rw.look)) n = { ...n, owned: [...n.owned, rw.look] };
      }
      return { ...n, passClaimed: reached };
    });
    sfx("claim"); buzz(20);
    track("pass_claimed", { upto: reached });
    say(`${reached - s.passClaimed} gold ${reached - s.passClaimed === 1 ? "reward" : "rewards"} claimed`);
  };
  const buyBooster = (b: Boost, pay: "coins" | "gems" = "coins") => {
    const item = BOOSTERS.find((x) => x.id === b);
    if (!item) return;
    const price = pay === "gems" ? item.gems : item.price;
    const have = pay === "gems" ? s.gems : s.coins;
    if (have < price) { shortfall(item.name, price, have, pay); return; }
    // the first booster a player buys is the right moment to show the one-time starter pack (once)
    const offer = storeOn && !s.prompts.starter && !s.iap.starter;
    setS((p) => ({ ...p, coins: pay === "coins" ? p.coins - price : p.coins, gems: pay === "gems" ? p.gems - price : p.gems, boosters: { ...p.boosters, [b]: p.boosters[b] + 1 }, prompts: { ...p.prompts, starter: p.prompts.starter || offer } }));
    track("shop_purchase", { item: b, pay });
    if (offer) { setSheet({ kind: "store", reason: `${item.name} added. A starter pack gives you more for the first rounds.` }); track("store_opened", { reason: "starter_offer", focus: "any" }); }
    else say(`${item.name} added. You paid ${price} ${pay}.`);
  };
  const buyLook = (id: string) => {
    const look = LOOKS.find((x) => x.id === id);
    const price = look?.price ?? 0;
    if (s.owned.includes(id) || look?.only) return;
    if (s.gems < price) { shortfall(`${look?.name ?? "this"} look`, price, s.gems, "gems"); return; }
    setS((p) => ({ ...p, gems: p.gems - price, owned: [...p.owned, id], look: id }));
    track("shop_purchase", { item: id });
  };
  const equip = (id: string) => setS((p) => (p.owned.includes(id) ? { ...p, look: id } : p));
  const claimTier = () => {
    const reached = Math.min(SEASON_TIERS, Math.floor(s.season / SEASON_XP));
    if (s.seasonClaimed >= reached) return;
    setS((p) => give({ ...p, seasonClaimed: p.seasonClaimed + 1 }, seasonReward(p.seasonClaimed + 1)));
    sfx("claim"); track("season_tier_claimed", { tier: s.seasonClaimed + 1 });
  };
  const claimEvent = (i: number) => {
    const have = i === 0 ? s.eventScore : s.eventLines;
    if (s.eventClaimed[i] || have < EVENTS[i].goal) return;
    setS((p) => give({ ...p, eventClaimed: p.eventClaimed.map((c, k) => (k === i ? true : c)) }, EVENTS[i].reward));
    sfx("claim");
  };

  // ---- accounts and reminders (the real game saves to an account; here it only changes a flag) ----
  const pickSave = (p: Linked) => {
    setS((x) => ({ ...x, linked: p }));
    setSheet(null);
    track("save_progress_completed", { provider: p });
    say(`Saved with ${p[0].toUpperCase() + p.slice(1)} (playground: no real sign-in)`);
  };
  const closeSave = () => { setSheet(null); track("save_progress_dismissed"); };
  const answerNotify = (yes: boolean) => {
    setSheet(null);
    if (!yes) { track("notification_prompt_result", { result: "later" }); return; }
    try {
      if ("Notification" in window) void Notification.requestPermission().then((result) => track("notification_prompt_result", { result }));
      else track("notification_prompt_result", { result: "unsupported" });
    } catch { track("notification_prompt_result", { result: "error" }); }
    say("Reminders on (playground: none are sent)");
  };

  // ---- navigation ----
  const go = (d: string) => {
    const gate = d !== "play" && d in TAB_FEATURE ? TAB_FEATURE[d as Tab] : null;
    if (gate && !unlocked(gate, level)) { setSheet({ kind: "lock", feature: gate }); track("lock_sheet_shown", { feature: gate }); return; }
    if (d === "play") setScreen("lobby");
    else if (d === "match") startMatch();
    else if (["journey", "collect", "compete", "shop", "daily", "profile"].includes(d)) {
      setScreen(d as Screen);
      if (d === "compete" && !s.prompts.league) {
        const askNotify = !s.prompts.notify;
        const askSave = !askNotify && s.linked === "guest" && !s.prompts.saveLeague;
        setS((p) => ({ ...p, prompts: { ...p.prompts, league: true, notify: p.prompts.notify || askNotify, saveLeague: p.prompts.saveLeague || askSave } }));
        track("league_joined");
        if (askNotify) { setSheet({ kind: "notify" }); track("notification_prompt_shown", { reason: "league" }); }
        else if (askSave) { setSheet({ kind: "save", reason: "league" }); track("save_progress_shown", { reason: "league" }); }
      }
    }
  };
  const nav = (t: Tab | "daily") => go(t);
  const home = () => setScreen("lobby");

  // ---- playground tools ----
  const setLevel = (l: number) => {
    setS({ ...s, xp: xpForLevel(l), coins: Math.max(s.coins, 100 + l * 20), gems: l >= 6 ? Math.max(s.gems, 15) : s.gems, season: l >= 4 ? Math.max(s.season, 450) : s.season });
    setSheet(null);
    setScreen("lobby");
  };
  const reset = () => { setS(DEFAULT); setSpeed("chill"); setMode("practice"); setRes(null); setSheet(null); setScreen("lobby"); };
  /** a friend joins through the invite link, then moves one step down the invite reward ladder per press */
  const simFriend = () => {
    const p = s;
    const idx = p.friends.findIndex((f) => f.step < INVITE_STEPS.length);
    if (idx < 0) {
      const name = FRIEND_POOL.find((nm) => !p.friends.some((f) => f.name === nm));
      if (!name) { say("All sample friends are at the top step."); return; }
      setS({ ...p, friends: [...p.friends, { name, step: 0, pts: 0 }] });
      track("invite_friend_joined", { name });
      say(`${name} joined with your code`);
      return;
    }
    const f = p.friends[idx];
    const step = INVITE_STEPS[f.step];
    setS(give({ ...p, friends: p.friends.map((x, i) => (i === idx ? { ...x, step: x.step + 1 } : x)) }, step.reward));
    say(`${f.name}: ${step.text.toLowerCase()}. ${rewardText(step.reward, 99)}`);
  };
  const sampleChallenge = () => {
    setIncoming({ seed: cardSeed(s.dayOffset) + 7, score: 210, speed: "normal", name: "Noam" });
    setScreen("challengeIn");
  };

  const sample = { r: SAMPLE, prevXp: xpForLevel(level) + 5, newXp: xpForLevel(level) + 60, isBest: true, bonus: [] as Bonus[], doubleXp: false, run: null as Run | null, goals: [] as Goal[], nearMiss: undefined as string | undefined };
  const shown = res ?? sample;
  /** after a match against a person: play them again on a fresh board */
  const rematch = res && res.run?.kind === "person" && res.run.rival
    ? { name: res.run.rival.name, onRematch: () => { const nm = res.run?.rival?.name ?? ""; track("rematch_started", { vs: nm, via: "results" }); startMatch(nm); } }
    : undefined;
  const lvl = levelOf(shown.newXp);
  const look = LOOKS.find((l) => l.id === s.look) ?? LOOKS[0];
  const jump = (label: string, to: Screen) => <button key={to} aria-pressed={screen === to} onClick={() => setScreen(to)}>{label}</button>;
  const events = readEvents().slice(-8).reverse();
  const stageRun = (i: number) => request({ kind: "journey", stage: i, speed: STAGES[i].speed, label: `Stage ${i + 1}: ${STAGES[i].name}` });

  const toolsEl = <aside className="pg-side">
        <h1>Design E playground</h1>
        <div>
          <h2>View</h2>
          <div className="pg-grid pg-3">
            <button aria-pressed={desk} onClick={() => chooseView("desktop")}>Desktop</button>
            <button aria-pressed={!desk} onClick={() => chooseView("phone")}>Phone</button>
          </div>
        </div>
        <p>Bingo Night, playable on this computer. No account and no Supabase keys needed. Rounds are scored by the real game engine on this device and nothing is saved on a server.</p>
        <div>
          <h2>Unlock ladder</h2>
          <div className="pg-grid pg-3">
            <button aria-pressed={LADDER === "retention"} onClick={() => LADDER !== "retention" && setLadder("retention")}>Retention</button>
            <button aria-pressed={LADDER === "original"} onClick={() => LADDER !== "original" && setLadder("original")}>Original</button>
          </div>
          <p style={{ marginTop: 6 }}>Retention opens rewards, a streak and quests at level 2, the season at 4 and the league at 5. Original is the first draft. The page reloads when you switch.</p>
        </div>
        <div>
          <h2>Player level (now {level}, {s.xp} XP)</h2>
          <div className="pg-grid">
            {LEVELS.map((l) => <button key={l} aria-pressed={level === l} onClick={() => setLevel(l)}>{l}</button>)}
          </div>
          <p style={{ marginTop: 6 }}>Pick a level to see the lobby, the bottom bar and the locked cards at that level. Play a round to earn XP the real way.</p>
        </div>
        <div>
          <h2>Jump to a screen</h2>
          <div className="pg-grid pg-3">
            {jump("Lobby", "lobby")}
            <button aria-pressed={screen === "game"} onClick={() => playLobby("practice")}>Play a round</button>
            <button aria-pressed={screen === "results"} onClick={() => { setRes(null); setScreen("results"); }}>Results (sample)</button>
            <button aria-pressed={screen === "levelup"} onClick={() => { setRes({ ...sample, newXp: xpForLevel(Math.min(LAST_UNLOCK_LEVEL, level + 1)), prevXp: xpForLevel(level) }); setScreen("levelup"); }}>Level up (sample)</button>
            {jump("Level path", "path")}
            {jump("Daily rewards", "daily")}
            {jump("Journey", "journey")}
            {jump("Collect", "collect")}
            {jump("Compete", "compete")}
            {jump("Shop", "shop")}
            {jump("Profile", "profile")}
          </div>
        </div>
        <div>
          <h2>Make things happen</h2>
          <div className="pg-grid pg-3">
            <button onClick={nextDay}>Next day</button>
            <button onClick={simFriend}>Friend joins / moves up</button>
            <button onClick={sampleChallenge}>Open a friend's challenge</button>
            <button onClick={reset}>Reset to level 1</button>
            <button onClick={() => { setS((p) => ({ ...p, skew: p.skew + 4 * 3600000 })); say("Clock moved 4 hours ahead"); }}>Skip 4 hours</button>
            <button onClick={() => {
              if (!s.pending.length && !s.inbox.length) setS((p) => ({ ...p, pending: [{ id: p.nid, to: "Noam", seed: cardSeed(p.dayOffset) + 3, score: Math.max(120, p.best), speed: "normal" }] }));
              setS((p) => { const rs = resolvePending(p); return rs.n; });
              say("Friends answered your challenges");
            }}>Friends answer now</button>
            <button onClick={() => { setS((p) => ({ ...p, streak: 7, daily: { claimed: 7, ready: true }, freezes: 0, lost: null })); say("Streak set to 7. Press Next day without claiming to break it."); }}>Give a 7-day streak</button>
            <button onClick={() => openStore()}>Open the store</button>
          </div>
          <p style={{ marginTop: 6 }}>Skip 4 hours moves the clock for the bonus box. Friends answer now: a friend replies to a challenge you sent (they also reply after your next round). Next day: skips today's unclaimed reward (a streak freeze is used up, or the streak ends) and gives a new daily card.</p>
        </div>
        <div>
          <h2>Event log (what to send to analytics)</h2>
          <div className="pg-log" aria-live="off">
            {events.length === 0 ? <span>Nothing yet. Play a round.</span> : events.map((e, i) => (
              <span key={`${i}${e.t}${e.name}`}><b>{e.name}</b> {Object.entries(e.props).map(([k, v]) => `${k}=${v}`).join(" ")}</span>
            ))}
          </div>
          <div className="pg-grid pg-3" style={{ marginTop: 6 }}>
            <button onClick={async () => say((await shareText(JSON.stringify(readEvents()))) === "failed" ? "Could not copy" : "Event log copied")}>Copy as JSON</button>
            <button onClick={clearEvents}>Clear</button>
          </div>
        </div>
        <p>Level 1 is a 60 second round with hints and no combo. From level 3 combos are on. Ghost, a person and duels play against a made-up score on this device. Screens you jump to ahead of your level show their locks.</p>
      </aside>;
  const screensEl = (
    <>
          {screen === "lobby" && <Lobby level={level} xp={s.xp} coins={s.coins} rounds={s.rounds} speed={speed} onSpeed={setSpeed} mode={mode} onMode={setMode} onPlay={playLobby} onLocked={(f) => { setSheet({ kind: "lock", feature: f }); track("lock_sheet_shown", { feature: f }); }} onPath={() => setScreen("path")}
            onProfile={() => setScreen("profile")} onGo={go} daily={{ day: s.daily.claimed % 7, ready: s.daily.ready, box: boxReady }} streak={s.streak} cardScore={s.today.cardScore}
            firstToday={s.today.rounds === 0} ghostFee={ghostFee(s, level)} ghostFreeLeft={Math.max(0, GHOST_FREE - s.ghostPlays)} avgXp={avgXp} />}
          {screen === "prep" && run && <Prep level={level} s={s} run={run} fee={run.kind === "ghost" ? run.fee ?? 0 : 0} onStart={(b) => begin(run, b)} onBuy={buyBooster} onBack={home} />}
          {screen === "match" && run && <Matching key={gameKey + run.label} run={run} onStart={() => begin(run, null)} onCancel={home} />}
          {screen === "challengeIn" && incoming && <ChallengeIn c={incoming} welcome={!s.welcome} onAccept={acceptChallenge} onDecline={declineChallenge} />}
          {screen === "game" && run && <Game key={gameKey} level={level} speed={run.speed} firstRound={s.rounds === 0 && run.kind === "free"} rival={run.rival} boost={boost} dab={look.c} seed={run.seed} onDone={done} onLeave={home} />}
          {screen === "results" && <Results r={shown.r} prevXp={shown.prevXp} newXp={shown.newXp} best={s.best} isBest={shown.isBest} bonus={shown.bonus} doubleXp={shown.doubleXp}
            shareLabel={shown.run?.kind === "challenge" ? "Share result" : "Challenge a friend"} onShare={res && unlocked("dailyChallenge", level) ? shareResult : undefined}
            goals={shown.goals} nearMiss={shown.nearMiss} rematch={rematch} onContinue={() => setScreen("levelup")} onAgain={again} onHome={home} />}
          {screen === "levelup" && <LevelUp level={res ? lvl : Math.min(LAST_UNLOCK_LEVEL, level)} prevLevel={res ? levelOf(res.prevXp) : Math.max(1, level - 1)} xp={res ? res.newXp : s.xp} avgXp={avgXp}
            onAgain={again} onHome={home} onGo={go} />}
          {screen === "path" && <Roadmap level={level} xp={s.xp} avgXp={avgXp} onBack={home} />}
          {screen === "daily" && <DailyRewards level={level} s={s} onClaim={claimDaily} onFreeze={buyFreeze} onBack={home} onNav={nav} onBox={() => openBox()} onSkipBox={skipBox} onRepair={repairStreak} />}
          {screen === "journey" && <Journey level={level} s={s} onNav={nav} onPlayStage={stageRun} onClaimTier={claimTier} onClaimEvent={claimEvent} onBuyPass={() => startCheckout(PASS)} onClaimPass={claimPass} />}
          {screen === "collect" && <Collect level={level} s={s} onNav={nav} onClaimQuest={claimQuest} onReroll={rerollQuest} onPlayChallenge={playCard} />}
          {screen === "compete" && <Compete level={level} s={s} onNav={nav} onMatch={() => startMatch()}
            onDuel={(name, via) => { track(via === "inbox" ? "rematch_started" : "duel_started", { vs: name, via: via ?? "friends" }); startMatch(name); }}
            onSeeInbox={() => { setS((p) => ({ ...p, inbox: p.inbox.map((n) => ({ ...n, read: true })) })); track("inbox_opened", { unread }); }}
            onCupEnter={enterCup} onCupPlay={playCup} onCupClaim={claimCup} />}
          {screen === "shop" && <Shop level={level} s={s} onNav={nav} onBuyBooster={buyBooster} onBuyLook={buyLook} onEquip={equip} onStore={() => openStore()} />}
          {screen === "profile" && <Profile level={level} s={s} onNav={nav} onBack={home} onSave={() => { setSheet({ kind: "save", reason: "rounds" }); track("save_progress_shown", { reason: "profile" }); }} onDelete={() => { reset(); clearEvents(); }} />}
    </>
  );
  const sheetsEl = (
    <>
          {sheet?.kind === "lock" && <LockSheet feature={sheet.feature} xp={s.xp} avgXp={avgXp} onPlay={() => { setSheet(null); playLobby("practice"); }} onClose={() => setSheet(null)} />}
          {sheet?.kind === "save" && <SaveSheet reason={sheet.reason} coins={s.coins} level={level} streak={s.streak} onPick={pickSave} onClose={closeSave} />}
          {sheet?.kind === "notify" && <NotifySheet onYes={() => answerNotify(true)} onNo={() => answerNotify(false)} />}
          {sheet?.kind === "store" && <StoreSheet focus={sheet.focus} reason={sheet.reason} level={level} starterBought={s.iap.starter} onPick={startCheckout} onClose={() => setSheet(null)} />}
          {sheet?.kind === "checkout" && <CheckoutSheet item={sheet.item} level={level} onPay={() => payCheckout(sheet.item)} onCancel={() => cancelCheckout(sheet.item)} />}
    </>
  );
  const toastEl = toast ? <div className="e-toast" role="status" style={{ zIndex: 60 }}>{toast}</div> : null;

  // the daily reward button shows in the top bar of the main screens (the Play screen has its own tile)
  const dailyInfo: DailyInfo = { on: unlocked("dailyRewards", level) && ["journey", "collect", "compete", "shop", "profile"].includes(screen), unlocked: unlocked("dailyRewards", level), ready: s.daily.ready, day: s.daily.claimed % 7, streak: s.streak, open: () => go("daily"),
    box: boxReady, any: unlocked("dailyRewards", level) && (s.daily.ready || boxReady), unread: unlocked("friendDuels", level) ? unread : 0,
    store: storeOn ? (focus) => openStore(focus) : null, gemsOn: level >= GEM_LEVEL };

  // ---- the desktop layout ----
  if (desk) {
    const deskTab: Tab | null = screen === "journey" ? "journey" : screen === "collect" ? "collect" : screen === "compete" ? "compete" : screen === "shop" ? "shop" : screen === "profile" ? null : "play";
    const deskTitle = ({ prep: "Get ready", match: "Finding a player", challengeIn: "Challenge", levelup: "Level up", path: "Level path", daily: "Daily rewards", profile: "You" } as Record<string, string>)[screen];
    const deskBack = screen === "prep" || screen === "path" || screen === "daily" || screen === "profile";
    return (
      <DailyCtx.Provider value={dailyInfo}>
      <div className="pg pg-desk">
        {screen === "game" && run ? (
          <Game key={gameKey} wide label={run.label} level={level} speed={run.speed} firstRound={s.rounds === 0 && run.kind === "free"} rival={run.rival} boost={boost} dab={look.c} seed={run.seed} onDone={done} onLeave={home} />
        ) : (
          <DeskShell level={level} xp={s.xp} coins={s.coins} gems={s.gems} tab={deskTab} title={deskTitle} onBack={deskBack ? home : undefined} onNav={(t) => go(t)} onProfile={() => go("profile")} onPath={() => setScreen("path")} onTools={() => setTools(!tools)} toolsOpen={tools}>
            {screen === "lobby" ? (
              <DeskLobby level={level} xp={s.xp} coins={s.coins} rounds={s.rounds} speed={speed} onSpeed={setSpeed} mode={mode} onMode={setMode} onPlay={playLobby}
                onLocked={(f) => { setSheet({ kind: "lock", feature: f }); track("lock_sheet_shown", { feature: f }); }} onPath={() => setScreen("path")} onGo={go}
                daily={{ day: s.daily.claimed % 7, ready: s.daily.ready, box: boxReady }} streak={s.streak} cardScore={s.today.cardScore} firstToday={s.today.rounds === 0}
                ghostFee={ghostFee(s, level)} ghostFreeLeft={Math.max(0, GHOST_FREE - s.ghostPlays)} avgXp={avgXp} />
            ) : screen === "results" ? (
              <Results wide r={shown.r} prevXp={shown.prevXp} newXp={shown.newXp} best={s.best} isBest={shown.isBest} bonus={shown.bonus} doubleXp={shown.doubleXp}
                shareLabel={shown.run?.kind === "challenge" ? "Share result" : "Challenge a friend"} onShare={res && unlocked("dailyChallenge", level) ? shareResult : undefined}
                goals={shown.goals} nearMiss={shown.nearMiss} rematch={rematch} onContinue={() => setScreen("levelup")} onAgain={again} onHome={home} />
            ) : (
              screensEl
            )}
          </DeskShell>
        )}
        {tools && <div className="pg-drawer">{toolsEl}</div>}
        <div className="deskmodal">{sheetsEl}</div>
        {toast && <div className="e-toast e-toast-desk" role="status">{toast}</div>}
      </div>
      </DailyCtx.Provider>
    );
  }

  // ---- the phone layout ----
  return (
    <DailyCtx.Provider value={dailyInfo}>
    <div className="pg">
      <button className="pg-toggle" aria-expanded={tools} onClick={() => setTools(!tools)}>{tools ? "Hide tools" : "Tools: change level, jump to a screen"}</button>
      {tools && toolsEl}
      <div className="pg-stage" style={{ width: 390 * scale, height: 844 * scale }}>
        <div style={{ transform: `scale(${scale})`, width: 390, height: 844 }}>
          {screensEl}
          {sheetsEl}
          {toastEl}
        </div>
      </div>
    </div>
    </DailyCtx.Provider>
  );
}
