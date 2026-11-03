// Compete's rules, kept apart from its looks so they can be tested. Conditions and wording are the same as Classic's
// Events, League, Crew, Calendar and New players tabs.
import type { CrewHit, CrewInfo, LiveOp } from "../../lib/supabase";

export type CompeteTab = "events" | "league" | "crew" | "calendar" | "new";
/** Short labels, so the row fits or scrolls sideways on phones. */
export const TABS: [CompeteTab, string][] = [["events", "Events"], ["league", "League"], ["crew", "Crew"], ["calendar", "Calendar"], ["new", "New"]];

export type Ev = { id: string; name: string; descr: string; level: string; fee: number; attempts: number; starts_at: string; ends_at: string; bonus: number; split: number[]; status: string; auto?: boolean };
export type Race = { id: string; title: string; descr: string; kind: string; mult: number; ends_at: string; prizes: number[]; board: { rank: number; name: string; points: number; me: boolean }[] };
export type EventRow = { rank: number; user_id: string; display_name: string; best: number; attempts: number };
export type LeagueRow = { rank: number; user_id: string; display_name: string; points: number };
export type LeagueInfo = { players: number; prizes: number[]; auto: boolean };
export type Payout = { week: string; prizes: number[]; winners: { rank: number; name: string; points: number; prize: number }[] };
export type CrewBoardRow = { rank: number; crew_id: string; name: string; tag: string; members: number; points: number };
export type NewPlayer = { user_id: string; name: string; level: number; joined_at: string; is_me: boolean; waved: boolean };

/**
 * The calls Compete needs, named after Classic's. Until the shared screen-data PR lands they come from fixtures only.
 * Loaders reject when they cannot load. Actions reject with an Error whose message is already the player's text.
 */
export type CompeteApi = {
  events: () => Promise<Ev[]>;
  live_races: () => Promise<Race[]>;
  attempts_used: (eventId: string) => Promise<number>;
  event_leaderboard: (eventId: string) => Promise<EventRow[]>;
  league_info: () => Promise<LeagueInfo | null>;
  league_board: () => Promise<LeagueRow[]>;
  league_payouts: () => Promise<Payout | null>;
  crew_info: () => Promise<CrewInfo | null>;
  crew_board: () => Promise<CrewBoardRow[]>;
  search_crews: (q: string) => Promise<CrewHit[]>;
  join_crew: (crewId: string | null, code?: string) => Promise<void>;
  create_crew: (f: { name: string; tag: string; descr: string; open: boolean }) => Promise<void>;
  claim_crew_chest: (tier: 1 | 2) => Promise<void>;
  leave_crew: () => Promise<void>;
  update_crew: (descr: string, open: boolean) => Promise<void>;
  kick_crew_member: (userId: string) => Promise<void>;
  liveops: () => Promise<LiveOp[]>;
  new_players: (limit: number) => Promise<NewPlayer[]>;
  wave_hello: (userId: string) => Promise<void>;
};

/** Classic's "N days left / N h left / N min left / ended" (Events and League). */
export const leftText = (ms: number) => {
  if (ms <= 0) return "ended";
  const h = Math.floor(ms / 36e5);
  return h >= 48 ? `${Math.floor(h / 24)} days left` : h >= 1 ? `${h} h left` : `${Math.max(1, Math.floor(ms / 6e4))} min left`;
};
export const leftUntil = (iso: string, now = Date.now()) => leftText(new Date(iso).getTime() - now);
/** The league week ends Monday 00:00 UTC. */
export const weekEnd = (now = Date.now()) => {
  const d = new Date(now), day = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + (7 - day));
};

// ---- Events ----
export function eventStatus(e: Ev, used: number, balance: number, blocked: boolean) {
  const rest = e.attempts - used;
  const disabled = blocked || rest <= 0 || balance < e.fee;
  const cta = rest <= 0 ? "No attempts left" : balance < e.fee ? "Not enough coins" : "Enter";
  return { rest: Math.max(0, rest), disabled, cta };
}
export const eventLine = (e: Ev, used: number, mine: EventRow | undefined, now = Date.now()) =>
  `${leftUntil(e.ends_at, now)} · ${Math.max(0, e.attempts - used)} of ${e.attempts} attempts left · prizes for the top ${e.split.length}${mine ? ` · you are #${mine.rank} with ${mine.best}` : ""}`;
export const autoLine = (e: Ev) => (e.auto ? `New every ${/Daily/i.test(e.name) ? "day" : "week"} · prizes paid automatically when it ends` : "");
export const raceLine = (r: Race) => {
  const mine = r.board.find((b) => b.me);
  return `${r.descr || "Earn the most XP while the boost runs."} Every round in any mode counts. Prizes: ${r.prizes.map((p, i) => `#${i + 1} ${p}`).join(" · ")} coins.${mine ? ` You are #${mine.rank} with ${mine.points} XP.` : " Play a round to join."}`;
};
/** Top 5, plus the player's own row when lower down. */
export const raceRows = (r: Race) => {
  const mine = r.board.find((b) => b.me);
  return [...r.board.slice(0, 5), ...(mine && mine.rank > 5 ? [mine] : [])];
};

// ---- League ----
/** Top 20 as in Classic, plus the player's own row when lower down. */
export const leagueRows = (rows: LeagueRow[], userId: string) => {
  const me = rows.find((r) => r.user_id === userId);
  return [...rows.slice(0, 20), ...(me && me.rank > 20 ? [me] : [])];
};
export const prizeNow = (info: LeagueInfo | null, rank: number) => (info && info.prizes[rank - 1] ? `wins ${info.prizes[rank - 1].toLocaleString("en-US")} coins now` : "");
export const leagueNote = (info: LeagueInfo) =>
  `${info.players} ${info.players === 1 ? "player" : "players"} so far · the prizes grow as more people play${info.auto ? " · paid automatically on Monday" : ""}`;

// ---- Crew ----
export const crewPct = (c: CrewInfo) => Math.min(100, Math.round((c.week_points / c.goal) * 100));
export function chest(c: CrewInfo, t: 1 | 2) {
  const need = t === 1 ? c.tier1 : c.goal, got = c.week_points >= need, done = c.claimed.includes(t), small = c.size < c.min_members;
  const why = small ? `Needs ${c.min_members} players` : !got ? `${need} crew XP` : c.my_points < c.min_points ? `You need ${c.min_points} XP yourself` : "";
  return {
    name: t === 1 ? "Small chest" : "Big chest", need, reward: t === 1 ? "30 coins" : "60 coins and a stamp pack",
    disabled: done || !got || small || c.my_points < c.min_points, label: done ? "Claimed" : why || "Open chest",
  };
}
export const canJoinWithCode = (code: string) => code.length >= 4;

// ---- Calendar ----
export const splitOps = (ops: LiveOp[], now = Date.now()) => ({
  live: ops.filter((o) => new Date(o.starts_at).getTime() <= now),
  soon: ops.filter((o) => new Date(o.starts_at).getTime() > now),
});

// ---- New players ----
export const ago = (iso: string, now = Date.now()) => {
  const d = Math.floor((now - new Date(iso).getTime()) / 864e5);
  return d <= 0 ? "joined today" : d === 1 ? "joined yesterday" : `joined ${d} days ago`;
};
