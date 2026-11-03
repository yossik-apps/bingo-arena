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

/** The player. Null for a visitor who has no account yet (see `visitor`). */
export type ProfileGroup = {
  id: string; name: string; level: number; xp: number; xpPct: number; xpText: string; title?: string; frame?: string; equipped: Equipped;
  streak: number; shields: number; dailyDone: number; played: number; banned: boolean; isAdmin: boolean; guest: boolean;
  /** "Save", or "Log in" inside CrazyGames */
  saveLabel: string; save: () => void; logOut: () => void;
};

/** Balances and what they buy. All spending goes through the server. */
export type WalletGroup = {
  coins: number; gems: number | null; economy: Economy | null; items: ShopItem[]; owned: Set<string>; boosters: Record<string, number>;
  refresh: () => Promise<void>; openWallet: () => void; openStore: () => void;
};

/** Starting and finishing rounds. The server scores every round. */
export type RoundsGroup = {
  cfg: GameCfg | null; ops: LiveOp[]; error: string; dailyKey: number;
  challenge: ChallengeInfo | null; acceptChallenge: (code: string) => void; dismissChallenge: () => void;
  start: (mode: "solo" | "ghost" | "pvp", level: string, boosters: string[]) => void;
  startStage: (id: string) => void; startDaily: () => void; startDrill: () => void; startEvent: (id: string) => void;
  active: RoundStart | null; result: { r: RoundResult; p: RoundStart["params"] } | null;
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
};

export type ScreenName = "lobby" | "match" | "play" | "result" | "journey" | "compete" | "collect" | "wallet" | "shop" | "profile" | "help" | "inbox" | "admin" | "refer";

/** Moving between screens. */
export type NavigationGroup = { screen: ScreenName; go: (screen: ScreenName) => void; competeTab: "events" | "league" | "crew" | "calendar" | "new"; setCompeteTab: (tab: "events" | "league" | "crew" | "calendar" | "new") => void };

/** Messages to the player. */
export type NoticesGroup = { unread: number; adminUnread: number; toast: string; showToast: (message: string) => void; refreshInbox: () => void; contactUs: () => void };

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
export type VisitorGroup = { starting: boolean; playFree: () => void; logIn?: () => void; askSignUp: (reason: string) => void; welcome: number | null; /** free rounds on this device are still available */ freeRounds: boolean };

export type ScreenCtx = {
  profile: ProfileGroup | null; wallet: WalletGroup; rounds: RoundsGroup; navigation: NavigationGroup; notices: NoticesGroup;
  social: SocialGroup; daily: DailyGroup; dna: DnaGroup; settings: SettingsGroup; platform: PlatformGroup; visitor: VisitorGroup | null;
};

export type ScreenProps = { ctx: ScreenCtx };
export type ScreenModule = { default: ComponentType<ScreenProps> };

/** A screen's fixture file (<Name>.fixture.ts) changes the sample data for its captures. */
export type ScreenFixture = (base: ScreenCtx, state: string | null) => ScreenCtx;
