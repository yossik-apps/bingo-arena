// Playground data: what a player owns, and the content of every screen. Nothing here touches a server.
// Every number a designer may want to tune (rewards, prices, goals, timings) lives in this file.
import type { Tone } from "./Ball";
import type { IconName } from "./Icon";
import type { Speed } from "./Lobby";
import { featureLevel, unlocked, type Feature } from "../lib/levels";

export type Boost = "hint" | "slow" | "x2";
export type Reward = { coins?: number; gems?: number; boosters?: Partial<Record<Boost, number>> };
export type RunKind = "free" | "ghost" | "person" | "journey" | "challenge" | "cup";
export type Run = {
  kind: RunKind; speed: Speed; label: string; stage?: number;
  rival?: { name: string; target: number; person: boolean };
  /** a fixed board (daily card, friend challenge). Without it every round gets a fresh random board. */
  seed?: number;
  /** daily card only: is this the one scored try of the day? */
  scored?: boolean;
  /** ghost only: the coins paid to start (0 while the free races last) */
  fee?: number;
  /** a friend's link: the first one pays the welcome gift when the round ends */
  welcome?: boolean;
};
export type Bonus = { title: string; text: string; tone: Tone };
export type Linked = "guest" | "google" | "apple" | "email";
export type FriendState = { name: string; step: number; pts: number };
/** "Ben answered your challenge": a friend played the board you sent. */
export type Notice = { id: number; from: string; mine: number; theirs: number; speed: Speed; seed: number; read: boolean };
/** A challenge you sent that nobody has answered yet. */
export type Pending = { id: number; to: string; seed: number; score: number; speed: Speed };
export type Tourn = { id: number; tries: number; best: number; claimed: boolean };

export type Saved = {
  xp: number; best: number; coins: number; rounds: number; gems: number;
  daily: { claimed: number; ready: boolean };
  /** days in a row. A missed day keeps it only if a streak freeze was held. */
  streak: number; freezes: number;
  /** playground only: how many "next day" jumps were made, so the daily card changes board */
  dayOffset: number;
  /** one line that explains what happened to the streak overnight */
  note: string;
  today: { rounds: number; daubs: number; lines: number; done: boolean[]; challenge: boolean; cardScore: number; qv: number[] };
  stamps: number[]; stars: number[]; setClaimed: boolean[];
  boosters: Record<Boost, number>; owned: string[]; look: string;
  weekly: number; season: number; seasonClaimed: number;
  eventScore: number; eventLines: number; eventClaimed: boolean[];
  crew: number; friends: FriendState[];
  ghostPlays: number;
  linked: Linked;
  prompts: { saveRounds: boolean; saveStreak: boolean; saveLeague: boolean; notify: boolean; league: boolean; starter: boolean };
  stats: { daubs: number; lines: number; wrong: number; accSum: number; scoreSum: number };
  /** playground only: milliseconds skipped on the clock, so timers can be tested without waiting */
  skew: number;
  /** the free bonus box: when it opens next and how many were opened (the reward cycles) */
  box: { readyAt: number; n: number };
  inbox: Notice[]; pending: Pending[]; nid: number;
  /** head to head per friend: wins and losses of the player */
  h2h: Record<string, { w: number; l: number }>;
  /** the welcome bundle for opening a friend's link was paid */
  welcome: boolean;
  /** play money: how many purchases, how much (US dollars), and whether the one-time starter pack was bought */
  iap: { count: number; usd: number; starter: boolean };
  pass: boolean; passClaimed: number;
  tourn: Tourn | null;
  /** a streak that just broke and can still be repaired */
  lost: { streak: number; claimed: number } | null;
};

export const DEFAULT: Saved = {
  xp: 0, best: 0, coins: 100, rounds: 0, gems: 0,
  daily: { claimed: 0, ready: true },
  streak: 0, freezes: 0, dayOffset: 0, note: "",
  today: { rounds: 0, daubs: 0, lines: 0, done: [false, false, false], challenge: false, cardScore: -1, qv: [0, 0, 0] },
  stamps: [], stars: [], setClaimed: [false, false, false, false],
  boosters: { hint: 2, slow: 2, x2: 2 }, owned: ["bubblegum"], look: "bubblegum",
  weekly: 0, season: 0, seasonClaimed: 0,
  eventScore: 0, eventLines: 0, eventClaimed: [false, false],
  crew: 0, friends: [],
  ghostPlays: 0,
  linked: "guest",
  prompts: { saveRounds: false, saveStreak: false, saveLeague: false, notify: false, league: false, starter: false },
  stats: { daubs: 0, lines: 0, wrong: 0, accSum: 0, scoreSum: 0 },
  skew: 0, box: { readyAt: 0, n: 0 },
  inbox: [], pending: [], nid: 1, h2h: {}, welcome: false,
  iap: { count: 0, usd: 0, starter: false },
  pass: false, passClaimed: 0, tourn: null, lost: null,
};

