// Runs the real migration in an in-memory Postgres (PGlite) and checks wallet + security behaviour.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const db = new PGlite();
await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{"provider":"email"}', created_at timestamptz default now());
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
const TT = dealt[0] === "t_eye" ? "t_line" : "t_eye", TK = TT === "t_eye" ? "eye" : "line"; // date-proof: today's deal may already be the title
assert.ok((await msg(as(c, `select equip_item('${TT}')`))).includes("not_owned"));
await give(c, 100); await as(c, `select buy_item('${TT}')`);
assert.equal((await q("select equipped->>'title' t from profiles where id=$1", [c]))[0].t, TK);
await as(c, `select equip_item('${TT}', false)`);
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
const lastWeek = (await q("select week_start(now() - interval '7 days') w"))[0].w;
await q("update rounds set finished_at = ($3::date + interval '2 days')::timestamp at time zone 'utc' where user_id in ($1,$2) and status = 'scored'", [g1, g2, lastWeek]); // date-proof: land inside last week
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

// ===================== Phase 6 =====================
await db.exec(readFileSync(new URL("../migrations/006_phase6.sql", import.meta.url), "utf8"));
const six = await uid("six@test.com", "Sixy"); await q("update profiles set adult_confirmed=true where id=$1", [six]);

// BUG FIX: an admin's normal queries return ONLY their own rows (the wallet used to show 0 once a second player existed)
await asUser(ADM, async () => {
  assert.equal((await q("select count(*)::int c from profiles"))[0].c, 1, "admin sees only own profile");
  assert.equal((await q("select count(*)::int c from wallet"))[0].c, 1, "admin wallet is one row");
  assert.equal((await q("select count(*)::int c from ledger where user_id <> $1", [ADM]))[0].c, 0);
  assert.equal((await q("select count(*)::int c from rounds where user_id <> $1", [ADM]))[0].c, 0);
  assert.equal((await q("select count(*)::int c from inventory where user_id <> $1", [ADM]))[0].c, 0);
});
// ...while the admin functions still see everyone
assert.ok((await as(ADM, "select admin_players('',100,0) r"))[0].r.total >= 8);
const au = (await as(ADM, "select admin_audit(50) r"))[0].r;
assert.ok(au.length >= 5 && au.some((x) => x.actor === "b" || x.actor === "Player" || x.actor), "audit shows who did what");
assert.ok((await msg(as(six, "select admin_audit(5)"))).includes("forbidden"));
const health = (await as(ADM, "select admin_health() r"))[0].r;
assert.ok(health.length > 30 && health.every((h) => h.ok), "health: " + JSON.stringify(health.filter((h) => !h.ok)));
assert.ok((await msg(as(six, "select admin_health()"))).includes("forbidden"));

// admin coin tools keep working end to end
const sixBal = await bal(six);
assert.equal((await as(ADM, "select admin_adjust_coins($1,40,'Test gift') n", [six]))[0].n, sixBal + 40);
assert.equal((await as(six, "select balance from wallet"))[0].balance, sixBal + 40, "the player sees the coins in their wallet");

// Daily Challenge: one try a day, tiers, shield every 5th
await q("select ensure_daily_tx(current_date,'medium',4242,'{}'::jsonb,50,100,150)");
await q("select ensure_daily_tx(current_date,'hard',1,'{}'::jsonb,1,2,3)");
assert.equal((await q("select level, g3 from daily_boards where day=current_date"))[0].level, "medium", "first board of the day wins");
assert.ok((await msg(as(six, "select seed from daily_boards"))).includes("permission denied"), "daily seed is secret");
const dparams = JSON.stringify({ total: 100, every: 3000, win: 3, pt: 1, pen: 8, hint: false, xm: 1, fee: 0, pay: 1.8 });
const playDaily = async (u, score, day = "current_date") => {
  const rid = (await q("select start_round_tx($1,'daily','medium',0,4242,$2::jsonb) id", [u, dparams]))[0].id;
  await q(`update rounds set daily_day=${day} where id=$1`, [rid]);
  await q(`select finish_round($1,$2,0,20,'{"win":false}'::jsonb)`, [rid, score]);
  return (await q("select settle_daily_tx($1) r", [rid]))[0].r;
};
const dBal = await bal(six);
const d1r = await playDaily(six, 160);
assert.equal(d1r.tier, 3); assert.equal(d1r.coins, 40); assert.ok(d1r.pack, "gold gives a stamp pack"); assert.equal(d1r.rank, 1);
assert.equal((await bal(six)) - dBal, 40);
const stray = (await q("select start_round_tx($1,'daily','medium',0,4242,$2::jsonb) id", [six, dparams]))[0].id;
assert.ok(await fails(q("update rounds set daily_day=current_date where id=$1", [stray])), "only one daily try");
await q("update rounds set status='rejected' where id=$1", [stray]);
const rid2 = (await q("select id from rounds where user_id=$1 and daily_day=current_date", [six]))[0].id;
assert.equal((await q("select settle_daily_tx($1) r", [rid2]))[0].r.ok, false, "daily settles once");
assert.equal((await as(six, "select * from daily_leaderboard()"))[0].display_name, "Sixy");
for (let i = 2; i <= 5; i++) {
  await q("select ensure_daily_tx(current_date - $1::int,'medium',7,'{}'::jsonb,50,100,150)", [20 + i]);
  const r = await playDaily(six, 60, `current_date - ${20 + i}`);
  if (i === 5) assert.equal(r.shield_earned, true, "5th challenge earns a Streak Shield");
}
assert.equal((await q("select shields, daily_done from profiles where id=$1", [six]))[0].shields, 1);

// Streak shield saves a login streak that missed exactly one day; without it the streak resets
await q("update profiles set streak=10, last_login=current_date-2, shields=1 where id=$1", [six]);
const sh = (await q("select claim_daily($1) r", [six]))[0].r;
assert.equal(sh.streak, 11); assert.equal(sh.shield_used, true);
assert.equal((await q("select shields from profiles where id=$1", [six]))[0].shields, 0);
await q("update profiles set streak=10, last_login=current_date-2, shields=0 where id=$1", [six]);
assert.equal((await q("select claim_daily($1) r", [six]))[0].r.streak, 1, "no shield: streak resets");
await q("update profiles set streak=10, last_login=current_date-3, shields=1 where id=$1", [six]);
assert.equal((await q("select claim_daily($1) r", [six]))[0].r.streak, 1, "a shield covers only one missed day");

// Beat my run
const crid = (await q("select start_round_tx($1,'solo','medium',0,555,$2::jsonb) id", [g3, dparams]))[0].id;
await q(`select finish_round($1,200,2,20,'{"win":true}'::jsonb)`, [crid]);
const code = (await q("select create_challenge_tx($1,$2) c", [g3, crid]))[0].c;
assert.equal(code.length, 8);
assert.equal((await q("select create_challenge_tx($1,$2) c", [g3, crid]))[0].c, code, "same round, same link");
const info = (await as(six, "select get_challenge($1) r", [code]))[0].r;
assert.equal(info.creator, "Gil"); assert.equal(info.score, 200); assert.equal(info.mine, false); assert.equal(info.played, false);
assert.equal((await as(g3, "select get_challenge($1) r", [code]))[0].r.mine, true);
assert.ok((await msg(as(six, "select get_challenge('nope')"))).includes("challenge_not_found"));
const bcrid = (await q("select start_round_tx($1,'solo','medium',0,556,$2::jsonb,array[]::text[]) id", [g1, JSON.stringify({ ...JSON.parse(dparams), boosters: ["slow"] })]))[0].id;
await q(`select finish_round($1,100,2,20,'{}'::jsonb)`, [bcrid]);
assert.ok((await msg(q("select create_challenge_tx($1,$2)", [g1, bcrid]))).includes("boosted_round"), "boosted rounds cannot be challenges");
const dr = (await q("select start_round_tx($1,'duel','medium',0,555,$2::jsonb) id", [six, dparams]))[0].id;
await q("update rounds set challenge_code=$2 where id=$1", [dr, code]);
await q(`select finish_round($1,260,0,10,'{"win":false}'::jsonb)`, [dr]);
const duel = (await q("select settle_duel_tx($1) r", [dr]))[0].r;
assert.equal(duel.win, true); assert.equal(duel.creator_score, 200);
assert.equal((await q("select settle_duel_tx($1) r", [dr]))[0].r.ok, false, "duel settles once");
assert.equal((await as(six, "select get_challenge($1) r", [code]))[0].r.played, true);
assert.equal((await q("select plays from challenges where code=$1", [code]))[0].plays, 1);

