// How a round ends, for the new screens (ctx.rounds.submit and ctx.rounds.abandon).
// These make exactly the calls Classic Play makes (views/Play.tsx). Classic keeps its own copy until it is retired.
import { missedCount, scoreTaps, type Tap } from "../../../supabase/functions/_shared/engine.ts";
import type { RoundResult, RoundStart } from "../views/Play";

type Call = <T>(name: string, body: unknown) => Promise<T>;

/** `call` is callFn and `text` is errorText from lib/supabase, passed in so tests need no server. */
export function roundCalls(call: Call, text: (code: string) => string) {
  return {
    /** The server scores the round. Fails with a message ready to show, for ctx.rounds.fail. */
    submit: async (roundId: string, taps: Tap[]): Promise<RoundResult> => {
      try { return await call<RoundResult>("submit-round", { roundId, taps }); } catch (e) { throw new Error(text((e as Error).message)); }
    },
    /** Leaving early. Errors are ignored: the server also expires stale rounds. */
    abandon: async (roundId: string): Promise<void> => {
      try { await call("submit-round", { roundId, abandon: true }); } catch { /* the server also expires stale rounds */ }
    },
  };
}

/** A visitor's free round: scored on the device, nothing is saved. The same result as Classic Play's local round. */
export function localResult(round: RoundStart, taps: Tap[]): RoundResult {
  const p = round.params;
  const s = scoreTaps(round.seed, p, taps);
  return { ...s, missed: missedCount(round.seed, p, s.marked, p.total * 1000), win: false, prize: 0, xp: 0, ghost: null, best: null, balance: 0, level: 1, achievements: [], mode: "local" };
}
