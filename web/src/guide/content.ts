// The player guide. THE SINGLE PLACE to update when a feature is added or changed.
//
// How it works:
//  * New players see every step once (the intro tour).
//  * Returning players see only the steps whose `since` is higher than the guide version they last saw ("What's new").
//  * Everyone can replay the whole guide from the ? button.
//
// When you add a feature: add a step (or edit one) with since = GUIDE_VERSION + 1, and add a "- Guide:" line to the
// top CHANGELOG entry. `npm test` fails if you forget (supabase/tests/guide.test.ts).

export type GuideStep = {
  id: string;
  since: number; // the guide revision that introduced this step
  icon: string;  // an icon name from the sprite in index.html
  title: string;
  body: string[];
  demo?: "tap";  // shows the interactive "try it" board
  view?: "lobby" | "journey" | "compete" | "collect" | "shop" | "profile"; // where the "Open it" button goes
};

export const GUIDE: GuideStep[] = [
  { id: "welcome", since: 1, icon: "play", title: "Welcome to Bingo Arena",
    body: ["A 100-second bingo duel that rewards skill, not luck.", "Every player gets the same numbers, so the best player wins."] },
  { id: "howto", since: 1, icon: "quest", title: "How to play", demo: "tap",
    body: ["Numbers are called one at a time. Find the same number on your card and tap it.", "Be quick: only the most recent numbers can still be tapped. Older ones leave the board.", "Try it below."] },
  { id: "score", since: 1, icon: "star", title: "Score more points",
    body: ["Correct taps in a row build a combo that multiplies your points.", "Complete a row, column or diagonal for a big line bonus.", "A wrong tap costs points and resets your combo, so look before you tap.", "After each round your coach shows what to improve."] },
  { id: "modes", since: 1, icon: "users", title: "Ways to play", view: "lobby",
    body: ["Practice: play alone for free and beat your own best.", "Beat the Ghost: a practice rival. You pay a small entry fee in coins and win more if you beat it.", "Play a person: a live match on the same board. The higher score wins.", "Daily Challenge: one free try a day on a board everyone shares."] },
  { id: "journey", since: 1, icon: "map", title: "Your adventure", view: "journey",
    body: ["Journey: clear stages to earn up to 3 stars each. Stars open new worlds.", "Collect: find stamps for your album, and finish quests and badges.", "Every reward is earned by playing. You cannot buy random packs."] },
  { id: "coins", since: 1, icon: "coin", title: "Coins, shop and boosters", view: "shop",
    body: ["You earn coins by playing, finishing quests and logging in each day.", "Spend them on entry fees and in the Shop: colors, boards, titles and boosters.", "Boosters help in Practice and Beat the Ghost, never against real people.", "Coins are play money. They cannot be cashed out."] },
  { id: "compete", since: 1, icon: "trophy", title: "Compete and share", view: "compete",
    body: ["Events are tournaments with prizes. The weekly league rewards the most active players.", "Challenge a friend: after a round, send a link so they can try to beat your score on the same board."] },
  { id: "help", since: 1, icon: "help", title: "Play your way", view: "profile",
    body: ["Tap your name to open your Profile: set break reminders, a daily time limit and larger text.", "Tap the ? button at the top any time to replay this guide, read the FAQ, or get help."] },
];

export const GUIDE_VERSION = Math.max(...GUIDE.map((s) => s.since));

export const FAQ: { q: string; a: string }[] = [
  { q: "Is this real money?", a: "No. Coins and items are play money. They have no cash value and cannot be cashed out." },
  { q: "Why does it say “Not called yet” or “That one already left the board”?", a: "You can only tap a number that has been called and is still on the board (the most recent numbers). A number that is not called yet, or is too old, costs you points." },
  { q: "What is a combo?", a: "Each correct tap in a row raises a multiplier, up to a maximum. A wrong tap resets it, so accuracy pays." },
  { q: "How do stars work?", a: "Every Journey stage has three score goals. Reach each goal to earn a star. Stars unlock new worlds." },
  { q: "How do I get coins?", a: "Play rounds, finish daily quests, log in every day (the bonus grows with your streak), win prizes and complete album pages." },
  { q: "What happens if I leave a round?", a: "The round ends and any entry fee is not refunded. You can start a new round straight away." },
  { q: "How are scores checked?", a: "Our servers replay your taps against the same numbers, so the score that counts is the score that was checked. Bots and scripts are not allowed." },
  { q: "What is a Streak Shield?", a: "It saves your daily login streak if you miss exactly one day. You earn one for every 5 Daily Challenges you finish." },
  { q: "Why can't I use boosters in a live match?", a: "So everyone has the same chance. Boosters only work in Practice and Beat the Ghost." },
  { q: "How do I download my data or delete my account?", a: "Open your Profile and look under Your data." },
];

export const GLOSSARY: { term: string; meaning: string }[] = [
  { term: "Coins", meaning: "Play money you earn by playing. Used for entry fees and the Shop." },
  { term: "Stars", meaning: "Earned in Journey stages. They open new worlds." },
  { term: "Stamps", meaning: "Collectibles in your Album. Common, rare or epic." },
  { term: "Dust", meaning: "You get it from duplicate stamps. Use it to craft a stamp you are missing." },
  { term: "Combo", meaning: "Correct taps in a row. A longer combo multiplies your points." },
  { term: "Window", meaning: "How many of the most recent numbers you can still tap." },
  { term: "Ghost", meaning: "A practice rival with a fixed target score. Beat it to win a prize." },
  { term: "Streak Shield", meaning: "Saves your login streak if you miss one day." },
  { term: "Mastery rank", meaning: "Bronze to Legend, based on your best score on each level." },
];
