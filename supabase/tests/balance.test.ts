// Balance v2 (reports/balance-spec.md): version 1 is untouched, the version 2 rules match the spec's golden vectors,
// and each mode gets the right version under the flag's three states, including the UTC-midnight switch.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyMods, botTaps, ghostFromShare, makeBoard, scoreTaps, xpFor, type Params } from "../functions/_shared/engine.ts";
import { boardVersion, FLAG_OFF, parseFlagMode, plainLevel, readFlag, roundVersion, v2Level } from "../functions/_shared/balance.ts";
import { buildRound, matchParams, type Cfg } from "../functions/_shared/rounds.ts";
import { humanTaps } from "./balanceSupport.ts";

const LEVELS = {
  beginner: { every: 4000, win: 4, pt: 1, pen: 5, hint: false, xm: 1, fee: 10, gl: 150, gr: 100 },
  medium: { every: 3000, win: 3, pt: 1.5, pen: 8, hint: false, xm: 1.5, fee: 20, gl: 250, gr: 130 },
  hard: { every: 2200, win: 2, pt: 2, pen: 15, hint: false, xm: 2, fee: 40, gl: 380, gr: 200 },
} as Record<string, Params>;
const V2 = { beginner: { calls: 0.5, bonus: 5, share: 0.812, xpDiv: 2.4 }, medium: { calls: 0.4, bonus: 5, share: 0.827, xpDiv: 1.7 }, hard: { bonus: 5, share: 0.867, xpDiv: 1.2 } };
const cfg: Cfg = { levels: LEVELS, g: { total: 100, pay: 1.8 }, v2: V2 };
const base = (level: string) => ({ mode: "ghost", level, cfg, boosters: [] as string[], randomSeed: 12345 });
const v2base = (level: string) => ({ ...base(level), v2: true });

// ---------- version 1 is untouched ----------

// The old engine's answers (from redesign/next before this change) for 48 imperfect rounds: same taps, same score.
const V1 = JSON.parse(readFileSync(new URL("./balanceV1.json", import.meta.url), "utf8")) as {
  level: string; seed: number; mods: Record<string, number>; rt: number; miss: number; slip: number; taps: number;
  score: number; daubs: number; wrong: number; late: number; lines: number; maxMult: number; ghost: number; xp: number;
}[];

test("version 1: 48 rounds score exactly as the old engine scored them", () => {
  assert.equal(V1.length, 48);
  for (const c of V1) {
    const p = applyMods({ ...LEVELS[c.level], total: 100 }, c.mods);
    const taps = humanTaps(makeBoard(c.seed), p.every, c.seed, c.rt, c.miss, c.slip, p.total * 1000);
    assert.equal(taps.length, c.taps, "same taps");
    const r = scoreTaps(c.seed, p, taps);
    assert.deepEqual([r.score, r.daubs, r.wrong, r.late, r.lines, r.maxMult], [c.score, c.daubs, c.wrong, c.late, c.lines, c.maxMult], `${c.level} ${c.seed} ${c.rt}`);
    assert.deepEqual([r.bonus, r.fast1, r.fast2], [0, 0, 0], "no speed bonus in version 1");
    assert.equal(xpFor(r.score, p.xm, 1, r.score > 100), c.xp, "version 1 XP unchanged");
  }
});

test("version 1: makeBoard without calls is the original board, and the ghost is still gl + random(gr)", () => {
  for (const seed of [1, 42, 99999, 4000000000]) assert.deepEqual(makeBoard(seed), makeBoard(seed, undefined));
  for (const c of V1) {
    const r = buildRound({ ...base(c.level), randomSeed: c.seed });
    assert.equal(r.params.ghost, c.ghost, "the old ghost target");
    for (const k of ["cv", "calls", "bonus", "xpDiv", "perfect"]) assert.equal(k in r.params, false, `no ${k} in a version 1 round`);
  }
});

