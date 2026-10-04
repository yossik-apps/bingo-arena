// Runs the real migration in an in-memory Postgres (PGlite) and checks wallet + security behaviour.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const db = new PGlite();
await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{"provider":"email"}');
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

// ===================== Phase 4 =====================
await db.exec(readFileSync(new URL("../migrations/004_phase4.sql", import.meta.url), "utf8"));
const g1 = await uid("g1@test.com", "Gus"), g2 = await uid("g2@test.com", "Gia"), g3 = await uid("g3@test.com", "Gil");
for (const u of [g1, g2, g3]) { await give(u, 100); await q("update profiles set adult_confirmed=true where id=$1", [u]); }
const mp = JSON.stringify({ total: 100, every: 3000, fee: 20, pay: 1.8, win: 3, pt: 1, pen: 8, hint: false, xm: 1, gl: 100, gr: 50 });
const mm = async (u) => (await q("select matchmake_tx($1,'medium',$2::jsonb,777) r", [u, mp]))[0].r;

// 18+ confirmation: email sign-ups with the checkbox are confirmed, social sign-ups are not
const soc = (await q("insert into auth.users(email, raw_user_meta_data, raw_app_meta_data) values ('s@test.com','{\"name\":\"Sia\"}','{\"provider\":\"google\"}') returning id"))[0].id;
assert.equal((await q("select adult_confirmed a from profiles where id=$1", [soc]))[0].a, false);
await as(soc, "select confirm_adult()");
assert.equal((await q("select adult_confirmed a, terms_at is not null t from profiles where id=$1", [soc]))[0].a, true);
const emailAdult = (await q("insert into auth.users(email, raw_user_meta_data) values ('ea@test.com','{\"adult\":\"true\"}') returning id"))[0].id;
assert.equal((await q("select adult_confirmed a from profiles where id=$1", [emailAdult]))[0].a, true);
const fake = (await q("insert into auth.users(email, raw_user_meta_data, raw_app_meta_data) values ('f@test.com','{\"adult\":\"true\"}','{\"provider\":\"facebook\"}') returning id"))[0].id;
assert.equal((await q("select adult_confirmed a from profiles where id=$1", [fake]))[0].a, false, "social users cannot self-declare via metadata");

// matchmaking: first player waits, second player is matched, fees are charged to both, third waits alone
const g1start = await bal(g1), g2start = await bal(g2);
assert.equal((await mm(g1)).status, "queued");
assert.equal((await as(g1, "select my_match() r"))[0].r.status, "queued");
const matched = await mm(g2);
assert.equal(matched.status, "ready");
assert.equal(await bal(g1), g1start - 20); assert.equal(await bal(g2), g2start - 20);
const mine = (await as(g1, "select my_match() r"))[0].r;
assert.equal(mine.status, "ready"); assert.equal(mine.opponent, "Gia"); assert.equal(mine.params.fee, 20);
assert.equal((await mm(g1)).status, "ready", "no second match while one is active");
assert.equal((await mm(g3)).status, "queued");
assert.equal((await as(g3, "select cancel_queue() r"))[0].r, true);
assert.equal((await as(g3, "select my_match() r"))[0].r.status, "none");
assert.ok((await msg(q("select matchmake_tx($1,'medium',$2::jsonb,1)", [g3, JSON.stringify({ ...JSON.parse(mp), fee: 99999 })]))).includes("insufficient_funds"));