// Mastery
assert.equal((await q("select count(*)::int c from mastery_tiers"))[0].c, 15);
const ms = (await as(g3, "select mastery() r"))[0].r;
const med = ms.find((x) => x.level === "medium");
assert.equal(med.best, 200); assert.equal(med.name, "Gold"); assert.ok(med.next_name === "Platinum" && med.next_min > 200);
assert.equal(ms.find((x) => x.level === "hard").name, "Bronze");

// new email sign-ups record the terms version they accepted
const tv = (await q("insert into auth.users(email, raw_user_meta_data) values ('tv@test.com','{\"adult\":\"true\",\"terms_version\":\"2026-10\"}') returning id"))[0].id;
assert.equal((await q("select terms_version v, adult_confirmed a from profiles where id=$1", [tv]))[0].v, "2026-10");
// Privacy tools
await as(six, "select accept_terms('2026-10')");
assert.equal((await q("select terms_version v from profiles where id=$1", [six]))[0].v, "2026-10");
assert.ok((await msg(as(six, "select accept_terms('')"))).includes("invalid_version"));
const exp = (await as(six, "select export_my_data() r"))[0].r;
assert.equal(exp.account.email, "six@test.com"); assert.ok(exp.wallet_history.length >= 3 && exp.rounds.length >= 3);
assert.ok(!JSON.stringify(exp).includes("g3@test.com"), "export only contains my own data");
// deleting a user removes their personal rows
await q("delete from auth.users where id=$1", [six]);
assert.equal((await q("select count(*)::int c from profiles where id=$1", [six]))[0].c, 0);
assert.equal((await q("select count(*)::int c from ledger where user_id=$1", [six]))[0].c, 0);

// ===================== Guide progress (007) =====================
await db.exec(readFileSync(new URL("../migrations/007_guide.sql", import.meta.url), "utf8"));
const gp = await uid("guide@test.com", "Gigi");
assert.equal((await q("select guide_seen g from profiles where id=$1", [gp]))[0].g, 0, "new players have not seen the guide");
await as(gp, "select set_guide_seen(3)");
assert.equal((await q("select guide_seen g from profiles where id=$1", [gp]))[0].g, 3);
await as(gp, "select set_guide_seen(2)");
assert.equal((await q("select guide_seen g from profiles where id=$1", [gp]))[0].g, 3, "progress never goes backwards");
assert.ok((await msg(as(gp, "select set_guide_seen(-1)"))).includes("invalid_version"));
assert.ok(await fails(q("update profiles set guide_seen=99 where id=$1", [gp]).then(() => as(gp, "update profiles set guide_seen=99 where id=$1", [gp]))), "players cannot write the column directly");
const hl = (await as(ADM, "select admin_health() r"))[0].r;
assert.ok(hl.some((h) => h.name === "set_guide_seen" && h.ok) && hl.every((h) => h.ok), "health includes the guide function");

// ===================== Phase 7 =====================
await db.exec(readFileSync(new URL("../migrations/008_phase7.sql", import.meta.url), "utf8"));
const mkUser = async (email, name) => { const id = await uid(email, name); await q("update profiles set adult_confirmed=true where id=$1", [id]); return id; };
const mkRound = (u, xp, when = "now()") => q(`insert into rounds(user_id,mode,level,seed,params,status,finished_at,score,xp_gain,result) values ($1,'solo','medium',1,'{"total":100}','scored',${when},100,$2,'{}')`, [u, xp]);

// ---- live ops
for (const sql of ["select admin_liveops()", "select admin_delete_liveop(gen_random_uuid())"]) assert.ok((await msg(as(gp, sql))).includes("forbidden"));
const loId = (await as(ADM, "select admin_save_liveop(null,'xp_boost','Lucky Hour','Double XP', now() - interval '5 minutes', now() + interval '1 hour', 2, 0, true) id"))[0].id;
await as(ADM, "select admin_save_liveop(null,'banner','Tomorrow','Soon', now() + interval '1 day', now() + interval '2 days', 1, 0, true)");
const hidden = (await as(ADM, "select admin_save_liveop(null,'coin_boost','Hidden','x', now(), now() + interval '1 hour', 1.5, 0, false) id"))[0].id;
assert.ok((await msg(as(ADM, "select admin_save_liveop(null,'xp_boost','Bad','x', now(), now() + interval '1 hour', 9, 0, true)"))).includes("invalid_liveop"));
assert.ok((await msg(as(ADM, "select admin_save_liveop(null,'fee_discount','Bad','x', now(), now() + interval '1 hour', 1, 99, true)"))).includes("invalid_liveop"));
assert.ok((await msg(as(ADM, "select admin_save_liveop(null,'banner','Bad','x', now(), now() + interval '40 days', 1, 0, true)"))).includes("invalid_liveop"));
const seen = await as(gp, "select title from liveops order by title");
assert.deepEqual(seen.map((x) => x.title), ["Lucky Hour", "Tomorrow"], "players see active events only");
assert.equal((await as(ADM, "select admin_liveops() r"))[0].r.length, 3, "admin sees all");
assert.ok(await fails(q("update liveops set mult=5", [])  .then(() => as(gp, "update liveops set mult=5"))), "players cannot edit events");
await as(ADM, "select admin_delete_liveop($1)", [hidden]);

// ---- crews
const [cA, cB, cC, cD] = [await mkUser("ca@t.com", "Ana"), await mkUser("cb@t.com", "Ben"), await mkUser("cc@t.com", "Cat"), await mkUser("cd@t.com", "Dov")];
assert.ok((await msg(as(cA, "select create_crew('x','TAG','',true)"))).includes("invalid_crew_name"));
assert.ok((await msg(as(cA, "select create_crew('Bad<>Name','TAG','',true)"))).includes("invalid_crew_name"));
assert.ok((await msg(as(cA, "select create_crew('Neon Foxes','TOOLONG','',true)"))).includes("invalid_crew_name"));
const crew = (await as(cA, "select create_crew('Neon Foxes','fox','We play daily',true) id"))[0].id;
assert.ok((await msg(as(cB, "select create_crew('neon foxes','FX','',true)"))).includes("crew_name_taken"), "names are unique ignoring case");
assert.ok((await msg(as(cA, "select create_crew('Other Crew','OC','',true)"))).includes("already_in_crew"));
await as(cB, "select join_crew($1)", [crew]);
assert.ok((await msg(as(cB, "select join_crew($1)", [crew]))).includes("already_in_crew"));
await as(cA, "select update_crew('Closed now', false)");
assert.ok((await msg(as(cC, "select join_crew($1)", [crew]))).includes("crew_not_found"), "closed crews need the code");
const code7 = (await as(cA, "select crew_info() r"))[0].r.invite_code;
await as(cC, "select join_crew(null, $1)", [code7]);
assert.ok((await msg(as(cB, "select update_crew('hack', true)"))).includes("not_crew_leader"));
assert.ok((await msg(as(cB, `select kick_crew_member('${cC}')`))).includes("not_crew_leader"));
assert.ok((await msg(as(cA, `select kick_crew_member('${cA}')`))).includes("cannot_kick_self"));
// crew players cannot read tables directly
assert.ok((await msg(as(cA, "select * from crew_members"))).includes("permission denied"));
assert.ok((await msg(as(cA, "select * from crews"))).includes("permission denied"));

