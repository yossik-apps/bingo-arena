#!/usr/bin/env node
// WP4 balance research: Beat the Ghost targets, lines, Journey/Daily star goals and Mastery ranks.
// Read-only research tool. It changes no game code and touches no database.
//
// It runs the REAL engine (supabase/functions/_shared/engine.ts: makeBoard, botTaps, scoreTaps, ghostTarget, applyMods).
// For the "biased calls" line options it loads a copy of the engine whose makeBoard can be swapped; the copy is
// checked against the original engine before any number is reported.
//
// Run (Node 22.6+ strips the TypeScript types itself):
//   node tools/sim-balance.mjs                         # defaults from the migrations, 10,000 seeds per level
//   node tools/sim-balance.mjs --config live.json      # live game_config.data (the { levels, g } JSON)
//   node tools/sim-balance.mjs --seeds 2000 --quick    # faster, fewer repeats
// Optional inputs: --stages stages.json  ([{id,name,level,seed,mods,s1,s2,s3}], live Journey stages)
//                  --tiers tiers.json    ([{level,tier,name,min_score}], live mastery_tiers)
//                  --good 900,0.10 --avg 1300,0.25   (reaction ms, share of numbers missed)
//                  --out tools/sim-out   (git-ignored; report.md and results.json are written there)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, def) => { const i = process.argv.indexOf("--" + name); return i < 0 ? def : (process.argv[i + 1] ?? true); };
const flag = (name) => process.argv.includes("--" + name);
const N = Number(arg("seeds", 10000));
const QUICK = flag("quick");
const OUT = resolve(ROOT, arg("out", "tools/sim-out"));
mkdirSync(OUT, { recursive: true });

// ---------- engine ----------
const ENGINE = join(ROOT, "supabase/functions/_shared/engine.ts");
const src = readFileSync(ENGINE, "utf8");
const HEAD = "export function makeBoard(seed: number): Board {";
if (!src.includes(HEAD)) throw new Error("engine.ts makeBoard signature changed; update tools/sim-balance.mjs");
writeFileSync(join(OUT, "engine.sim.ts"), src.replace(HEAD, "function realMakeBoard(seed: number): Board {")
  + "\n// sim-balance: makeBoard can be swapped to test other call orders.\n"
  + "export const makeBoard = (seed: number): Board => ((globalThis as any).__simMakeBoard ?? realMakeBoard)(seed);\nexport { realMakeBoard };\n");
const E = await import(pathToFileURL(join(OUT, "engine.sim.ts")).href);
const REAL = await import(pathToFileURL(ENGINE).href);

// ---------- inputs ----------
function defaultConfig() {
  const sql = readFileSync(join(ROOT, "supabase/migrations/001_schema.sql"), "utf8");
  const m = sql.match(/insert into public\.game_config \(id, data\) values \(1, '(\{[\s\S]*?\})'\);/);
  if (!m) throw new Error("could not read game_config defaults from 001_schema.sql");
  return JSON.parse(m[1]);
}
const cfgRaw = arg("config") ? JSON.parse(readFileSync(resolve(arg("config")), "utf8")) : defaultConfig();
const CFG = cfgRaw.data ?? cfgRaw; // accept the row or its data
const LEVELS = CFG.levels, TOTAL = CFG.g?.total ?? 100;
const LEVEL_NAMES = ["beginner", "medium", "hard"].filter((l) => LEVELS[l]);

function defaultStages() {
  const sql = readFileSync(join(ROOT, "supabase/migrations/005_phase5.sql"), "utf8");
  const re = /\('(w\d+s\d+)', (\d+), (\d+), '((?:[^']|'')*)', '(\w+)', (\d+), '([^']*)', (\d+), (\d+), (\d+), (\d+)\)/g;
  return [...sql.matchAll(re)].map((m) => ({ id: m[1], name: m[4].replace(/''/g, "'"), level: m[5], seed: Number(m[6]), mods: JSON.parse(m[7]), s1: +m[8], s2: +m[9], s3: +m[10] }));
}
function defaultTiers() {
  const sql = readFileSync(join(ROOT, "supabase/migrations/006_phase6.sql"), "utf8");
  return [...sql.matchAll(/\('(\w+)', (\d), '(\w+)', (\d+)\)/g)].map((m) => ({ level: m[1], tier: +m[2], name: m[3], min_score: +m[4] }));
}
const STAGES = arg("stages") ? JSON.parse(readFileSync(resolve(arg("stages")), "utf8")) : defaultStages();
const TIERS = arg("tiers") ? JSON.parse(readFileSync(resolve(arg("tiers")), "utf8")) : defaultTiers();

const prof = (s, name) => { const [rt, miss, wrong] = String(s).split(",").map(Number); return { name, rt, miss, wrong: wrong || 0 }; };
const GOOD = prof(arg("good", "900,0.10"), "good"), AVG = prof(arg("avg", "1300,0.25"), "average");
const GOOD_FAST = { ...GOOD, name: "good-fast", rt: 700 }, GOOD_SLOW = { ...GOOD, name: "good-slow", rt: 1100 }; // same misses, faster / slower hands
const GOOD_W = { ...GOOD, name: "good+wrong", wrong: 0.05 }, AVG_W = { ...AVG, name: "average+wrong", wrong: 0.1 };
const TARGET_WIN = { beginner: 0.6, medium: 0.5, hard: 0.4 };