// settle: waiting until both scored; higher score wins fee*1.8; loser gets nothing
const mid = matched.match_id;
const rounds = (await q("select user_id, round_id from match_players where match_id=$1", [mid]));
const rid = (u) => rounds.find((r) => r.user_id === u).round_id;
assert.equal((await as(g1, "select match_result($1) r", [mid]))[0].r.status, "waiting");
await q(`select finish_round($1,400,0,30,'{"win":false,"daubs":5}'::jsonb)`, [rid(g1)]);
assert.equal((await as(g1, "select match_result($1) r", [mid]))[0].r.status, "waiting");
await q(`select finish_round($1,250,0,30,'{"win":false,"daubs":5}'::jsonb)`, [rid(g2)]);
const res1 = (await as(g1, "select match_result($1) r", [mid]))[0].r, res2 = (await as(g2, "select match_result($1) r", [mid]))[0].r;
assert.equal(res1.result, "win"); assert.equal(res1.prize, 36); assert.equal(res1.opp_score, 250);
assert.equal(res2.result, "lose"); assert.equal(res2.my_score, 250);
assert.equal(await bal(g1), g1start - 20 + 36); assert.equal(await bal(g2), g2start - 20);
await as(g1, "select match_result($1)", [mid]); assert.equal(await bal(g1), g1start - 20 + 36, "settled only once");
assert.ok((await q("select 1 from user_achievements where user_id=$1 and ach_id='pvpwin'", [g1])).length === 1);
assert.equal((await q("select counters->>'pvp' p from daily_progress where user_id=$1 and day=current_date", [g1]))[0].p, "1");
assert.ok((await msg(as(g3, "select match_result($1)", [mid]))).includes("forbidden"), "outsiders cannot read a match");

// tie refunds both
await mm(g1); const t = await mm(g2);
const tr = await q("select user_id, round_id from match_players where match_id=$1", [t.match_id]);
const b1 = await bal(g1), b2 = await bal(g2);
for (const r of tr) await q(`select finish_round($1,300,0,30,'{"win":false}'::jsonb)`, [r.round_id]);
assert.equal((await as(g1, "select match_result($1) r", [t.match_id]))[0].r.result, "tie");
assert.equal(await bal(g1), b1 + 20); assert.equal(await bal(g2), b2 + 20);

// walk-away: after the grace period the player who finished wins
await mm(g1); const f = await mm(g2);
const fr = await q("select user_id, round_id from match_players where match_id=$1", [f.match_id]);
await q(`select finish_round($1,120,0,10,'{"win":false}'::jsonb)`, [fr.find((r) => r.user_id === g1).round_id]);
assert.equal((await as(g1, "select match_result($1) r", [f.match_id]))[0].r.status, "waiting", "grace period");
await q("update matches set start_at = now() - interval '5 minutes' where id=$1", [f.match_id]);
const fb = await bal(g1);
const fres = (await as(g1, "select match_result($1) r", [f.match_id]))[0].r;
assert.equal(fres.result, "forfeit_win"); assert.equal(await bal(g1), fb + 36);
assert.equal((await as(g2, "select match_result($1) r", [f.match_id]))[0].r.result, "forfeit_loss");
assert.equal((await q("select status from rounds where id=$1", [fr.find((r) => r.user_id === g2).round_id]))[0].status, "rejected");

// nobody shows up: cancelled and refunded
await mm(g1); const c2 = await mm(g2);
const cb1 = await bal(g1);
await q("update matches set start_at = now() - interval '10 minutes' where id=$1", [c2.match_id]);
assert.equal((await as(g1, "select match_result($1) r", [c2.match_id]))[0].r.result, "cancelled");
assert.equal(await bal(g1), cb1 + 20);

// weekly league
const lb = await as(g1, "select * from league_board()");
assert.ok(lb.length >= 2 && lb[0].points >= lb[1].points, "league is sorted by points");
assert.ok((await msg(as(ADM, "select admin_pay_league(week_start())"))).includes("week_not_finished"));
await q("update rounds set finished_at = finished_at - interval '8 days' where user_id in ($1,$2)", [g1, g2]);
const lastWeek = (await q("select week_start(now() - interval '7 days') w"))[0].w;
const lw = await as(ADM, "select * from league_board($1::date)", [lastWeek]);
assert.ok(lw.length >= 1);
const lg1 = await bal(lw[0].user_id);
const paid = (await as(ADM, "select admin_pay_league($1::date, array[200,100]) r", [lastWeek]))[0].r;
assert.equal(await bal(lw[0].user_id), lg1 + 200);
assert.ok((await msg(as(ADM, "select admin_pay_league($1::date)", [lastWeek]))).includes("already_paid"), "league paid once");
assert.ok((await msg(as(g1, "select admin_pay_league($1::date)", [lastWeek]))).includes("forbidden"));

