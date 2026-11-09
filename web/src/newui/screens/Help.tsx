// Help and guide: the tour, Contact us, how the game works, questions and words. Same text and actions as Classic views/Help.tsx.
// A visitor opens it too and sees the same page: for a visitor, ctx's replayTour and contactUs ask them to sign up, as in Classic,
// so the screen needs nothing from ctx.visitor.
// Uses: settings, notices, social
import { Button, Card, Chip, SectionHeader } from "../components";
import { Icon } from "../Icon";
import type { ScreenProps } from "./contract";
import { facebookLink, footer, SECTIONS, WORDS } from "./Help.logic";
import "./help.css";

export default function Help({ ctx }: ScreenProps) {
  const fb = facebookLink(ctx.social.facebook);
  return (
    <div className="nu-help">
      <div className="nu-hp-col">
        <Card label={WORDS.eyebrow}>
          <div className="nu-hp-hero">
            <Chip tone="dark">{WORDS.eyebrow}</Chip>
            <h2>{WORDS.heading}</h2>
            <p>{WORDS.intro}</p>
          </div>
        </Card>
        <div className="nu-hp-actions" data-must-see="the tour button">
          <Button size="lg" wide onClick={ctx.settings.replayTour}><Icon name="play" size={22} />{WORDS.tour}</Button>
          <Button kind="white" wide onClick={ctx.notices.contactUs}><Icon name="mail" size={22} />{WORDS.contact}</Button>
          {fb && <Button kind="white" wide href={fb}><Icon name="ext" size={22} />{WORDS.facebook}</Button>}
        </div>
        <section className="nu-hp-group" aria-label={WORDS.guide} data-must-peek="how the game works">
          <SectionHeader title={WORDS.guide} />
          {SECTIONS.guide.map((s) => (
            <details className="nu-hp-item" key={s.id}>
              <summary>{s.title}</summary>
              <div className="nu-hp-body">{s.body.map((b) => <p key={b}>{b}</p>)}</div>
            </details>
          ))}
        </section>
      </div>
      <div className="nu-hp-col">
        <section className="nu-hp-group" aria-label={WORDS.faq}>
          <SectionHeader title={WORDS.faq} />
          {SECTIONS.faq.map((f) => (
            <details className="nu-hp-item" key={f.q}>
              <summary>{f.q}</summary>
              <div className="nu-hp-body"><p>{f.a}</p></div>
            </details>
          ))}
        </section>
        <section className="nu-hp-group" aria-label={WORDS.words}>
          <SectionHeader title={WORDS.words} />
          <Card>
            <dl className="nu-hp-words">
              {SECTIONS.glossary.map((g) => (
                <div key={g.term}><dt>{g.term}</dt><dd>{g.meaning}</dd></div>
              ))}
            </dl>
          </Card>
        </section>
        <p className="nu-hp-foot">{footer()}</p>
      </div>
    </div>
  );
}
