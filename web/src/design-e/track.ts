// A tiny event log for the playground. It only writes to this browser (a ring of the last 500 events) so you can see
// WHAT the real game should send to analytics, and when. Nothing leaves the device.
export type TrackEvent = { t: number; name: string; props: Record<string, string | number | boolean> };

const KEY = "design_e_events_v1";
const MAX = 500;
const listeners = new Set<() => void>();

export const readEvents = (): TrackEvent[] => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") as TrackEvent[]; } catch { return []; }
};

export function track(name: string, props: TrackEvent["props"] = {}) {
  const next = [...readEvents(), { t: Date.now(), name, props }].slice(-MAX);
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
  listeners.forEach((f) => f());
}

export const clearEvents = () => { try { localStorage.removeItem(KEY); } catch { /* private mode */ } listeners.forEach((f) => f()); };

/** Call the function whenever an event is written. Returns the unsubscribe function. */
export function onTrack(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; }

/**
 * What the real game should send, one line per event: name, properties, and the question it answers.
 * The playground writes all of these through `track()`. Add a name here when you add a new event.
 *
 * Social loop
 *   challenge_created      { score }                     how many players send a challenge after a round (share_tapped = the score card instead)
 *   challenge_opened       { score, level }              how many links get opened (the friend side)
 *   challenge_answered     { from, mine, theirs }        a friend played your board and the answer reached you
 *   inbox_opened           { unread }                    how often the answers are looked at
 *   rematch_started        { vs, via: "results"|"inbox" } the loop closing: a second duel with the same person
 *   duel_started           { vs, via: "friends" }         a duel started from the friends list
 *   welcome_gift           { coins }                     the invited friend got the welcome bundle
 *
 * Money
 *   store_opened           { reason: "button"|"shortfall"|"starter_offer", focus }   where the store gets seen
 *   shop_shortfall         { item, need, have, currency, level }  a player wanted something and was short: the best sales moment
 *   iap_checkout_started   { item, usd }                 tapped a price
 *   iap_completed          { item, usd, first }          paid (first = the first purchase ever)
 *   iap_cancelled          { item }                      left at the payment step
 *
 * Coin sinks and reasons to come back
 *   box_opened             { n, early }                  the free bonus box (early = skipped the wait with gems)
 *   streak_repaired        { streak, pay }               paid to bring back a lost streak
 *   quest_rerolled         { slot }                      paid to swap a quest
 *   cup_entered            { cost }                      entered the weekend cup
 *   cup_try                { score, try }                one of the three tries
 *   cup_claimed            { rank }                      took the cup prize
 *   pass_claimed           { upto }                      claimed gold season rewards up to this tier
 */
export const EVENT_CATALOG = [
  "challenge_created", "challenge_opened", "challenge_answered", "inbox_opened", "rematch_started", "duel_started", "welcome_gift",
  "store_opened", "shop_shortfall", "iap_checkout_started", "iap_completed", "iap_cancelled",
  "box_opened", "streak_repaired", "quest_rerolled", "cup_entered", "cup_try", "cup_claimed", "pass_claimed",
] as const;
