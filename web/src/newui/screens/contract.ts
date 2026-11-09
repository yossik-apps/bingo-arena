// The screen contract. App.tsx builds one ScreenCtx and every new screen receives it as its only prop.
// A screen reads what it needs from the named groups and lists them in a "Uses:" comment at the top of its file.
import type { ComponentType, ReactNode } from "react";
import type { AdStatus } from "../../lib/ads";
import type { Arena } from "../../lib/arena";
import type { Dna, DnaRound } from "../../lib/dna";
import type { Settings } from "../../lib/settings";
import type { Economy } from "../../lib/store";
import type { ChallengeInfo, DailyInfo, Equipped, GameCfg, LiveOp, ShopItem } from "../../lib/supabase";
import type { Cal } from "../../views/LoginCalendar";
import type { RoundResult, RoundStart } from "../../views/Play";
import type { Tap } from "@engine";
import type { AuthGroup, AuthReply, ScreenData } from "../../lib/screenData";
import type { GuideStep } from "../../guide/content";

/** The player. Null for a visitor who has no account yet (see `visitor`). */
export type ProfileGroup = {
  id: string; name: string; level: number; xp: number; xpPct: number; xpText: string; /** XP still needed for the next level (Classic: "N to level L+1") */ xpLeft: number; title?: string; frame?: string; equipped: Equipped;
  streak: number; shields: number; dailyDone: number; played: number; banned: boolean; isAdmin: boolean; guest: boolean;
  /** "Save", or "Log in" inside CrazyGames */
  saveLabel: string; save: () => void; logOut: () => void;
};

/** Balances and what they buy. All spending goes through the server. */
export type WalletGroup = {
  coins: number; gems: number | null; economy: Economy | null; items: ShopItem[]; owned: Set<string>; boosters: Record<string, number>;
  refresh: () => Promise<void>; openWallet: () => void; openStore: () => void;
};

export type XpBefore = { xp: number; level: number };

/** Starting and finishing rounds. The server scores every round. */
export type RoundsGroup = {
  cfg: GameCfg | null; ops: LiveOp[]; error: string; dailyKey: number;
  challenge: ChallengeInfo | null; acceptChallenge: (code: string) => void; dismissChallenge: () => void;
  start: (mode: "solo" | "ghost" | "pvp", level: string, boosters: string[]) => void;
  startStage: (id: string) => void; startDaily: () => void; startDrill: () => void; startEvent: (id: string) => void;
  /** xpBefore: the player's XP and level when the round started, for the level bar (null for a visitor's free round, or if the profile had not loaded yet). */
  active: RoundStart | null; result: { r: RoundResult; p: RoundStart["params"]; xpBefore: XpBefore | null } | null;
  finish: (r: RoundResult, p: RoundStart["params"]) => void; fail: (message: string) => void; leave: () => void;
  /** Ends the active round: the server scores it (submit-round), as in Classic Play. A visitor's free round is scored on the device and nothing is saved. Fails with a message ready for `fail`. */
  submit: (roundId: string, taps: Tap[]) => Promise<RoundResult>;
  /** Leaving a round early (submit-round with abandon), as in Classic Play. Never fails. */
  abandon: (roundId: string) => Promise<void>;
  /** null when this kind of round cannot be replayed */
  replay: (() => void) | null;
  /** runs the between-rounds ad, if one is due, and then `go` */
  afterRound: (go: () => void) => void;
  achievementNames: Record<string, string>;
  /**
   * While the match screen shows (a live match is being found): the difficulty, and `ready`, to call with the round the server
   * started once the match is found. It does what Classic Matchmaking's onReady does in App: notes the XP for the level bar,
   * starts the round, opens the round screen and refreshes. null on every other screen, and for a visitor.
   */
  matching: { level: string; ready: (round: RoundStart) => void } | null;
};

export type ScreenName = "lobby" | "match" | "play" | "result" | "journey" | "compete" | "collect" | "wallet" | "shop" | "profile" | "help" | "inbox" | "admin" | "refer";

/** Moving between screens. */
export type NavigationGroup = { screen: ScreenName; go: (screen: ScreenName) => void; competeTab: "events" | "league" | "crew" | "calendar" | "new"; setCompeteTab: (tab: "events" | "league" | "crew" | "calendar" | "new") => void };

/** Messages to the player. */
export type NoticesGroup = { unread: number; adminUnread: number; toast: string; showToast: (message: string) => void; refreshInbox: () => void; contactUs: () => void;
  /** true when the player came to the inbox from a "Contact us" button, so it opens on the Contact us form; false from the inbox button or tab */
  composing: boolean;
};

/** Other players. */
export type SocialGroup = { arena: Arena | null; newCount: number; newIds: Set<string>; invite: boolean; facebook: string | null };

/** Daily rewards. Rewards are claimed by the server when the game opens, so nothing here claims anything. */
export type DailyGroup = {
  cal: Cal | null; openCalendar: () => void; drillDone: boolean;
  /** the edge function daily-info; rejects or gives null when it cannot load */
  loadChallenge: () => Promise<DailyInfo | null>;
  /** the database function daily_leaderboard */
  loadLeaderboard: () => Promise<{ rank: number; user_id: string; display_name: string; score: number }[]>;
};

/** Bingo DNA and the coach. */
export type DnaGroup = { dna: Dna | null; rounds: DnaRound[]; coach: string };