// ---------- call-order variants ----------
function shuffle(a, r) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
/** Same card as today; each call is a card number with probability q (until the card runs out). */
function biased(q) {
  const cache = new Map();
  return (seed) => {
    let b = cache.get(seed);
    if (b) return b;
    const real = E.realMakeBoard(seed), r = E.mulberry32((seed ^ 0x5bd1e995) >>> 0);
    const onSet = new Set(real.card.filter((v) => v > 0));
    const on = shuffle([...onSet], r), off = shuffle(Array.from({ length: 75 }, (_, i) => i + 1).filter((n) => !onSet.has(n)), r);
    const seq = [];
    while (on.length || off.length) seq.push(on.length && (!off.length || r() < q) ? on.pop() : off.pop());
    b = { card: real.card, seq };
    if (cache.size > 50000) cache.clear();
    cache.set(seed, b);
    return b;
  };
}
const VARIANTS = String(arg("variants", "now,b40,b50")).split(",").map((k) => k === "now"
  ? { key: "now", label: "Calls unchanged (today)", fn: undefined }
  : { key: k, label: `Calls biased: ${k.slice(1)}% on the card`, fn: biased(Number(k.slice(1)) / 100) });
if (VARIANTS[0].key !== "now") throw new Error("--variants must start with now");
const useVariant = (v) => { globalThis.__simMakeBoard = v.fn; };

// ---------- check the copy against the real engine ----------
useVariant(VARIANTS[0]);
for (let s = 1; s <= 300; s++) {
  const lv = { ...LEVELS[LEVEL_NAMES[s % LEVEL_NAMES.length]] };
  const a = E.scoreTaps(s, lv, E.botTaps(s, lv, 700, TOTAL * 1000)), b = REAL.scoreTaps(s, lv, REAL.botTaps(s, lv, 700, TOTAL * 1000));
  if (a.score !== b.score || a.lines !== b.lines) throw new Error("engine copy differs from engine.ts at seed " + s);
}

// ---------- players ----------
function gauss(r) { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }
/** A human-like player: reacts in about rt ms (±25%), skips a share of numbers, sometimes taps a number that was not called. */
function playerTaps(seed, p, pl, totalMs, r) {
  const { card, seq } = E.makeBoard(seed);
  const pos = new Map(seq.map((n, k) => [n, k]));
  const raw = [];
  for (let k = 0; k < seq.length && k * p.every <= totalMs; k++) {
    const i = card.indexOf(seq[k]);
    if (i < 0 || i === 12 || r() < pl.miss) continue;
    const rt = Math.max(250, pl.rt * (1 + 0.25 * gauss(r)));
    raw.push({ i, t: k * p.every + rt });
    if (pl.wrong && r() < pl.wrong) { // a slip: a square whose number has not been called yet
      const cand = card.map((v, j) => (v > 0 && pos.get(v) > k ? j : -1)).filter((j) => j >= 0);
      if (cand.length) raw.push({ i: cand[Math.floor(r() * cand.length)], t: k * p.every + rt * 0.6 });
    }
  }
  raw.sort((a, b) => a.t - b.t);
  const taps = []; let last = -1000;
  for (const x of raw) { const t = Math.round(Math.max(x.t, last + 100)); if (t > totalMs) break; taps.push({ i: x.i, t }); last = t; }
  return taps;
}
/** Score today (floored at 0) and under the decided rule (wrong taps may take the score below zero). */
function play(seed, p, taps) {
  const res = E.scoreTaps(seed, p, taps);
  const noFloor = E.scoreTaps(seed, { ...p, pen: 0 }, taps).score - p.pen * (res.wrong + res.late);
  return { score: res.score, neg: noFloor, lines: res.lines, wrong: res.wrong, late: res.late, daubs: res.daubs, maxMult: res.maxMult, fast: fastTaps(seed, p, taps), tier: tierTaps(seed, p, taps) };
}
/** Correct taps made within SPEED_MS of the call (what a speed bonus would pay for). Same live/marked rules as scoreTaps. */
const SPEED_MS = Number(arg("speed-ms", 1500));
const SPEEDS = String(arg("speed", "3,5")).split(",").map(Number).filter((x) => x > 0);
function fastTaps(seed, p, taps) {
  const { card, seq } = E.makeBoard(seed), marked = card.map((v) => v === 0);
  let n = 0;
  for (const { i, t } of taps) {
    if (marked[i] || E.status(seq, card[i], t, p) !== "live") continue;
    marked[i] = true;
    if (t - seq.indexOf(card[i]) * p.every <= SPEED_MS) n++;
  }
  return n;
}
/** Graded speed bonus input: correct taps within 1.0 s of the call (n1) and within 1.0–2.0 s (n2). */
function tierTaps(seed, p, taps) {
  const { card, seq } = E.makeBoard(seed), marked = card.map((v) => v === 0);
  let n1 = 0, n2 = 0;
  for (const { i, t } of taps) {
    if (marked[i] || E.status(seq, card[i], t, p) !== "live") continue;
    marked[i] = true;
    const d = t - seq.indexOf(card[i]) * p.every;
    if (d <= 1000) n1++; else if (d <= 2000) n2++;
  }
  return [n1, n2];
}
const perfectOf = (seed, p, totalMs) => { const taps = E.botTaps(seed, p, 700, totalMs), res = E.scoreTaps(seed, p, taps); return { ...res, fast: fastTaps(seed, p, taps), tier: tierTaps(seed, p, taps) }; };

