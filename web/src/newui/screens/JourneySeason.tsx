// The Journey's Season track tab. Looks follow the playground's Season tab (a tier card, a gold pass card, rows of tier balls);
// the data, rules and words are Classic's (views/Season.tsx and the visitor teaser in views/JourneyHub.tsx).
// Uses: season, wallet, profile, visitor
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { SeasonInfo } from "../../lib/supabase";
import { Ball, type Tone } from "../Ball";
import { Button, Card, Chip, ErrorState, ListRow, ProgressBar, Skeleton, Toast } from "../components";
import { Coin, Icon, type IconName } from "../Icon";
import type { ScreenProps } from "./contract";
import {
  canBuyPass, eyebrow, HAS_PASS, MSG, NO_SEASON, noSeasonText, PASS_TEXT, PASS_TITLE, passPrice, progress, shortHint, showPassCard, TEASER, tierButton, tierName,
  TIP_LABEL, TIP_TEXT, type Track,
} from "./JourneySeason.logic";
import "./season.css";

const TEASER_MARK: [Tone, IconName][] = [["P", "star"], ["G", "gift"], ["B", "clock"]];

function Teaser({ onJoin }: { onJoin: () => void }) {
  return (
    <div className="nu-sn-teaser">
      <Card label={TEASER.title}>
        <div className="nu-sn-tcard">
          <Chip tone="dark">Free account</Chip>
          <h2>{TEASER.title}</h2>
          <p>{TEASER.intro}</p>
        </div>
      </Card>
      <div className="nu-sn-tlist">
        {TEASER.points.map(([head, text], i) => (
          <ListRow key={head} title={head} sub={text} lead={<Ball tone={TEASER_MARK[i][0]} size={44}><Icon name={TEASER_MARK[i][1]} size={22} color="#14254F" /></Ball>} />
        ))}
      </div>
      <Button size="lg" wide onClick={onJoin}>{TEASER.button}</Button>
      <p className="nu-sn-note">{TEASER.hint}</p>
    </div>
  );
}

