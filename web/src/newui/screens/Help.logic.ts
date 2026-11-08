// Help and guide: wording copied from Classic views/Help.tsx. The guide, questions and words come from guide/content.ts, unchanged.
import { FAQ, GLOSSARY, GUIDE, GUIDE_VERSION } from "../../guide/content";

export const WORDS = {
  eyebrow: "Help",
  heading: "New here? Take the 1-minute tour.",
  intro: "It shows how a round works, how to score, and where everything is.",
  tour: "Show the intro tour again",
  contact: "Contact us",
  facebook: "Follow us on Facebook: news, events and prizes",
  guide: "How the game works",
  faq: "Questions people ask",
  words: "Words used in the game",
} as const;

export const footer = (version: number = GUIDE_VERSION) => `Guide version ${version}. The guide is updated whenever the game gets new features.`;

/** Classic shows the Facebook button only when a link is set (it is empty on CrazyGames). */
export const facebookLink = (link: string | null | undefined) => (link ? link : null);

export const SECTIONS = { guide: GUIDE, faq: FAQ, glossary: GLOSSARY };