// ===================== Phase 5 =====================
await db.exec(readFileSync(new URL("../migrations/005_phase5.sql", import.meta.url), "utf8"));
const jp = await uid("j@test.com", "Jay"); await q("update profiles set adult_confirmed=true where id=$1", [jp]);
assert.equal((await q("select count(*)::int c from worlds"))[0].c, 3);
assert.equal((await q("select count(*)::int c from stages"))[0].c, 24);
assert.equal((await q("select count(*)::int c from stamps"))[0].c, 27);
assert.ok((await msg(as(jp, "select seed from stages"))).includes("permission denied"), "stage seeds are secret");
assert.equal((await as(jp, "select id, s1, s2, s3 from stages where id='w1s1'"))[0].id, "w1s1");
assert.ok((await msg(as(jp, "select buy_item('bd_harbor')"))).includes("not_for_sale"), "reward items cannot be bought");

// unlocking
const unl = async (st) => (await q("select stage_unlocked($1,$2) u", [jp, st]))[0].u;
assert.equal(await unl("w1s1"), true); assert.equal(await unl("w1s2"), false); assert.equal(await unl("w2s1"), false); assert.equal(await unl("nope"), false);

// play a stage round and settle it
const stg = (await q("select * from stages where id='w1s1'"))[0];
const playStage = async (sid, score) => {
  const rid = (await q("select start_round_tx($1,'stage','beginner',0,$2,$3::jsonb) id", [jp, stg.seed, params]))[0].id;
  await q("update rounds set stage_id=$2 where id=$1", [rid, sid]);
  await q(`select finish_round($1,$2,0,20,'{"win":false,"daubs":8}'::jsonb)`, [rid, score]);
  return (await q("select settle_stage_tx($1) r", [rid]))[0].r;
};
const balBefore = await bal(jp);
const first = await playStage("w1s1", stg.s3 + 5);
assert.equal(first.stars, 3); assert.equal(first.new_stars, 3);
assert.equal(first.coins, stg.reward_coins + 20); assert.equal(first.packs.length, 2, "first clear pack + first 3-star pack");
assert.equal((await bal(jp)) - balBefore, stg.reward_coins + 20);
assert.equal(await unl("w1s2"), true, "next stage unlocks");
// the same round cannot be settled twice
const rr = (await q("select id from rounds where stage_id='w1s1' limit 1"))[0].id;
assert.equal((await q("select settle_stage_tx($1) r", [rr]))[0].r.ok, false);
// replaying gives no farm
const again = await playStage("w1s1", stg.s3 + 50);
assert.equal(again.coins, 0); assert.equal(again.packs.length, 0); assert.equal(again.new_stars, 0);
// improving stars pays 10 per new star, and a worse replay never lowers stars
const stg2 = (await q("select * from stages where id='w1s2'"))[0];
const st1 = await playStage("w1s2", stg2.s1);
assert.equal(st1.stars, 1); assert.equal(st1.packs.length, 1);
const st2 = await playStage("w1s2", stg2.s3);
assert.equal(st2.new_stars, 2); assert.equal(st2.coins, 20); assert.equal(st2.packs.length, 1, "first 3-star pack");
const st3 = await playStage("w1s2", 0);
assert.equal(st3.best_stars, 3, "stars never go down");
assert.equal((await q("select stars, attempts from user_stages where user_id=$1 and stage_id='w1s2'", [jp]))[0].attempts, 3);