export const PLAYER = { name: "SunnyOwl21", code: "SUNNYOWL21" };
export const GEM_LEVEL = 6;

export const give = (s: Saved, r: Reward): Saved => ({
  ...s, coins: s.coins + (r.coins ?? 0), gems: s.gems + (r.gems ?? 0),
  boosters: { hint: s.boosters.hint + (r.boosters?.hint ?? 0), slow: s.boosters.slow + (r.boosters?.slow ?? 0), x2: s.boosters.x2 + (r.boosters?.x2 ?? 0) },
});

/** "+30 coins". Gems are only mentioned once the player has met them (level 6). */
export const rewardText = (r: Reward, level: number) => {
  const parts: string[] = [];
  if (r.coins) parts.push(`+${r.coins} coins`);
  if (r.gems && level >= GEM_LEVEL) parts.push(`+${r.gems} gems`);
  // boosters are only mentioned once the player has met them (level 5); the reward is still added
  if (r.boosters && level >= featureLevel.boosters) for (const b of BOOSTERS) if (r.boosters[b.id]) parts.push(`+${r.boosters[b.id]} ${{ hint: "Hint", slow: "Slow", x2: "Double" }[b.id]}`);
  return parts.join(" ") || "Surprise";
};

/**
 * Typical XP of one round. It is measured, not assumed: the real engine pays about 15 + score / 8 XP, so a beginner at
 * Chill speed earns about 25 to 35 and a good player at Fast speed 60 to 90. Before the player has history we guess 35.
 */
export const avgRoundXp = (s: Pick<Saved, "rounds" | "stats">) =>
  s.rounds >= 3 ? Math.max(20, Math.min(120, Math.round(15 + s.stats.scoreSum / s.rounds / 8))) : 35;

// ---- feature cards (level-up screen, lock sheet, level path) ----
export const FEATURE_INFO: Record<Feature, { title: string; desc: string; icon: IconName; tone: Tone; go: string }> = {
  play: { title: "Play", desc: "Practice rounds with hints on.", icon: "play", tone: "B", go: "play" },
  dailyRewards: { title: "Daily rewards", desc: "A reward and a streak for every day you come back.", icon: "gift", tone: "I", go: "daily" },
  normalSpeed: { title: "Normal speed", desc: "Faster calls and a few more points per tap.", icon: "bolt", tone: "B", go: "play" },
  quests: { title: "Daily quests", desc: "Three goals a day for coins and gems.", icon: "target", tone: "N", go: "collect" },
  dailyChallenge: { title: "Daily card", desc: "Everyone plays the same board today. One scored try.", icon: "target", tone: "G", go: "collect" },
  combos: { title: "Combos", desc: "Tap right 4 times in a row to raise your multiplier.", icon: "bolt", tone: "O", go: "play" },
  journey: { title: "Journey", desc: "36 stages in 3 chapters. Win up to 3 stars each.", icon: "map", tone: "G", go: "journey" },
  fastSpeed: { title: "Fast speed", desc: "The quickest pace and the most points.", icon: "bolt", tone: "I", go: "play" },
  ghost: { title: "Beat the Ghost", desc: "Race a rival score. Your first 3 races are free.", icon: "ghost", tone: "I", go: "play" },
  boosters: { title: "Boosters", desc: "Hint, Slow calls or Double points before a round.", icon: "bolt", tone: "O", go: "shop" },
  album: { title: "Album", desc: "Collect 24 stamps in 4 sets. Finish a set for gems.", icon: "book", tone: "B", go: "collect" },
  shop: { title: "Shop", desc: "Boosters for coins, dabber looks for gems.", icon: "bag", tone: "O", go: "shop" },
  gems: { title: "Gems", desc: "A second currency for looks and streak rewards.", icon: "star", tone: "G", go: "shop" },
  pvp: { title: "Live matches", desc: "Play a real person on the same board.", icon: "users", tone: "N", go: "match" },
  league: { title: "Weekly league", desc: "Climb a table of 10. Nobody moves down in your first week.", icon: "trophy", tone: "O", go: "compete" },
  crew: { title: "Crew", desc: "Team up with friends and fill a shared chest.", icon: "users", tone: "N", go: "compete" },
  friendDuels: { title: "Friends", desc: "Duel a friend on the same board. Invite friends for rewards.", icon: "users", tone: "I", go: "compete" },
  events: { title: "Events", desc: "Limited-time goals with gem prizes.", icon: "star", tone: "G", go: "journey" },
  season: { title: "Season track", desc: "30 tiers of rewards. Every round fills the bar.", icon: "trophy", tone: "G", go: "journey" },
  dna: { title: "Bingo DNA", desc: "Five skill bars and a tip from Coach Nova.", icon: "star", tone: "O", go: "profile" },
  mastery: { title: "Mastery", desc: "Ranks from Rookie to Legend.", icon: "trophy", tone: "B", go: "profile" },
};