// weekly XP only counts after joining; goal, chest tiers, one claim each
await q("update crew_members set joined_at = now() - interval '30 days'");
await mkRound(cA, 100); await mkRound(cB, 80); await mkRound(cC, 40);
await mkRound(cC, 500, "now() - interval '40 days'"); // old XP never counts
let ci = (await as(cA, "select crew_info() r"))[0].r;
assert.equal(ci.week_points, 220); assert.equal(ci.size, 3); assert.equal(ci.goal, 450); assert.equal(ci.tier1, 270); assert.equal(ci.my_points, 100); assert.equal(ci.is_leader, true);
assert.deepEqual(ci.members.map((m) => m.name), ["Ana", "Ben", "Cat"], "members ranked by weekly points");
assert.ok((await msg(as(cA, "select claim_crew_chest(1)"))).includes("goal_not_reached"));
await mkRound(cA, 60); // 280 >= 270
assert.equal(await msg(as(cC, "select claim_crew_chest(1)")), "", "Cat has exactly 40 XP of her own, so she can claim");
const bA = await bal(cA);
assert.equal((await as(cA, "select claim_crew_chest(1) r"))[0].r.coins, 30); assert.equal((await bal(cA)) - bA, 30);
assert.ok((await msg(as(cA, "select claim_crew_chest(1)"))).includes("already_claimed"));
assert.ok((await msg(as(cA, "select claim_crew_chest(2)"))).includes("goal_not_reached"));
await mkRound(cB, 200); // 480 >= 450
const t2 = (await as(cA, "select claim_crew_chest(2) r"))[0].r;
assert.equal(t2.coins, 60); assert.ok(t2.pack && t2.pack.stamp_id, "gold chest gives a stamp pack");
assert.ok((await msg(as(cA, "select claim_crew_chest(3)"))).includes("invalid_tier"));
// someone with too little of their own XP cannot claim; small crews cannot claim
await q("delete from crew_claims");
await q("update rounds set xp_gain = 5 where user_id=$1 and finished_at > now() - interval '1 day'", [cC]);
assert.ok((await msg(as(cC, "select claim_crew_chest(1)"))).includes("contribute_more"));
// XP earned before joining does not count for a late joiner
await as(cD, "select join_crew(null, $1)", [code7]);
await mkRound(cD, 900, "now() - interval '2 hours'"); // joined just now, so this does not count
assert.equal((await as(cD, "select crew_info() r"))[0].r.my_points, 0);
// search and board
await as(cA, "select update_crew('Open again', true)");
const found = (await as(cB, "select search_crews('fox') r"))[0].r;
assert.equal(found.length, 1, "open crews with room are listed"); assert.equal(found[0].name, "Neon Foxes");
assert.ok((await as(cB, "select * from crew_board()")).some((r) => r.name === "Neon Foxes" && r.points > 0));
// leave, leader transfer, last member deletes the crew
await as(cA, "select leave_crew()");
assert.equal((await q("select role from crew_members where user_id=$1", [cB]))[0].role, "leader", "oldest member becomes leader");
await as(cB, `select kick_crew_member('${cC}')`);
await as(cB, "select leave_crew()"); await as(cD, "select leave_crew()");
assert.equal((await q("select count(*)::int c from crews"))[0].c, 0, "an empty crew is removed");
// crew is full at 20
const big = (await as(cA, "select create_crew('Big Crew','BIG','',true) id"))[0].id;
for (let i = 0; i < 19; i++) await q("insert into crew_members(crew_id,user_id) values ($1,$2)", [big, await mkUser(`bigm${i}@t.com`, "Member" + i)]);
assert.ok((await msg(as(cB, "select join_crew($1)", [big]))).includes("crew_full"));
// admin tools
assert.ok((await msg(as(cA, "select admin_crews()"))).includes("forbidden"));
assert.equal((await as(ADM, "select admin_crews() r"))[0].r.length, 1);
await as(ADM, "select admin_rename_crew($1,'Renamed Crew')", [big]);
assert.ok((await msg(as(ADM, "select admin_rename_crew($1,'x')", [big]))).includes("invalid_crew_name"));
// weekly crew prizes
const lastWk = (await q("select week_start(now() - interval '7 days') w"))[0].w;
await q("update crew_members set joined_at = now() - interval '60 days'");
const members = await q("select user_id from crew_members where crew_id=$1 limit 3", [big]);
for (const m of members) await mkRound(m.user_id, 50, "(week_start(now() - interval '7 days') + interval '2 days')::timestamp at time zone 'utc'");
assert.ok((await msg(as(ADM, "select admin_pay_crews(week_start())"))).includes("week_not_finished"));
const cb0 = await bal(members[0].user_id);
const pay = (await as(ADM, "select admin_pay_crews($1::date, array[100,50]) r", [lastWk]))[0].r;
assert.equal(pay.winners[0].crew, "Renamed Crew"); assert.equal(pay.winners[0].members_paid, 3);
assert.equal((await bal(members[0].user_id)) - cb0, 100);
assert.ok((await msg(as(ADM, "select admin_pay_crews($1::date)", [lastWk]))).includes("already_paid"));
await as(ADM, "select admin_delete_crew($1)", [big]);
assert.equal((await q("select count(*)::int c from crew_members"))[0].c, 0);

// ---- season track
const sp = await mkUser("season@t.com", "Seasoner"); await q("delete from ledger where user_id=$1", [sp]); await give(sp, 1000);
let si = (await as(sp, "select season_info() r"))[0].r;
assert.equal(si.active, true); assert.equal(si.name, "Neon Nights"); assert.equal(si.tier, 0); assert.equal(si.tiers.length, 30); assert.equal(si.pass, false);
assert.ok((await msg(as(sp, "select claim_season_tier(1,'free')"))).includes("tier_not_reached"));
await mkRound(sp, 450); // 450 / 200 = tier 2
assert.equal((await as(sp, "select season_info() r"))[0].r.tier, 2);
const sb = await bal(sp);
await as(sp, "select claim_season_tier(1,'free')"); await as(sp, "select claim_season_tier(2,'free')");
assert.equal((await bal(sp)) - sb, 23 + 26, "free coins for tiers 1 and 2");
assert.ok((await msg(as(sp, "select claim_season_tier(2,'free')"))).includes("already_claimed"));
assert.ok((await msg(as(sp, "select claim_season_tier(3,'free')"))).includes("tier_not_reached"));
assert.ok((await msg(as(sp, "select claim_season_tier(1,'premium')"))).includes("pass_required"));
const pb = await bal(sp);
assert.equal((await as(sp, "select buy_season_pass() r"))[0].r.price, 600); assert.equal(pb - (await bal(sp)), 600);
assert.ok((await msg(as(sp, "select buy_season_pass()"))).includes("already_owned"));
await as(sp, "select claim_season_tier(1,'premium')");
assert.equal((await bal(sp)) - (pb - 600), 45, "premium tier 1 coins");
await mkRound(sp, 1000); // 1450 -> tier 7
await as(sp, "select claim_season_tier(3,'premium')");
assert.equal((await q("select count(*)::int c from inventory where user_id=$1 and item_id='ball_nightpulse'", [sp]))[0].c, 1, "exclusive item granted");
await mkRound(sp, 600); // 2050 -> tier 10
const t5 = (await as(sp, "select claim_season_tier(5,'free') r"))[0].r;
assert.equal(t5.packs.length, 1, "free tier 5 is a stamp pack");
await as(sp, "select claim_season_tier(10,'free')");
assert.equal((await q("select qty from user_boosters where user_id=$1 and key='time'", [sp]))[0].qty >= 2, true, "booster reward");
assert.ok((await msg(as(sp, "select buy_item('t_nightowl')"))).includes("not_for_sale"), "season rewards cannot be bought");
// the pass is too expensive for someone without coins
const poor = await mkUser("poor@t.com", "Poor"); await q("delete from ledger where user_id=$1", [poor]);
assert.ok((await msg(as(poor, "select buy_season_pass()"))).includes("insufficient_funds"));
// players cannot touch the track
assert.ok(await fails(q("insert into season_claims(user_id,season_id,tier,track) values ($1,1,30,'free')", [poor]).then(() => as(poor, "insert into season_claims(user_id,season_id,tier,track) values ($1,1,30,'free')", [poor]))));
assert.ok((await msg(as(poor, "select admin_save_tier(1,1,'{\"coins\":5000}','{\"coins\":5000}')"))).includes("forbidden"));
// admin editing
assert.ok((await msg(as(ADM, "select admin_save_tier(1,1,'{\"coins\":99999}','{\"coins\":5}')"))).includes("invalid_reward"));
assert.ok((await msg(as(ADM, "select admin_save_tier(1,1,'{\"item\":\"nope\"}','{\"coins\":5}')"))).includes("invalid_reward"));
assert.ok((await msg(as(ADM, "select admin_save_tier(1,1,'{\"coins\":5,\"pack\":1}','{\"coins\":5}')"))).includes("invalid_reward"), "one reward per slot");
await as(ADM, "select admin_save_tier(1,1,'{\"coins\":77}','{\"booster\":{\"key\":\"hint\",\"qty\":3}}')");
assert.equal((await as(ADM, "select admin_season_tiers(1) r"))[0].r[0].free_reward.coins, 77);
assert.ok((await msg(as(ADM, "select admin_save_season(null,'Overlap','x', now(), now() + interval '10 days', 200, 600)"))).includes("season_overlap"));
const s2 = (await as(ADM, "select admin_save_season(null,'Spring Rush','Next one', date_trunc('day', now()) + interval '50 days', date_trunc('day', now()) + interval '92 days', 250, 500) id"))[0].id;
assert.equal(s2, 2); assert.equal((await q("select count(*)::int c from season_tiers where season_id=2"))[0].c, 30, "a new season copies the last tiers");
assert.equal((await as(ADM, "select admin_seasons() r"))[0].r.length, 2);
// grace period: claim for 3 days after the season ends, then it is closed
await q("update seasons set starts_at = now() - interval '50 days', ends_at = now() - interval '2 days' where id=1");
assert.equal((await as(sp, "select season_info() r"))[0].r.over, true);
assert.ok((await msg(as(poor, "select buy_season_pass()"))).includes("no_season"), "the pass cannot be bought after the season ends");
await q("update seasons set ends_at = now() - interval '4 days' where id=1");
assert.equal((await as(sp, "select season_info() r"))[0].r.active, false);
assert.ok((await as(sp, "select season_info() r"))[0].r.next.name === "Spring Rush");