// ---------- stats ----------
const sorted = (a) => Float64Array.from(a).sort();
const q = (s, f) => s[Math.min(s.length - 1, Math.max(0, Math.floor(f * (s.length - 1) + 0.5)))];
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const share = (a, f) => a.filter(f).length / a.length;
const pct = (x) => (100 * x).toFixed(0) + "%";
const r0 = (x) => Math.round(x);
const dist = (a) => { const s = sorted(a); return { mean: mean(a), p10: q(s, 0.1), p50: q(s, 0.5), p90: q(s, 0.9), min: s[0], max: s[s.length - 1] }; };
const dstr = (d) => `${r0(d.mean)} | ${r0(d.p10)} | ${r0(d.p50)} | ${r0(d.p90)} | ${r0(d.min)}–${r0(d.max)}`;
const seeds = (n, salt) => { const r = E.mulberry32(salt); return Array.from({ length: n }, () => Math.floor(r() * 4294967296)); };
const round5 = (x) => Math.max(10, Math.round(x / 5) * 5);

/** Share of the board's perfect score the ghost needs so that `scores` beat it with probability `want`. */
function solveShare(perf, scores, want) {
  let best = 0, err = Infinity; // scores move in steps of 5-10 points, so pick the share whose win rate is closest
  for (let f = 0.5; f <= 1.0001; f += 0.0025) { const e = Math.abs(winAt(perf, scores, f) - want); if (e < err - 1e-9) { err = e; best = f; } }
  return best;
}
const winAt = (perf, scores, f) => share(scores.map((s, k) => s > Math.round(f * perf[k])), Boolean);

// ---------- main runs ----------
const T0 = Date.now();
const RES = { inputs: { seeds: N, total: TOTAL, levels: LEVELS, good: GOOD, avg: AVG, source: arg("config") ? "file" : "001_schema.sql defaults" }, levels: {}, stages: [], daily: [], mastery: {} };
const md = [];
md.push(`# Bingo Arena balance simulation (WP4)\n`);
md.push(`Seeds per level: ${N}. Round: ${TOTAL} s. Level values: ${RES.inputs.source}. Good player: ${GOOD.rt} ms, ${pct(GOOD.miss)} missed. Average player: ${AVG.rt} ms, ${pct(AVG.miss)} missed. Perfect = botTaps at 700 ms (the reference player used for star goals). Ghost win = score > target.\n`);

for (const v of VARIANTS) {
  useVariant(v);
  RES.levels[v.key] = {};
  for (const L of LEVEL_NAMES) {
    const p = LEVELS[L], totalMs = TOTAL * 1000;
    const S = seeds(N, 20261109 + L.length);
    const out = { perf: [], perfLines: [], good: [], goodLines: [], avg: [], avgLines: [], ghost: [], goodW: [], goodWneg: [], avgW: [], avgWneg: [], onCard: [] };
    S.forEach((seed, k) => {
      const r = E.mulberry32((seed ^ 0xa5a5a5a5) >>> 0);
      const pf = perfectOf(seed, p, totalMs);
      const g = play(seed, p, playerTaps(seed, p, GOOD, totalMs, r));
      const a = play(seed, p, playerTaps(seed, p, AVG, totalMs, r));
      const r2 = E.mulberry32((seed ^ 0x77777777) >>> 0);
      const gF = play(seed, p, playerTaps(seed, p, GOOD_FAST, totalMs, r2)), gS = play(seed, p, playerTaps(seed, p, GOOD_SLOW, totalMs, r2));
      for (const [k, x] of [["perf", pf], ["good", g], ["avg", a], ["gfast", gF], ["gslow", gS]]) { (out[k + "T1"] ??= []).push(x.tier[0]); (out[k + "T2"] ??= []).push(x.tier[1]); }
      (out.gfast ??= []).push(gF.score); (out.gslow ??= []).push(gS.score);
      (out.perfM3 ??= []).push(pf.maxMult >= 3 ? 1 : 0); (out.goodM3 ??= []).push(g.maxMult >= 3 ? 1 : 0); (out.avgM3 ??= []).push(a.maxMult >= 3 ? 1 : 0); (out.goodDaubs ??= []).push(g.daubs); (out.avgDaubs ??= []).push(a.daubs); (out.perfFast ??= []).push(pf.fast); (out.goodFast ??= []).push(g.fast); (out.avgFast ??= []).push(a.fast);
      out.perf.push(pf.score); out.perfLines.push(pf.lines);
      out.good.push(g.score); out.goodLines.push(g.lines);
      out.avg.push(a.score); out.avgLines.push(a.lines);
      out.ghost.push(E.ghostTarget(seed, p));
      out.onCard.push(pf.daubs);
      if (k < (QUICK ? 1000 : 4000)) {
        const gw = play(seed, p, playerTaps(seed, p, GOOD_W, totalMs, r)), aw = play(seed, p, playerTaps(seed, p, AVG_W, totalMs, r));
        out.goodW.push(gw.score); out.goodWneg.push(gw.neg); out.avgW.push(aw.score); out.avgWneg.push(aw.neg);
      }
    });
    const calls = Math.min(75, Math.floor(totalMs / p.every) + 1);
    const f = solveShare(out.perf, out.good, TARGET_WIN[L]);
    // variety between boards: per-board win chance of a good player
    const nb = QUICK ? 100 : 300, reps = QUICK ? 60 : 150, perBoard = [];
    S.slice(0, nb).forEach((seed, k) => {
      const r = E.mulberry32((seed ^ 0x1234567) >>> 0), tgt = Math.round(f * out.perf[k]);
      let w = 0; for (let j = 0; j < reps; j++) if (play(seed, p, playerTaps(seed, p, GOOD, totalMs, r)).score > tgt) w++;
      perBoard.push(w / reps);
    });
    const nW = out.goodW.length;
    RES.levels[v.key][L] = {
      calls, cardHitsPerRound: dist(out.onCard),
      perfect: dist(out.perf), good: dist(out.good), avg: dist(out.avg),
      ghostNow: { target: dist(out.ghost), winPerfect: share(out.perf.map((s, k) => s > out.ghost[k]), Boolean), winGood: share(out.good.map((s, k) => s > out.ghost[k]), Boolean), winAvg: share(out.avg.map((s, k) => s > out.ghost[k]), Boolean) },
      lines: Object.fromEntries([["perfect", out.perfLines], ["good", out.goodLines], ["avg", out.avgLines]].map(([n, a]) => [n, { mean: mean(a), ge1: share(a, (x) => x >= 1), ge2: share(a, (x) => x >= 2), ge3: share(a, (x) => x >= 3) }])),
      ghostFix: {
        share: f, winGood: winAt(out.perf, out.good, f), winAvg: winAt(out.perf, out.avg, f),
        target: dist(out.perf.map((x) => Math.round(f * x))), perBoardGoodWin: dist(perBoard),
        boardsUnder25: share(perBoard, (x) => x < 0.25), boardsOver85: share(perBoard, (x) => x > 0.85),
        withWrongTaps: {
          goodFloor: winAt(out.perf.slice(0, nW), out.goodW, f), goodNeg: winAt(out.perf.slice(0, nW), out.goodWneg, f),
          avgFloor: winAt(out.perf.slice(0, nW), out.avgW, f), avgNeg: winAt(out.perf.slice(0, nW), out.avgWneg, f),
          goodMeanFloor: mean(out.goodW), goodMeanNeg: mean(out.goodWneg), avgMeanFloor: mean(out.avgW), avgMeanNeg: mean(out.avgWneg),
          avgBelowZero: share(out.avgWneg, (x) => x < 0),
        },
      },
      _raw: { perf: out.perf, good: out.good, avg: out.avg, goodLines: out.goodLines, avgLines: out.avgLines, ghost: out.ghost, perfFast: out.perfFast, goodFast: out.goodFast, gfast: out.gfast, gslow: out.gslow, perfT1: out.perfT1, perfT2: out.perfT2, goodT1: out.goodT1, goodT2: out.goodT2, avgT1: out.avgT1, avgT2: out.avgT2, gfastT1: out.gfastT1, gfastT2: out.gfastT2, gslowT1: out.gslowT1, gslowT2: out.gslowT2, perfM3: out.perfM3, goodM3: out.goodM3, avgM3: out.avgM3, goodDaubs: out.goodDaubs, avgDaubs: out.avgDaubs, avgFast: out.avgFast, pt: p.pt },
    };
    process.stderr.write(`${v.key} ${L} done (${((Date.now() - T0) / 1000).toFixed(0)} s)\n`);
  }
}