test("version 1: the floor at 0 stays (wrong taps before any point leave 0)", () => {
  const p = { ...LEVELS.medium, total: 100 };
  assert.equal(scoreTaps(5, p, [{ i: 0, t: 100 }]).score, 0);
});

// ---------- version 2 rules ----------

test("version 2: the card is the same, the calls are a biased reorder of the same 75 numbers", () => {
  for (const seed of [1, 12345, 4000000000]) {
    const a = makeBoard(seed), b = makeBoard(seed, 0.5);
    assert.deepEqual(a.card, b.card);
    assert.deepEqual([...b.seq].sort((x, y) => x - y), Array.from({ length: 75 }, (_, i) => i + 1));
    assert.notDeepEqual(a.seq, b.seq);
    assert.deepEqual(makeBoard(seed, 0.5), b, "deterministic");
  }
});

// seed, first 12 calls, card row 1, base score, taps within 1 s, taps within 2 s, bonus, total, ghost (reports/balance-spec.md section 9)
const GOLDEN = [
  ["beginner", 1, [32, 10, 74, 50, 58, 54, 53, 26, 69, 38, 71, 34], [4, 25, 42, 59, 68], 140, 8, 0, 40, 180, 146],
  ["beginner", 12345, [71, 51, 23, 73, 65, 52, 29, 27, 12, 67, 15, 20], [9, 17, 39, 58, 70], 340, 13, 0, 65, 405, 329],
  ["beginner", 4000000000, [37, 75, 13, 42, 23, 4, 72, 55, 30, 50, 31, 16], [2, 30, 34, 52, 68], 230, 11, 0, 55, 285, 231],
  ["medium", 1, [32, 10, 74, 54, 50, 53, 69, 58, 38, 71, 34, 73], [4, 25, 42, 59, 68], 510, 13, 0, 104, 614, 508],
  ["medium", 12345, [71, 51, 23, 73, 52, 29, 27, 67, 65, 15, 6, 12], [9, 17, 39, 58, 70], 510, 13, 0, 104, 614, 508],
  ["medium", 4000000000, [37, 75, 23, 72, 50, 13, 31, 42, 16, 39, 40, 41], [2, 30, 34, 52, 68], 390, 12, 0, 96, 486, 402],
  ["hard", 1, [67, 71, 39, 64, 56, 57, 54, 2, 19, 21, 45, 47], [4, 25, 42, 59, 68], 1280, 18, 0, 180, 1460, 1266],
  ["hard", 12345, [32, 17, 25, 5, 75, 39, 27, 22, 52, 41, 38, 56], [9, 17, 39, 58, 70], 400, 10, 0, 100, 500, 434],
  ["hard", 4000000000, [14, 38, 11, 22, 50, 69, 32, 12, 42, 40, 7, 16], [2, 30, 34, 52, 68], 640, 14, 0, 140, 780, 676],
] as const;

test("version 2: the spec's golden vectors (a perfect 700 ms player, ghost = share x perfect)", () => {
  for (const [level, seed, calls, row1, baseScore, fast1, fast2, bonus, total, ghost] of GOLDEN) {
    const r = buildRound({ ...v2base(level), randomSeed: seed });
    const p = r.params as unknown as Params & { total: number; ghost: number };
    const b = makeBoard(seed, p.calls);
    assert.deepEqual(b.seq.slice(0, 12), calls, `${level} ${seed} calls`);
    assert.deepEqual(b.card.slice(0, 5), row1, `${level} ${seed} card row 1`);
    const s = scoreTaps(seed, p, botTaps(seed, p, 700, 100000));
    assert.deepEqual([s.score - s.bonus, s.fast1, s.fast2, s.bonus, s.score], [baseScore, fast1, fast2, bonus, total], `${level} ${seed} score`);
    assert.equal(p.ghost, ghost, `${level} ${seed} ghost`);
    assert.equal(r.params.perfect, total, "the perfect score is kept for recalibration");
  }
});

