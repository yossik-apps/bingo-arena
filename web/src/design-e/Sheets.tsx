import { useEffect, type ReactNode } from "react";
import { Ball } from "./Ball";
import { Coin, Gem, Icon } from "./Icon";
import { Bar, useDesk } from "./Nav";
import { COIN_PACKS, FEATURE_INFO, GEM_LEVEL, GEM_PACKS, LOOKS, rewardText, STARTER, usd, WELCOME, type Challenge, type Linked, type StoreItem } from "./data";
import { featureLevel, xpForLevel, type Feature } from "../lib/levels";

/** A card that slides up over the screen. Tapping outside it, or pressing Escape, closes it. */
function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: { key: string }) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="e-sheet-bg" onClick={onClose}>
      <div className="e-sheet e-rise" role="dialog" aria-modal="true" aria-label={label} onClick={(e: { stopPropagation: () => void }) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

const Close = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
  <button onClick={onClick} style={{ height: 46, border: 0, background: "transparent", color: "#4A5A85", fontSize: 16, fontWeight: 900 }}>{children}</button>
);

// ============ a locked tab or feature ============
export function LockSheet({ feature, xp, avgXp, onPlay, onClose }: { feature: Feature; xp: number; avgXp: number; onPlay: () => void; onClose: () => void }) {
  const info = FEATURE_INFO[feature];
  const need = featureLevel[feature];
  const goal = xpForLevel(need);
  const rounds = Math.max(1, Math.ceil((goal - xp) / avgXp));
  return (
    <Sheet label={`${info.title} is locked`} onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Ball tone="X" size={56}><Icon name="lock" size={26} color="#4A5A85" sw={2.6} /></Ball>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
          <span className="e-ld" style={{ fontSize: 24, lineHeight: 1.1 }}>{info.title}</span>
          <span className="e-sub" style={{ fontSize: 14, fontWeight: 800 }}>Unlocks at level {need}</span>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.4 }}>{info.desc}</p>
      <Bar pct={(xp / goal) * 100} />
      <span className="e-sub" style={{ fontSize: 14, fontWeight: 900 }}>About {rounds} {rounds === 1 ? "round" : "rounds"} to go</span>
      <button className="e-gold" onClick={onPlay} style={{ marginTop: 4 }}>Play a round</button>
      <Close onClick={onClose}>Close</Close>
    </Sheet>
  );
}

// ============ save progress (guest to account) ============
const GoogleLogo = () => (
  <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
    <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
    <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z" />
    <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
  </svg>
);
const AppleLogo = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#fff" d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
  </svg>
);
const COPY = {
  rounds: (c: number, l: number, _s: number) => ({ title: "Save your progress", text: `You have ${c} coins and level ${l}. Save them so you never lose them.` }),
  streak: (_c: number, _l: number, s: number) => ({ title: "Save your streak", text: `Your ${s}-day streak lives in this browser only. Save it to keep it on every device.` }),
  league: (_c: number, _l: number, _s: number) => ({ title: "Save your league spot", text: "Your weekly points and your place in the league stay with your account." }),
};
export function SaveSheet({ reason, coins, level, streak, onPick, onClose }: { reason: "rounds" | "streak" | "league"; coins: number; level: number; streak: number; onPick: (p: Linked) => void; onClose: () => void }) {
  const c = COPY[reason](coins, level, streak);
  const row = (p: Linked, label: string, logo: ReactNode, bg: string) => (
    <button key={p} className="e-mode" onClick={() => onPick(p)} style={{ minHeight: 58, border: "3px solid #DCE4F5", boxShadow: "none" }}>
      <span aria-hidden="true" style={{ width: 38, height: 38, borderRadius: "50%", background: bg, boxShadow: "inset 0 0 0 1.5px rgba(20,37,79,.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{logo}</span>
      <span className="e-ld" style={{ fontSize: 19, flex: 1 }}>{label}</span>
    </button>
  );
  return (
    <Sheet label={c.title} onClose={onClose}>
      <h2 className="e-ld" style={{ margin: 0, fontSize: 26, lineHeight: 1.1 }}>{c.title}</h2>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.4 }}>{c.text}</p>
      {row("google", "Continue with Google", <GoogleLogo />, "#fff")}
      {row("apple", "Continue with Apple", <AppleLogo />, "#000")}
      {row("email", "Continue with email", <Icon name="mail" size={20} color="#fff" sw={2.4} />, "#2F6FE4")}
      <span className="e-sub" style={{ fontSize: 12, fontWeight: 700, textAlign: "center" }}>Playground: no real sign-in happens here. The live game saves to your account.</span>
      <Close onClick={onClose}>Maybe later</Close>
    </Sheet>
  );
}

