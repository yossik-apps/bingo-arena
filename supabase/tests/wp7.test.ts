import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GOOD_ROUND, coachTips, freeText, showsSaveCard } from "../../web/src/newui/screens/Result.logic.ts";
import { BE_FIRST_DAILY, GUEST_NOTE, hasBoard, lobbyStatus } from "../../web/src/newui/screens/Lobby.logic.ts";
import { BE_FIRST_LEAGUE } from "../../web/src/newui/screens/Compete.logic.ts";
import { NOBODY, noInviteText } from "../../web/src/newui/screens/Match.logic.ts";
import type { RoundResult } from "../../web/src/views/Play.tsx";
import type { GameCfg } from "../../web/src/lib/supabase.ts";

const root = new URL("../../", import.meta.url);
const src = (path: string) => readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");
const p = { every: 2500 } as never;
const round = (o: Partial<RoundResult> = {}) => ({ score: 120, daubs: 9, wrong: 0, late: 0, lines: 0, maxMult: 2, accuracy: 1, avgReactionMs: 1000, win: false, prize: 0, xp: 10, ghost: null, best: null, balance: 0, level: 1, achievements: [], ...o }) as RoundResult;

// ---- BA-07: the coach's awareness tip ----
test("the awareness tip counts numbers that left the board untapped, using the server's missed count", () => {
  assert.match(coachTips(round({ missed: 5 }), p, null)[0], /^You let 5 matching numbers slip off the board/);
  assert.equal(coachTips(round({ missed: 1, late: 0 }), p, null)[0], "Good attention: very few numbers slipped away.");
  assert.match(coachTips(round({ missed: 4, late: 0 }), p, null)[0], /^You let 4 matching numbers/, "late taps do not hide missed numbers");
});

test("a round with 0 points or no taps is never praised for attention", () => {
  for (const r of [round({ score: 0, daubs: 0, missed: 0 }), round({ score: 0, daubs: 3 }), round({ daubs: 0, score: 5 })]) {
    const t = coachTips(r, p, null);
    assert.doesNotMatch(t[0], /Good attention/);
    assert.match(t[0], /did not tap any matching numbers/);
    assert.doesNotMatch(t[1], /combo stayed healthy/);
  }
});

// ---- BA-38: the guest's note and Save prompt ----
test("a guest is told progress lives on this device until they save", () => {
  assert.match(GUEST_NOTE, /on this device until you save/);
  assert.match(src("web/src/newui/screens/Lobby.tsx"), /profile\?\.guest && !platform\.crazyGames && profile\.played < 2 && <p className="nu-lb-guestnote" role="note">\{GUEST_NOTE\}/);
});

test("the Save prompt comes after the first good round, or from the third round, for guests only", () => {
  assert.equal(showsSaveCard(true, 1, GOOD_ROUND), true, "first good round");
  assert.equal(showsSaveCard(true, 1, GOOD_ROUND - 1), false, "first round, not good");
  assert.equal(showsSaveCard(true, 1, 0), false);
  assert.equal(showsSaveCard(true, 2, 10), false);
  assert.equal(showsSaveCard(true, 3, 0), true, "third round as before");
  assert.equal(showsSaveCard(false, 5, 500), false, "never for a saved player");
  assert.match(src("web/src/newui/screens/Result.tsx"), /showsSaveCard\(prof\.guest, prof\.played, r\.score\)/);
});

// ---- BA-36: boards ----
test("a board with nobody on it is replaced by a short Be the first line", () => {
  assert.equal(hasBoard(0), false);
  assert.equal(hasBoard(4), true);
  assert.match(BE_FIRST_DAILY, /^Be the first/);
  assert.match(BE_FIRST_LEAGUE, /^Be the first/);
  assert.match(src("web/src/newui/screens/Lobby.tsx"), /info\.done > 0 \? <Button[^]*?: <span className="nu-lb-first">\{BE_FIRST_DAILY\}<\/span>/);
  assert.match(src("web/src/newui/screens/Compete.tsx"), /rows\.length === 0 \? <p className="nu-cp-note">\{BE_FIRST_LEAGUE\}<\/p>/);
});

test("the online player count has one source: the arena", () => {
  assert.equal(noInviteText(0), NOBODY);
  assert.equal(noInviteText(null), NOBODY);
  assert.match(noInviteText(3), /^No one is free to invite/, "never 'nobody is online' while the arena counts people");
  const match = src("web/src/newui/screens/Match.tsx"), lobby = src("web/src/newui/screens/Lobby.tsx");
  assert.match(match, /onlineText\(arena\?\.online\)/);
  assert.match(lobby, /social\.arena\.online/);
  assert.doesNotMatch(match, /online\.length\} (player|online)/, "the invite list is never the count");
});

// ---- BA-21: welcome coins arrive after the first round ----
test("every mention of the welcome coins says they arrive after the first round", () => {
  assert.match(freeText(0, 2, 50).gets[0][1], /after your first round/);
  assert.doesNotMatch(freeText(0, 2, 50).join, /coins/);
  const cfg = { levels: { beginner: { fee: 10 } }, g: { pay: 1.8, maint: false, paid: true, pvp: true, welcome: 50, total: 100 } } as unknown as GameCfg;
  assert.match(lobbyStatus({ cfg, mode: "ghost", level: "beginner", balance: 100, banned: false, visitor: true, freeRounds: false }).hint, /after your first round/);
  assert.match(src("web/src/newui/NewShell.tsx"), /welcome coins`.*arrive after your first round/);
});

// ---- BA-15: the tour is offered from the lobby ----
test("the tour never opens by itself: it is offered in the lobby with a visible Skip, and never over a result", () => {
  const app = src("web/src/App.tsx");
  assert.doesNotMatch(app, /if \(seen === 0\) setTour\(/, "no automatic opening");
  assert.match(app, /if \(seen === 0\) setTourOffer\(\{ kind: "full"/);
  assert.match(app, /tourOffer && view === "lobby" && !tour && !result && \(/, "offered in the lobby only, not over a result");
  assert.match(app, /onClick=\{takeTour\}>Take the tour<\/button>/);
  assert.match(app, /onClick=\{skipTour\}>Skip<\/button>/);
  assert.match(app, /const skipTour = \(\) => \{ markTourSeen\(\); setTourOffer\(null\); \};/, "Skip is remembered, so it is not offered again");
  assert.match(app, /\{tour && !inRound && !result && overlay\("tour"/, "the tour itself never draws over a result");
});
