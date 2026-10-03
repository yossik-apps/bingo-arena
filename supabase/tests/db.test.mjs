// Runs the real migration in an in-memory Postgres (PGlite) and checks wallet + security behaviour.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const db = new PGlite();
await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
`);
await db.exec(readFileSync(new URL("../migrations/001_schema.sql", import.meta.url), "utf8"));

const q = async (sql, params) => (await db.query(sql, params)).rows;
const uid = async (email, name) => (await q("insert into auth.users(email, raw_user_meta_data) values ($1, $2) returning id", [email, JSON.stringify(name ? { name } : {})]))[0].id;
const bal = async (u) => (await q("select coalesce(sum(amount),0)::int b from ledger where user_id=$1", [u]))[0].b;
const params = JSON.stringify({ total: 100, every: 3000 });
const asUser = async (u, fn) => { await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${u}',false)`); try { return await fn(); } finally { await db.exec("reset role"); } };
const fails = async (p) => { try { await p; return false; } catch { return true; } };

const a = await uid("a@test.com", "Alice"), b = await uid("b@test.com");
assert.equal((await q("select display_name from profiles where id=$1", [a]))[0].display_name, "Alice");
assert.equal((await q("select display_name from profiles where id=$1", [b]))[0].display_name, "Player");
assert.equal(await bal(a), 50, "welcome bonus");

// paid round charges once, only one active round, prize is paid once
const r1 = (await q("select start_round_tx($1,'ghost','medium',20,12345,$2::jsonb) id", [a, params]))[0].id;
assert.equal(await bal(a), 30);
assert.ok(await fails(q("select start_round_tx($1,'ghost','medium',20,1,$2::jsonb)", [a, params])), "second active round blocked");
assert.equal((await q("select finish_round($1,120,36,40,'{}'::jsonb) ok", [r1]))[0].ok, true);
assert.equal((await q("select finish_round($1,120,36,40,'{}'::jsonb) ok", [r1]))[0].ok, false, "no double payout");
assert.equal(await bal(a), 66);
assert.equal((await q("select xp from profiles where id=$1", [a]))[0].xp, 40);

// cannot overspend
assert.ok(await fails(q("select start_round_tx($1,'ghost','hard',500,1,$2::jsonb)", [a, params])), "insufficient funds");
assert.equal(await bal(a), 66);

// daily bonus once per day, streak starts at 1
const d1 = (await q("select claim_daily($1) r", [a]))[0].r;
assert.equal(d1.claimed, true); assert.equal(d1.bonus, 10);
assert.equal((await q("select claim_daily($1) r", [a]))[0].r.claimed, false);

// security: players see only their own rows and cannot write money
await asUser(a, async () => {
  assert.equal((await q("select count(*)::int c from ledger"))[0].c, 4);
  assert.equal((await q("select count(*)::int c from profiles"))[0].c, 1);
  assert.ok(await fails(q("insert into ledger(user_id,amount,reason) values ($1,1000,'hack')", [a])), "no direct ledger insert");
  assert.ok(await fails(q("update profiles set xp=99999 where id=$1", [a])), "no direct xp update");
  assert.ok(await fails(q("update profiles set role='admin' where id=$1", [a])), "no self-promotion");
  assert.ok(await fails(q("select start_round_tx($1,'solo','easy',0,1,'{}')", [a])), "cannot call server functions");
  assert.ok(await fails(q("update game_config set data='{}'")) || (await q("select data from game_config"))[0].data.g, "config protected");
});
await db.exec("update profiles set role='admin' where id='" + b + "'");
await asUser(b, async () => { assert.ok((await q("select count(*)::int c from profiles"))[0].c >= 2, "admin sees all players"); });

// ===================== Phase 2 =====================
await db.exec(readFileSync(new URL("../migrations/002_phase2.sql", import.meta.url), "utf8"));
const c = await uid("c@test.com", "Cleo");
const msg = async (p) => { try { await p; return ""; } catch (e) { return String(e.message); } };
const as = (u, sql, params) => asUser(u, () => q(sql, params));
const give = (u, n) => q("insert into ledger(user_id,amount,reason) values ($1,$2,'test')", [u, n]);

