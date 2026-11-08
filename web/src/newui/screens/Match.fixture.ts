// Sample searches for captures of Matchmaking. Local development only: nothing is sent, and the sample search never finds a match.
import type { Arena } from "../../lib/arena";
import type { OnlinePlayer } from "../../lib/screenData";
import type { ScreenFixture } from "./contract";

const PEOPLE: OnlinePlayer[] = [
  { id: "o1", name: "Sample player one", level: 7, playing: false },
  { id: "o2", name: "Sample player with a very long name", level: 14, playing: true },
  { id: "o3", name: "Sample friend", level: 3, playing: false },
  { id: "o4", name: "Sample rival", level: 22, playing: false },
];
const ARENA: Arena = { online: 14, waiting: [], invites: [], sent: [] };

const STATES: Record<string, { level?: string; waited: number; online?: OnlinePlayer[] | null; arena?: Partial<Arena> | null }> = {
  searching: { waited: 3 },
  ghost: { waited: 21 },
  still: { waited: 31, arena: { sent: [{ to: "Sample friend", status: "declined" }, { to: "Sample rival", status: "accepted" }] } },
  nobody: { waited: 8, online: [], arena: { online: 1 } },
  loading: { waited: 1, online: null, arena: null },
  elsewhere: { waited: 12, arena: { waiting: [{ id: "w1", name: "Sample rival", level: "hard", waited: 30, player_level: 18 }, { id: "w2", name: "Sample player one", level: "beginner", waited: 4, player_level: 6 }] } },
  hard: { level: "hard", waited: 6, online: PEOPLE.slice(0, 2) },
  none: { waited: 0 },
};

export const fixture: ScreenFixture = (base, state) => {
  const s = STATES[state ?? "searching"] ?? STATES.searching;
  const level = s.level ?? "medium";
  const none = state === "none";
  const never = new Promise<never>(() => undefined);
  return {
    ...base,
    rounds: { ...base.rounds, matching: none ? null : { level, ready: () => undefined } } as typeof base.rounds,
    social: { ...base.social, arena: s.arena === null ? null : { ...ARENA, ...s.arena } },
    match: {
      ...base.match,
      find: async () => undefined,
      // always still queued, at the state's waiting time
      state: async () => ({ status: "queued", waited: s.waited }),
      cancel: async () => true,
      online: () => (s.online === null ? never : Promise.resolve(s.online ?? PEOPLE)),
      invite: async () => undefined,
    },
  };
};