test("version 2: over 2,000 boards a perfect player averages what the simulation found", () => {
  const want: Record<string, [number, number]> = { beginner: [369, 0.61], medium: [641, 0.97], hard: [947, 1.18] };
  for (const level of ["beginner", "medium", "hard"]) {
    const p = buildRound({ ...v2base(level) }).params as unknown as Params & { total: number };
    let sum = 0, lines = 0;
    for (let seed = 1; seed <= 2000; seed++) { const s = scoreTaps(seed, p, botTaps(seed, p, 700, 100000)); sum += s.score; lines += s.lines; }
    assert.ok(Math.abs(sum / 2000 / want[level][0] - 1) < 0.03, `${level} mean ${sum / 2000}`);
    assert.ok(Math.abs(lines / 2000 - want[level][1]) < 0.1, `${level} lines ${lines / 2000}`);
  }
});

test("version 2: the speed bonus is graded per level and never multiplied by the combo", () => {
  const POINTS = { beginner: [5, 3], medium: [8, 4], hard: [10, 5] } as const;
  for (const level of ["beginner", "medium", "hard"] as const) {
    const p = buildRound({ ...v2base(level) }).params as unknown as Params & { total: number };
    const seed = 777, { card, seq } = makeBoard(seed, p.calls), k = seq.findIndex((n) => card.includes(n)), i = card.indexOf(seq[k]);
    const at = (delay: number) => scoreTaps(seed, p, [{ i, t: k * p.every + delay }]);
    const plain = scoreTaps(seed, { ...p, bonus: undefined }, [{ i, t: k * p.every + 500 }]).score;
    const [fast, slow] = POINTS[level];
    assert.deepEqual([at(0).bonus, at(1000).bonus, at(1001).bonus, at(2000).bonus, at(2001).bonus], [fast, fast, slow, slow, 0], level);
    assert.deepEqual([at(500).fast1, at(500).fast2, at(1500).fast1, at(1500).fast2, at(2500).fast2], [1, 0, 0, 1, 0]);
    assert.equal(at(500).score, plain + fast, "the bonus is added after the base points");
    const taps = botTaps(seed, p, 500, 100000).slice(0, 12);
    const withB = scoreTaps(seed, p, taps), without = scoreTaps(seed, { ...p, bonus: undefined }, taps);
    assert.equal(withB.score - without.score, withB.bonus);
    assert.equal(withB.bonus, taps.length * fast, "every tap within 1 s earns exactly the flat bonus, whatever the combo");
    assert.ok(withB.maxMult >= 2, "the streak did build a combo");
  }
});

test("version 2: wrong taps can take the score below zero; version 1 keeps the floor", () => {
  const p1 = { ...LEVELS.medium, total: 100 }, p2 = { ...p1, cv: 2 as const };
  const wrong = [{ i: 0, t: 100 }, { i: 1, t: 300 }, { i: 2, t: 500 }];
  assert.equal(scoreTaps(5, p1, wrong).score, 0);
  const r = scoreTaps(5, p2, wrong);
  assert.equal(r.score, -24, "three wrong taps at 8 each");
  assert.equal(r.wrong + r.late, 3);
});

test("XP: version 2 divides the score; a negative score earns no XP from the score", () => {
  assert.equal(xpFor(240, 1, 1, false), xpFor(240, 1, 1, false, 1));
  assert.equal(xpFor(600, 1.5, 1, false, 2.4), Math.round((15 + 600 / 2.4 / 8) * 1.5));
  assert.equal(xpFor(-50, 1, 1, false, 1.7), 15, "just the base XP");
  assert.equal(xpFor(-50, 1, 1, true, 1.7), 35);
});