// ---- daily rewards, streak (level 2) ----
export const DAILY: Reward[] = [{ coins: 20 }, { coins: 30 }, { coins: 40, boosters: { hint: 1 } }, { coins: 50 }, { coins: 20, gems: 3 }, { coins: 80, boosters: { slow: 1 } }, { coins: 150, gems: 5 }];
/** how many days of the current 7-day cycle are already claimed */
export const cyclePos = (d: Saved["daily"]) => (d.ready ? d.claimed % 7 : ((d.claimed - 1) % 7) + 1);
export const FREEZE_PRICE = 50; // coins
export const FREEZE_MAX = 2;
/** the season pass adds one more freeze slot */
export const freezeMax = (s: { pass: boolean }) => FREEZE_MAX + (s.pass ? 1 : 0);
/** a broken streak can be repaired the next day if it was at least this long */
export const REPAIR_MIN = 5;
export const REPAIR_GEMS = 10;
export const REPAIR_COINS = 150; // before gems appear (level 6)

// ---- quests and the daily card (levels 2 and 3) ----
export type Quest = { text: string; goal: number; key: "rounds" | "daubs" | "lines"; reward: Reward };
/** Three quest slots, three versions of each. A re-roll (REROLL_PRICE coins) moves a slot to its next version; a new day starts at version 1 again. */
export const QUEST_SETS: Quest[][] = [
  [{ text: "Play 3 rounds", goal: 3, key: "rounds", reward: { coins: 30 } }, { text: "Play 5 rounds", goal: 5, key: "rounds", reward: { coins: 55 } }, { text: "Play 2 rounds", goal: 2, key: "rounds", reward: { coins: 20 } }],
  [{ text: "Mark 30 numbers", goal: 30, key: "daubs", reward: { coins: 40 } }, { text: "Mark 50 numbers", goal: 50, key: "daubs", reward: { coins: 70 } }, { text: "Mark 20 numbers", goal: 20, key: "daubs", reward: { coins: 25 } }],
  [{ text: "Complete 2 lines", goal: 2, key: "lines", reward: { coins: 30, gems: 2, boosters: { x2: 1 } } }, { text: "Complete 3 lines", goal: 3, key: "lines", reward: { coins: 50, gems: 3, boosters: { x2: 1 } } }, { text: "Complete 1 line", goal: 1, key: "lines", reward: { coins: 20, boosters: { hint: 1 } } }],
];
export const questOf = (slot: number, version: number): Quest => QUEST_SETS[slot][((version % 3) + 3) % 3];
export const REROLL_PRICE = 20; // coins
/** One shared board a day. One scored try; replays are practice. */
export const CARD = { speed: "normal" as Speed, reward: { coins: 50 } as Reward, bonusScore: 200, bonus: { coins: 30 } as Reward, xp: 30 };

/** A stable whole number from any text. The same text always gives the same board. */
export const seedFor = (text: string) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 1) || 1;
};
export const dayKey = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
export const cardSeed = (offset: number) => seedFor(`bingo-arena-card-${dayKey(offset)}`);
export const dayLabel = (offset: number) => new Date(Date.now() + offset * 86400000).toLocaleDateString("en-US", { day: "numeric", month: "short", timeZone: "UTC" });

/** Spoiler-free picture of the card for sharing: the marked cells only. */
export const cardGrid = (marked: boolean[]) =>
  [0, 1, 2, 3, 4].map((r) => marked.slice(r * 5, r * 5 + 5).map((m) => (m ? "\u{1F7E1}" : "⚪")).join("")).join("\n");

// ---- friend challenge links ----
const SPEED_OF: Record<string, Speed> = { c: "chill", n: "normal", f: "fast" };
export type Challenge = { seed: number; score: number; speed: Speed; name: string };
export const challengeLink = (c: Challenge) =>
  `${location.origin}${location.pathname}?c=${c.seed}.${c.score}.${c.speed[0]}.${encodeURIComponent(c.name)}`;
