// Sample data for Invite friends' captures, one state per name. Local development only.
// Names are plainly sample names; nothing here is shown to players. The rewards are the base sample's, not live values.
import type { Referral, ReferralFriend } from "../../lib/screenData";
import type { ScreenFixture } from "./contract";

const DAY = 864e5;
const iso = (ms: number) => new Date(Date.now() + ms).toISOString();
const friend = (over: Partial<ReferralFriend>): ReferralFriend => ({
  name: "SampleFriend", joined: iso(-6 * DAY), status: "ok", register: true, play: false, return: false, week: false, rounds: 2, coins: 0, gems: 0, saved: true, ends: iso(24 * DAY), ...over,
});
const FRIENDS: ReferralFriend[] = [
  friend({ name: "SampleFriendOne", play: true, return: true, rounds: 9, coins: 700, gems: 15 }),
  friend({ name: "SampleFriendTwo", joined: iso(-40 * DAY), play: true, return: true, week: true, rounds: 31, coins: 1200, gems: 40, ends: iso(-10 * DAY) }),
  friend({ name: "SampleFriendThree", register: false, coins: 0 }),
  friend({ name: "SampleReview", status: "review", register: false }),
  friend({ name: "SampleBlocked", status: "blocked", register: false }),
  friend({ name: "SampleCapped", status: "capped", register: false }),
  friend({ name: "SampleAVeryLongFriendNameThatKeepsGoing", play: true, coins: 500, gems: 15 }),
];

export const fixture: ScreenFixture = (base, state) => {
  const on = (over: (r: Referral) => Referral | "old" | null) => ({
    ...base,
    refer: { load: async () => { const r = await base.refer.load(); return r && r !== "old" ? over(r) : r; } },
  });
  switch (state) {
    // the live state today: nobody invited yet
    case "empty": return on((r) => ({ ...r, stats: { invited: 0, active: 0, registered: 0, played: 0, returned: 0, week: 0, coins: 0, gems: 0 }, friends: [] }));
    case "loading": return { ...base, refer: { load: () => new Promise<never>(() => undefined) } };
    case "old": return { ...base, refer: { load: async () => "old" as const } };
    case "paused": return on((r) => ({ ...r, enabled: false }));
    case "crazygames": return { ...base, social: { ...base.social, invite: false }, platform: { ...base.platform, crazyGames: true } };
    case "friends": return on((r) => ({ ...r, stats: { invited: 7, active: 3, registered: 3, played: 3, returned: 2, week: 1, coins: 2400, gems: 70 }, friends: FRIENDS }));
    default: return on((r) => ({ ...r, stats: { invited: 1, active: 1, registered: 1, played: 1, returned: 1, week: 0, coins: 700, gems: 15 }, friends: [FRIENDS[0]] }));
  }
};