// ---------- report: scores, ghost, lines ----------
for (const v of VARIANTS) {
  const R = RES.levels[v.key];
  md.push(`\n## ${v.label}\n`);
  md.push(`### 1. Score distribution (mean | p10 | p50 | p90 | range)\n`);
  md.push(`| Level | Calls/round | Card numbers called (mean) | Perfect | Good | Average |\n|---|---|---|---|---|---|`);
  for (const L of LEVEL_NAMES) { const x = R[L]; md.push(`| ${L} | ${x.calls} | ${x.cardHitsPerRound.mean.toFixed(1)} of 24 | ${dstr(x.perfect)} | ${dstr(x.good)} | ${dstr(x.avg)} |`); }
  md.push(`\n### 2. Current ghost (gl + random(gr)) — how often each player beats it\n`);
  md.push(`| Level | Ghost target (mean, p10–p90) | Perfect wins | Good wins | Average wins |\n|---|---|---|---|---|`);
  for (const L of LEVEL_NAMES) { const g = R[L].ghostNow; md.push(`| ${L} | ${r0(g.target.mean)} (${r0(g.target.p10)}–${r0(g.target.p90)}) | ${pct(g.winPerfect)} | ${pct(g.winGood)} | ${pct(g.winAvg)} |`); }
  md.push(`\n### 3. Lines per round\n`);
  md.push(`| Level | Perfect: mean, 1+, 3+ | Good: mean, 1+, 2+, 3+ | Average: mean, 1+, 2+, 3+ |\n|---|---|---|---|`);
  for (const L of LEVEL_NAMES) { const l = R[L].lines; md.push(`| ${L} | ${l.perfect.mean.toFixed(2)}, ${pct(l.perfect.ge1)}, ${pct(l.perfect.ge3)} | ${l.good.mean.toFixed(2)}, ${pct(l.good.ge1)}, ${pct(l.good.ge2)}, ${pct(l.good.ge3)} | ${l.avg.mean.toFixed(2)}, ${pct(l.avg.ge1)}, ${pct(l.avg.ge2)}, ${pct(l.avg.ge3)} |`); }
  md.push(`\n### 4. Ghost fix: target = share × this board's perfect score\n`);
  md.push(`| Level | Share | Target (mean, p10–p90) | Good wins | Average wins | Per-board good win chance p10 / p50 / p90 | Boards where good wins <25% / >85% |\n|---|---|---|---|---|---|---|`);
  for (const L of LEVEL_NAMES) { const g = R[L].ghostFix; md.push(`| ${L} | ${g.share.toFixed(3)} | ${r0(g.target.mean)} (${r0(g.target.p10)}–${r0(g.target.p90)}) | ${pct(g.winGood)} | ${pct(g.winAvg)} | ${pct(g.perBoardGoodWin.p10)} / ${pct(g.perBoardGoodWin.p50)} / ${pct(g.perBoardGoodWin.p90)} | ${pct(g.boardsUnder25)} / ${pct(g.boardsOver85)} |`); }
  md.push(`\nWith wrong taps (good 5%, average 10% of taps are slips), at the same share — today's floor at 0 vs the decided rule (below zero allowed):\n`);
  md.push(`| Level | Good wins (floor / below 0) | Average wins (floor / below 0) | Good mean score (floor / below 0) | Average mean (floor / below 0) | Average rounds below 0 |\n|---|---|---|---|---|---|`);
  for (const L of LEVEL_NAMES) { const w = R[L].ghostFix.withWrongTaps; md.push(`| ${L} | ${pct(w.goodFloor)} / ${pct(w.goodNeg)} | ${pct(w.avgFloor)} / ${pct(w.avgNeg)} | ${r0(w.goodMeanFloor)} / ${r0(w.goodMeanNeg)} | ${r0(w.avgMeanFloor)} / ${r0(w.avgMeanNeg)} | ${pct(w.avgBelowZero)} |`); }
}