export const parseChallenge = (q: string | null): Challenge | null => {
  if (!q) return null;
  const [seed, score, sp, name] = q.split(".");
  const s = Number(seed), sc = Number(score);
  if (!Number.isInteger(s) || s <= 0 || !Number.isInteger(sc) || sc < 0 || sc > 5000 || !SPEED_OF[sp]) return null;
  const nm = decodeURIComponent(name ?? "").replace(/[^\p{L}\p{N}_ -]/gu, "").slice(0, 16) || "A friend";
  return { seed: s, score: sc, speed: SPEED_OF[sp], name: nm };
};

// ---- journey (level 3 or 4): 36 stages, 3 chapters ----
export type StageKind = "score" | "marks" | "streak" | "clean";
export type Stage = { name: string; kind: StageKind; goal: number; need: number[]; speed: Speed; chapter: number };
export const CHAPTERS = ["Warm-up Hall", "Neon Boulevard", "High Rollers"];
/** stars needed to open each chapter */
export const CHAPTER_NEED = [0, 12, 30];
const NAMES = [
  "Warm up", "Dabber Alley", "Lucky Lane", "Neon Row", "Hot Streak", "Midnight", "Rocket", "Crown", "Storm", "The Vault", "Legend", "Grand Final",
  "Sunset Strip", "Pinball Pier", "Copper Canyon", "Aurora", "Velvet Room", "Turbo Town", "Gold Rush", "Frostbite", "Night Market", "Skyline", "Carnival", "Ember Lane",
  "Echo Hall", "Silver Tide", "High Roller", "Midway", "Starlight", "Thunder Alley", "Mirror Maze", "Lantern Row", "Crystal Cove", "Final Countdown", "Hall of Fame", "Bingo Night",
];
const KINDS: StageKind[] = [
  "score", "score", "score", "marks", "score", "streak", "score", "clean", "score", "marks", "streak", "score",
  "streak", "score", "clean", "score", "marks", "score", "streak", "clean", "score", "marks", "streak", "score",
  "score", "streak", "clean", "marks", "score", "score", "streak", "clean", "marks", "score", "streak", "score",
];
// Star goals come from the real engine: what a careful player (hits 3 of 4 cards numbers) scores at each speed.
const SPEED_OF_STAGE = (i: number): Speed => (i < 4 ? "chill" : i < 24 ? "normal" : "fast");
const NEEDS: Record<Exclude<StageKind, "score">, Record<Speed, number[]>> = {
  marks: { chill: [4, 6, 8], normal: [6, 9, 12], fast: [8, 12, 15] },
  streak: { chill: [4, 6, 8], normal: [5, 8, 11], fast: [6, 10, 14] },
  clean: { chill: [4, 4, 4], normal: [6, 6, 6], fast: [8, 8, 8] }, // numbers to mark; stars come from wrong taps
};
const scoreGoal = (i: number) => (i < 4 ? [80, 90, 100, 115][i] : i < 24 ? 130 + 7 * (i - 4) : 300 + 14 * (i - 24));
export const STAGES: Stage[] = NAMES.map((name, i) => {
  const kind = KINDS[i], speed = SPEED_OF_STAGE(i), chapter = Math.floor(i / 12);
  if (kind === "score") { const g = scoreGoal(i); return { name, kind, speed, chapter, goal: g, need: [g, Math.round(g * 1.3), Math.round(g * 1.6)] }; }
  const need = NEEDS[kind][speed];
  return { name, kind, speed, chapter, goal: need[0], need };
});
export type StageResult = { score: number; daubs: number; wrong: number; streak: number };
export const stageStars = (st: Stage, r: StageResult): number => {
  const count = (v: number) => st.need.filter((n) => v >= n).length;
  switch (st.kind) {
    case "score": return count(r.score);
    case "marks": return count(r.daubs);
    case "streak": return count(r.streak);
    case "clean": return r.daubs < st.goal ? 0 : r.wrong <= 0 ? 3 : r.wrong <= 2 ? 2 : r.wrong <= 4 ? 1 : 0;
  }
};
export const goalText = (st: Stage) =>
  st.kind === "score" ? `Score ${st.goal} points`
    : st.kind === "marks" ? `Mark ${st.goal} numbers`
      : st.kind === "streak" ? `Tap ${st.goal} right in a row`
        : `Mark ${st.goal} numbers with 4 wrong taps or fewer`;
export const chapterOpen = (c: number, stars: number[]) => stars.reduce((a, b) => a + b, 0) >= CHAPTER_NEED[c];
export const stageOpen = (i: number, stars: number[]) => chapterOpen(Math.floor(i / 12), stars) && (i % 12 === 0 || (stars[i - 1] ?? 0) > 0);

