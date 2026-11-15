// WP5 (QA BA-01, BA-11, BA-35): a round left open by a reload is resumed or closed, instead of blocking new rounds for minutes.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decideOpen, GRACE_MS, RESUME_MIN_MS, resumeBody, type OpenRow } from "../functions/_shared/openRound.ts";
import { waitMessage } from "../../web/src/lib/roundWait.ts";
import { openRoundText } from "../../web/src/newui/screens/Lobby.logic.ts";

const src = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const T0 = Date.parse("2026-11-15T10:00:00Z");
const row = (mode: string, extra: Partial<OpenRow> = {}): OpenRow =>
  ({ id: "r-1", mode, level: "medium", seed: "12345", fee: 20, params: { total: 100, every: 3000, cv: 2, ghost: 300 }, started_at: new Date(T0).toISOString(), ...extra });

test("a solo-type round with at least 10 s left is resumed, with the time already played", () => {
  for (const mode of ["solo", "ghost", "daily", "stage", "tour", "duel", "drill"]) {
    assert.deepEqual(decideOpen(row(mode), T0 + 30_000), { action: "resume", elapsedMs: 30_000, leftMs: 70_000 }, mode);
    assert.equal(decideOpen(row(mode), T0 + 100_000 - RESUME_MIN_MS).action, "resume", `${mode}: exactly 10 s left`);
    assert.equal(decideOpen(row(mode), T0 + 100_000 - RESUME_MIN_MS + 1).action, "close", `${mode}: under 10 s left`);
  }
});

test("past its end plus a few seconds, any round (a live match too) is closed", () => {
  for (const mode of ["solo", "ghost", "daily", "pvp"]) {
    assert.equal(decideOpen(row(mode), T0 + 100_000 + GRACE_MS + 1).action, "close", mode);
    assert.equal(decideOpen(row(mode), T0 + 3_600_000).action, "close", mode);
  }
  assert.equal(GRACE_MS, 5000);
});

test("a live match still on is never resumed or closed early: the answer is the real wait", () => {
  assert.deepEqual(decideOpen(row("pvp"), T0 + 30_000), { action: "wait", waitS: 75 });
  assert.deepEqual(decideOpen(row("pvp"), T0 + 99_500), { action: "wait", waitS: 6 }, "under 10 s left: still a wait, never a close");
  assert.deepEqual(decideOpen(row("pvp", { started_at: new Date(T0 + 6000).toISOString() }), T0), { action: "wait", waitS: 111 }, "a match that starts in 6 s");
});

test("odd rows: no total means 100 s, a bad date is closed", () => {
  assert.equal(decideOpen(row("solo", { params: {} }), T0 + 50_000).action, "resume");
  assert.equal(decideOpen(row("solo", { started_at: "not a date" }), T0).action, "close");
});

test("resume gives the same seed, the same params (cv included) and the same start time", () => {
  const r = row("ghost");
  const b = resumeBody(r, { elapsedMs: 30_000, leftMs: 70_000 }, 140);
  assert.equal(b.roundId, "r-1"); assert.equal(b.seed, 12345); assert.equal(b.params, r.params, "the stored params object, untouched");
  assert.equal(b.params.cv, 2); assert.equal(b.startedAt, r.started_at); assert.equal(b.resumed, true);
  assert.equal(b.elapsedMs, 30_000); assert.equal(b.balance, 140);
});

