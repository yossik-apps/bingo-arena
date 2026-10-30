// One table decides what a player sees at each level. Change a level number here and every screen follows.
// Two ladders live side by side so they can be compared: "retention" (default) and "original" (the first draft).
// Switch in the playground sidebar; the choice is remembered in this browser.
import { levelOf } from "@engine";

export type Feature =
  | "play" | "dailyRewards" | "normalSpeed" | "quests" | "dailyChallenge" | "combos" | "journey" | "fastSpeed"
  | "ghost" | "boosters" | "album" | "shop" | "gems" | "pvp" | "league" | "crew" | "friendDuels"
  | "events" | "season" | "dna" | "mastery";

export type LevelUnlock = {
  level: number;
  title: string;
  desc: string;
  /** icon name shown on the level path */
  icon: "play" | "gift" | "target" | "map" | "ghost" | "book" | "users" | "trophy" | "star" | "bolt";
  /** which ball color the icon sits on */
  tone: "B" | "I" | "N" | "G" | "O";
  features: Feature[];
};

export type Ladder = "retention" | "original";

/** The first draft: social and competitive features arrive late (levels 8 to 15). */
const ORIGINAL: LevelUnlock[] = [
  { level: 1, title: "Play", desc: "Practice rounds. Slow calls and hints are on.", icon: "play", tone: "B", features: ["play"] },
  { level: 2, title: "Daily rewards", desc: "A reward every day you return. Normal speed.", icon: "gift", tone: "I", features: ["dailyRewards", "normalSpeed"] },
  { level: 3, title: "Quests and Daily Challenge", desc: "Three goals a day. Combos switch on.", icon: "target", tone: "N", features: ["quests", "dailyChallenge", "combos"] },
  { level: 4, title: "Journey", desc: "Stages with 3-star goals. Fast speed.", icon: "map", tone: "G", features: ["journey", "fastSpeed"] },
  { level: 5, title: "Beat the Ghost, boosters", desc: "Your first rounds that cost coins.", icon: "ghost", tone: "O", features: ["ghost", "boosters"] },
  { level: 6, title: "Album and Shop", desc: "Collect stamps. Buy looks. Gems arrive here.", icon: "book", tone: "B", features: ["album", "shop", "gems"] },
  { level: 8, title: "Play a person, Weekly league", desc: "Live matches on the same board.", icon: "users", tone: "I", features: ["pvp", "league"] },
  { level: 10, title: "Crew and friend duels", desc: "Team chest, challenges, invites.", icon: "users", tone: "N", features: ["crew", "friendDuels"] },
  { level: 12, title: "Events and Season track", desc: "Limited events and 30 tiers of rewards.", icon: "trophy", tone: "G", features: ["events", "season"] },
  { level: 15, title: "Bingo DNA and Mastery", desc: "Skill coach and ranks.", icon: "star", tone: "O", features: ["dna", "mastery"] },
];

/**
 * The retention ladder. Why it looks like this:
 *  - a reason to come back tomorrow (daily rewards, streak, quests) arrives at level 2, after one round;
 *  - the season track (a bar every round fills) arrives at level 4, not 12;
 *  - something social (league, friends) arrives at level 5, about 15 to 25 rounds in, not 36 to 59;
 *  - the heavy features (crew, live matches, DNA) wait until the player has a reason to want them.
 */
const RETENTION: LevelUnlock[] = [
  { level: 1, title: "Play", desc: "Practice rounds. Slow calls and hints are on.", icon: "play", tone: "B", features: ["play"] },
  { level: 2, title: "Rewards, streak, quests", desc: "A reward and a streak every day. Three daily goals.", icon: "gift", tone: "I", features: ["dailyRewards", "quests", "normalSpeed"] },
  { level: 3, title: "Daily card and Journey", desc: "One shared board a day. Stages with stars. Combos on.", icon: "target", tone: "N", features: ["dailyChallenge", "combos", "journey"] },
  { level: 4, title: "Ghost and Season", desc: "Race a rival. 30 reward tiers. Fast speed.", icon: "ghost", tone: "G", features: ["ghost", "season", "fastSpeed"] },
  { level: 5, title: "League and Friends", desc: "Weekly league. Duel and invite friends. Boosters.", icon: "trophy", tone: "O", features: ["league", "friendDuels", "boosters"] },
  { level: 6, title: "Album and Shop", desc: "Collect stamps in sets. Buy looks. Gems arrive.", icon: "book", tone: "B", features: ["album", "shop", "gems"] },
  { level: 8, title: "Crew, live matches, DNA", desc: "Team chest, live matches and your skill profile.", icon: "users", tone: "I", features: ["crew", "pvp", "dna"] },
  { level: 10, title: "Events and Mastery", desc: "Limited events and ranks from Rookie to Legend.", icon: "star", tone: "N", features: ["events", "mastery"] },
];

const KEY = "design_e_ladder";
const read = (): Ladder => {
  try { return localStorage.getItem(KEY) === "original" ? "original" : "retention"; } catch { return "retention"; }
};
export const LADDER: Ladder = read();
/** Remember the choice and reload, because the ladder is read once when the page loads. */
export const setLadder = (v: Ladder) => {
  try { localStorage.setItem(KEY, v); } catch { /* private mode */ }
  location.reload();
};

export const LEVEL_UNLOCKS: LevelUnlock[] = LADDER === "original" ? ORIGINAL : RETENTION;
export const ALL_LADDERS: Record<Ladder, LevelUnlock[]> = { original: ORIGINAL, retention: RETENTION };

export const featureLevel = Object.fromEntries(
  LEVEL_UNLOCKS.flatMap((u) => u.features.map((f) => [f, u.level])),
) as Record<Feature, number>;

export const unlocked = (f: Feature, level: number) => level >= featureLevel[f];

/** The next level that unlocks something, or null when everything is open. */
export const nextUnlock = (level: number) => LEVEL_UNLOCKS.find((u) => u.level > level) ?? null;

/** The highest level that unlocks something. */
export const LAST_UNLOCK_LEVEL = LEVEL_UNLOCKS[LEVEL_UNLOCKS.length - 1].level;

/** XP needed to reach a level. This is the exact inverse of levelOf() in the game engine: level = floor(sqrt(xp / 40)) + 1. */
export const xpForLevel = (level: number) => 40 * (level - 1) ** 2;

export { levelOf };