test("the ghost is a share of the perfect round of the same board, and ignores boosters", () => {
  const plain = buildRound({ ...v2base("medium") }), boosted = buildRound({ ...v2base("medium"), boosters: ["slow", "win", "time", "hint"] });
  assert.equal(plain.params.ghost, boosted.params.ghost, "boosters do not raise the target");
  const p0 = { ...LEVELS.medium, calls: 0.4, bonus: 5, cv: 2 as const, xpDiv: 1.7, total: 100 };
  assert.equal(plain.params.ghost, ghostFromShare(12345, p0, 0.827));
  assert.equal(boosted.params.every, 3900, "the boosters still change the round itself");
});

// ---------- which rounds play by which version ----------

test("config: invalid or missing version 2 settings mean version 1", () => {
  assert.deepEqual(v2Level({ v2: V2 }, "medium"), { calls: 0.4, bonus: 5, share: 0.827, xpDiv: 1.7 });
  assert.deepEqual(v2Level({ v2: V2 }, "hard"), { bonus: 5, share: 0.867, xpDiv: 1.2 }, "Hard has no calls: today's order");
  for (const v2 of [undefined, null, {}, { medium: null }, { medium: "x" }, { medium: { bonus: 5, share: 0.8 } }, { medium: { bonus: 5, share: 0.8, xpDiv: 0.5 } },
    { medium: { bonus: 5, share: 5, xpDiv: 1 } }, { medium: { bonus: -1, share: 0.8, xpDiv: 1 } }, { medium: { calls: 2, bonus: 5, share: 0.8, xpDiv: 1 } },
    { medium: { calls: "0.4", bonus: 5, share: 0.8, xpDiv: 1 } }, { medium: { bonus: NaN, share: 0.8, xpDiv: 1 } }])
    assert.equal(v2Level({ v2 }, "medium"), null, JSON.stringify(v2));
  const noCfg = buildRound({ ...base("medium"), cfg: { ...cfg, v2: undefined }, v2: true });
  assert.equal(noCfg.params.cv, undefined, "no settings: the round is version 1 even when asked for version 2");
  assert.equal(typeof noCfg.params.ghost, "number");
});

test("a level never hands version 2 keys to a version 1 round, whatever sits in the level config", () => {
  const dirty = { ...cfg, levels: { ...LEVELS, medium: { ...LEVELS.medium, calls: 0.4, bonus: 9, share: 0.5, xpDiv: 3, cv: 2 } as Params } };
  const r = buildRound({ ...base("medium"), cfg: dirty, v2: false });
  for (const k of ["cv", "calls", "bonus", "xpDiv", "share", "perfect"]) assert.equal(k in r.params, false, k);
  assert.deepEqual(plainLevel({ a: 1, calls: 1, bonus: 2, share: 3, xpDiv: 4, cv: 2 }), { a: 1 });
  const m = matchParams(dirty, "medium", false);
  for (const k of ["cv", "calls", "bonus", "xpDiv", "share"]) assert.equal(k in m, false, k);
});

test("every mode's version under off, admins and all", () => {
  const modes = ["solo", "ghost", "tour", "stage", "daily", "duel", "drill", "pvp"];
  const v = (mode: string, flag: "off" | "admins" | "all", admin: boolean, boardCv: number | null = null, ready = true) => roundVersion({ mode, flag, admin, ready, boardCv });
  // Off: every round that is not on an already-created version 2 board is version 1
  for (const m of modes) for (const admin of [false, true]) assert.equal(v(m, "off", admin, null), 1, `off: ${m}`);
  for (const m of ["solo", "ghost", "pvp", "stage", "drill", "duel"]) assert.equal(v(m, "off", true, 2), 1, `off: ${m} ignores board versions`);
  // Admins only: practice and ghost rounds of admins, nothing shared
  assert.deepEqual(["solo", "ghost"].map((m) => [v(m, "admins", true), v(m, "admins", false)]), [[2, 1], [2, 1]]);
  for (const m of ["tour", "stage", "daily", "duel", "drill", "pvp"]) for (const admin of [false, true]) assert.equal(v(m, "admins", admin, null), 1, `admins: ${m}`);
  assert.equal(v("pvp", "admins", true), 1, "a live match is never version 2 while the flag is Admins");
  // All: everything except stages, drills and duels; shared boards use the version they were created with
  for (const m of ["solo", "ghost", "pvp"]) assert.equal(v(m, "all", false), 2, `all: ${m}`);
  assert.equal(v("daily", "all", false, 2), 2);
  assert.equal(v("daily", "all", false, 1), 1, "today's board, created before the switch, stays version 1");
  assert.equal(v("daily", "all", false, null), 1, "a board with no version is version 1");
  assert.equal(v("tour", "all", false, 2), 2);
  assert.equal(v("tour", "all", false, null), 1, "an event created before the switch stays version 1");
  for (const m of ["stage", "drill", "duel"]) for (const admin of [false, true]) assert.equal(v(m, "all", admin, 2), 1, `all: ${m} stays version 1`);
  // a board keeps its version if the flag is switched off later, so one day's board never mixes versions
  assert.equal(v("daily", "off", false, 2), 2);
  assert.equal(v("tour", "admins", true, 2), 2);
  // a level without settings is version 1 in every state
  for (const m of modes) assert.equal(v(m, "all", true, 2, false), 1, `not ready: ${m}`);
});

