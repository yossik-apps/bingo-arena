import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { corsHeaders, parseOrigins } from "../functions/_shared/cors.ts";
import { gameIdOk } from "../functions/_shared/cg.ts";

const fn = (path: string) => readFileSync(new URL(`../functions/${path}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const LIVE = "https://bingo-arena-tan.vercel.app";

test("ALLOWED_ORIGIN unset: any origin, as before", () => {
  assert.deepEqual(parseOrigins(undefined), []);
  assert.deepEqual(parseOrigins(" , "), []);
  for (const origin of [LIVE, "https://elsewhere.example", null]) assert.equal(corsHeaders(origin, [])["Access-Control-Allow-Origin"], "*");
});

test("ALLOWED_ORIGIN is a comma-separated list; a caller gets its own origin back only when listed", () => {
  const list = parseOrigins(` ${LIVE}/ , http://localhost:5195,,`);
  assert.deepEqual(list, [LIVE, "http://localhost:5195"], "trimmed, no trailing slash, empty entries dropped");
  assert.equal(corsHeaders(LIVE, list)["Access-Control-Allow-Origin"], LIVE);
  assert.equal(corsHeaders("http://localhost:5195", list)["Access-Control-Allow-Origin"], "http://localhost:5195");
  for (const origin of ["https://elsewhere.example", "https://bingo-arena-tan.vercel.app.evil.example", "http://localhost:5196", "", null])
    assert.equal(corsHeaders(origin, list)["Access-Control-Allow-Origin"], undefined, `not for ${origin}`);
  assert.equal(corsHeaders(LIVE, list).Vary, "Origin", "caches keep the answers apart");
  assert.equal(corsHeaders(LIVE, list)["Access-Control-Allow-Methods"], "POST, OPTIONS");
  assert.equal(corsHeaders(LIVE, list)["Access-Control-Allow-Headers"], "authorization, x-client-info, apikey, content-type");
});

test("http.ts sets the caller's CORS headers on every reply, the preflight included", () => {
  const http = fn("_shared/http.ts");
  assert.ok(http.includes('const ORIGINS = parseOrigins(Deno.env.get("ALLOWED_ORIGIN"));'));
  assert.ok(http.includes('for (const [k, v] of Object.entries(corsHeaders(req.headers.get("Origin"), ORIGINS))) res.headers.set(k, v);'));
  assert.ok(http.includes('res.headers.delete("Access-Control-Allow-Origin");'), "no leftover * when a list is set");
  assert.ok(http.includes('if (req.method === "OPTIONS") return new Response("ok");'));
  assert.ok(!/Deno\.env\.get\("ALLOWED_ORIGIN"\) \?\? "\*"/.test(http), "the old single value is gone");
});

test("cg-login: with CG_GAME_ID set, a missing or different game ID is refused", () => {
  for (const unset of [undefined, null, "", "  "]) for (const got of [undefined, null, "", "123", 123]) assert.equal(gameIdOk(unset, got), true, "unset: no game check, as before");
  assert.equal(gameIdOk("12345", "12345"), true);
  assert.equal(gameIdOk("12345", 12345), true, "a number in the token");
  for (const got of [undefined, null, "", "54321", 54321, "12345 "]) assert.equal(gameIdOk("12345", got), false, `refused: ${JSON.stringify(got)}`);
  const cg = fn("cg-login/index.ts");
  assert.ok(cg.includes('if (!gameIdOk(Deno.env.get("CG_GAME_ID"), cg.gameId)) throw new HttpError(401, "cg_token_invalid");'));
  assert.ok(!cg.includes("gameId && cg.gameId &&"), "the old check that let a token without a game ID through is gone");
});
