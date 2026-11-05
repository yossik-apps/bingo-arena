// Invite friends: your link, the share bar, what you earn per friend, your totals and your friends. Same call and wording as Classic views/Refer.tsx.
// Looks follow the playground's invite card (Compete, Friends tab); none of its sample friends or rewards are used.
// Uses: refer, social, platform
import { useEffect, useRef, useState } from "react";
import type { Referral } from "../../lib/screenData";
import { Ball, type Tone } from "../Ball";
import { Button, Card, Chip, SectionHeader, Share, Skeleton } from "../components";
import { Icon } from "../Icon";
import type { ScreenProps } from "./contract";
import { earned, friendSteps, heading, intro, inviteLink, joinedLine, kpis, reason, shareText, steps, WORDS } from "./Refer.logic";
import "./refer.css";

const TONES: Tone[] = ["B", "I", "N", "G", "O"];

function Notice({ text }: { text: string }) {
  return <Card label={WORDS.title}><div className="nu-rf-note"><Ball tone="I" size={48}><Icon name="users" size={22} color="#14254F" /></Ball><p>{text}</p></div></Card>;
}

export default function Refer({ ctx }: ScreenProps) {
  // invites need links to our own site, which CrazyGames does not allow (Classic App.tsx)
  if (!ctx.social.invite || ctx.platform.crazyGames) return <div className="nu-refer"><Notice text={WORDS.crazyGames} /></div>;
  return <Invite ctx={ctx} />;
}

function Invite({ ctx }: ScreenProps) {
  const refer = useRef(ctx.refer);
  refer.current = ctx.refer;
  const [d, setD] = useState<Referral | "old" | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>();
  useEffect(() => {
    let live = true;
    refer.current.load().then((v) => { if (live) setD(v); }, () => { if (live) setD("old"); });
    return () => { live = false; window.clearTimeout(timer.current); };
  }, []);

  if (d === undefined) return <div className="nu-refer"><Skeleton rows={1} height={120} label="Loading your invites" /><Skeleton rows={1} height={200} label="Loading your invites" /></div>;
  if (d === null) return null; // a visitor: the menu does not offer Invite friends
  if (d === "old") return <div className="nu-refer"><Notice text={WORDS.old} /></div>;
  if (!d.enabled) return <div className="nu-refer"><Notice text={WORDS.paused} /></div>;

  const r = d.rewards, link = inviteLink(window.location.origin, d.code), say = intro(r);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch { /* the link is visible to copy by hand */ }
  };

  return (
    <div className="nu-refer">
      <Card label={WORDS.title}>
        <div className="nu-rf-hero">
          <Ball tone="I" size={56}><Icon name="share" size={26} color="#14254F" /></Ball>
          <div className="nu-rf-herotext">
            <Chip tone="dark">{WORDS.title}</Chip>
            <h2>{heading(r)}</h2>
            <p>{say.before}<b>{say.bold}</b>{say.after}</p>
          </div>
        </div>
      </Card>
      <div className="nu-rf-grid">
        <div className="nu-rf-col">
          <Card label={WORDS.linkTitle}>
            <div className="nu-rf-box">
              <h3>{WORDS.linkTitle}</h3>
              <div className="nu-rf-copy" data-must-see="your invite link and Copy">
                <input readOnly value={link} aria-label={WORDS.linkTitle} onFocus={(e) => e.currentTarget.select()} />
                <Button size="sm" onClick={() => void copy()}>{copied ? WORDS.copied : WORDS.copy}</Button>
              </div>
              <span className="nu-rf-code">{WORDS.code}<b>{d.code}</b></span>
              <span className="nu-rf-sr" role="status">{copied ? WORDS.copied : ""}</span>
              <Share title={WORDS.shareTitle} text={shareText(r)} link={link} />
            </div>
          </Card>
          <Card label={WORDS.stepsTitle}>
            <div className="nu-rf-box">
              <h3>{WORDS.stepsTitle}</h3>
              <ol className="nu-rf-steps">
                {steps(r).map((s) => <li key={s.key}><span>{s.text}</span><b>{s.prize}</b></li>)}
              </ol>
              <p className="nu-rf-fine">{WORDS.fine}</p>
            </div>
          </Card>
        </div>
        <div className="nu-rf-col">
          <ul className="nu-rf-kpis" aria-label="Your totals">
            {kpis(d).map((k) => <li key={k.label}><b>{k.value}</b><span>{k.label}</span></li>)}
          </ul>
          <section className="nu-rf-friends" aria-label={WORDS.friendsTitle}>
            <SectionHeader title={WORDS.friendsTitle} />
            {d.friends.length === 0 ? (
              <Card>
                <div className="nu-rf-note"><Ball tone="G" size={48}><Icon name="users" size={22} color="#14254F" /></Ball><p>{WORDS.none}</p></div>
              </Card>
            ) : (
              <ul className="nu-rf-list">
                {d.friends.map((f, i) => {
                  const ok = f.status === "ok", plus = earned(f);
                  return (
                    <li key={i} className={`nu-rf-friend${ok ? "" : " is-off"}`}>
                      <Ball tone={TONES[i % TONES.length]} size={40} mode="l" letter={f.name.slice(0, 1).toUpperCase()} />
                      <div className="nu-rf-who">
                        <b title={f.name}>{f.name}</b>
                        <span>{joinedLine(f)}</span>
                        {plus && <span className="nu-rf-earn">{plus}</span>}
                        {ok ? (
                          <span className="nu-rf-dots" role="group" aria-label={WORDS.stepsReached}>
                            {friendSteps(f, r).map((s) => (
                              <span key={s.key} className={s.done ? "is-on" : ""}>
                                {s.done && <Icon name="check" size={14} />}{s.text}{s.done ? <span className="nu-rf-sr"> (reached)</span> : <span className="nu-rf-sr"> (not yet)</span>}
                              </span>
                            ))}
                          </span>
                        ) : <span className="nu-rf-why">{reason(f.status)}</span>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