// packs: epic guaranteed within 10 packs; duplicates become dust
await q("delete from user_stamps where user_id=$1", [jp]); await q("update user_collect set dust=0, packs_since_epic=0 where user_id=$1", [jp]);
let epics = 0, dustSeen = 0;
for (let i = 1; i <= 30; i++) {
  const pk = (await q("select open_pack_tx($1,1) p", [jp]))[0].p;
  if (pk.rarity === "epic") epics++; dustSeen += pk.dust;
  assert.ok((await q("select packs_since_epic s from user_collect where user_id=$1", [jp]))[0].s <= 9, "pity timer");
}
assert.ok(epics >= 3, "at least one epic per 10 packs"); assert.ok(dustSeen > 0, "duplicates give dust");
assert.equal((await q("select dust from user_collect where user_id=$1", [jp]))[0].dust, dustSeen);

// crafting
await q("delete from user_stamps where user_id=$1", [jp]); await q("update user_collect set dust=100 where user_id=$1", [jp]);
assert.ok((await msg(as(jp, "select craft_stamp('s1_9')"))).includes("not_enough_dust"), "epic costs 240");
assert.equal((await as(jp, "select craft_stamp('s1_1') r"))[0].r.dust, 70);
assert.ok((await msg(as(jp, "select craft_stamp('s1_1')"))).includes("already_owned"));

// album
assert.ok((await msg(as(jp, "select claim_album(1)"))).includes("album_incomplete"));
await q("insert into user_stamps(user_id, stamp_id) select $1, id from stamps where world=1 on conflict do nothing", [jp]);
const abal = await bal(jp);
const claim = (await as(jp, "select claim_album(1) r"))[0].r;
assert.equal(claim.coins, 200); assert.equal((await bal(jp)) - abal, 200);
assert.equal((await q("select count(*)::int c from inventory where user_id=$1 and item_id='bd_harbor'", [jp]))[0].c, 1);
assert.ok((await msg(as(jp, "select claim_album(1)"))).includes("already_claimed"));
assert.ok((await msg(as(jp, "select claim_album(2)"))).includes("album_incomplete"));
await as(jp, "select equip_item('bd_harbor')");
assert.equal((await q("select equipped->>'board' b from profiles where id=$1", [jp]))[0].b, "harbor");

// day-7 streak gives a free pack
await q("update profiles set streak=6, last_login=current_date-1 where id=$1", [jp]);
const day7 = (await q("select claim_daily($1) r", [jp]))[0].r;
assert.equal(day7.streak, 7); assert.ok(day7.pack && day7.pack.stamp_id, "streak pack");

// security + admin tuning
assert.ok((await msg(as(jp, `select open_pack_tx('${jp}',1)`))).includes("permission denied"), "players cannot open packs");
assert.ok((await msg(as(jp, "select settle_stage_tx(gen_random_uuid())"))).includes("permission denied"));
assert.ok(await fails(q("insert into user_stages(user_id,stage_id,stars) values ($1,'w3s8',3)", [jp]).then(() => as(jp, "insert into user_stages(user_id,stage_id,stars) values ($1,'w3s8',3)", [jp]))), "no self-granted stars");
assert.ok((await msg(as(jp, "select admin_save_stage('w1s1',1,2,3,10)"))).includes("forbidden"));
assert.ok((await msg(as(ADM, "select admin_save_stage('w1s1',50,40,60,10)"))).includes("invalid_stage"));
await as(ADM, "select admin_save_stage('w1s1',50,90,140,25)");
assert.deepEqual((await q("select s1,s2,s3,reward_coins from stages where id='w1s1'"))[0], { s1: 50, s2: 90, s3: 140, reward_coins: 25 });
const js = (await as(ADM, "select admin_journey_stats() r"))[0].r;
assert.equal(js.length, 24); assert.ok(js.find((x) => x.id === "w1s1").players >= 1);
console.log("DB tests passed");