// ---------- 5b. line quest and badge with calls unchanged ----------
{
  md.push(`\n## 5b. Calls unchanged: line quest ("Complete N lines" in a day) and badge ("N lines in one round")\n`);
  md.push(`| Level | Player | Quest 1 line within 3 rounds | 2 lines within 3 | 3 lines within 3 (today) | 3 lines within 10 | Badge 1+ in a round | 2+ | 3+ (today) | 3+ within 50 rounds |\n|---|---|---|---|---|---|---|---|---|---|`);
  const r = E.mulberry32(777);
  for (const L of LEVEL_NAMES) for (const [who, key] of [["good", "goodLines"], ["average", "avgLines"]]) {
    const a = RES.levels.now[L]._raw[key];
    const reach = (need, rounds) => { let ok = 0; for (let t = 0; t < 4000; t++) { let s = 0; for (let j = 0; j < rounds; j++) s += a[Math.floor(r() * a.length)]; if (s >= need) ok++; } return ok / 4000; };
    const p1 = share(a, (x) => x >= 1), p2 = share(a, (x) => x >= 2), p3 = share(a, (x) => x >= 3);
    md.push(`| ${L} | ${who} | ${pct(reach(1, 3))} | ${pct(reach(2, 3))} | ${pct(reach(3, 3))} | ${pct(reach(3, 10))} | ${pct(p1)} | ${pct(p2)} | ${(100 * p3).toFixed(1)}% | ${pct(1 - (1 - p3) ** 50)} |`);
  }
}

// ---------- 5c. Other live quests that depend on the call order ----------
{
  md.push(`
## 5c. Daily quests that depend on the calls: "Daub 25 numbers" (daubs) and "Reach a x3 combo" (8 correct daubs in a row)
`);
  md.push(`| Calls | Level | Good: daubs/round | Daub 25 within 3 rounds (good / avg) | Combo x3 in a round: perfect / good / average | Combo x3 within 3 rounds (good) |
|---|---|---|---|---|---|`);
  const r = E.mulberry32(555); RES.quests = {};
  for (const v of VARIANTS) for (const L of LEVEL_NAMES) {
    const x = RES.levels[v.key][L]._raw;
    const reach3 = (a, need) => { let ok = 0; for (let t = 0; t < 4000; t++) { let sm = 0; for (let j = 0; j < 3; j++) sm += a[Math.floor(r() * a.length)]; if (sm >= need) ok++; } return ok / 4000; };
    const q = { daubsGood: mean(x.goodDaubs), d25Good: reach3(x.goodDaubs, 25), d25Avg: reach3(x.avgDaubs, 25), m3Perfect: mean(x.perfM3), m3Good: mean(x.goodM3), m3Avg: mean(x.avgM3), m3Good3: 1 - (1 - mean(x.goodM3)) ** 3 };
    RES.quests[`${v.key}.${L}`] = q;
    md.push(`| ${v.key} | ${L} | ${q.daubsGood.toFixed(1)} | ${pct(q.d25Good)} / ${pct(q.d25Avg)} | ${pct(q.m3Perfect)} / ${pct(q.m3Good)} / ${pct(q.m3Avg)} | ${pct(q.m3Good3)} |`);
  }
}