// shop
assert.equal((await q("select count(*)::int c from shop_items"))[0].c, 34);
assert.equal((await q("select array_length(daily_deals(),1) n"))[0].n, 3);
assert.ok((await msg(as(c, "select buy_item('th_ocean')"))).includes("insufficient_funds"));
const dealt = (await q("select daily_deals() d"))[0].d;
await give(c, 1000);
await q("update profiles set xp=100000 where id=$1", [c]); // deals can include level-locked items; make the test date-proof
const dealItem = (await q("select * from shop_items where id=$1", [dealt[0]]))[0];
const before = await bal(c);
const bought = (await as(c, "select buy_item($1) r", [dealt[0]]))[0].r;
assert.equal(bought.price, Math.round(dealItem.price * 0.75), "daily deal is 25% off");
assert.equal(before - (await bal(c)), bought.price);
assert.ok((await msg(as(c, "select buy_item($1)", [dealt[0]]))).includes("already_owned"));
await q("update profiles set xp=0 where id=$1", [c]);
assert.ok((await msg(as(c, "select buy_item('th_rose')"))).includes("already_owned"), "free item is already yours");
assert.ok((await msg(as(c, "select buy_item('fr_rainbow')"))).includes("level_too_low"));
assert.ok((await msg(as(c, "select buy_item('nope')"))).includes("item_not_found"));
await as(c, "select buy_item('b_slow')"); await as(c, "select buy_item('b_slow')");
assert.equal((await q("select qty from user_boosters where user_id=$1 and key='slow'", [c]))[0].qty, 2);
await as(c, "select buy_item('bundle_starter')");
assert.equal((await q("select qty from user_boosters where user_id=$1 and key='hint'", [c]))[0].qty, 2);
assert.ok((await msg(as(c, "select buy_item('bundle_starter')"))).includes("already_owned"));

// equip
await as(c, "select equip_item('bd_midnight')");
assert.equal((await q("select equipped->>'board' b from profiles where id=$1", [c]))[0].b, "midnight");
assert.ok((await msg(as(c, "select equip_item('t_eye')"))).includes("not_owned"));
await give(c, 100); await as(c, "select buy_item('t_eye')");
assert.equal((await q("select equipped->>'title' t from profiles where id=$1", [c]))[0].t, "eye");
await as(c, "select equip_item('t_eye', false)");
assert.equal((await q("select equipped->>'title' t from profiles where id=$1", [c]))[0].t, "");

// boosters consumed at round start, not allowed in other modes, no free boosters
const rb = (await q("select start_round_tx($1,'solo','beginner',0,5,$2::jsonb, array['slow','hint']) id", [c, params]))[0].id;
assert.equal((await q("select qty from user_boosters where user_id=$1 and key='slow'", [c]))[0].qty, 3);
await q("update rounds set status='rejected' where id=$1", [rb]);
assert.ok((await msg(q("select start_round_tx($1,'pvp','beginner',0,5,$2::jsonb, array['slow'])", [c, params]))).includes("boosters_not_allowed"));
await q("update user_boosters set qty=0 where user_id=$1 and key='time'", [c]);
assert.ok((await msg(q("select start_round_tx($1,'solo','beginner',0,5,$2::jsonb, array['time'])", [c, params]))).includes("no_booster"));

// finishing a round: stats, quests progress, achievements
const rf = (await q("select start_round_tx($1,'ghost','hard',0,9,$2::jsonb) id", [c, params]))[0].id;
const fin = (await q(`select finish_round($1,300,0,50,'{"win":true,"daubs":12,"wrong":0,"late":0,"lines":3,"maxMult":3}'::jsonb) r`, [rf]))[0].r;
assert.equal(fin.ok, true);
for (const k of ["first", "hard", "perfect", "lines3"]) assert.ok(fin.ach.includes(k), "achievement " + k);
assert.equal((await q("select played, wins from profiles where id=$1", [c]))[0].wins, 1);
const prog = (await q("select counters from daily_progress where user_id=$1 and day=current_date", [c]))[0].counters;
assert.equal(prog.played, 1); assert.equal(prog.combo, 1); assert.equal(prog.adv, 1); assert.equal(prog.lines, 3);