export default function JourneySeason({ ctx }: ScreenProps) {
  // ctx is rebuilt on every App render, so the group is kept in a ref and the data loads once
  const season = useRef(ctx.season);
  season.current = ctx.season;
  const [s, setS] = useState<SeasonInfo | null>(null);
  const [failed, setFailed] = useState(false);
  const [tip, setTip] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [ok, setOk] = useState("");
  // errors stay next to the action that failed, as Classic's notice does, until the next action
  const [err, setErr] = useState<{ at: string; text: string } | null>(null);
  const visitor = !ctx.profile;

  const load = useCallback(() => {
    setFailed(false);
    setS(null);
    season.current.load().then(setS, () => setFailed(true));
  }, []);
  useEffect(() => { if (!visitor) load(); }, [load, visitor]);
  useEffect(() => {
    if (!ok) return;
    const t = window.setTimeout(() => setOk(""), 4000);
    return () => window.clearTimeout(t);
  }, [ok]);

  if (visitor) return <Teaser onJoin={() => ctx.visitor?.playFree()} />;
  if (failed) return <ErrorState title="The season track did not load" onRetry={load} />;
  if (!s) return <Skeleton rows={4} height={64} label="Loading the season track" />;

  if (!s.active) {
    return (
      <Card label={NO_SEASON}>
        <div className="nu-sn-none"><h2>{NO_SEASON}</h2><p>{noSeasonText(s)}</p></div>
      </Card>
    );
  }

  // as in Classic: on success show the message and reload the track (the group refreshes the wallet); on failure show the server's words
  const run = async (at: string, act: () => Promise<void>, done: string) => {
    if (busy) return;
    setErr(null); setOk(""); setBusy(at);
    try {
      await act();
      setOk(done);
      await season.current.load().then(setS, () => undefined);
    } catch (e) {
      setErr({ at, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };
  const errAt = (at: string) => err?.at === at ? <Toast inline alert>{err.text}</Toast> : null;

  const p = progress(s), price = passPrice(s), coins = ctx.wallet.coins, enough = canBuyPass(s, coins);
  const tiers = s.tiers ?? [];

  const cell = (t: (typeof tiers)[number], track: Track) => {
    const b = tierButton(t, track, p.tier, !!s.pass, ctx.wallet.items), at = `${t.tier}-${track}`;
    const cls = `nu-sn-cell is-${track}${b.claimed ? " is-claimed" : ""}${b.disabled ? "" : " is-ready"}`;
    return (
      <button type="button" className={cls} disabled={b.disabled || busy !== null} aria-label={b.label} title={b.text}
        onClick={() => void run(at, () => season.current.claimTier(t.tier, track), MSG.claimed)}>
        {b.claimed ? <Icon name="check" size={16} sw={3.2} /> : b.locked ? <Icon name="lock" size={14} /> : null}
        <span className="nu-sn-celltext">{b.text}</span>
      </button>
    );
  };

  const half = Math.ceil(tiers.length / 2);
  const row = (t: (typeof tiers)[number]) => {
    const reached = t.tier <= p.tier;
    return (
      <div key={t.tier} className={`nu-sn-row${reached ? " is-reached" : ""}`}>
        <span className="nu-sn-num" role="img" aria-label={tierName(t, p.tier)}><Ball tone={reached ? "G" : "X"} size={36} mode="n" num={t.tier} /></span>
        {cell(t, "free")}
        {cell(t, "premium")}
        {(err?.at === `${t.tier}-free` || err?.at === `${t.tier}-premium`) && <div className="nu-sn-rowerr"><Toast inline alert>{err.text}</Toast></div>}
      </div>
    );
  };

  return (
    <div className="nu-season">
      <div className="nu-sn-top">
        <Card label={s.name}>
          <div className="nu-sn-head">
            <div className="nu-sn-headrow">
              <Ball tone="P" size={52} mode="n" num={p.tier} />
              <div className="nu-sn-headtext">
                <span className="nu-sn-eyebrow">{eyebrow(s)}</span>
                <h2 title={s.name}>{s.name}</h2>
              </div>
            </div>
            {s.blurb && <p className="nu-sn-blurb">{s.blurb}</p>}
            <div className="nu-sn-tierline"><b>Tier {p.tier} of 30</b><span>{s.xp} season XP</span></div>
            <ProgressBar pct={p.pct} label="Progress to the next tier" />
            <p className="nu-sn-next">
              {p.text}{" "}
              <button type="button" className="nu-sn-tipbtn" aria-label={`What is ${TIP_LABEL}?`} aria-expanded={tip} onClick={() => setTip(!tip)}><span aria-hidden="true">?</span></button>
            </p>
            {tip && <p className="nu-sn-tip" role="note">{TIP_TEXT}</p>}
          </div>
        </Card>

        {showPassCard(s) && (
          <section className="nu-sn-pass" aria-label={PASS_TITLE}>
            <div className="nu-sn-passrow">
              <Ball tone="P" size={50}><Icon name="star" size={26} color="#14254F" /></Ball>
              <div className="nu-sn-passtext"><h2>{PASS_TITLE}</h2><p>{PASS_TEXT}</p></div>
            </div>
            <div className="nu-sn-buy" data-should-see="get the pass">
              <Button size="md" wide disabled={!enough || busy !== null} onClick={() => void run("pass", season.current.buyPass, MSG.passBought)}>
                <span className="nu-sn-price">Get the pass · <Coin size={20} />{price.toLocaleString("en-US")}</span>
              </Button>
              {!enough && <p className="nu-sn-short">{shortHint(s)}</p>}
            </div>
            {errAt("pass")}
          </section>
        )}
        {s.pass && (
          <section className="nu-sn-pass is-on" aria-label={PASS_TITLE}>
            <div className="nu-sn-passrow">
              <Ball tone="P" size={50}><Icon name="star" size={26} color="#14254F" /></Ball>
              <p className="nu-sn-has">{HAS_PASS}</p>
            </div>
          </section>
        )}
      </div>

      {/* on a wide screen the list splits into two columns read top to bottom; the second heading shows only there */}
      <section className="nu-sn-tiers" aria-label="Season tiers" data-must-peek="season tiers" style={{ "--rows": half + 1 } as CSSProperties}>
        <div className="nu-sn-colhead" aria-hidden="true"><span /><b>Free</b><b>Pass</b></div>
        {tiers.slice(0, half).map(row)}
        <div className="nu-sn-colhead is-second" aria-hidden="true"><span /><b>Free</b><b>Pass</b></div>
        {tiers.slice(half).map(row)}
      </section>

      {ok && <Toast>{ok}</Toast>}
    </div>
  );
}