/** The player's settings on this device. */
export type SettingsGroup = { settings: Settings; update: (s: Settings) => void; minutesToday: number; replayTour: () => void };

/** Where the game runs, and ads. */
export type PlatformGroup = { crazyGames: boolean; ads: AdStatus | null; rewardAd: (placement: string, compact?: boolean) => ReactNode };

/** Only for a visitor with no account. Actions that need an account make a guest account first, as Classic does. */
export type VisitorGroup = { starting: boolean; playFree: () => void; logIn?: () => void; askSignUp: (reason: string) => void; welcome: number | null; /** free rounds on this device are still available */ freeRounds: boolean;
  /** A free round's result, while it is waiting to be shown (its score is in rounds.result). As Classic's GuestResult: `left` free rounds
   * remain on this device, `again` plays another at the same level (null when none are left), `join` opens sign-up, `back` closes it. */
  freeResult?: { level: string; left: number; again: (() => void) | null; join: () => void; back: () => void } | null };

export type ScreenCtx = {
  profile: ProfileGroup | null; wallet: WalletGroup; rounds: RoundsGroup; navigation: NavigationGroup; notices: NoticesGroup;
  social: SocialGroup; daily: DailyGroup; dna: DnaGroup; settings: SettingsGroup; platform: PlatformGroup; visitor: VisitorGroup | null;
} & ScreenData;
// ScreenData (lib/screenData.ts) adds the groups that load and change data, each making the same calls as a Classic screen:
// journey, season, quests, album, account, compete, store, shop, history, inbox, refer, match, auth.

export type ScreenProps = { ctx: ScreenCtx };
export type ScreenModule = { default: ComponentType<ScreenProps> };

/** A screen's fixture file (<Name>.fixture.ts) changes the sample data for its captures. */
export type ScreenFixture = (base: ScreenCtx, state: string | null) => ScreenCtx;
/**
 * Local development only. A fixture file may also export `moments`, one per state, for screens whose look depends on time, such as Play.
 * The screenshot tool then controls the page clock: it makes each tap (cell index, ms from the start of the round),
 * clicks the button named `click` if given, and takes the picture `at` ms into the round (negative: before the start).
 */
export type ScreenMoment = { at: number; taps?: Tap[]; click?: string };

// Overlays: the views App.tsx draws outside the screen host. Each new version receives only its own small ctx, because some
// are shown before a ScreenCtx exists (the terms gate and the new-password page come before the shell loads).
// An overlay uses its new version only where the viewer gets the new design and its line is in NEW_OVERLAYS (registry.ts).
export type OverlayName = "auth" | "terms" | "password" | "firstVisit" | "tour" | "arenaBar";
export type TourView = NonNullable<GuideStep["view"]>;
export type OverlayCtx = {
  /** Classic AuthGate and Auth: sign up or log in (a visitor), or save progress (guest: true, a guest account). */
  auth: {
    reason: string; mode: "reg" | "log"; welcome: number | null; guest: boolean; crazyGames: boolean;
    /** inside a frame (CrazyGames), Google opens in a small window: popupSignIn, as Classic does */
    inFrame: boolean; popupSignIn: (onState: (s: "waiting" | "blocked" | "done" | "timeout" | "error", message?: string) => void) => () => void;
    /** the same signup steps Classic records (lib/track.ts) */
    track: (step: "signup_google" | "signup_email" | "confirm_needed") => void;
    /** a fun default player name, as Classic suggests */
    suggestName: () => string;
    data: AuthGroup; saved: (() => void) | null; close: () => void;
  };
  /** Classic AgeGate: until the current terms are accepted. `updated` means they accepted an older version. Shown before the shell. */
  terms: { name: string; updated: boolean; crazyGames: boolean; accept: () => Promise<AuthReply>; done: () => Promise<void>; logOut: () => void };
  /** Classic SetPassword: after a password-reset link. Shown before the shell. */
  password: { save: (password: string) => Promise<AuthReply>; done: () => void };
  /** Classic FirstVisit: the welcome card for a first-time visitor. */
  firstVisit: { crazyGames: boolean; inviter: string | null; busy: boolean; play: () => void; logIn: (() => void) | null; close: () => void };
  /** Classic Tour: the first-time tour, "What is new" after an update, or a replay from Help or Profile. */
  tour: { kind: "full" | "new" | "replay"; heading: string; steps: GuideStep[]; close: () => void; go: (screen: TourView) => void };
  /** Classic ArenaBar: live-match invites and waiting players, above the screen. `fees` by difficulty. */
  arenaBar: { arena: Arena | null; fees: Record<string, number>; canPlay: boolean; play: (level: string) => void;
    /**
     * Accepts or declines an invite: Classic's answer_invite call. Resolves with the match's difficulty when the server gives one
     * (Classic then calls play with it, or with the invite's own difficulty). Fails with the same text Classic shows (rpcError).
     */
    answer: (id: string, yes: boolean) => Promise<{ level?: string }>;
  };
};
export type OverlayProps<K extends OverlayName> = { ctx: OverlayCtx[K] };
export type OverlayModule<K extends OverlayName> = { default: ComponentType<OverlayProps<K>> };
/** An overlay's fixture file (newui/overlays/<Name>.fixture.ts) changes the sample data for its captures. */
export type OverlayFixture<K extends OverlayName> = (base: OverlayCtx[K], state: string | null) => OverlayCtx[K];