// ---- album (level 6): 24 stamps in 4 sets of 6 ----
export const STAMPS = ["Lucky 7", "Hot Streak", "Sharp Eye", "Night Owl", "Fast Hands", "Full House", "Corner Pocket", "Free Space", "Golden Ball", "Rainbow", "Double Dab", "Cool Cat", "Big Win", "Early Bird", "Comeback", "Perfect Tap", "Neon Night", "Speedster", "Cherry", "Moonshot", "Jackpot", "Cloud Nine", "Bullseye", "Champion"];
export const STAMP_TONES: Tone[] = ["B", "I", "N", "G", "O", "P"];
export const SET_NAMES = ["Lucky Set", "Night Set", "Hands Set", "Grand Set"];
export const SET_REWARD: Reward = { gems: 5 };
export const setDone = (k: number, stamps: number[]) => [0, 1, 2, 3, 4, 5].every((j) => stamps.includes(k * 6 + j));

// ---- shop (level 6) ----
/** price is in coins, gems is the alternative price (gems can be earned slowly or, later, bought with real money) */
export const BOOSTERS: { id: Boost; name: string; short: string; desc: string; price: number; gems: number; tone: Tone }[] = [
  { id: "hint", name: "Hint", short: "HINT", desc: "The called number glows on your card.", price: 40, gems: 2, tone: "G" },
  { id: "slow", name: "Slow calls", short: "SLOW", desc: "Numbers come a little slower.", price: 40, gems: 2, tone: "B" },
  { id: "x2", name: "Double points", short: "x2", desc: "Every tap is worth twice as much.", price: 60, gems: 3, tone: "O" },
];
/** price is in gems. `only` marks a look that cannot be bought with gems: it comes from the starter pack or the season pass. */
export const LOOKS: { id: string; name: string; price: number; c: [string, string, string]; only?: string }[] = [
  { id: "bubblegum", name: "Bubblegum", price: 0, c: ["#FF9CC0", "#FF4F8B", "#D6336C"] },
  { id: "lagoon", name: "Lagoon", price: 5, c: ["#7FE6D6", "#1FA48F", "#0B6B5B"] },
  { id: "grape", name: "Grape", price: 8, c: ["#C9A6FF", "#8B4FE6", "#55239F"] },
  { id: "lime", name: "Lime", price: 6, c: ["#C8F07E", "#6FB81F", "#3E7208"] },
  { id: "ember", name: "Ember", price: 10, c: ["#FFC27A", "#F2760F", "#A33F00"] },
  { id: "ink", name: "Midnight", price: 12, c: ["#8FA2D6", "#3A4F9E", "#1B2A63"] },
  { id: "ocean", name: "Ocean", price: 8, c: ["#9ADBFF", "#2B9BEA", "#0E5C9E"] },
  { id: "sunny", name: "Sunny", price: 7, c: ["#FFF3A0", "#F5C400", "#A07800"] },
  { id: "rose", name: "Rose", price: 9, c: ["#FFB8C8", "#E8506E", "#9C1F3C"] },
  { id: "mint", name: "Mint", price: 6, c: ["#C4F5E1", "#42C79A", "#1B7A5A"] },
  { id: "slate", name: "Slate", price: 12, c: ["#C3CBD9", "#6B7790", "#363F55"] },
  { id: "royal", name: "Royal", price: 14, c: ["#D2B8FF", "#6A3DD1", "#34167C"] },
  { id: "sparkle", name: "Sparkle", price: 0, only: "Starter pack", c: ["#FFFFFF", "#FFD84D", "#E69500"] },
  { id: "gala", name: "Gala", price: 0, only: "Pass tier 10", c: ["#FFD1F0", "#E040C0", "#7A1E67"] },
  { id: "neon", name: "Neon", price: 0, only: "Pass tier 20", c: ["#B6FFB0", "#19D14B", "#07702A"] },
  { id: "legend", name: "Legend", price: 0, only: "Pass tier 30", c: ["#FFE29A", "#FF7A18", "#8E2A00"] },
];

// ---- league (level 5; was 8) ----
/** Full-week totals of the other nine players. The table shows the share of the week that has passed, so a player who
 *  joins mid-week sits among them after two or three rounds, never alone at the bottom with 0 against 1,380. */