test("buildRound: only solo, ghost, tour and daily honor version 2; stages, drills and duels do not", () => {
  const as = (mode: string, extra = {}) => buildRound({ ...base("medium"), mode, v2: true, ...extra });
  for (const mode of ["solo", "ghost", "tour"]) { const r = as(mode, { eventFee: 5 }); assert.deepEqual([r.params.cv, r.params.calls, r.params.bonus, r.params.xpDiv], [2, 0.4, 5, 1.7], mode); }
  const d = as("daily", { daily: { day: "2026-11-12", seed: 777, mods: { line_mul: 2 }, g1: 40, g2: 80, g3: 120 } });
  assert.deepEqual([d.params.cv, d.params.calls, d.params.lineMul], [2, 0.4, 2], "daily twists apply on top of version 2");
  const s = as("stage", { stage: { seed: 8080, mods: { combo_step: 2 }, s1: 1, s2: 2, s3: 3 } });
  const dr = as("drill", { drill: { skill: "speed", mods: { every_mul: 0.75, total_add: -40 } } });
  for (const r of [s, dr]) for (const k of ["cv", "calls", "bonus", "xpDiv"]) assert.equal(k in r.params, false, k);
  const frozenV2 = { ...LEVELS.medium, total: 100, cv: 2, calls: 0.4, bonus: 5, xpDiv: 1.7, boosters: ["slow"], ghost: 9 };
  const duelV2 = as("duel", { duel: { code: "abc", seed: 31337, params: frozenV2 } });
  assert.deepEqual([duelV2.params.cv, duelV2.params.calls, duelV2.params.bonus, duelV2.params.ghost, duelV2.params.boosters], [2, 0.4, 5, null, []], "a duel from a version 2 round replays version 2");
  const frozenV1 = { ...LEVELS.medium, total: 100, boosters: [], ghost: 9 };
  const duelV1 = as("duel", { duel: { code: "abd", seed: 31337, params: frozenV1 } });
  assert.equal("cv" in duelV1.params, false, "an existing challenge stays version 1");
});

test("a live match: both players get one set of params, version 2 only when asked", () => {
  const m2 = matchParams(cfg, "beginner", true), m1 = matchParams(cfg, "beginner", false);
  assert.deepEqual([m2.cv, m2.calls, m2.bonus, m2.ghost, m2.boosters], [2, 0.5, 5, null, []]);
  assert.equal("cv" in m1, false);
  assert.deepEqual(m1, { ...LEVELS.beginner, total: 100, fee: 10, pay: 1.8, boosters: [], ghost: null }, "exactly what find-match built before");
  assert.equal(matchParams({ ...cfg, v2: undefined }, "beginner", true).cv, undefined, "no settings: version 1");
});