test("start-round: the open round is handled before any other check, and #74's version choice is unchanged", () => {
  const sr = src("supabase/functions/start-round/index.ts");
  const at = (s: string) => { const i = sr.indexOf(s); assert.ok(i >= 0, s); return i; };
  assert.ok(at("const open = await openRound(db, user.id);") < at('if (mode === "daily") {'), "before the Daily Challenge's already_played");
  assert.ok(at('if (cfg.g.maint) throw new HttpError(503, "maintenance");') < at("const open = await openRound"), "after the ban, age and maintenance checks");
  assert.ok(sr.includes('if (open && decision?.action === "close") await abandonRound(db, user.id, open);'));
  assert.ok(sr.includes('return json({ error: "round_in_progress", wait: decision.waitS }, 409);'));
  assert.ok(sr.includes("return json(resumeBody(open, decision, await balanceNow()));"));
  assert.ok(sr.indexOf("if (check === true)") < sr.indexOf('decision?.action === "close") await abandonRound'), "the lobby's check changes nothing");
  assert.ok(sr.includes("const cv = roundVersion({ mode, flag: flag.mode, admin: prof.role === \"admin\", ready: v2Level(cfg, level!) !== null, boardCv });"), "version choice as merged");
  const sb = src("supabase/functions/submit-round/index.ts");
  assert.ok(sb.includes("await abandonRound(db, user.id, r);"), "submit-round's abandon is the same close");
  assert.ok(sb.includes("const res = scoreTaps(Number(r.seed), p, v.taps);"), "scoring as merged");
  const ab = src("supabase/functions/_shared/openRound.ts");
  assert.ok(ab.includes('update({ status: "rejected", finished_at: new Date().toISOString(), result: { reason: "abandoned" } })'), "abandoned, no refund");
  assert.ok(!/ledger|refund\(/.test(ab.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "")), "nothing is paid back");
});

test("messages show the real wait", () => {
  assert.equal(waitMessage("round_in_progress:42"), "Your last round is still running. You can start a new one in 42 seconds.");
  assert.equal(waitMessage("round_in_progress:1"), "Your last round is still running. You can start a new one in 1 second.");
  assert.equal(waitMessage("round_in_progress:150"), "Your last round is still running. You can start a new one in 3 minutes.");
  for (const c of ["round_in_progress", "round_in_progress:0", "round_in_progress:x", "insufficient_funds", "insufficient_funds:5"]) assert.equal(waitMessage(c), null, c);
  const fnSrc = src("web/src/lib/supabase.ts");
  assert.ok(fnSrc.includes("export const errorText = (raw: string) => waitMessage(raw) ?? errorTexts(baseCode(raw));"));
  assert.ok(fnSrc.includes('round_in_progress: "Your last round is still running. Try again in a few seconds.",'), "no more \"wait a minute\" when the wait is unknown");
  assert.ok(fnSrc.includes("if (typeof j.wait === \"number\" && j.wait > 0) code = `${code}:${Math.ceil(j.wait)}`;"));
});

test("the lobby card says what starting a new one costs", () => {
  assert.deepEqual(openRoundText({ mode: "daily", level: "medium", leftMs: 64_400 }), {
    title: "Your round is still running", line: "Daily Challenge · Medium · about 64 seconds left.", note: "Starting a new one ends it, and it still counts as today's try.",
  });
  assert.equal(openRoundText({ mode: "ghost", level: "hard", leftMs: 20_000 }).note, "Starting a new one ends it. The entry fee is not refunded.");
  assert.equal(openRoundText({ mode: "solo", level: "beginner", leftMs: 20_000 }).line, "Practice · Beginner · about 20 seconds left.");
});

test("App: checks on lobby load, resumes, closes, and warns before leaving a timed round", () => {
  const app = src("web/src/App.tsx");
  assert.ok(app.includes('callFn<{ open: OpenRound | null }>("start-round", { check: true })'));
  assert.ok(app.includes('if (!session || view !== "lobby" || !profile?.adult_confirmed) return;'));
  assert.ok(app.includes("const continueOpen = () => { replay.current = null; void begin({ resume: true }); };"));
  assert.ok(app.includes("void calls.abandon(o.roundId)"), "Start a new one: submit-round's abandon");
  assert.ok(app.includes('const timedRound = view === "play" && !!round && !round.local;'));
  assert.ok(app.includes('window.addEventListener("beforeunload", warn);') && app.includes('window.removeEventListener("beforeunload", warn);'));
  for (const f of ["web/src/newui/screens/Play.tsx", "web/src/views/Play.tsx"])
    assert.ok(src(f).includes("const t0 = useRef(performance.now() - (round.elapsedMs ?? 0) + (round.startAt ? Math.max(0, round.startAt - Date.now()) : 0));"), f);
});