// ---- health knows about Phase 7
const h8 = (await as(ADM, "select admin_health() r"))[0].r;
assert.ok(h8.some((h) => h.name === "claim_crew_chest" && h.ok) && h8.some((h) => h.name === "liveops" && h.ok) && h8.every((h) => h.ok), JSON.stringify(h8.filter((h) => !h.ok)));

// ===================== Inbox, support and welcome waves (009) =====================
await db.exec(readFileSync(new URL("../migrations/009_inbox.sql", import.meta.url), "utf8"));
const [iA, iB, iC] = [await mkUser("ia@t.com", "Ivy"), await mkUser("ib@t.com", "Ian"), await mkUser("ic@t.com", "Ima")];

// contact us: validation, rate limit, flags
assert.ok((await msg(as(iA, "select contact_support('x','hello there friend')"))).includes("invalid_subject"));
assert.ok((await msg(as(iA, "select contact_support('Question','hi')"))).includes("invalid_message"));
const th = (await as(iA, "select contact_support('My coins','I think a prize is missing') id"))[0].id;
let row = (await q("select status, admin_unread, user_unread from support_threads where id=$1", [th]))[0];
assert.deepEqual(row, { status: "open", admin_unread: true, user_unread: false });
for (let i = 0; i < 4; i++) await as(iA, "select contact_support('More','another question here')");
assert.ok((await msg(as(iA, "select contact_support('Too many','sixth message today')"))).includes("too_many_messages"), "5 new conversations a day");
// privacy: other players cannot read or reply, and cannot read the tables
assert.ok((await msg(as(iB, "select thread_messages($1)", [th]))).includes("thread_not_found"));
assert.ok((await msg(as(iB, "select reply_support($1,'hi')", [th]))).includes("thread_not_found"));
assert.equal((await as(iB, "select my_threads() r"))[0].r.length, 0);
assert.ok((await msg(as(iA, "select * from support_messages"))).includes("permission denied"));
assert.ok((await msg(as(iA, "select * from notifications"))).includes("permission denied"));
// admin sees it, with the unread flag, then answers
assert.ok((await msg(as(iA, "select admin_threads()"))).includes("forbidden"));
const adminList = (await as(ADM, "select admin_threads() r"))[0].r;
const mineT = adminList.find((x) => x.id === th);
assert.equal(mineT.admin_unread, true); assert.equal(mineT.player, "Ivy"); assert.equal(mineT.email, "ia@t.com");
assert.ok((await as(ADM, "select inbox_summary() r"))[0].r.admin_unread >= 5);
const tview = (await as(ADM, "select admin_thread_messages($1) r", [th]))[0].r;
assert.equal(tview.messages.length, 1); assert.equal(tview.player.name, "Ivy");
assert.equal((await q("select admin_unread a from support_threads where id=$1", [th]))[0].a, false, "opening it marks it read for the admin");
assert.ok((await msg(as(ADM, "select admin_reply($1,'')", [th]))).includes("invalid_message"));
await as(ADM, "select admin_reply($1,'Found it. I added the coins.')", [th]);
row = (await q("select status, user_unread from support_threads where id=$1", [th]))[0];
assert.deepEqual(row, { status: "answered", user_unread: true });
// the player gets the badge, reads it, the badge clears
assert.equal((await as(iA, "select inbox_summary() r"))[0].r.unread, 1);
const mtr = (await as(iA, "select my_threads() r"))[0].r.find((x) => x.id === th);
assert.equal(mtr.unread, true); assert.equal(mtr.last_sender, "admin");
const convo = (await as(iA, "select thread_messages($1) r", [th]))[0].r;
assert.deepEqual(convo.messages.map((m) => m.sender), ["player", "admin"]);
assert.equal((await as(iA, "select inbox_summary() r"))[0].r.unread, 0);
// the player replies, it reopens and the admin is notified again
await as(iA, "select reply_support($1,'Thank you!')", [th]);
row = (await q("select status, admin_unread from support_threads where id=$1", [th]))[0];
assert.deepEqual(row, { status: "open", admin_unread: true });
await as(ADM, "select admin_set_thread_status($1,'closed')", [th]);
assert.ok((await msg(as(ADM, "select admin_set_thread_status($1,'weird')", [th]))).includes("invalid_status"));
assert.equal((await as(ADM, "select admin_threads('closed') r"))[0].r.length, 1);

// the admin writes first
assert.ok((await msg(as(iB, `select admin_send_message('${iC}','Hi','hello')`))).includes("forbidden"));
assert.ok((await msg(as(ADM, "select admin_send_message(gen_random_uuid(),'Hi','hello')"))).includes("player_not_found"));
const proThread = (await as(ADM, `select admin_send_message('${iC}','Welcome!','Thanks for joining. Tell us what you think.') id`))[0].id;
assert.equal((await as(iC, "select inbox_summary() r"))[0].r.unread, 1, "the player sees a badge");
assert.equal((await as(iC, "select my_threads() r"))[0].r[0].origin, "admin");
await as(iC, "select reply_support($1,'Thanks, I love it')", [proThread]);
assert.equal((await as(ADM, "select admin_threads() r"))[0].r.find((x) => x.id === proThread).admin_unread, true, "the player can answer an admin message");
// a suspended player can still contact support (to appeal)
await q("update profiles set banned=true where id=$1", [iB]);
await as(iB, "select contact_support('Appeal','Please review my account')");
await q("update profiles set banned=false where id=$1", [iB]);

// new players and welcome waves
const newp = (await as(iA, "select new_players() r"))[0].r;
assert.ok(newp.total >= 3 && newp.players.some((x) => x.name === "Ian") && newp.players.every((x) => typeof x.waved === "boolean"));
await as(iA, `select wave_hello('${iB}')`);
assert.ok((await msg(as(iA, `select wave_hello('${iB}')`))).includes("already_waved"), "one wave per pair");
assert.ok((await msg(as(iA, `select wave_hello('${iA}')`))).includes("cannot_wave_self"));
assert.ok((await msg(as(iA, "select wave_hello(gen_random_uuid())"))).includes("not_a_new_player"));
assert.equal((await as(iB, "select inbox_summary() r"))[0].r.notifications, 1);
const nts = (await as(iB, "select my_notifications() r"))[0].r;
assert.equal(nts[0].kind, "wave"); assert.equal(nts[0].from_name, "Ivy"); assert.ok(nts[0].title.includes("Ivy"));
assert.equal((await as(iA, "select new_players() r"))[0].r.players.find((x) => x.name === "Ian").waved, true);
await as(iB, "select mark_notifications_read()");
assert.equal((await as(iB, "select inbox_summary() r"))[0].r.unread, 0);
// older players cannot be waved at, and 5 waves a day is the limit
await q("update profiles set created_at = now() - interval '30 days' where id=$1", [iC]);
assert.ok((await msg(as(iA, `select wave_hello('${iC}')`))).includes("not_a_new_player"), "only players who joined this week");
for (let i = 0; i < 4; i++) await as(iA, `select wave_hello('${await mkUser(`wv${i}@t.com`, "Wave" + i)}')`);
assert.ok((await msg(as(iA, `select wave_hello('${await mkUser("wv9@t.com", "Wave9")}')`))).includes("too_many_waves"));
// deleting a player removes their messages
await q("delete from auth.users where id=$1", [iA]);
assert.equal((await q("select count(*)::int c from support_threads where user_id=$1", [iA]))[0].c, 0);
// health knows about the inbox
const h9 = (await as(ADM, "select admin_health() r"))[0].r;
assert.ok(h9.some((h) => h.name === "contact_support" && h.ok) && h9.some((h) => h.name === "notifications" && h.ok) && h9.every((h) => h.ok), JSON.stringify(h9.filter((h) => !h.ok)));