// quests: only today's, only when complete, only once
const todays = (await q("select id from todays_missions()")).map((x) => x.id);
assert.equal(todays.length, 3);
const notToday = (await q("select id from mission_defs where id <> all($1)", [todays]))[0].id;
assert.ok((await msg(as(c, "select claim_mission($1)", [notToday]))).includes("not_todays_mission"));
await q("update daily_progress set counters = '{}' where user_id=$1", [c]);
assert.ok((await msg(as(c, "select claim_mission($1)", [todays[0]]))).includes("not_complete"));
await q("update daily_progress set counters = '{\"played\":9,\"wins\":9,\"daubs\":99,\"lines\":9,\"adv\":9,\"combo\":9}' where user_id=$1", [c]);
const b4 = await bal(c);
const reward = (await as(c, "select claim_mission($1) r", [todays[0]]))[0].r.reward;
assert.equal((await bal(c)) - b4, reward);
assert.ok((await msg(as(c, "select claim_mission($1)", [todays[0]]))).includes("already_claimed"));

// security for phase 2
await asUser(c, async () => {
  assert.ok(await fails(q("insert into inventory(user_id,item_id) values ($1,'th_gold')", [c])), "no free items");
  assert.ok(await fails(q("update user_boosters set qty=99 where user_id=$1", [c])), "no free boosters");
  assert.ok(await fails(q("update shop_items set price=0")), "no price edits");
  assert.ok(await fails(q("select finish_round($1,1,1000,1,'{}')", [rf])), "no self-scoring");
  assert.ok(await fails(q("update profiles set equipped='{}' where id=$1", [c])), "no direct equip");
  assert.equal((await q("select count(*)::int c from inventory"))[0].c >= 1, true);
  assert.equal((await q("select count(*)::int c from inventory where user_id <> $1", [c]))[0].c, 0, "only own inventory visible");
});

// ===================== Phase 3 =====================
await db.exec(readFileSync(new URL("../migrations/003_phase3.sql", import.meta.url), "utf8"));
assert.equal((await q("select data->'levels'->'beginner'->>'hint' h from game_config"))[0].h, "false", "Beginner has no highlight");
const ADM = b; // promoted to admin earlier
const d = await uid("d@test.com", "Dan"), e2 = await uid("e@test.com", "Eve");
await give(d, 200); await give(e2, 200);

// non-admins are locked out of every admin function
for (const sql of ["select admin_overview()", "select admin_players('',10,0)", `select admin_adjust_coins('${d}',10,'x1')`, `select admin_set_banned('${d}',true)`,
                   "select admin_events()", "select admin_save_item('b_hint','Hint',null,1,0,true)"]) {
  assert.ok((await msg(as(d, sql))).includes("forbidden"), "forbidden: " + sql);
}
// admin analytics, players, coins, suspend
const ov = (await as(ADM, "select admin_overview() o"))[0].o;
assert.ok(ov.players >= 5 && Array.isArray(ov.by_mode) && ov.signups.length === 14);
const pl = (await as(ADM, "select admin_players('Dan',10,0) r"))[0].r;
assert.equal(pl.total, 1); assert.equal(pl.rows[0].email, "d@test.com");
const dd = (await as(ADM, "select admin_player_detail($1) r", [d]))[0].r;
assert.equal(dd.profile.balance, await bal(d));
const bd = await bal(d);
assert.equal((await as(ADM, "select admin_adjust_coins($1,25,'Welcome gift') n", [d]))[0].n, bd + 25);
assert.ok((await msg(as(ADM, "select admin_adjust_coins($1,-99999,'too much')", [d]))).includes("insufficient_funds"));
assert.ok((await msg(as(ADM, "select admin_adjust_coins($1,5,'')", [d]))).includes("invalid_reason"));
assert.ok((await msg(as(ADM, "select admin_set_banned($1,true)", [ADM]))).includes("cannot_ban_self"));
await as(ADM, "select admin_set_banned($1,true)", [d]);
assert.equal((await q("select banned from profiles where id=$1", [d]))[0].banned, true);
await as(ADM, "select admin_set_banned($1,false)", [d]);