// ============ reminders ============
export function NotifySheet({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  return (
    <Sheet label="Reminders" onClose={onNo}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Ball tone="P" size={56}><Icon name="bell" size={28} color="#3A2300" /></Ball>
        <h2 className="e-ld" style={{ margin: 0, fontSize: 24, lineHeight: 1.1, flex: 1 }}>Want a reminder?</h2>
      </div>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.4 }}>We can tell you when your daily reward is ready, or when your streak is about to end. At most one a day, and you can turn it off any time.</p>
      <button className="e-gold" onClick={onYes} style={{ marginTop: 4 }}>Yes, remind me</button>
      <Close onClick={onNo}>Not now</Close>
    </Sheet>
  );
}

// ============ a friend's challenge link ============
export function ChallengeIn({ c, welcome, onAccept, onDecline }: { c: Challenge; /** the welcome gift has not been paid yet */ welcome: boolean; onAccept: () => void; onDecline: () => void }) {
  const desk = useDesk();
  return (
    <div className={`e-root e-fade e-hero-bg${desk ? " e-desk-embed e-center" : ""}`} style={{ alignItems: "center", justifyContent: "center", gap: 16, padding: 24 }}>
      <Ball tone="I" size={104} style={{ border: "5px solid #fff" }}><b style={{ fontSize: 46 }}>{c.name[0].toUpperCase()}</b></Ball>
      <h1 className="e-ld" style={{ margin: 0, fontSize: 32, lineHeight: 1.1, textAlign: "center", textShadow: "0 3px 0 #123E91" }}>{c.name} challenged you!</h1>
      <div className="e-white" style={{ padding: "12px 24px", textAlign: "center" }}>
        <div className="e-ld" style={{ fontSize: 44, lineHeight: 1 }}>{c.score}</div>
        <div className="e-sub" style={{ fontSize: 14, fontWeight: 800 }}>points to beat · {c.speed[0].toUpperCase() + c.speed.slice(1)} speed</div>
      </div>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, textAlign: "center", maxWidth: 290, lineHeight: 1.4 }}>Same board, same numbers. Highest score wins. No account needed.</p>
      {welcome && (
        <span className="e-chip" role="note" style={{ fontSize: 14, padding: "6px 14px 6px 10px" }}>
          <Icon name="gift" size={18} color="#8A4B00" sw={2.4} />Welcome gift for playing: {rewardText(WELCOME, 99)}
        </span>
      )}
      <button className="e-gold" onClick={onAccept} style={{ width: "100%", maxWidth: 360, marginTop: 6 }}>Accept the challenge</button>
      <button className="e-ghost" onClick={onDecline}>Not now</button>
    </div>
  );
}

// ============ the store (play money: no payment is taken) ============
const contents = (it: StoreItem, level: number) => [
  it.reward.coins ? `${it.reward.coins} coins` : "", it.reward.gems && (level >= GEM_LEVEL || it.kind === "gems") ? `${it.reward.gems} gems` : "",
  it.reward.boosters ? "3 of each booster" : "", it.look ? `${LOOKS.find((l) => l.id === it.look)?.name} look` : "",
].filter(Boolean);

const packStyle = { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, border: "3px solid #DCE4F5", borderRadius: 18, background: "#fff", padding: "10px 6px", font: "inherit", color: "#14254F", minHeight: 96, cursor: "pointer" } as const;