// ===================== Guests can look around (010) =====================
await db.exec(readFileSync(new URL("../migrations/010_guest.sql", import.meta.url), "utf8"));
const asAnon = async (sql, params) => { await db.exec("set role anon; select set_config('request.jwt.claim.sub','',false)"); try { return await q(sql, params); } finally { await db.exec("reset role"); } };
assert.equal((await asAnon("select count(*)::int c from worlds"))[0].c, 3, "visitors see the worlds");
assert.equal((await asAnon("select count(*)::int c from stamps"))[0].c, 27);
assert.ok((await asAnon("select id, name, s1, s2, s3 from stages where id='w1s1'")).length === 1, "visitors see stage goals");
assert.ok((await msg(asAnon("select seed from stages"))).includes("permission denied"), "stage boards stay secret");
assert.ok((await asAnon("select count(*)::int c from shop_items"))[0].c > 0, "visitors see the shop");
assert.equal((await asAnon("select array_length(daily_deals(),1) n"))[0].n, 3, "and today's deals");
assert.ok((await asAnon("select game_config.data from game_config")).length === 1);
await q("insert into liveops(kind,title,starts_at,ends_at,active) values ('banner','Hidden news',now(),now()+interval '1 hour',false)");
assert.ok((await asAnon("select title from liveops")).every((x) => x.title !== "Hidden news"), "switched-off events stay hidden");
for (const sql of ["select * from profiles", "select * from ledger", "select * from rounds", "select * from wallet", "select * from events", "select * from user_stages", "select * from matches"]) {
  assert.ok((await msg(asAnon(sql))).includes("permission denied"), "no personal data for visitors: " + sql);
}
for (const sql of ["select buy_item('th_ocean')", "select league_board()", "select new_players()", "select season_info()", "select contact_support('Hi','hello there')", "select admin_overview()"]) {
  assert.ok((await msg(asAnon(sql))).length > 0, "visitors cannot call: " + sql);
}

// ===================== Bingo DNA drills (011) =====================
await db.exec(readFileSync(new URL("../migrations/011_dna.sql", import.meta.url), "utf8"));
const dr1 = await mkUser("drill@t.com", "Drew");
const drillRound = async (skill) => {
  const id = (await q("select start_round_tx($1,'drill','medium',0,5,$2::jsonb) id", [dr1, JSON.stringify({ total: 60, every: 2250, drill: skill })]))[0].id;
  await q(`select finish_round($1,150,0,20,'{"win":false,"daubs":9,"missed":2,"maxStreak":6}'::jsonb)`, [id]);
  return id;
};
const db0 = await bal(dr1);
const d1id = await drillRound("speed");
const ds1 = (await q("select settle_drill_tx($1) r", [d1id]))[0].r;
assert.equal(ds1.first_today, true); assert.equal(ds1.coins, 20); assert.equal(ds1.skill, "speed");
assert.equal((await bal(dr1)) - db0, 20, "first drill of the day pays 20 coins");
assert.equal((await q("select settle_drill_tx($1) r", [d1id]))[0].r.ok, false, "a drill settles once");
const d2id = await drillRound("combo");
const ds2 = (await q("select settle_drill_tx($1) r", [d2id]))[0].r;
assert.equal(ds2.first_today, false); assert.equal(ds2.coins, 0, "only the first drill of the day pays");
assert.equal((await bal(dr1)) - db0, 20);
assert.equal((await q("select counters->>'drills' d from daily_progress where user_id=$1 and day=current_date", [dr1]))[0].d, "2");
assert.ok((await msg(as(dr1, `select settle_drill_tx('${d2id}')`))).includes("permission denied"), "players cannot settle drills themselves");
// the stored result keeps the new Bingo DNA fields, and the player can read their own rounds
const drMine = await as(dr1, "select mode, result from rounds where user_id=$1 order by started_at", [dr1]);
assert.ok(drMine.length === 2 && drMine.every((x) => x.mode === "drill" && x.result.missed === 2 && x.result.maxStreak === 6));
const h11 = (await as(ADM, "select admin_health() r"))[0].r;
assert.ok(h11.some((h) => h.name === "settle_drill_tx" && h.ok) && h11.every((h) => h.ok), JSON.stringify(h11.filter((h) => !h.ok)));

// ===================== Economy (012) =====================
await db.exec(readFileSync(new URL("../migrations/012_economy.sql", import.meta.url), "utf8"));
const ec = await mkUser("econ@t.com", "Penny");
const gems = async (u) => (await q("select coalesce(sum(amount),0)::int g from gem_ledger where user_id=$1", [u]))[0].g;
assert.equal((await q("select count(*)::int n from store_products"))[0].n, 13);
// the vault fills with 10% of game earnings, but not from purchases
await q("insert into ledger (user_id, amount, reason) values ($1, 100, 'Prize')", [ec]);
assert.equal((await q("select coins from coin_vault where user_id=$1", [ec]))[0].coins, 10);
await q("insert into ledger (user_id, amount, reason) values ($1, 500, 'Purchase: test')", [ec]);
assert.equal((await q("select coins from coin_vault where user_id=$1", [ec]))[0].coins, 10, "purchases do not fill the vault");
await q("insert into ledger (user_id, amount, reason, ref) values ($1, 20, 'Daily drill', 'drill:x')", [ec]);
assert.equal(await gems(ec), 1, "the first drill of the day gives a gem");
// nobody can buy while the store is in preview; players can never call grant_purchase directly
assert.ok((await msg(as(ec, "select buy_test('coins_s')"))).includes("store_not_open"));
assert.ok((await msg(as(ADM, "select buy_test('coins_s')"))).includes("store_not_open"), "even admins need test mode");
assert.ok((await msg(as(ec, `select grant_purchase('${ec}', 'coins_s', 'paid', 'x', null)`))).includes("permission denied"));
assert.ok((await msg(as(ec, "select admin_store()"))).includes("forbidden"));
assert.ok((await msg(as(ADM, "select admin_set_store('live', 10, 3000)"))).includes("live_needs_payments"));
await as(ADM, "select admin_set_store('test', 10, 3000)");
assert.ok((await msg(as(ec, "select buy_test('coins_s')"))).includes("store_not_open"), "test purchases are for admins only");
// admin test purchases: coins, starter once, gems, vault, club
const ab0 = await bal(ADM);
const ecR1 = (await as(ADM, "select buy_test('coins_m') r"))[0].r;
assert.equal(ecR1.coins, 2800); assert.equal((await bal(ADM)) - ab0, 2800);
await as(ADM, "select buy_test('starter')");
assert.ok((await msg(as(ADM, "select buy_test('starter')"))).includes("already_owned"), "the starter pack is once only");
assert.equal(await gems(ADM), 30);
await q("insert into ledger (user_id, amount, reason) values ($1, 1000, 'Prize')", [ADM]);
const vault = (await q("select coins from coin_vault where user_id=$1", [ADM]))[0].coins;
assert.ok(vault >= 100);
const ab1 = await bal(ADM);
assert.equal((await as(ADM, "select buy_test('vault') r"))[0].r.coins, vault);
assert.equal((await bal(ADM)) - ab1, vault, "opening the vault pays out everything in it");
assert.ok((await msg(as(ADM, "select buy_test('vault')"))).includes("vault_empty"));
assert.ok((await msg(as(ADM, "select club_claim()"))).includes("not_member"));
await as(ADM, "select buy_test('club')");
assert.equal((await as(ADM, "select club_claim() r"))[0].r.gems, 5);
assert.ok((await msg(as(ADM, "select club_claim()"))).includes("already_claimed"));
assert.equal(await gems(ADM), 35);
// gems buy coins and Streak Shields
const ab2 = await bal(ADM);
assert.equal((await as(ADM, "select gem_spend('coins_s') r"))[0].r.coins, 600);
assert.equal((await bal(ADM)) - ab2, 600); assert.equal(await gems(ADM), 25);
assert.ok((await msg(as(ec, "select gem_spend('coins_l')"))).includes("insufficient_gems"));
// crew treat needs a crew; spending limits stop purchases
const hasCrew = (await q("select count(*)::int n from crew_members where user_id=$1", [ADM]))[0].n > 0;
if (!hasCrew) assert.ok((await msg(as(ADM, "select buy_test('crew_treat')"))).includes("no_crew"));
await as(ADM, "select set_spend_limit(500)");
assert.ok((await msg(as(ADM, "select buy_test('coins_s')"))).includes("spend_limit"), "the monthly limit counts test purchases too");
await as(ADM, "select set_spend_limit(null)");
await as(ADM, "select buy_test('coins_s')");
const me2 = (await as(ADM, "select my_economy() r"))[0].r;
assert.equal(me2.mode, "test"); assert.equal(me2.gems, 25); assert.ok(me2.club_until); assert.equal(me2.club_claimed, true);
assert.deepEqual(me2.owned, ["starter"]);
assert.ok((await as(ADM, "select my_purchases() r"))[0].r.length >= 5);
const st = (await as(ADM, "select admin_store() r"))[0].r;
assert.equal(st.paid_all_cents, 0, "test purchases are not revenue"); assert.ok(st.tests >= 5); assert.equal(st.club_active, 1);
await as(ADM, "select admin_save_product('coins_s', '1,200 coins', '', 199, 1200, 0, 0, '+20%', true)");
assert.equal((await q("select coins from store_products where id='coins_s'"))[0].coins, 1200);
assert.equal((await as(ec, "select count(*)::int n from purchases"))[0].n, 0, "players only see their own purchases");
const h12 = (await as(ADM, "select admin_health() r"))[0].r;
assert.ok(h12.every((h) => h.ok), JSON.stringify(h12.filter((h) => !h.ok)));