// ---------- 6. Journey stages and Daily twists ----------
const STAR_REPS = QUICK ? 300 : 1000;
function starRates(seed, p, totalMs, goals, pl) {
  const r = E.mulberry32((seed ^ 0x2468ace) >>> 0), st = [0, 0, 0, 0]; let lines = 0;
  for (let j = 0; j < STAR_REPS; j++) { const x = play(seed, p, playerTaps(seed, p, pl, totalMs, r)); st[x.score >= goals[2] ? 3 : x.score >= goals[1] ? 2 : x.score >= goals[0] ? 1 : 0]++; lines += x.lines; }
  return { s1: (st[1] + st[2] + st[3]) / STAR_REPS, s2: (st[2] + st[3]) / STAR_REPS, s3: st[3] / STAR_REPS, lines: lines / STAR_REPS };
}
md.push(`\n## 6a. Journey stages: share of good / average attempts reaching 1★ / 2★ / 3★\n`);
md.push(`Stored goals are the numbers in the stages table (26/48/70% of the 700 ms reference on today's boards). "Regenerated" recomputes them the same way on the new boards.\n`);
md.push(`| Stage | Level | Twist | Stored goals | ${VARIANTS.map((v) => `${v.key}, stored goals: perfect, good ★1/2/3, avg ★1/2/3`).join(" | ")} | b50, regenerated goals: good, avg |
|---|---|---|---|${VARIANTS.map(() => "---").join("|")}|---|`);
const sr = (x) => `${pct(x.s1)}/${pct(x.s2)}/${pct(x.s3)}`;
const regen = (pf) => [0.26, 0.48, 0.7].map((f) => round5(pf * f));
for (const s of STAGES) {
  const p = E.applyMods({ ...LEVELS[s.level], total: TOTAL }, s.mods ?? {}), totalMs = p.total * 1000, goals = [s.s1, s.s2, s.s3];
  const row = { id: s.id, name: s.name, level: s.level, label: s.mods?.label ?? "", goals };
  const cells = [];
  for (const v of VARIANTS) {
    useVariant(v);
    const pf = perfectOf(s.seed, p, totalMs).score;
    const g = starRates(s.seed, p, totalMs, goals, GOOD), a = starRates(s.seed, p, totalMs, goals, AVG);
    row[v.key] = { perfect: pf, good: g, avg: a };
    if (v.key === "b50") { const rg = regen(pf); row.b50regen = { goals: rg, good: starRates(s.seed, p, totalMs, rg, GOOD), avg: starRates(s.seed, p, totalMs, rg, AVG) }; }
    cells.push(`${pf}, ${sr(g)}, ${sr(a)}`);
  }
  RES.stages.push(row);
  md.push(`| ${s.id} ${s.name} | ${s.level} | ${row.label || "—"} | ${goals.join("/")} | ${cells.join(" | ")} | ${row.b50regen ? `${sr(row.b50regen.good)}, ${sr(row.b50regen.avg)}` : "—"} |`);
}
useVariant(VARIANTS[0]);
process.stderr.write(`stages done (${((Date.now() - T0) / 1000).toFixed(0)} s)\n`);

md.push(`\n## 6b. Daily Challenge twists (goals from each day's board: 26/48/70% of perfect), good / average ★1/2/3 and lines per round\n`);
md.push(`| Twist | Level | ${VARIANTS.map((v) => `${v.label}: good, avg, good lines`).join(" | ")} |\n|---|---|${VARIANTS.map(() => "---").join("|")}|`);
const DN = QUICK ? 300 : 1500;
for (const mods of E.DAILY_MODS) for (const L of LEVEL_NAMES) {
  const p = E.applyMods({ ...LEVELS[L], total: TOTAL }, mods), totalMs = p.total * 1000;
  const cells = [], row = { twist: mods.label ?? "Normal", level: L };
  for (const v of VARIANTS) {
    useVariant(v);
    const r = E.mulberry32(99 + L.length), st = { good: [0, 0, 0], avg: [0, 0, 0] }; let gl = 0;
    for (const seed of seeds(DN, 4242 + L.length)) {
      const pf = perfectOf(seed, p, totalMs).score, goals = [0.26, 0.48, 0.7].map((f) => round5(pf * f));
      for (const [k, pl] of [["good", GOOD], ["avg", AVG]]) {
        const x = play(seed, p, playerTaps(seed, p, pl, totalMs, r));
        goals.forEach((gg, i) => { if (x.score >= gg) st[k][i]++; });
        if (k === "good") gl += x.lines;
      }
    }
    const f = (a) => a.map((x) => pct(x / DN)).join("/");
    row[v.key] = { good: st.good.map((x) => x / DN), avg: st.avg.map((x) => x / DN), goodLines: gl / DN };
    cells.push(`${f(st.good)}, ${f(st.avg)}, ${(gl / DN).toFixed(2)}`);
  }
  RES.daily.push(row);
  md.push(`| ${row.twist} | ${L} | ${cells.join(" | ")} |`);
}
useVariant(VARIANTS[0]);

