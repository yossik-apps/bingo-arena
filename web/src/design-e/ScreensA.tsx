import { useEffect, useState, type CSSProperties } from "react";
import { Ball, toneOf } from "./Ball";
import { Coin, Gem, Icon } from "./Icon";
import { Bar, LockedCard, Mini, Page, rowStyle, sectionTitle, Seg, type Tab } from "./Nav";
import {
  BOOSTERS, BOX_SKIP_GEMS, boxLeft, boxReward, CARD, GEM_LEVEL, cyclePos, DAILY, fmtLeft, freezeMax, FREEZE_PRICE, LOOKS, questOf, REPAIR_COINS, REPAIR_GEMS, REPAIR_MIN, REROLL_PRICE,
  rewardText, SET_NAMES, SET_REWARD, STAMPS, STAMP_TONES, STARTER, usd,
  type Boost, type Run, type Saved,
} from "./data";
import { featureLevel, unlocked } from "../lib/levels";

type Common = { level: number; s: Saved; onNav: (t: Tab | "daily") => void };

// ============ Daily rewards and streak (level 2) ============
/** A countdown that ticks every second. The page that shows it does not redraw on its own. */
function Tick({ s }: { s: Saved }) {
  const [, t] = useState(0);
  useEffect(() => { const id = setInterval(() => t((x) => x + 1), 1000); return () => clearInterval(id); }, []);
  return <>{fmtLeft(boxLeft(s))}</>;
}