// ===================== Ads (013) =====================
await db.exec(readFileSync(new URL("../migrations/013_ads.sql", import.meta.url), "utf8"));
const adU = await mkUser("ads@t.com", "Vida");
assert.equal((await as(adU, "select my_ad_status() r"))[0].r.enabled, false, "ads are off until a publisher ID is set");
assert.ok((await msg(as(adU, "select claim_ad_reward('lobby')"))).includes("ads_off"));
assert.ok((await msg(as(adU, "select admin_set_ads(true, 'ca-pub-1234567890', true, 50, 2, false, 3)"))).includes("forbidden"));
assert.ok((await msg(as(ADM, "select admin_set_ads(true, '', true, 50, 2, false, 3)"))).includes("ads_need_client"));
assert.ok((await msg(as(ADM, "select admin_set_ads(true, 'pub-123', true, 50, 2, false, 3)"))).length > 0, "the publisher ID must look like ca-pub-…");
await as(ADM, "select admin_set_ads(true, 'ca-pub-1234567890', true, 50, 2, false, 3)");
const adSt = (await as(adU, "select my_ad_status() r"))[0].r;
assert.equal(adSt.enabled, true); assert.equal(adSt.left_today, 2); assert.equal(adSt.client, "ca-pub-1234567890");
const adB0 = await bal(adU);
assert.equal((await as(adU, "select claim_ad_reward('lobby') r"))[0].r.coins, 50);
assert.equal((await bal(adU)) - adB0, 50);
assert.ok((await msg(as(adU, "select claim_ad_reward('lobby')"))).includes("ad_too_soon"), "rewards are spaced out");
await q("update ad_rewards set created_at = now() - interval '1 minute' where user_id=$1", [adU]);
await as(adU, "select claim_ad_reward('store')");
await q("update ad_rewards set created_at = now() - interval '1 minute' where user_id=$1", [adU]);
assert.ok((await msg(as(adU, "select claim_ad_reward('store')"))).includes("ad_limit"), "the daily cap stops more rewards");
assert.equal((await as(adU, "select my_ad_status() r"))[0].r.left_today, 0);
const adA = (await as(ADM, "select admin_ads() r"))[0].r;
assert.equal(adA.today, 2); assert.equal(adA.by_placement.store, 1);
assert.ok((await msg(as(adU, "select count(*) from ad_rewards"))).includes("permission denied"), "players cannot read the ad log");
await as(ADM, "select admin_set_ads(false, 'ca-pub-1234567890', true, 50, 5, false, 3)");
const h13 = (await as(ADM, "select admin_health() r"))[0].r;
assert.ok(h13.every((h) => h.ok), JSON.stringify(h13.filter((h) => !h.ok)));

// ===================== Analytics (014) =====================
await db.exec(readFileSync(new URL("../migrations/014_analytics.sql", import.meta.url), "utf8"));
const anonQ = async (sql, params) => { await db.exec("set role anon; select set_config('request.jwt.claim.sub','',false)"); try { return await q(sql, params); } finally { await db.exec("reset role"); } };
const vidA = "11111111-1111-4111-8111-111111111111", vidB = "22222222-2222-4222-8222-222222222222";
await anonQ("select track_visit($1, 'phone', 'Google.com/<script>', 'lobby')", [vidA]);
await anonQ("select track_visit($1, 'phone', 'google.com', 'lobby')", [vidA]);
await anonQ("select track_step($1, 'guest_round')", [vidA]);
await anonQ("select track_step($1, 'signup_open')", [vidA]);
await anonQ("select track_visit($1, 'toaster', '', '')", [vidB]);
const va = (await q("select * from visits where vid=$1", [vidA]))[0];
assert.equal(va.hits, 2); assert.equal(va.guest_rounds, 1); assert.equal(va.signup_open, true); assert.equal(va.source, "google.comscript");
assert.equal(va.user_id, null);
const vb = (await q("select * from visits where vid=$1", [vidB]))[0];
assert.equal(vb.device, "desktop"); assert.equal(vb.source, "direct"); assert.equal(vb.landing, "lobby");
assert.ok((await msg(anonQ("select track_step($1, 'hack')", [vidA]))).includes("bad_request"));
assert.ok((await msg(anonQ("select count(*) from visits"))).includes("permission denied"), "visitors cannot read the visit log");
assert.ok((await msg(anonQ("select count(*) from an_activity"))).includes("permission denied"));
const anU = await mkUser("an@t.com", "Ana");
await as(anU, "select track_visit($1, 'phone', 'google.com', 'lobby')", [vidA]);
assert.equal((await q("select user_id from visits where vid=$1", [vidA]))[0].user_id, anU, "logging in links the visitor to the account");
assert.ok((await msg(as(anU, "select count(*) from visits"))).includes("permission denied"));
assert.ok((await msg(as(anU, "select admin_analytics(30)"))).includes("forbidden"));
assert.ok((await msg(as(anU, "select an_kpi(current_date, current_date, false)"))).includes("permission denied"));
// a returning player: joined 10 days ago, played 9 days ago and today
await q("update profiles set created_at = now() - interval '10 days' where id=$1", [anU]);
await q("insert into rounds (user_id, mode, level, seed, params, status, started_at, finished_at, score, result) values ($1,'solo','beginner',1,'{}','scored', now() - interval '9 days', now() - interval '9 days', 80, '{\"accuracy\":0.9}'), ($1,'solo','beginner',2,'{}','scored', now(), now(), 90, '{\"accuracy\":0.8}')", [anU]);
const an = (await as(ADM, "select admin_analytics(30, true, 'Asia/Jerusalem') r"))[0].r;
assert.equal(an.range.days, 30); assert.equal(an.daily.length, 30); assert.equal(an.range.tz, "Asia/Jerusalem");
assert.equal(an.now.visitors, 2); assert.equal(an.now.new_visitors, 2); assert.equal(an.now.guest_rounds, 1);
assert.ok(an.now.active >= 1); assert.ok(an.now.revenue_cents > 0, "test purchases count when asked");
assert.equal(an.funnel.visitors, 2); assert.equal(an.funnel.tried, 1); assert.equal(an.funnel.signup_open, 1); assert.equal(an.funnel.tried_joined, 1, "the visitor who tried a free round then joined"); assert.equal(an.funnel.joined_tracked, 1);
assert.equal(an.traffic.devices.phone, 1); assert.equal(an.traffic.devices.desktop, 1);
assert.ok(an.games.by_mode.some((m) => m.mode === "solo" && m.acc > 0)); assert.ok(an.games.heat.length >= 1);
assert.equal(an.loyalty.buckets.length, 5); assert.ok(Array.isArray(an.retention.cohorts));
assert.ok(an.economy.some((e) => e.kind === "Welcome bonus"));
const today = an.daily[an.daily.length - 1];
assert.ok(today.active >= 1 && today.returning >= 1, "a player who joined earlier counts as returning");
const anPaid = (await as(ADM, "select admin_analytics(7) r"))[0].r;
assert.equal(anPaid.now.revenue_cents, 0, "test purchases are left out by default"); assert.equal(anPaid.daily.length, 7);
assert.equal((await as(ADM, "select admin_analytics(12, false, 'Mars/Base') r"))[0].r.range.days, 30, "unknown ranges and time zones fall back safely");
const h14 = (await as(ADM, "select admin_health() r"))[0].r;
assert.ok(h14.every((h) => h.ok), JSON.stringify(h14.filter((h) => !h.ok)));