export const LEAGUE_BOTS: { name: string; week: number }[] = [
  { name: "LuckyLuna", week: 1380 }, { name: "DabMaster", week: 1210 }, { name: "BingoBeth", week: 1105 }, { name: "Noam", week: 990 },
  { name: "Tali", week: 870 }, { name: "Yoni", week: 760 }, { name: "Dana", week: 640 }, { name: "RedBall", week: 520 }, { name: "Ben", week: 410 },
];
export const WEEK_PASSED = 4 / 7; // "ends in 3 days"
/** The first league week is protected: nobody moves down. */
export const LEAGUE_PROTECTED = true;
export type LeagueRow = { name: string; pts: number; friend: boolean };
/**
 * The first league is a friends league: the friends a player invited take the lowest bot places (or their own place, if a bot
 * has their name), and bots fill the rest of the ten. Friends' points grow with the rounds the player plays, so they are close.
 */
export const leagueBoard = (weekly: number, friends: Pick<FriendState, "name" | "pts">[] = []): LeagueRow[] => {
  const slots = LEAGUE_BOTS.map((b) => ({ name: b.name, week: b.week, friend: false, extra: 0 }));
  friends.slice(0, 4).forEach((f) => {
    let i = slots.findIndex((b) => b.name === f.name);
    if (i < 0) for (let k = slots.length - 1; k >= 0; k--) if (!slots[k].friend) { i = k; break; }
    if (i >= 0) slots[i] = { name: f.name, week: slots[i].week, friend: true, extra: f.pts * 2 };
  });
  return [...slots.map((b) => ({ name: b.name, pts: Math.round(b.week * WEEK_PASSED) + b.extra, friend: b.friend })), { name: "You", pts: weekly, friend: false }].sort((a, b) => b.pts - a.pts);
};
/** "You lead Ben 3 to 2" */
export const h2hText = (h: Record<string, { w: number; l: number }>, name: string) => {
  const r = h[name];
  if (!r || r.w + r.l === 0) return "No matches yet";
  return r.w === r.l ? `Tied ${r.w} to ${r.l}` : r.w > r.l ? `You lead ${r.w} to ${r.l}` : `${name} leads ${r.l} to ${r.w}`;
};

// ---- friends, invites, crew (levels 5 and 8) ----
/** The invite rewards mirror the live game (referrals, version 0.25). */
export const INVITE_STEPS: { text: string; reward: Reward }[] = [
  { text: "Saves their account", reward: { coins: 100 } },
  { text: "Plays 3 rounds", reward: { coins: 150 } },
  { text: "Comes back on another day", reward: { gems: 5 } },
  { text: "Plays on 7 different days", reward: { coins: 500, gems: 10 } },
];
export const FRIEND_WELCOME = 100; // coins the invited friend gets after their first round
/** What a friend gets for opening a link and playing the challenge: the link gives something to the person who opens it. */
export const WELCOME: Reward = { coins: FRIEND_WELCOME, boosters: { hint: 1 } };
export const FRIEND_POOL = ["MiaDabs", "Noam", "Tali", "Ben", "Yoni", "Dana"];
export const CREW = { name: "Lucky Dabbers", goal: 2000 };
export const RIVAL_NAMES = ["MiaDabs", "Noam", "Tali", "Ben", "Yoni", "Dana"];
export const rivalTarget = (sp: Speed) => Math.round({ chill: 100, normal: 190, fast: 380 }[sp] * (0.85 + Math.random() * 0.3));

// ---- ghost (level 4) ----
export const GHOST_FEE = 10; // coins at level 4, when Ghost opens
export const GHOST_FEE_MAX = 40; // coins at level 15 and above
export const GHOST_FREE = 3; // the first races cost nothing, so the first coin-costing mode feels safe
/** The entry grows with level (10 coins at level 4, 40 at level 15), so coins stay worth something to a player who has many. */
export const ghostFee = (s: Pick<Saved, "ghostPlays">, level: number) =>
  s.ghostPlays < GHOST_FREE ? 0 : Math.min(GHOST_FEE_MAX, GHOST_FEE + Math.max(0, Math.round(((level - 4) * (GHOST_FEE_MAX - GHOST_FEE)) / 11)));

// ---- season, events ----
export const SEASON_TIERS = 30;
export const SEASON_XP = 100;
export const seasonReward = (t: number): Reward => (t % 10 === 0 ? { gems: 10, coins: 100 } : t % 5 === 0 ? { gems: 3, boosters: { [(["hint", "slow", "x2"] as Boost[])[((t - 5) / 10) % 3]]: 1 } as Partial<Record<Boost, number>> } : { coins: 15 + t });
export const EVENTS = [
  { title: "Lucky Sevens Weekend", desc: "Score 600 points in total.", goal: 600, ends: "2 days left", reward: { gems: 5, coins: 100 } as Reward, tone: "O" as Tone },
  { title: "Night Owl Rally", desc: "Complete 5 lines.", goal: 5, ends: "5 days left", reward: { gems: 3, coins: 60 } as Reward, tone: "B" as Tone },
];