export function DailyRewards({ level, s, onClaim, onFreeze, onBack, onNav, onBox, onSkipBox, onRepair }: Common & {
  onClaim: () => void; onFreeze: () => void; onBack: () => void; onBox: () => void; onSkipBox: () => void; onRepair: (pay: Pay) => void;
}) {
  const done = cyclePos(s.daily);
  const today = s.daily.ready ? s.daily.claimed % 7 : -1;
  const r = DAILY[s.daily.claimed % 7];
  const fmax = freezeMax(s);
  const full = s.freezes >= fmax;
  const short = !full && s.coins < FREEZE_PRICE;
  const boxReady = boxLeft(s) === 0;
  const br = boxReward(s.box.n);
  const repairable = !!s.lost && s.lost.streak >= REPAIR_MIN && s.daily.ready;
  return (
    <Page narrow title="Daily rewards" level={level} tab={null} onNav={(t) => onNav(t)} onBack={onBack} coins={s.coins} gems={s.gems}>
      {s.note && <div className="e-white" role="status" style={{ ...rowStyle, background: "#FFF8E1", fontSize: 14, fontWeight: 800, lineHeight: 1.35 }}>{s.note}</div>}
      <div className="e-white" style={{ ...rowStyle, borderRadius: 22 }}>
        <Ball tone="O" size={50}><Icon name="flame" size={26} color="#14254F" /></Ball>
        <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
          <span className="e-ld" style={{ fontSize: 22, lineHeight: 1.1 }}>{s.streak} {s.streak === 1 ? "day" : "days"} in a row</span>
          <span className="e-sub" style={{ fontSize: 13, fontWeight: 700 }}>{s.daily.ready ? (s.streak > 0 ? "Claim today to keep your streak." : "Claim today to start a streak.") : "Streak safe. Come back tomorrow."}</span>
        </span>
      </div>
      {repairable && s.lost && (
        <div className="e-white" role="group" aria-label="Repair your streak" style={{ ...rowStyle, borderRadius: 22, background: "#FFF1F0", flexWrap: "wrap" }}>
          <Ball tone="I" size={50}><Icon name="flame" size={26} color="#14254F" /></Ball>
          <span style={{ flex: 1, minWidth: 140, display: "flex", flexDirection: "column", gap: 1 }}>
            <span className="e-ld" style={{ fontSize: 20, lineHeight: 1.1 }}>Bring back your {s.lost.streak}-day streak</span>
            <span className="e-sub" style={{ fontSize: 13, fontWeight: 700 }}>You missed a day. Repair it before you claim today.</span>
          </span>
          <BuyButtons b={{ price: REPAIR_COINS, gems: REPAIR_GEMS }} coins={s.coins} gems={s.gems} level={level} onBuy={onRepair} />
        </div>
      )}
      <div className="e-white" style={{ ...rowStyle, borderRadius: 22 }}>
        <Ball tone="G" size={50}><Icon name="gift" size={26} color="#14254F" /></Ball>
        <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
          <span className="e-ld" style={{ fontSize: 20, lineHeight: 1.1 }}>Free bonus box</span>
          <span className="e-sub" style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.25 }}>
            {boxReady ? `Ready: ${rewardText(br, level)}` : <>Opens in <Tick s={s} /> · {rewardText(br, level)}</>}
          </span>
        </span>
        {boxReady ? <Mini onClick={onBox}>Open</Mini>
          : level >= GEM_LEVEL ? <Mini short={s.gems < BOX_SKIP_GEMS} onClick={onSkipBox} label={`Open now for ${BOX_SKIP_GEMS} gems`}><span style={{ display: "flex", alignItems: "center", gap: 4 }}><Gem size={18} />{BOX_SKIP_GEMS}</span></Mini> : null}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
        {DAILY.map((d, i) => {
          const claimed = i < done;
          const isToday = i === today;
          const big = i === 6;
          const st: CSSProperties = { gridColumn: big ? "span 2" : undefined, height: 104, borderRadius: 20, padding: "8px 4px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, position: "relative", boxShadow: isToday ? undefined : "0 4px 0 #0E3E9C", opacity: claimed ? 0.75 : 1, background: isToday ? "#FFF8E1" : undefined };
          return (
            <div key={i} className={`e-white${isToday ? " e-ring" : ""}`} style={st} aria-label={`Day ${i + 1}: ${rewardText(d, level)}${claimed ? ", claimed" : ""}`} role="group">
              <span style={{ fontSize: 12, fontWeight: 900 }} className="e-sub">Day {i + 1}</span>
              <Ball tone={big ? "P" : i % 2 ? "I" : "G"} size={big ? 52 : 44}><Icon name={big ? "trophy" : "gift"} size={big ? 26 : 22} color="#14254F" /></Ball>
              <span style={{ fontSize: 12, fontWeight: 900, textAlign: "center", lineHeight: 1.2, padding: "0 4px" }}>{rewardText(d, level)}</span>
              {claimed && <span role="img" aria-label="Claimed" style={{ position: "absolute", top: -6, right: -6, width: 24, height: 24, borderRadius: "50%", background: "#2EB872", border: "2.5px solid #fff", boxSizing: "border-box", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="check" size={12} color="#fff" sw={3.4} /></span>}
            </div>
          );
        })}
      </div>
      <div className="e-panel" style={{ ...rowStyle, boxShadow: "none", background: "#123E91" }}>
        <Ball tone="B" size={44}><Icon name="shield" size={22} color="#14254F" /></Ball>
        <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
          <span className="e-ld" style={{ fontSize: 18, lineHeight: 1.1 }}>Streak freeze</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#DCE7FF", lineHeight: 1.25 }}>Saves your streak if you miss a day. You have {s.freezes} of {fmax}.</span>
        </span>
        <Mini disabled={full} short={short} onClick={onFreeze} label={`Buy a streak freeze for ${FREEZE_PRICE} coins`}><span style={{ display: "flex", alignItems: "center", gap: 4 }}><Coin size={18} />{FREEZE_PRICE}</span></Mini>
      </div>
      <span style={{ flex: 1 }} />
      <button className="e-gold" disabled={!s.daily.ready} onClick={onClaim} style={{ flexShrink: 0 }}>
        {s.daily.ready ? `Claim ${rewardText(r, level)}` : "Come back tomorrow"}
      </button>
    </Page>
  );
}

// ============ Collect: quests, daily card, album ============
export function Collect({ level, s, onClaimQuest, onReroll, onPlayChallenge, onNav }: Common & { onClaimQuest: (i: number) => void; onReroll: (i: number) => void; onPlayChallenge: () => void }) {
  const [tab, setTab] = useState<"quests" | "album">("quests");
  const albumOn = unlocked("album", level);
  return (
    <Page title="Collect" level={level} tab="collect" onNav={(t) => onNav(t)} coins={s.coins} gems={s.gems}>
      <Seg label="Collect" value={tab} onChange={setTab} options={[{ id: "quests", text: "Quests" }, { id: "album", text: albumOn ? `Album ${s.stamps.length}/${STAMPS.length}` : "Album", locked: !albumOn }]} />
      {tab === "quests" ? (
        <>
          {unlocked("dailyChallenge", level) && (
            <div className="e-white" style={{ ...rowStyle, borderRadius: 22 }}>
              <Ball tone="G" size={52}><Icon name="target" size={26} color="#14254F" /></Ball>
              <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
                <span className="e-ld" style={{ fontSize: 20, lineHeight: 1.1 }}>Daily card</span>
                <span className="e-sub" style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.25 }}>{s.today.cardScore >= 0 ? `You scored ${s.today.cardScore}. Replays are practice.` : `Same board for everyone · ${rewardText(CARD.reward, level)}`}</span>
              </span>
              <Mini onClick={onPlayChallenge}>{s.today.cardScore >= 0 ? "Replay" : "Play"}</Mini>
            </div>
          )}
          <h2 style={sectionTitle}>Today's quests</h2>
          {[0, 1, 2].map((i) => {
            const q = questOf(i, s.today.qv[i] ?? 0);
            const have = Math.min(q.goal, s.today[q.key]);
            const ready = have >= q.goal && !s.today.done[i];
            return (
              <div key={i} className="e-white e-quest" style={{ ...rowStyle, flexDirection: "column", alignItems: "stretch", justifyContent: "center", gap: 8 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ flex: 1, fontSize: 16, fontWeight: 900 }}>{q.text}</span>
                  <span className="e-sub" style={{ fontSize: 13, fontWeight: 800 }}>{rewardText(q.reward, level)}</span>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 40 }}>
                  <span style={{ flex: 1 }}><Bar pct={(have / q.goal) * 100} /></span>
                  <span className="e-sub" style={{ fontSize: 13, fontWeight: 900, minWidth: 40, textAlign: "right" }}>{have}/{q.goal}</span>
                  {!s.today.done[i] && !ready && (
                    <button className="e-reroll" aria-label={`Swap this quest for another one, ${REROLL_PRICE} coins`} aria-disabled={s.coins < REROLL_PRICE || undefined} onClick={() => onReroll(i)}>
                      <Icon name="refresh" size={16} sw={2.6} /><Coin size={16} />{REROLL_PRICE}
                    </button>
                  )}
                  {s.today.done[i] ? <span className="e-tag" style={{ background: "#2EB872" }}>CLAIMED</span> : <Mini disabled={!ready} onClick={() => onClaimQuest(i)}>Claim</Mini>}
                </span>
              </div>
            );
          })}
          <p style={{ margin: "2px 2px 0", fontSize: 13, fontWeight: 700, color: "#DCE7FF" }}>New quests every day. Play a round to fill the bars.</p>
        </>
      ) : !albumOn ? (
        <LockedCard title="Album" text={`Unlocks at level ${featureLevel.album}`} />
      ) : (
        <>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#DCE7FF" }}>Every round you play can win a stamp. Finish a set for {rewardText(SET_REWARD, level)}.</p>
          <div className="e-span e-sets">
          {SET_NAMES.map((setName, k) => {
            const have = [0, 1, 2, 3, 4, 5].filter((j) => s.stamps.includes(k * 6 + j)).length;
            return (
              <div key={setName} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <h2 style={{ ...sectionTitle, display: "flex", justifyContent: "space-between" }}><span>{setName}</span><span>{s.setClaimed[k] ? "Done" : `${have}/6`}</span></h2>
                <div className="e-stamps" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                  {[0, 1, 2, 3, 4, 5].map((j) => {
                    const i = k * 6 + j, name = STAMPS[i];
                    const got = s.stamps.includes(i);
                    const latest = got && s.stamps[s.stamps.length - 1] === i;
                    return (
                      <div key={name} className={got ? "e-white" : "e-panel"} role="group" aria-label={got ? name : "Locked stamp"}
                        style={{ borderRadius: 16, height: 98, padding: "8px 2px 4px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, boxShadow: got ? "0 3px 0 #0E3E9C" : "none", position: "relative" }}>
                        {got ? <Ball tone={STAMP_TONES[i % STAMP_TONES.length] === "P" ? toneOf(i * 3 + 1) : STAMP_TONES[i % STAMP_TONES.length]} size={44} mode="n" num={i + 1} /> : <Ball tone="X" size={44}><Icon name="lock" size={18} color="#4A5A85" sw={2.6} /></Ball>}
                        <span style={{ fontSize: 11, fontWeight: 900, lineHeight: 1.15, textAlign: "center", color: got ? "#14254F" : "#DCE7FF" }}>{got ? name : "???"}</span>
                        {latest && <span className="e-tag" style={{ position: "absolute", top: -6, right: -2, fontSize: 10, padding: "0 6px" }}>NEW</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          </div>
        </>
      )}
    </Page>
  );
}

// ============ Shop (level 6) ============
export function Shop({ level, s, onBuyBooster, onBuyLook, onEquip, onStore, onNav }: Common & { onBuyBooster: (b: Boost, pay?: Pay) => void; onBuyLook: (id: string) => void; onEquip: (id: string) => void; onStore: () => void }) {
  const [tab, setTab] = useState<"boosters" | "looks">("boosters");
  return (
    <Page title="Shop" level={level} tab="shop" onNav={(t) => onNav(t)} coins={s.coins} gems={s.gems}>
      <Seg label="Shop" value={tab} onChange={setTab} options={[{ id: "boosters", text: "Boosters" }, { id: "looks", text: "Dabber looks" }]} />
      <div className="e-white e-span" style={{ ...rowStyle, borderRadius: 22, background: s.iap.starter ? undefined : "#FFF8E1" }}>
        <Ball tone="P" size={50}><Icon name="bag" size={24} color="#14254F" /></Ball>
        <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
          <span className="e-ld" style={{ fontSize: 19, lineHeight: 1.1 }}>{s.iap.starter ? "Coins and gems" : `Starter pack ${usd(STARTER.usd)}`}</span>
          <span className="e-sub" style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.25 }}>{s.iap.starter ? "Top up when you run low." : "500 coins, 30 gems, 3 of each booster and the Sparkle look. One time."}</span>
        </span>
        <Mini onClick={onStore}>{s.iap.starter ? "Get more" : "See it"}</Mini>
      </div>
      {tab === "boosters" ? (
        <>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#DCE7FF" }}>Pay with coins or gems. You also win boosters from daily rewards, quests and the season. Each one is used up when a round starts.</p>
          {BOOSTERS.map((b) => (
            <div key={b.id} className="e-white" style={rowStyle}>
              <Ball tone={b.tone} size={54}><BoosterMark id={b.id} short={b.short} /></Ball>
              <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
                <span className="e-ld" style={{ fontSize: 20, lineHeight: 1.1 }}>{b.name}</span>
                <span className="e-sub" style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.25 }}>{b.desc}</span>
                <span style={{ fontSize: 12, fontWeight: 900, color: "#0F6B3A" }}>You have {s.boosters[b.id]}</span>
              </span>
              <BuyButtons b={b} coins={s.coins} gems={s.gems} level={level} onBuy={(pay) => onBuyBooster(b.id, pay)} />
            </div>
          ))}
        </>
      ) : (
        <>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#DCE7FF" }}>Change the color of your dabber ink. Gems come from quests, the season and events.</p>
          <div className="e-span e-looks" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            {LOOKS.map((l) => {
              const owned = s.owned.includes(l.id);
              const on = s.look === l.id;
              const can = s.gems >= l.price;
              return (
                <div key={l.id} className="e-white" style={{ borderRadius: 20, boxShadow: on ? "0 0 0 3px #FFC531, 0 4px 0 #D98E00" : "0 4px 0 #0E3E9C", padding: "12px 8px 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <span aria-hidden="true" className="e-ld" style={{ width: 60, height: 60, borderRadius: "52% 48% 50% 50%/50% 52% 48% 50%", background: `radial-gradient(circle at 36% 30%, ${l.c[0]} 0, ${l.c[1]} 50%, ${l.c[2]} 100%)`, boxShadow: "inset -3px -4px 6px rgba(0,0,0,.25), inset 2px 3px 4px rgba(255,255,255,.4)", color: "#fff", fontSize: 24, display: "flex", alignItems: "center", justifyContent: "center", textShadow: "0 1px 0 rgba(0,0,0,.35)" }}>42</span>
                  <span className="e-ld" style={{ fontSize: 18, lineHeight: 1 }}>{l.name}</span>
                  <span style={{ minHeight: 40, display: "flex", alignItems: "center" }}>
                    {owned ? (on ? <span className="e-tag" style={{ background: "#157A49" }}>EQUIPPED</span> : <Mini onClick={() => onEquip(l.id)}>Equip</Mini>)
                      : l.only ? <span className="e-tag" style={{ background: "#4A5A85" }}>{l.only}</span>
                        : <Mini short={!can} onClick={() => onBuyLook(l.id)} label={`Buy ${l.name} for ${l.price} gems`}><span style={{ display: "flex", alignItems: "center", gap: 4 }}><Gem size={18} />{l.price}</span></Mini>}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Page>
  );
}

// ============ Get ready (level 5: boosters) ============
export function Prep({ level, s, run, fee, onStart, onBuy, onBack }: { level: number; s: Saved; run: Run; fee: number; onStart: (b: Boost | null) => void; onBuy: (b: Boost, pay?: Pay) => void; onBack: () => void }) {
  const [pick, setPick] = useState<Boost | null>(null);
  const speedName = run.speed[0].toUpperCase() + run.speed.slice(1);
  return (
    <Page narrow title="Get ready" level={level} tab={null} onNav={() => onBack()} onBack={onBack} coins={s.coins} gems={s.gems}>
      <div className="e-white" style={{ ...rowStyle, borderRadius: 22 }}>
        <Ball tone={run.kind === "ghost" ? "I" : run.kind === "person" ? "N" : run.kind === "journey" ? "G" : run.kind === "challenge" ? "O" : "B"} size={52}>
          <Icon name={run.kind === "ghost" ? "ghost" : run.kind === "person" ? "users" : run.kind === "journey" ? "map" : run.kind === "challenge" ? "target" : "user"} size={26} color="#14254F" />
        </Ball>
        <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
          <span className="e-ld" style={{ fontSize: 22, lineHeight: 1.1 }}>{run.label}</span>
          <span className="e-sub" style={{ fontSize: 13, fontWeight: 700 }}>{speedName} speed{run.rival ? ` · vs ${run.rival.name}` : ""}</span>
        </span>
        {run.kind === "ghost" && fee > 0 && <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 16, fontWeight: 900 }}><Coin size={20} />{fee}</span>}
      </div>
      <h2 style={sectionTitle}>Boost this round (optional)</h2>
      <p style={{ margin: "-4px 2px 0", fontSize: 13, fontWeight: 700, color: "#DCE7FF" }}>Tap one to use it in this round. It is used up when the round starts.</p>
      {BOOSTERS.map((b) => {
        const have = s.boosters[b.id];
        const on = pick === b.id;
        return (
          <div key={b.id} className="e-mode" role="radio" aria-checked={on} tabIndex={0} onClick={() => have > 0 && setPick(on ? null : b.id)}
            onKeyDown={(e: { key: string; preventDefault: () => void }) => { if ((e.key === "Enter" || e.key === " ") && have > 0) { e.preventDefault(); setPick(on ? null : b.id); } }}
            style={{ cursor: have > 0 ? "pointer" : "default", opacity: have > 0 ? 1 : 0.9 }}>
            <Ball tone={b.tone} size={48}><BoosterMark id={b.id} short={b.short} /></Ball>
            <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
              <span className="e-ld" style={{ fontSize: 19, lineHeight: 1.1 }}>{b.name}</span>
              <span className="e-sub" style={{ fontSize: 12, fontWeight: 700 }}>{b.desc}</span>
            </span>
            {have > 0 ? (on
              ? <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 900, color: "#0F6B3A", whiteSpace: "nowrap" }}><Icon name="check" size={16} color="#0F6B3A" sw={3.4} />Using 1</span>
              : <span style={{ fontSize: 13, fontWeight: 900, color: "#0F6B3A", whiteSpace: "nowrap" }}>You have {have}</span>) : <BuyButtons b={b} coins={s.coins} gems={s.gems} level={level} onBuy={(pay) => onBuy(b.id, pay)} />}
          </div>
        );
      })}
      <span style={{ flex: 1 }} />
      <button className="e-gold" disabled={s.coins < fee} onClick={() => onStart(pick)}>{pick ? "Start with booster" : "Start"}</button>
    </Page>
  );
}

type Pay = "coins" | "gems";

/** Two prices for one booster: coins, and (from level 6, when gems appear) gems. */
export function BuyButtons({ b, coins, gems, level, onBuy }: { b: { price: number; gems: number }; coins: number; gems: number; level: number; onBuy: (pay: Pay) => void }) {
  const btn = (pay: Pay, price: number, have: number, icon: JSX.Element) => {
    const off = have < price;
    return (
      <button onClick={() => onBuy(pay)} aria-disabled={off || undefined} aria-label={`Buy for ${price} ${pay}`} className="e-ld"
        style={{ height: 40, minWidth: 72, border: 0, borderRadius: 12, padding: "0 12px", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, fontSize: 16, background: off ? "#DCE4F5" : pay === "gems" ? "#7CE0F0" : "#FFC531", color: off ? "#4A5A85" : "#3A2300", boxShadow: off ? "none" : pay === "gems" ? "0 3px 0 #2AA7BE" : "0 3px 0 #D98E00" }}>
        {icon}{price}
      </button>
    );
  };
  return (
    <span style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
      {btn("coins", b.price, coins, <Coin size={18} />)}
      {level >= GEM_LEVEL && btn("gems", b.gems, gems, <Gem size={18} />)}
    </span>
  );
}

/** The mark inside a booster ball: an icon for the words that do not fit (Hint, Slow), text for "x2". */
function BoosterMark({ id, short }: { id: string; short: string }) {
  if (id === "hint") return <Icon name="eye" size={19} color="#14254F" sw={2.6} />;
  if (id === "slow") return <Icon name="clock" size={19} color="#14254F" sw={2.6} />;
  return <b style={{ fontSize: 17 }}>{short}</b>;
}