// ===================== Countries (015) =====================
await db.exec(readFileSync(new URL("../migrations/015_geo.sql", import.meta.url), "utf8"));
const vidC = "33333333-3333-4333-8333-333333333333";
await anonQ("select track_visit($1, 'desktop', 'direct', 'lobby', 'il')", [vidC]);
await anonQ("select track_visit($1, 'desktop', 'direct', 'lobby')", [vidC]);
assert.equal((await q("select country from visits where vid=$1", [vidC]))[0].country, "IL", "the country is kept when an older browser sends no country");
await anonQ("select track_visit($1, 'phone', 'direct', 'lobby', 'Israel')", [vidB]);
assert.equal((await q("select country from visits where vid=$1", [vidB]))[0].country, null, "only two-letter codes are stored");
await as(anU, "select track_visit($1, 'phone', 'google.com', 'lobby', 'DE')", [vidA]);
assert.ok((await msg(as(anU, "select admin_geo(30)"))).includes("forbidden"));
const geo = (await as(ADM, "select admin_geo(30, true) r"))[0].r;
const il = geo.rows.find((r) => r.c === "IL"), de = geo.rows.find((r) => r.c === "DE");
assert.equal(il.visitors, 1); assert.equal(il.players, 0);
assert.equal(de.visitors, 1); assert.equal(de.players, 1, "a logged-in player is counted in their country");
assert.ok(geo.rows.some((r) => r.c === "??"), "players without a known country are listed as unknown");
const h15 = (await as(ADM, "select admin_health() r"))[0].r;
assert.ok(h15.every((h) => h.ok), JSON.stringify(h15.filter((h) => !h.ok)));

