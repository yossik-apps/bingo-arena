import { onCrazyGames } from "./platform";
// Google's Ad Placement API for web games (H5 Games Ads): optional reward videos and short breaks between rounds.
// The ad script is only loaded when the owner switched ads on in Admin and the player is not a Bingo Club member.
import { supabase } from "./supabase";

export type AdStatus = { enabled: boolean; client: string; test_mode: boolean; reward_coins: number; left_today: number; interstitial: boolean; every_n_rounds: number; club: boolean };
type Placement = { type: string; name: string; beforeAd?: () => void; afterAd?: () => void; beforeReward?: (show: () => void) => void; adDismissed?: () => void; adViewed?: () => void; adBreakDone?: (info: unknown) => void };
type W = Window & { adsbygoogle?: unknown[]; adBreak?: (o: Placement) => void; adConfig?: (o: Record<string, unknown>) => void };

let loaded = "";
export async function loadAdStatus(): Promise<AdStatus | null> {
  const { data, error } = await supabase.rpc("my_ad_status");
  return error || !data ? null : (data as AdStatus); // null until the 0.18 database update is installed
}
// never inside CrazyGames: their rules allow only their own ads there
export const adsActive = (s: AdStatus | null) => !onCrazyGames && !!s && s.enabled && !!s.client && !s.club;

/** Adds Google's ad script to the page once. */
export function ensureAds(s: AdStatus | null) {
  if (!adsActive(s) || loaded === s!.client) return;
  loaded = s!.client;
  const w = window as W;
  w.adsbygoogle = w.adsbygoogle || [];
  w.adBreak = w.adConfig = (o: Record<string, unknown>) => { w.adsbygoogle!.push(o); };
  const el = document.createElement("script");
  el.async = true;
  el.crossOrigin = "anonymous";
  el.setAttribute("data-ad-frequency-hint", "30s");
  if (s!.test_mode) el.setAttribute("data-adbreak-test", "on");
  el.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(s!.client)}`;
  document.head.appendChild(el);
  w.adConfig({ preloadAdBreaks: "on", sound: "on" });
}

/** Shows a reward video. Resolves "viewed" only if the player watched it to the end. */
export function showReward(name: string): Promise<"viewed" | "dismissed" | "unavailable"> {
  const w = window as W;
  return new Promise((resolve) => {
    if (!w.adBreak) { resolve("unavailable"); return; }
    let done = false;
    const finish = (r: "viewed" | "dismissed" | "unavailable") => { if (!done) { done = true; resolve(r); } };
    const timer = setTimeout(() => finish("unavailable"), 15000); // no answer from the ad service
    w.adBreak({
      type: "reward", name,
      beforeReward: (show) => { clearTimeout(timer); show(); },
      adViewed: () => finish("viewed"),
      adDismissed: () => finish("dismissed"),
      adBreakDone: () => { clearTimeout(timer); finish("unavailable"); },
    });
  });
}

/** A short ad between rounds (Google decides whether one is shown). Always resolves. */
export function showBreak(name: string): Promise<void> {
  const w = window as W;
  return new Promise((resolve) => {
    if (!w.adBreak) { resolve(); return; }
    const timer = setTimeout(resolve, 8000);
    w.adBreak({ type: "next", name, adBreakDone: () => { clearTimeout(timer); resolve(); } });
  });
}