// ---------- 7. Mastery ----------
md.push(`\n## 7. Mastery ranks (rank = best score ever on the level)\n`);
md.push(`Proposed tiers: Silver = an average player's best of 5 rounds (median), Gold = a good player's best of 5, Platinum = a good player's best of 20, Legend = a good player's best of 100 (p90).\n`);
md.push(`| Variant | Level | Tiers today (Silver/Gold/Platinum/Legend) | Today's tiers — good after 1 / 5 / 20 rounds (most common) | Today's tiers — average after 1 / 5 / 20 | Good rounds that reach Platinum / reach it and lose today's ghost | Proposed Silver/Gold/Platinum/Legend | Proposed — good after 1 / 5 / 20 | Proposed — average after 1 / 5 / 20 |\n|---|---|---|---|---|---|---|---|---|`);
for (const v of VARIANTS) for (const L of LEVEL_NAMES) {
  const t = TIERS.filter((x) => x.level === L).sort((a, b) => a.tier - b.tier);
  const R = RES.levels[v.key][L], raw = R._raw, r = E.mulberry32(31337);
  const bestOf = (a, n) => { const o = []; for (let k = 0; k < 4000; k++) { let b = -Infinity; for (let j = 0; j < n; j++) b = Math.max(b, a[Math.floor(r() * a.length)]); o.push(b); } return sorted(o); };
  const tierOf = (tt, s) => { let n = "Bronze"; for (const x of tt) if (s >= x.min_score) n = x.name; return n; };
  const modeTier = (tt, s) => { const c = {}; for (const x of s) { const n = tierOf(tt, x); c[n] = (c[n] ?? 0) + 1; } const [n, k] = Object.entries(c).sort((a, b) => b[1] - a[1])[0]; return `${n} ${pct(k / s.length)}`; };
  const plat = t.find((x) => x.name === "Platinum")?.min_score ?? Infinity;
  const G = [1, 5, 20].map((n) => bestOf(raw.good, n)), A = [1, 5, 20].map((n) => bestOf(raw.avg, n));
  const proposedVals = [q(bestOf(raw.avg, 5), 0.5), q(G[1], 0.5), q(G[2], 0.5), q(bestOf(raw.good, 100), 0.9)].map(round5);
  for (let i = 1; i < 4; i++) proposedVals[i] = Math.max(proposedVals[i], proposedVals[i - 1] + 5);
  const pt = [{ name: "Bronze", min_score: 0 }, ...["Silver", "Gold", "Platinum", "Legend"].map((name, i) => ({ name, min_score: proposedVals[i] }))];
  const platLost = share(raw.good.map((s, k) => s >= plat && !(s > raw.ghost[k])), Boolean);
  RES.mastery[`${v.key}.${L}`] = { tiers: t, proposed: proposedVals, goodReachPlatinum: share(raw.good, (s) => s >= plat), goodPlatinumButLostGhost: platLost };
  const row3 = (tt, X) => X.map((s) => modeTier(tt, s)).join(" / ");
  md.push(`| ${v.key} | ${L} | ${t.slice(1).map((x) => x.min_score).join("/")} | ${row3(t, G)} | ${row3(t, A)} | ${pct(share(raw.good, (s) => s >= plat))} / ${pct(platLost)} | ${proposedVals.join("/")} | ${row3(pt, G)} | ${row3(pt, A)} |`);
}

// ---------- 8. Speed bonus ----------
// Not in the engine today: each correct tap within SPEED_MS of its call earns round(bonus × pt) extra points,
// on top of the base points (not multiplied by the combo). The 700 ms reference earns it on every tap.
{
  md.push(`\n## 8. Speed bonus: +B × pt points for each correct tap within ${SPEED_MS} ms of the call\n`);
  md.push(`Share of correct taps that are fast enough: good ≈ P(reaction ≤ ${SPEED_MS} ms) with ${GOOD.rt} ms ±25%, average with ${AVG.rt} ms ±25%. Ghost share re-solved for the decided good-player win rates; ranks use the section 7 formula.\n`);
  md.push(`| Variant | Level | Bonus B | Perfect mean | Good mean | Average mean | Good − average (good ÷ average) | Ghost share | Good / average win | Proposed Silver/Gold/Platinum/Legend |\n|---|---|---|---|---|---|---|---|---|---|`);
  const r = E.mulberry32(4711);
  const bestOf = (a, n, f) => { const o = []; for (let k = 0; k < 4000; k++) { let b = -Infinity; for (let j = 0; j < n; j++) b = Math.max(b, a[Math.floor(r() * a.length)]); o.push(b); } return q(sorted(o), f); };
  RES.speed = {};
  for (const v of VARIANTS) for (const L of LEVEL_NAMES) {
    const raw = RES.levels[v.key][L]._raw;
    for (const B of [0, ...SPEEDS]) {
      const pts = Math.round(B * raw.pt);
      const P = raw.perf.map((s, k) => s + pts * raw.perfFast[k]), G = raw.good.map((s, k) => s + pts * raw.goodFast[k]), A = raw.avg.map((s, k) => s + pts * raw.avgFast[k]);
      const f = solveShare(P, G, TARGET_WIN[L]);
      const tiers = [bestOf(A, 5, 0.5), bestOf(G, 5, 0.5), bestOf(G, 20, 0.5), bestOf(G, 100, 0.9)].map(round5);
      for (let i = 1; i < 4; i++) tiers[i] = Math.max(tiers[i], tiers[i - 1] + 5);
      const row = { bonusPoints: pts, perfect: mean(P), good: mean(G), avg: mean(A), gap: mean(G) - mean(A), ratio: mean(G) / mean(A), share: f, winGood: winAt(P, G, f), winAvg: winAt(P, A, f), tiers, fastTapsGood: mean(raw.goodFast), fastTapsAvg: mean(raw.avgFast) };
      (RES.speed[`${v.key}.${L}`] ??= {})[B] = row;
      md.push(`| ${v.key} | ${L} | ${B ? `+${B} (${pts} pts)` : "none"} | ${r0(row.perfect)} | ${r0(row.good)} | ${r0(row.avg)} | ${r0(row.gap)} (${row.ratio.toFixed(2)}×) | ${f.toFixed(3)} | ${pct(row.winGood)} / ${pct(row.winAvg)} | ${tiers.join("/")} |`);
    }
  }
}

