// Collect: daily quests and badges, and the stamp album. Looks follow the playground's Collect; the data, rules and words are Classic's.
// The Album tab comes in its own PR.
// Uses: quests, wallet, visitor
import { useCallback, useEffect, useRef, useState } from "react";
import { Ball, type Tone } from "../Ball";
import { Button, Card, Chip, ErrorState, ListRow, ProgressBar, SectionHeader, Skeleton, Tabs, Toast } from "../components";
import { Coin, Icon, type IconName } from "../Icon";
import type { ScreenCtx, ScreenProps } from "./contract";
import { claimMessage, QUESTS_NOTE, questState, TEASER, type QuestsData } from "./Collect.logic";
import "./collect.css";

/** Until the shared PR adds `quests` to ScreenCtx: the shape agreed with the main chat. */
type QuestsGroup = { load: () => Promise<QuestsData>; claim: (id: string) => Promise<{ reward: number }> };
const questsOf = (ctx: ScreenCtx) => (ctx as ScreenCtx & { quests: QuestsGroup }).quests;

const TEASER_MARK: [Tone, IconName][] = [["B", "book"], ["G", "target"], ["P", "trophy"]];

function Teaser({ onJoin }: { onJoin: () => void }) {
  return (
    <div className="nu-cl-teaser">
      <Card label={TEASER.title}>
        <div className="nu-cl-card">
          <Chip tone="dark">Free account</Chip>
          <h2>{TEASER.title}</h2>
          <p>{TEASER.intro}</p>
        </div>
      </Card>
      <div className="nu-cl-list">
        {TEASER.points.map(([head, text], i) => (
          <ListRow key={head} title={head} sub={text} lead={<Ball tone={TEASER_MARK[i][0]} size={44}><Icon name={TEASER_MARK[i][1]} size={22} color="#14254F" /></Ball>} />
        ))}
      </div>
      <Button size="lg" wide onClick={onJoin}>{TEASER.button}</Button>
      <p className="nu-cl-note">{TEASER.hint}</p>
    </div>
  );
}

function Quests({ ctx }: ScreenProps) {
  // ctx is rebuilt on every App render, so the calls are kept in a ref and the data loads once
  const quests = useRef(questsOf(ctx));
  quests.current = questsOf(ctx);
  const [data, setData] = useState<QuestsData | null>(null);
  const [failed, setFailed] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => quests.current.load().then((d) => { setData(d); setFailed(false); }, () => setFailed(true)), []);
  useEffect(() => { void load(); }, [load]);

  const claim = async (id: string) => {
    setMsg(null);
    setBusy(id);
    try {
      const r = await quests.current.claim(id);
      setMsg({ text: claimMessage(r.reward), error: false });
      await load();
      await ctx.wallet.refresh();
    } catch (e) {
      setMsg({ text: (e as Error).message, error: true });
    }
    setBusy(null);
  };

  if (failed && !data) return <ErrorState title="Your quests did not load" onRetry={() => { setFailed(false); void load(); }} />;
  if (!data) return <Skeleton rows={3} height={96} label="Loading your quests" />;
  const earned = new Set(data.earned);

  return (
    <div className="nu-cl-cols">
      <section className="nu-cl-col" aria-label="Daily quests">
        <SectionHeader title="Daily quests" />
        {msg && <Toast inline alert={msg.error}>{msg.text}</Toast>}
        {data.missions.map((m) => {
          const q = questState(m, data.counters, data.claimed);
          return (
            <div key={m.id} className="nu-cl-quest">
              <div className="nu-cl-qtop">
                <b className="nu-cl-qname">{m.label}</b>
                <span className="nu-cl-reward" aria-label={`Reward ${m.reward} coins`}><Coin size={18} />{m.reward}</span>
              </div>
              <div className="nu-cl-qbot">
                <span className="nu-cl-bar"><ProgressBar pct={q.pct} label={m.label} /></span>
                <span className="nu-cl-count">{q.have}/{m.goal}</span>
                {q.claimed
                  ? <Chip tone="green">Claimed</Chip>
                  : <Button size="sm" kind={q.canClaim ? "gold" : "white"} disabled={!q.canClaim || busy !== null} onClick={() => void claim(m.id)}>{q.button}</Button>}
              </div>
            </div>
          );
        })}
        <p className="nu-cl-note">{QUESTS_NOTE}</p>
      </section>
      {data.badges.length > 0 && <section className="nu-cl-col" aria-label="Badges">
        <SectionHeader title="Badges" trail={`${data.badges.filter((b) => earned.has(b.id)).length}/${data.badges.length}`} />
        <ul className="nu-cl-badges">
          {data.badges.map((b) => {
            const got = earned.has(b.id);
            return (
              <li key={b.id} className={got ? "is-got" : ""}>
                <Ball tone={got ? "P" : "X"} size={40}><Icon name={got ? "trophy" : "star"} size={20} color="#14254F" /></Ball>
                <b title={b.label}>{b.label}</b>
                <span>{got ? "Unlocked" : "Locked"}</span>
              </li>
            );
          })}
        </ul>
      </section>}
    </div>
  );
}

export default function Collect({ ctx }: ScreenProps) {
  const [tab, setTab] = useState<"quests" | "album">("quests");
  if (ctx.visitor) return <Teaser onJoin={ctx.visitor.playFree} />;
  return (
    <div className="nu-collect">
      <Tabs label="Collect" value={tab} onChange={setTab} options={[{ id: "quests", text: "Quests" }, { id: "album", text: "Album" }]} />
      {tab === "quests" ? <Quests ctx={ctx} /> : <Skeleton rows={2} height={96} label="The album is not built yet" />}
    </div>
  );
}
