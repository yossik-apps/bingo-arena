// The first-visit card: Classic's words (views/FirstVisit.tsx), kept exactly, as pure functions.

/** The three "How to play" steps, word for word. */
export const STEPS: [string, string][] = [
  ["Numbers are called one by one", "A ball with a letter and a number appears, like B7 or N42. The letter tells you the column on your card."],
  ["Tap it if it is on your card", "Only the last few numbers can still be tapped, so be quick. Wrong taps cost points."],
  ["Build combos and lines", "Correct taps in a row raise your combo. Complete a row, column or diagonal for bonus points."],
];

export const eyebrow = (inviter: string | null) => (inviter ? `${inviter} invited you · bonus coins inside` : "Bingo Arena · free skill bingo");
export const TITLE = "Tap the numbers. Beat your best.";
/** Classic's "▶  Play now": the triangle becomes the play icon, the words stay. */
export const playText = (busy: boolean) => (busy ? "Starting…" : "Play now");
export const SUB = "Free · no sign-up · a round takes under 2 minutes";
export const HOW = "How to play";
export const HAVE_ACCOUNT = "I have an account";
export const LOOK_AROUND = "Look around first";
export const legalStart = (crazyGames: boolean) => (crazyGames ? "By playing you agree to the" : "By playing you confirm you are 18+ and agree to the");
export const TERMS = { href: "/terms.html", text: "Terms" };
export const PRIVACY = { href: "/privacy.html", text: "Privacy Policy" };

// the steps
export const stepCount = (i: number) => `How to play · ${i + 1} of ${STEPS.length}`;
export const SKIP_PLAY = "Skip, play";
export const BACK = "Back";
export const NEXT = "Next";
export const isLast = (i: number) => i === STEPS.length - 1;