// ---------- the UTC-midnight switch and the flag ----------

test("shared boards switch at the next UTC midnight after the flag becomes All", () => {
  const all = (updatedAt: string) => ({ mode: "all" as const, updatedAt });
  const set = "2026-11-12T15:30:00Z"; // the flag is set to All on 12 Nov at 15:30 UTC
  assert.equal(boardVersion(all(set), "2026-11-12"), 1, "today's board stays version 1 even if nobody has opened it yet");
  assert.equal(boardVersion(all(set), "2026-11-11"), 1);
  assert.equal(boardVersion(all(set), "2026-11-13"), 2, "tomorrow's board is version 2");
  assert.equal(boardVersion(all("2026-11-12T00:00:00Z"), "2026-11-12"), 1, "changed exactly at midnight: that day's board is still version 1");
  assert.equal(boardVersion(all("2026-11-11T23:59:59Z"), "2026-11-12"), 2);
  for (const mode of ["off", "admins"] as const) assert.equal(boardVersion({ mode, updatedAt: "2026-01-01T00:00:00Z" }, "2026-11-20"), 1, mode);
  assert.equal(boardVersion({ mode: "all", updatedAt: null }, "2026-11-20"), 1);
  assert.equal(boardVersion({ mode: "all", updatedAt: "not a date" }, "2026-11-20"), 1);
  assert.equal(boardVersion(FLAG_OFF, "2026-11-20"), 1);
});

test("the flag is read from feature_flags and any failure is Off", async () => {
  const db = (res: () => Promise<unknown>) => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: res }) }) }) });
  assert.deepEqual(await readFlag(db(async () => ({ data: { mode: "all", updated_at: "2026-11-12T15:30:00+00:00" }, error: null }))), { mode: "all", updatedAt: "2026-11-12T15:30:00+00:00" });
  assert.equal((await readFlag(db(async () => ({ data: { mode: "admins", updated_at: "x" }, error: null })))).mode, "admins");
  for (const bad of [async () => ({ data: null, error: { message: "relation public.feature_flags does not exist" } }), async () => ({ data: null, error: null }),
    async () => { throw new Error("network"); }, async () => ({ data: { mode: "rainbow", updated_at: null }, error: null }), async () => ({ data: { mode: 7 }, error: null })])
    assert.deepEqual(await readFlag(db(bad)), FLAG_OFF);
  assert.deepEqual(await readFlag({ from: () => { throw new Error("no client"); } }), FLAG_OFF);
  assert.equal(parseFlagMode("admins"), "admins");
  assert.equal(parseFlagMode("ALL"), "off");
});

// ---------- the functions use it ----------

const fn = (path: string) => readFileSync(new URL(`../functions/${path}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

test("start-round, find-match and daily read the flag and choose the version only through balance.ts", () => {
  const sr = fn("start-round/index.ts");
  assert.ok(sr.includes("const flag = await readFlag(db);") && sr.includes("roundVersion({ mode, flag: flag.mode"));
  assert.ok(sr.includes('prof.role === "admin"') && sr.includes("v2: cv === 2"));
  assert.ok(sr.includes("boardCv = daily.cv ?? null;") && sr.includes('.from("events").select("cv")'), "daily boards and events carry their own version");
  const fm = fn("find-match/index.ts");
  assert.ok(fm.includes('roundVersion({ mode: "pvp", flag: flag.mode, admin: false') && fm.includes("matchParams(cfg, level!, cv === 2)"));
  const dl = fn("_shared/daily.ts");
  assert.ok(dl.includes("boardVersion(await readFlag(db), day)") && dl.includes("p_cv: 2"));
  const sb = fn("submit-round/index.ts");
  assert.ok(sb.includes('p.cv === 2 ? same.eq("params->>cv", "2") : same.is("params->>cv", null)'), "new best compares like with like");
  assert.ok(sb.includes("p.cv === 2 ? p.xpDiv ?? 1 : 1"));
});