// ===================== Automation (016) =====================
await db.exec(readFileSync(new URL("../migrations/016_auto.sql", import.meta.url), "utf8"));
const notes = async (u, kind) => (await q("select title, body from notifications where user_id=$1 and kind=$2 order by created_at", [u, kind]));
const au1 = await mkUser("auto1@t.com", "Ruby"), au2 = await mkUser("auto2@t.com", "Sapphire"), au3 = await mkUser("auto3@t.com", "Topaz");
// a hand-made event whose time is up is finished and paid by the engine, and the winner gets a message
const pastEv = (await q("insert into events (name, level, fee, attempts, starts_at, ends_at, bonus, split, status) values ('Old Cup','medium',0,3, now() - interval '2 days', now() - interval '1 hour', 300, '{60,40}', 'live') returning id"))[0].id;
const scoreRound = async (u, opts) => {
  const id = (await q("insert into rounds (user_id, mode, level, seed, params, status, event_id, started_at) values ($1, $2, 'medium', 1, '{}', 'active', $3, coalesce($4, now())) returning id", [u, opts.mode ?? "solo", opts.event ?? null, opts.at ?? null]))[0].id;
  await q("update rounds set status='scored', score=$2, xp_gain=$3, finished_at=coalesce($4, now()), result='{}' where id=$1", [id, opts.score ?? 0, opts.xp ?? 0, opts.at ?? null]);
  return id;
};
await scoreRound(au1, { event: pastEv, score: 200, at: new Date(Date.now() - 86400e3).toISOString() });
await scoreRound(au2, { event: pastEv, score: 120, at: new Date(Date.now() - 86400e3).toISOString() });
// last week's league: Topaz leads, Ruby second
const prevWk = (await q("select (public.week_start() - 7)::text w"))[0].w;
await q("delete from league_payouts where week = $1::date", [prevWk]);
const lwAt = (await q("select ((public.week_start() - 7)::timestamp at time zone 'utc' + interval '2 days')::text t"))[0].t;
await scoreRound(au3, { xp: 90, at: lwAt }); await scoreRound(au1, { xp: 60, at: lwAt });
const bal3 = await bal(au3), bal1 = await bal(au1);
const run1 = (await as(ADM, "select admin_run_auto() r"))[0].r;
assert.ok(Array.isArray(run1), JSON.stringify(run1));
const oldCup = (await q("select status, pool from events where id=$1", [pastEv]))[0];
assert.equal(oldCup.status, "ended", "events whose time is up are finished automatically"); assert.equal(oldCup.pool, 300);
assert.ok((await notes(au1, "prize")).some((n) => /won 180 coins in Old Cup/.test(n.title)), "the event winner gets a message with the amount");
assert.ok((await notes(au2, "prize")).some((n) => /won 120 coins/.test(n.title)));
const lp = (await q("select winners from league_payouts where week = $1::date", [prevWk]))[0];
assert.ok(lp, "last week's league is paid automatically");
const lgPlayers = (await q("select public.league_players($1::date) n", [prevWk]))[0].n;
const expectFirst = Math.floor(Math.min(5000, 150 + 10 * lgPlayers) * 40 / 100);
assert.equal(lp.winners[0].prize, expectFirst, "league prizes grow with the number of players");
assert.equal((await bal(au3)) - bal3, expectFirst + 0);
assert.ok((await notes(au3, "prize")).some((n) => /weekly league/.test(n.title) && n.title.includes(expectFirst.toLocaleString("en-US"))));
assert.ok((await bal(au1)) > bal1);
// seasons and live ops are planned
assert.ok((await q("select count(*)::int n from seasons where ends_at > now() and starts_at <= now() + interval '1 day'"))[0].n >= 1, "a season is always running");
const sid = (await q("select id from seasons where ends_at > now() order by starts_at limit 1"))[0].id;
assert.equal((await q("select count(*)::int n from season_tiers where season_id=$1", [sid]))[0].n > 0, true);
assert.ok((await q("select count(*)::int n from liveops where template_id is not null"))[0].n >= 3, "boosts are planned a week ahead");
const utcNow = new Date(); if (!(utcNow.getUTCHours() === 23 && utcNow.getUTCMinutes() >= 25)) assert.ok((await q("select count(*)::int n from events where auto and name = 'Daily Sprint' and status = 'live'"))[0].n === 1, "today's Daily Sprint is open");
// a second run does not pay twice
const run2 = (await as(ADM, "select admin_run_auto() r"))[0].r;
assert.ok(!JSON.stringify(run2).includes("league_paid") && !JSON.stringify(run2).includes("Old Cup"), JSON.stringify(run2));
assert.equal((await as(au1, "select auto_tick() r"))[0].r, false, "players nudge the engine at most every 5 minutes");
// someone passes you: in an event and in the league, once per cooldown
const liveEv = (await q("insert into events (name, level, fee, attempts, starts_at, ends_at, bonus, split, status) values ('Night Cup','medium',0,5, now() - interval '1 hour', now() + interval '5 hours', 100, '{100}', 'live') returning id"))[0].id;
await scoreRound(au1, { event: liveEv, score: 150 });
await scoreRound(au2, { event: liveEv, score: 210 });
const ov1 = await notes(au1, "overtake");
assert.ok(ov1.some((n) => /Sapphire just passed you in Night Cup/.test(n.title) && /#2/.test(n.body)), JSON.stringify(ov1));
await scoreRound(au3, { event: liveEv, score: 300 });
assert.equal((await notes(au1, "overtake")).filter((n) => /Night Cup/.test(n.title)).length, 1, "at most one message per board every few hours");
assert.ok((await notes(au2, "overtake")).some((n) => /Topaz just passed you in Night Cup/.test(n.title)));
await scoreRound(au1, { xp: 50 }); await scoreRound(au2, { xp: 30 });
await scoreRound(au2, { xp: 40 });
assert.ok((await notes(au1, "overtake")).some((n) => /passed you in the weekly league/.test(n.title)), "the league sends one too");
await as(ADM, `select admin_save_auto('${JSON.stringify({ ...(await as(ADM, "select admin_auto() r"))[0].r.settings, notify_overtake: false })}'::jsonb)`);
const before3 = (await notes(au3, "overtake")).length;
await scoreRound(au1, { event: liveEv, score: 400 });
assert.equal((await notes(au3, "overtake")).length, before3, "messages can be switched off");
// bad settings are refused, players cannot reach the admin parts
const autoS = (await as(ADM, "select admin_auto() r"))[0].r;
assert.ok(autoS.templates.length >= 3 && autoS.liveop_templates.length >= 3 && autoS.league.prizes.length === 5);
assert.ok((await msg(as(ADM, `select admin_save_auto('${JSON.stringify({ ...autoS.settings, league_split: [80, 40] })}'::jsonb)`))).includes("invalid_auto"));
assert.ok((await msg(as(au1, "select admin_auto()"))).includes("forbidden"));
assert.ok((await msg(as(au1, "select admin_run_auto()"))).includes("forbidden"));
assert.ok((await msg(as(au1, "select auto_run()"))).includes("permission denied"));
const tplId = (await as(ADM, `select admin_save_event_template(null, '${JSON.stringify({ name: "Lunch Dash", descr: "", level: "beginner", fee: 5, attempts: 2, schedule: "weekly", weekday: 2, start_hour: 11, duration_hours: 3, bonus: 100, bonus_per_player: 5, bonus_max: 500, split: [70, 30], active: true })}'::jsonb) id`))[0].id;
assert.ok(tplId);
assert.ok((await msg(as(ADM, `select admin_save_event_template(null, '${JSON.stringify({ name: "Bad", level: "beginner", fee: 5, attempts: 2, schedule: "daily", start_hour: 30, duration_hours: 3, bonus: 1, bonus_per_player: 0, bonus_max: 1, split: [70], active: true })}'::jsonb)`))).includes("invalid_auto"));
// live races and league info for players
assert.ok(Array.isArray((await as(au1, "select live_races() r"))[0].r));
const li = (await as(au1, "select league_info() r"))[0].r;
assert.ok(li.prizes.length === 5 && li.players >= 2);
// who is online
await as(au1, "select presence_ping(null)");
await anonQ("select presence_ping($1)", [vidC]);
const onl = (await as(ADM, "select admin_online(10) r"))[0].r;
assert.ok(onl.players >= 1 && onl.list.some((x) => x.name === "Ruby"), JSON.stringify(onl));
assert.ok((await msg(as(au1, "select admin_online(10)"))).includes("forbidden"));
// new sign-up steps are counted
await anonQ("select track_step($1, 'signup_google')", [vidC]);
await anonQ("select track_step($1, 'confirm_needed')", [vidC]);
const sgSteps = (await as(ADM, "select admin_signup_steps(30) r"))[0].r;
assert.ok(sgSteps.google >= 1 && sgSteps.confirm_needed >= 1, JSON.stringify(sgSteps));
const h16 = (await as(ADM, "select admin_health() r"))[0].r;
assert.ok(h16.every((h) => h.ok), JSON.stringify(h16.filter((h) => !h.ok)));

// ===================== CrazyGames (017) =====================
await db.exec(readFileSync(new URL("../migrations/017_crazygames.sql", import.meta.url), "utf8"));
assert.equal((await q("select age_18 from profiles where id=$1", [ADM]))[0].age_18, true, "players who accepted before confirmed 18+");
const cgU = (await q("insert into auth.users(email, raw_user_meta_data) values ('cg@t.com', $1) returning id", [JSON.stringify({ name: "CrazyCat", terms: "true", joined_on: "crazygames", terms_version: "2026-10" })]))[0].id;
const cgP = (await q("select adult_confirmed, age_18, joined_on, terms_version from profiles where id=$1", [cgU]))[0];
assert.deepEqual([cgP.adult_confirmed, cgP.age_18, cgP.joined_on], [true, false, "crazygames"], "CrazyGames email sign-ups accept the Terms without 18+");
const fakeCg = (await q("insert into auth.users(email, raw_user_meta_data) values ('cg2@t.com', $1) returning id", [JSON.stringify({ name: "Sneaky", terms: "true" })]))[0].id;
assert.equal((await q("select adult_confirmed from profiles where id=$1", [fakeCg]))[0].adult_confirmed, false, "terms-only needs the CrazyGames flag");
await as(fakeCg, "select accept_terms('2026-10', false, 'crazygames')");
const fk = (await q("select adult_confirmed, age_18, joined_on from profiles where id=$1", [fakeCg]))[0];
assert.deepEqual([fk.adult_confirmed, fk.age_18, fk.joined_on], [true, false, "crazygames"]);
const webU = await uid("web@t.com", "Webby");
await as(webU, "select accept_terms('2026-10')");
assert.equal((await q("select age_18 from profiles where id=$1", [webU]))[0].age_18, true, "the website still asks for 18+");
// purchases only with 18+
await q("update profiles set role='admin' where id=$1", [cgU]);
assert.ok((await msg(as(cgU, "select buy_test('coins_s')"))).includes("adults_only"), "players without 18+ cannot buy");
await q("update profiles set role='player' where id=$1", [cgU]);
// the sign-in relay: one-time, 5 minutes, only with a real code
const rc = "ab".repeat(24);
assert.ok((await msg(anonQ("select relay_put($1, 'refresh-token-1')", [rc]))).includes("permission denied"), "only a logged-in window can leave a login");
await as(cgU, "select relay_put($1, 'refresh-token-1')", [rc]);
assert.equal((await q("select count(*)::int n from auth_relay where code_hash = md5($1)", [rc]))[0].n, 1);
assert.ok((await msg(anonQ("select count(*) from auth_relay"))).includes("permission denied"));
assert.equal((await anonQ("select relay_take($1) t", [rc]))[0].t, "refresh-token-1");
assert.equal((await anonQ("select relay_take($1) t", [rc]))[0].t, null, "a code works once");
await as(cgU, "select relay_put($1, 'refresh-token-2')", [rc]);
await q("update auth_relay set created_at = now() - interval '6 minutes'");
assert.equal((await anonQ("select relay_take($1) t", [rc]))[0].t, null, "codes expire after 5 minutes");
assert.ok((await msg(anonQ("select relay_take('short')"))).includes("bad_request"));
const jo = (await as(ADM, "select admin_joined_on() r"))[0].r;
assert.ok(jo.crazygames >= 2 && jo.web >= 1);
const h17 = (await as(ADM, "select admin_health() r"))[0].r;
assert.ok(h17.every((h) => h.ok), JSON.stringify(h17.filter((h) => !h.ok)));

// ===================== Live matches (018) =====================
await db.exec(readFileSync(new URL("../migrations/018_arena.sql", import.meta.url), "utf8"));
const lmA = await mkUser("arenaA@t.com", "Amber"), lmB = await mkUser("arenaB@t.com", "Basil"), lmC = await mkUser("arenaC@t.com", "Coral");
for (const u of [lmA, lmB, lmC]) await give(u, 500);
await q("update profiles set last_seen = now() where id = any($1::uuid[])", [[lmA, lmB, lmC]]);
const arPar = JSON.stringify({ fee: 20, total: 100, every: 3000 });
const arMm = async (u) => (await q("select matchmake_tx($1,'hard',$2::jsonb,4242) r", [u, arPar]))[0].r;
// a player who closed the tab leaves the queue within 15 seconds
assert.equal((await arMm(lmA)).status, "queued");
await q("update match_queue set last_ping = now() - interval '20 seconds' where user_id=$1", [lmA]);
assert.equal((await arMm(lmB)).status, "queued", "nobody is matched with a player who left");
assert.equal((await q("select count(*)::int n from match_queue where user_id=$1", [lmA]))[0].n, 0);
// others see who is waiting, and can join at once
const arSt = (await as(lmC, "select arena_status() r"))[0].r;
assert.ok(arSt.online >= 2, JSON.stringify(arSt));
assert.ok(arSt.waiting.some((w) => w.name === "Basil" && w.level === "hard"), "players see who is waiting for a live match");
assert.equal((await as(lmB, "select arena_status() r"))[0].r.waiting.filter((w) => w.name === "Basil").length, 0, "you do not see yourself");
assert.equal((await as(lmB, "select my_match() r"))[0].r.status, "queued", "polling keeps the place in the queue");
assert.equal((await arMm(lmC)).status, "ready", "the next player at the same level is matched");
// invites
await arMm(lmA);
const arOn = (await as(lmA, "select online_players() r"))[0].r;
assert.ok(arOn.some((p) => p.name === "Coral"));
const arInv = (await as(lmA, "select send_invite($1, 'hard') id", [lmC]))[0].id;
const arSt2 = (await as(lmC, "select arena_status() r"))[0].r;
assert.ok(arSt2.invites.some((i) => i.id === arInv && i.from_name === "Amber" && i.waiting === true), JSON.stringify(arSt2.invites));
assert.equal((await as(lmC, "select answer_invite($1, true) r", [arInv]))[0].r.level, "hard");
assert.ok((await msg(as(lmC, "select answer_invite($1, true)", [arInv]))).includes("invite_expired"), "an invite is answered once");
assert.ok((await as(lmA, "select arena_status() r"))[0].r.sent.some((x) => x.to === "Coral" && x.status === "accepted"));
assert.ok((await msg(as(lmA, "select send_invite($1, 'hard')", [lmA]))).includes("bad_request"));
await q("update profiles set last_seen = now() - interval '1 hour' where id=$1", [lmB]);
assert.ok((await msg(as(lmA, "select send_invite($1, 'hard')", [lmB]))).includes("player_offline"), "only online players can be invited");
// Facebook link
assert.equal((await anonQ("select facebook from app_links"))[0].facebook, "");
await as(ADM, "select admin_save_links('https://www.facebook.com/BingoArenaGame')");
assert.equal((await anonQ("select facebook from app_links"))[0].facebook, "https://www.facebook.com/BingoArenaGame", "visitors can read the link");
assert.ok((await msg(as(ADM, "select admin_save_links('https://evil.example.com/x')"))).includes("invalid_link"));
assert.ok((await msg(as(lmA, "select admin_save_links('https://www.facebook.com/x')"))).includes("forbidden"));
const h18 = (await as(ADM, "select admin_health() r"))[0].r;
assert.ok(h18.every((h) => h.ok), JSON.stringify(h18.filter((h) => !h.ok)));
console.log("DB tests passed");