// ---- mastery (badge from level 2, full screen at level 10) ----
export const RANKS = ["Rookie", "Dabber", "Sharp", "Pro", "Master", "Legend"];

// ---- Coach Nova: one tip per round, chosen from how the round went ----
export type TipInput = { wrong: number; accuracy: number; daubs: number; lines: number; speed: string; score: number };
let lastTip = "";
export function coachTip(r: TipInput): string {
  const options: [string, string][] = [];
  if (r.wrong >= 3) options.push(["wrong", `${r.wrong} wrong taps reset your streak. Check the letter and the number before you tap.`]);
  if (r.accuracy >= 0.95 && r.daubs >= 6 && r.speed === "chill") options.push(["speedup", "Very clean round. Try Normal speed: the same taps are worth more points."]);
  if (r.accuracy >= 0.95 && r.daubs >= 8 && r.speed !== "chill") options.push(["streak", "No misses. Keep the streak going: 4 right in a row gives x2, 8 gives x3."]);
  if (r.daubs < 6) options.push(["scan", "Scan one column at a time, not the whole card. It is faster."]);
  if (r.lines === 0 && r.daubs >= 6) options.push(["line", "No line yet. Pick one row and finish it before you chase other numbers."]);
  options.push(["letter", "Look at the column letter first, then find the number. It is faster."]);
  const pick = options.find(([id]) => id !== lastTip) ?? options[0];
  lastTip = pick[0];
  return pick[1];
}

/** One line under the speed selector. Keep in step with the PACE table in Game.tsx (call every 4 / 3 / 2.2 seconds, points x1 / x1.2 / x1.5). */
export const SPEED_DESC: Record<Speed, string> = {
  chill: "Relaxed pace, with hints.",
  normal: "Faster calls. 20% more points.",
  fast: "The quickest pace. 50% more points.",
};