export function StoreSheet({ focus, reason, level, starterBought, onPick, onClose }: { focus?: "coins" | "gems"; reason?: string; level: number; starterBought: boolean; onPick: (it: StoreItem) => void; onClose: () => void }) {
  const gemsOn = level >= GEM_LEVEL;
  const pack = (it: StoreItem, icon: ReactNode) => (
    <button key={it.id} onClick={() => onPick(it)} aria-label={`${it.name}, ${contents(it, level).join(", ")}, ${usd(it.usd)}`} style={packStyle}>
      <span className="e-ld" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 24, lineHeight: 1 }}>{icon}{it.reward.gems ?? it.reward.coins}</span>
      <span style={{ fontSize: 12, fontWeight: 800, color: "#4A5A85" }}>{it.name}</span>
      <span style={{ minHeight: 16, fontSize: 11, fontWeight: 900, color: "#0F6B3A" }}>{it.tag ?? ""}</span>
      <span className="e-ld" style={{ fontSize: 17, background: "#FFC531", color: "#3A2300", borderRadius: 12, padding: "3px 14px", boxShadow: "0 3px 0 #D98E00" }}>{usd(it.usd)}</span>
    </button>
  );
  const gems = gemsOn ? (
    <section key="gems" aria-label="Gems" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <h3 className="e-ld" style={{ margin: 0, fontSize: 18 }}>Gems</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>{GEM_PACKS.map((it) => pack(it, <Gem size={26} />))}</div>
    </section>
  ) : null;
  const coins = (
    <section key="coins" aria-label="Coins" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <h3 className="e-ld" style={{ margin: 0, fontSize: 18 }}>Coins</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>{COIN_PACKS.map((it) => pack(it, <Coin size={26} />))}</div>
    </section>
  );
  return (
    <Sheet label="Get more" onClose={onClose}>
      <h2 className="e-ld" style={{ margin: 0, fontSize: 26, lineHeight: 1.1 }}>Get more</h2>
      {reason && <p role="status" style={{ margin: 0, fontSize: 15, fontWeight: 800, lineHeight: 1.35 }}>{reason}</p>}
      {!starterBought && (
        <section aria-label="Starter pack" style={{ border: "3px solid #FFC531", background: "#FFF8E1", borderRadius: 20, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="e-ld" style={{ fontSize: 22, lineHeight: 1.1, flex: 1 }}>Starter pack</span>
            <span className="e-tag">ONE TIME</span>
          </span>
          <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {contents(STARTER, level).map((t) => <span key={t} className="e-chip">{t}</span>)}
          </span>
          <button className="e-gold" onClick={() => onPick(STARTER)} style={{ height: 48, fontSize: 18 }}>Get it · {usd(STARTER.usd)}</button>
        </section>
      )}
      {focus === "gems" ? [gems, coins] : [coins, gems]}
      <span className="e-sub" style={{ fontSize: 12, fontWeight: 700, textAlign: "center" }}>Prototype: no payment is taken. Coins and gems cannot be sent to other players or turned into money.</span>
      <Close onClick={onClose}>Close</Close>
    </Sheet>
  );
}

export function CheckoutSheet({ item, level, onPay, onCancel }: { item: StoreItem; level: number; onPay: () => void; onCancel: () => void }) {
  const has = item.kind === "pass" ? ["Gold reward track", "Extra streak freeze slot", "3 exclusive looks"] : contents(item, level);
  return (
    <Sheet label={`Checkout: ${item.name}`} onClose={onCancel}>
      <h2 className="e-ld" style={{ margin: 0, fontSize: 26, lineHeight: 1.1 }}>Checkout</h2>
      <div role="note" style={{ background: "#FFF1C2", color: "#6B3A00", borderRadius: 14, padding: "8px 12px", fontSize: 14, fontWeight: 900, lineHeight: 1.35 }}>
        PROTOTYPE: no payment is taken and no card is needed. The real game shows the store's own payment screen here.
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          <span className="e-ld" style={{ fontSize: 22, lineHeight: 1.1 }}>{item.name}</span>
          <span className="e-sub" style={{ fontSize: 13, fontWeight: 700 }}>{has.join(" · ")}</span>
        </span>
        <span className="e-ld" style={{ fontSize: 26 }}>{usd(item.usd)}</span>
      </div>
      <button className="e-gold" onClick={onPay} style={{ marginTop: 4 }}>Pay {usd(item.usd)} (test)</button>
      <Close onClick={onCancel}>Cancel</Close>
    </Sheet>
  );
}