// config validation
const cfg = (await q("select data from game_config"))[0].data;
await as(ADM, "select admin_save_config($1::jsonb)", [JSON.stringify({ ...cfg, g: { ...cfg.g, note: "Hello" } })]);
assert.equal((await q("select data->'g'->>'note' n from game_config"))[0].n, "Hello");
const bad = JSON.parse(JSON.stringify(cfg)); bad.levels.hard.pen = 9999;
assert.ok((await msg(as(ADM, "select admin_save_config($1::jsonb)", [JSON.stringify(bad)]))).includes("invalid_config"));
assert.ok((await msg(as(ADM, "select admin_save_config($1::jsonb)", [JSON.stringify({ g: cfg.g })]))).includes("invalid_config"));
// catalog
await as(ADM, "select admin_save_item('b_hint','Hint glow','Lights up matches',99,0,true)");
assert.equal((await q("select price from shop_items where id='b_hint'"))[0].price, 99);
assert.ok((await msg(as(ADM, "select admin_save_item('b_hint','Hint glow','x',-5,0,true)"))).includes("invalid_item"));
await as(ADM, "select admin_save_mission('play3','Play 3 rounds',4,25,true)");

// events: create, go live, attempts, closed window, leaderboard, finalize and pay
const evId = (await as(ADM, `select admin_save_event(null,'Cup','Test cup','medium',20,1, now() - interval '1 hour', now() + interval '1 hour', 100, array[50,30]) id`))[0].id;
assert.ok((await msg(q(`select start_round_tx($1,'tour','medium',20,1,$2::jsonb,'{}',$3)`, [d, params, evId]))).includes("event_closed"), "draft event is closed");
await as(ADM, "select admin_set_event_status($1,'live')", [evId]);
const rd = (await q(`select start_round_tx($1,'tour','medium',20,1,$2::jsonb,'{}',$3) id`, [d, params, evId]))[0].id;
await q(`select finish_round($1,500,0,10,'{"win":false,"daubs":5}'::jsonb)`, [rd]);
assert.ok((await msg(q(`select start_round_tx($1,'tour','medium',20,1,$2::jsonb,'{}',$3)`, [d, params, evId]))).includes("no_attempts"), "attempt limit");
const re = (await q(`select start_round_tx($1,'tour','medium',20,2,$2::jsonb,'{}',$3) id`, [e2, params, evId]))[0].id;
await q(`select finish_round($1,300,0,10,'{"win":false,"daubs":3}'::jsonb)`, [re]);
const board = await as(d, "select * from event_leaderboard($1)", [evId]);
assert.deepEqual(board.map((r) => [r.display_name, r.best, r.rank]), [["Dan", 500, 1], ["Eve", 300, 2]]);
assert.ok((await msg(as(ADM, `select admin_save_event($1,'Cup','x','hard',20,1, now() - interval '1 hour', now() + interval '1 hour', 100, array[50,30])`, [evId]))).includes("event_has_entries"));
assert.ok((await msg(as(ADM, "select admin_delete_event($1)", [evId]))).includes("event_has_entries"));
const dBefore = await bal(d), eBefore = await bal(e2);
const fin2 = (await as(ADM, "select admin_finalize_event($1) r", [evId]))[0].r;
assert.equal(fin2.pool, 100 + Math.floor(2 * 20 * 0.9)); // bonus + entries minus 10% rake
assert.equal((await bal(d)) - dBefore, Math.floor(fin2.pool * 0.5));
assert.equal((await bal(e2)) - eBefore, Math.floor(fin2.pool * 0.3));
assert.ok((await msg(as(ADM, "select admin_finalize_event($1)", [evId]))).includes("already_finalized"), "no double payout");
assert.equal((await q("select count(*)::int c from audit_log"))[0].c >= 8, true, "admin actions are logged");

// players cannot see draft events or touch events
const draft = (await as(ADM, `select admin_save_event(null,'Secret','x','hard',5,1, now(), now() + interval '1 day', 0, array[100]) id`))[0].id;
await asUser(d, async () => {
  assert.equal((await q("select count(*)::int c from events where id=$1", [draft]))[0].c, 0, "drafts hidden");
  assert.ok(await fails(q("update events set bonus=999999")), "no event edits");
  assert.ok(await fails(q("select * from audit_log limit 1")) || (await q("select count(*)::int c from audit_log"))[0].c === 0, "audit log hidden");
});
console.log("DB tests passed");