// ---- the bonus box: a free reward that fills while the player is away ----
export const BOX_HOURS = 4;
export const BOX_MS = BOX_HOURS * 3600000;
export const BOX_SKIP_GEMS = 3; // gems to open it before the timer ends (from level 6)
/** Not random: the rewards come round in this order, so nobody pays for a lucky draw. */
export const BOX_REWARDS: Reward[] = [{ coins: 25 }, { boosters: { hint: 1 } }, { coins: 40 }, { boosters: { slow: 1 } }, { coins: 25, gems: 1 }, { boosters: { x2: 1 } }];
export const boxReward = (n: number): Reward => BOX_REWARDS[n % BOX_REWARDS.length];
/** the playground clock: real time plus the hours the tools skipped */
export const nowMs = (skew: number) => Date.now() + skew;
export const boxLeft = (s: Pick<Saved, "box" | "skew">) => Math.max(0, s.box.readyAt - nowMs(s.skew));
export const fmtLeft = (ms: number) => {
  const t = Math.ceil(ms / 1000), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m ${String(sec).padStart(2, "0")}s`;
};

// ---- the store: real money for gems, coins and two bundles. The playground takes no payment. ----
export type StoreItem = { id: string; kind: "starter" | "gems" | "coins" | "pass"; name: string; usd: number; reward: Reward; look?: string; tag?: string };
export const usd = (n: number) => `$${n.toFixed(2)}`;
export const STARTER: StoreItem = { id: "starter", kind: "starter", name: "Starter pack", usd: 2.99, reward: { coins: 500, gems: 30, boosters: { hint: 3, slow: 3, x2: 3 } }, look: "sparkle", tag: "One time" };
const GEM_BASE = 30 / 0.99; // gems per dollar in the smallest pack; bigger packs add a bonus
const GEMS: [string, number, number][] = [["Handful", 0.99, 30], ["Pouch", 4.99, 170], ["Bag", 9.99, 360], ["Vault", 19.99, 800]];
const COINS: [string, number, number][] = [["Coin stack", 0.99, 300], ["Coin pile", 2.99, 1100]];
const bonus = (price: number, amount: number, base: number) => Math.round((amount / (price * base) - 1) * 100);
export const GEM_PACKS: StoreItem[] = GEMS.map(([name, price, gems], i) => ({
  id: `gems${gems}`, kind: "gems", name, usd: price, reward: { gems },
  tag: i === 1 ? "Most popular" : bonus(price, gems, GEM_BASE) > 0 ? `+${bonus(price, gems, GEM_BASE)}% bonus` : undefined,
}));
export const COIN_PACKS: StoreItem[] = COINS.map(([name, price, coins]) => ({
  id: `coins${coins}`, kind: "coins", name, usd: price, reward: { coins }, tag: bonus(price, coins, 300 / 0.99) > 0 ? `+${bonus(price, coins, 300 / 0.99)}% bonus` : undefined,
}));
export const PASS: StoreItem = { id: "pass", kind: "pass", name: "Season pass", usd: 4.99, reward: {} };

// ---- season pass: a gold track beside the free one ----
export type PassReward = Reward & { look?: string };
/** Cosmetics and extra boosters. Nothing here changes a score, so the pass never decides a match. */
export const passReward = (t: number): PassReward =>
  t === 10 ? { gems: 10, look: "gala" } : t === 20 ? { gems: 15, look: "neon" } : t === 30 ? { gems: 25, look: "legend" }
    : t % 5 === 0 ? { gems: 5, boosters: { hint: 1, slow: 1, x2: 1 } }
      : t % 2 === 0 ? { coins: 40 + t } : { boosters: { [(["hint", "slow", "x2"] as Boost[])[(t >> 1) % 3]]: 1 } as Partial<Record<Boost, number>> };
export const passText = (r: PassReward, level: number) => {
  const b = r.boosters, all = !!b && !!b.hint && !!b.slow && !!b.x2;
  const main = all ? [r.coins ? `+${r.coins} coins` : "", r.gems && level >= GEM_LEVEL ? `+${r.gems} gems` : "", "+3 boosters"].filter(Boolean).join(" ") : rewardText(r, level);
  return [main, r.look ? `${LOOKS.find((l) => l.id === r.look)?.name} look` : ""].filter((x) => x && x !== "Surprise").join(" + ");
};

// ---- weekend cup: a coin sink with gem prizes, nothing to buy with money ----
export const CUP = { entry: 100, tries: 3, speed: "normal" as Speed };
/** the scores of the other twenty players; the player's best of three tries is placed among them */
export const CUP_BOTS: number[] = Array.from({ length: 20 }, (_, i) => 340 - 13 * i);
export const cupId = (dayOffset: number) => Math.floor(dayOffset / 7);
export const cupSeed = (id: number) => seedFor(`bingo-arena-cup-${id}`);
export const cupRank = (score: number) => CUP_BOTS.filter((b) => b > score).length + 1;
export const cupPrize = (rank: number): Reward => (rank <= 3 ? { gems: 10 } : rank <= 10 ? { gems: 4 } : { coins: 20 });

// ---- "next goal" strip on the results screen ----
export type Goal = { icon: IconName; text: string; away: number };
/**
 * The nearest things to reach, closest first. `away` is a rough number of rounds. A reward that is already waiting counts as 0.
 * The results screen shows the two nearest, so every finished round points at something one or two rounds away.
 */
export function nextGoals(n: Saved, level: number): Goal[] {
  const out: Goal[] = [];
  const avg = n.rounds > 0 ? Math.max(60, n.stats.scoreSum / n.rounds) : 150;
  if (unlocked("quests", level)) {
    let best: Goal | null = null;
    for (let i = 0; i < 3; i++) {
      if (n.today.done[i]) continue;
      const q = questOf(i, n.today.qv[i] ?? 0), have = n.today[q.key], left = q.goal - have;
      const g: Goal = left <= 0 ? { icon: "gift", text: "A quest reward is ready to claim", away: 0 }
        : { icon: "target", text: `Quest: ${q.text.toLowerCase()} · ${have} of ${q.goal}`, away: q.key === "rounds" ? left : q.key === "daubs" ? left / 12 : left / 1.5 };
      if (!best || g.away < best.away) best = g;
    }
    if (best) out.push(best);
  }
  if (unlocked("league", level)) {
    const board = leagueBoard(n.weekly, n.friends), me = board.findIndex((p) => p.name === "You");
    if (me > 0) { const gap = board[me - 1].pts - n.weekly + 1; out.push({ icon: "trophy", text: `${gap} points to pass ${board[me - 1].name}`, away: gap / avg }); }
  }
  if (unlocked("season", level)) {
    const tiers = Math.min(SEASON_TIERS, Math.floor(n.season / SEASON_XP));
    if (tiers > n.seasonClaimed) out.push({ icon: "gift", text: "A season reward is ready to claim", away: 0 });
    else if (tiers < SEASON_TIERS) { const left = SEASON_XP - (n.season % SEASON_XP); out.push({ icon: "star", text: `${left} to season tier ${tiers + 1}`, away: (left * 2) / avg }); }
  }
  if (unlocked("dailyRewards", level) && boxLeft(n) === 0) out.push({ icon: "gift", text: "Your free bonus box is ready", away: 0 });
  return out.sort((a, b) => a.away - b.away).slice(0, 2);
}