// ---------- 9. Graded speed bonus ----------
// Each correct tap earns round(B x pt) if it comes within 1.0 s of its call, or round(B x pt / 2) within 2.0 s. Not multiplied by the combo.
const GRADED = String(arg("graded", "3,5,8")).split(",").map(Number).filter((x) => x > 0);
{
  md.push(`
## 9. Graded speed bonus: +B x pt within 1.0 s of the call, +B/2 x pt within 2.0 s (not multiplied by the combo)
`);
  md.push(`Fast good = 700 ms, slow good = 1,100 ms (both miss 10%). The ghost share is re-solved so the good player (900 ms) wins the decided share. "Fast beats slow" = share of boards where the fast good player outscores the slow good player.
`);
  md.push(`| Calls | Level | B | Points (≤1 s / ≤2 s) | Perfect | Good | Avg | Good ÷ avg | Ghost share | Good / avg win | Fast good / slow good score | Fast / slow win | Fast beats slow | Silver/Gold/Platinum/Legend |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|`);
  const rr = E.mulberry32(8080); RES.graded = {};
  const bestOf = (a, n, fr) => { const o = []; for (let k = 0; k < 4000; k++) { let b = -Infinity; for (let j = 0; j < n; j++) b = Math.max(b, a[Math.floor(rr() * a.length)]); o.push(b); } return q(sorted(o), fr); };
  for (const v of VARIANTS) for (const L of LEVEL_NAMES) {
    const raw = RES.levels[v.key][L]._raw;
    for (const B of [0, ...GRADED]) {
      const a1 = Math.round(B * raw.pt), a2 = Math.round((B * raw.pt) / 2);
      const sc = (base, k) => base.map((x, i) => x + a1 * raw[k + "T1"][i] + a2 * raw[k + "T2"][i]);
      const P = sc(raw.perf, "perf"), G = sc(raw.good, "good"), A = sc(raw.avg, "avg"), F = sc(raw.gfast, "gfast"), S = sc(raw.gslow, "gslow");
      const fshare = solveShare(P, G, TARGET_WIN[L]);
      let beat = 0; for (let i = 0; i < F.length; i++) beat += F[i] > S[i] ? 1 : F[i] === S[i] ? 0.5 : 0; beat /= F.length;
      const tiers = [bestOf(A, 5, 0.5), bestOf(G, 5, 0.5), bestOf(G, 20, 0.5), bestOf(G, 100, 0.9)].map(round5);
      for (let i = 1; i < 4; i++) tiers[i] = Math.max(tiers[i], tiers[i - 1] + 5);
      const row = { pts: [a1, a2], perfect: mean(P), good: mean(G), avg: mean(A), ratio: mean(G) / mean(A), share: fshare, winGood: winAt(P, G, fshare), winAvg: winAt(P, A, fshare), fast: mean(F), slow: mean(S), winFast: winAt(P, F, fshare), winSlow: winAt(P, S, fshare), beat, tiers };
      (RES.graded[`${v.key}.${L}`] ??= {})[B] = row;
      md.push(`| ${v.key} | ${L} | ${B || "none"} | ${B ? a1 + " / " + a2 : "—"} | ${r0(row.perfect)} | ${r0(row.good)} | ${r0(row.avg)} | ${row.ratio.toFixed(2)}× | ${row.share.toFixed(3)} | ${pct(row.winGood)} / ${pct(row.winAvg)} | ${r0(row.fast)} / ${r0(row.slow)} | ${pct(row.winFast)} / ${pct(row.winSlow)} | ${pct(beat)} | ${tiers.join("/")} |`);
    }
  }
}

// ---------- 10. Quest goals per option ----------
{
  md.push(`
## 10. Quest goals: share of players who finish the quest within 3 rounds in a day (good / average)
`);
  md.push(`| Calls | Level | Lines: goal 1 | goal 2 | goal 3 | Daub: 25 | 30 | 35 | 40 | Combo x3: goal 1 | goal 2 | goal 3 | Daubs per round (good) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|`);
  const rq = E.mulberry32(1357); RES.questGoals = {};
  const reach = (a, need) => { let ok = 0; for (let t = 0; t < 4000; t++) { let sm = 0; for (let j = 0; j < 3; j++) sm += a[Math.floor(rq() * a.length)]; if (sm >= need) ok++; } return ok / 4000; };
  for (const v of VARIANTS) for (const L of LEVEL_NAMES) {
    const x = RES.levels[v.key][L]._raw, c = (g, a) => `${pct(reach(x[g], a))} / ${pct(reach(x[g.replace("good", "avg")], a))}`;
    const o = { line: [1, 2, 3].map((n) => [reach(x.goodLines, n), reach(x.avgLines, n)]), daub: [25, 30, 35, 40].map((n) => [reach(x.goodDaubs, n), reach(x.avgDaubs, n)]), combo: [1, 2, 3].map((n) => [reach(x.goodM3, n), reach(x.avgM3, n)]), daubsGood: mean(x.goodDaubs) };
    RES.questGoals[`${v.key}.${L}`] = o;
    md.push(`| ${v.key} | ${L} | ${o.line.map(([g, aa]) => pct(g) + " / " + pct(aa)).join(" | ")} | ${o.daub.map(([g, aa]) => pct(g) + " / " + pct(aa)).join(" | ")} | ${o.combo.map(([g, aa]) => pct(g) + " / " + pct(aa)).join(" | ")} | ${o.daubsGood.toFixed(1)} |`);
  }
}

// ---------- write ----------
for (const v of VARIANTS) for (const L of LEVEL_NAMES) delete RES.levels[v.key][L]._raw;
writeFileSync(join(OUT, "report.md"), md.join("\n") + "\n");
writeFileSync(join(OUT, "results.json"), JSON.stringify(RES, null, 1));
console.log(md.join("\n"));
process.stderr.write(`done in ${((Date.now() - T0) / 1000).toFixed(0)} s; wrote ${join(OUT, "report.md")} and results.json\n`);
