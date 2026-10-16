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
console.log("DB tests passed");
