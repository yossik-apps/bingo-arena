// The CrazyGames SDK (v3): their login, gameplay events and ads. Loaded only when the game runs inside CrazyGames
// (or with ?cgsdk=1 for testing). Every call is safe to make when the SDK is missing: it simply does nothing.
import { onCrazyGames } from "./platform";

type CgUser = { username: string; profilePictureUrl?: string };
type AdCb = { adStarted?: () => void; adFinished?: () => void; adError?: (e: unknown) => void };
type Sdk = {
  init: () => Promise<void>;
  environment: "local" | "crazygames" | "disabled";
  user: {
    isUserAccountAvailable: boolean;
    getUser: () => Promise<CgUser | null>;
    getUserToken: () => Promise<string>;
    showAuthPrompt: () => Promise<CgUser | null>;
    addAuthListener: (fn: (u: CgUser | null) => void) => void;
  };
  game: { gameplayStart: () => void; gameplayStop: () => void; happytime: () => void; loadingStart?: () => void; loadingStop?: () => void };
  ad: { requestAd: (type: "midgame" | "rewarded", cb: AdCb) => void };
};
type W = Window & { CrazyGames?: { SDK: Sdk } };

export const useCgSdk = onCrazyGames || /[?&]cgsdk=1/.test(location.search);
const SDK_URL = "https://sdk.crazygames.com/crazygames-sdk-v3.js";

let sdk: Sdk | null = null;
let readyP: Promise<boolean> | null = null;
/** Loads and starts the SDK once. Resolves false when it is not available (outside CrazyGames, blocked, or slow). */
export function cgReady(): Promise<boolean> {
  if (!useCgSdk) return Promise.resolve(false);
  if (readyP) return readyP;
  readyP = new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), 6000);
    const start = async () => {
      try {
        const s = (window as W).CrazyGames?.SDK;
        if (!s) { clearTimeout(timer); resolve(false); return; }
        await s.init();
        if (s.environment === "disabled") { clearTimeout(timer); resolve(false); return; }
        sdk = s; clearTimeout(timer); resolve(true);
      } catch { clearTimeout(timer); resolve(false); }
    };
    if ((window as W).CrazyGames?.SDK) { void start(); return; }
    const el = document.createElement("script");
    el.src = SDK_URL; el.async = true;
    el.onload = () => void start();
    el.onerror = () => { clearTimeout(timer); resolve(false); };
    document.head.appendChild(el);
  });
  return readyP;
}
export const cgActive = () => !!sdk;

/** The CrazyGames login token, or null when the player is not logged in to CrazyGames. */
export async function cgToken(): Promise<string | null> {
  if (!(await cgReady()) || !sdk!.user.isUserAccountAvailable) return null;
  try {
    const u = await sdk!.user.getUser();
    if (!u) return null;
    return await sdk!.user.getUserToken();
  } catch { return null; }
}
export const cgAccountsAvailable = () => !!sdk && sdk.user.isUserAccountAvailable;
/** Opens the CrazyGames login. Resolves true when the player logged in. */
export async function cgLoginPrompt(): Promise<boolean> {
  if (!(await cgReady()) || !sdk!.user.isUserAccountAvailable) return false;
  try { return !!(await sdk!.user.showAuthPrompt()); } catch { return false; }
}
export function cgOnAuth(fn: (loggedIn: boolean) => void) {
  void cgReady().then((ok) => { if (ok) try { sdk!.user.addAuthListener((u) => fn(!!u)); } catch { /* ignore */ } });
}

// gameplay events: CrazyGames uses them to measure how long people really play
let playing = false;
export function cgGameplay(on: boolean) {
  if (!sdk || on === playing) return;
  playing = on;
  try { if (on) sdk.game.gameplayStart(); else sdk.game.gameplayStop(); } catch { /* ignore */ }
}
export const cgHappy = () => { try { sdk?.game.happytime(); } catch { /* ignore */ } };
export const cgLoading = (on: boolean) => { try { if (on) sdk?.game.loadingStart?.(); else sdk?.game.loadingStop?.(); } catch { /* ignore */ } };

function ad(type: "midgame" | "rewarded"): Promise<"done" | "error"> {
  return new Promise((resolve) => {
    if (!sdk) { resolve("error"); return; }
    const was = playing;
    let done = false;
    const end = (r: "done" | "error") => { if (done) return; done = true; if (was) cgGameplay(true); resolve(r); };
    const timer = setTimeout(() => end("error"), type === "midgame" ? 45000 : 90000);
    try {
      sdk.ad.requestAd(type, {
        adStarted: () => { cgGameplay(false); document.documentElement.classList.add("cg-ad"); },
        adFinished: () => { clearTimeout(timer); document.documentElement.classList.remove("cg-ad"); end("done"); },
        adError: () => { clearTimeout(timer); document.documentElement.classList.remove("cg-ad"); end("error"); },
      });
    } catch { clearTimeout(timer); end("error"); }
  });
}
/** A short ad between rounds. CrazyGames decides how often one is really shown. Always resolves. */
export const cgMidgame = () => ad("midgame").then(() => undefined);
/** A reward video. "done" means the player watched it. */
export const cgRewarded = () => ad("rewarded");
