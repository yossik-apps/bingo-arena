// Builds supabase/migrations/008_phase7.sql: the template, Season 1 content, an extended health check and the permissions.
// Run: npx tsx supabase/tools/gen_phase7.ts
import { readFileSync, writeFileSync } from "node:fs";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const free = (t: number) => (t === 30 ? { item: "fr_neonnights" } : t === 10 ? { booster: { key: "time", qty: 2 } } : t === 20 ? { booster: { key: "slow", qty: 2 } } : t % 5 === 0 ? { pack: 1 } : { coins: 20 + 3 * t });
const prem = (t: number) => (t === 3 ? { item: "ball_nightpulse" } : t === 8 ? { item: "t_nightowl" } : t === 15 ? { item: "bd_nightcity" } : t === 22 ? { pack: 2 } : t === 30 ? { pack: 3 } : { coins: 40 + 5 * t });
const tiers = Array.from({ length: 30 }, (_, i) => i + 1).map((t) => `  (1, ${t}, ${q(JSON.stringify(free(t)))}, ${q(JSON.stringify(prem(t)))})`).join(",\n");

const health = readFileSync(new URL("../migrations/007_guide.sql", import.meta.url), "utf8").match(/create or replace function public\.admin_health\(\).*?\n\$\$;\n/s)![0]
  .replace("'set_guide_seen'];", "'set_guide_seen','create_crew','crew_info','claim_crew_chest','admin_pay_crews','season_info','claim_season_tier','admin_save_liveop','admin_save_season','valid_reward'];")
  .replace("'mastery_tiers'];", "'mastery_tiers','liveops','crews','seasons','season_tiers'];");
if (!health.includes("create_crew") || !health.includes("liveops")) throw new Error("health patch failed");

const player = ["create_crew(text, text, text, boolean)", "join_crew(uuid, text)", "leave_crew()", "kick_crew_member(uuid)", "update_crew(text, boolean)", "crew_info()", "search_crews(text)",
  "crew_board(date)", "claim_crew_chest(int)", "season_info()", "buy_season_pass()", "claim_season_tier(int, text)"];
const admin = ["admin_liveops()", "admin_save_liveop(uuid, text, text, text, timestamptz, timestamptz, numeric, int, boolean)", "admin_delete_liveop(uuid)", "admin_crews()",
  "admin_rename_crew(uuid, text)", "admin_delete_crew(uuid)", "admin_pay_crews(date, int[])", "admin_seasons()", "admin_season_tiers(int)",
  "admin_save_season(int, text, text, timestamptz, timestamptz, int, int)", "admin_save_tier(int, int, jsonb, jsonb)"];
const internal = ["member_week_points(uuid, uuid, date)", "crew_week_points(uuid, date)", "valid_reward(jsonb)", "grant_reward_tx(uuid, jsonb, text)", "current_season_id()", "season_xp(uuid, int)"];
const pub = (l: string[]) => l.map((f) => "public." + f).join(", ");

const sql = readFileSync(new URL("./phase7.template.sql", import.meta.url), "utf8") + `
-- ======================= Season 1 and its exclusive rewards =======================
insert into public.shop_items (id, slot, key, grp, name, descr, price, min_level, meta, sort) values
  ('fr_neonnights', 'frame', 'neonnights', 'world', 'Neon Nights ring', 'Season 1 reward', 9999, 0, '{"reward":true}', 90),
  ('ball_nightpulse', 'ball', 'nightpulse', 'world', 'Night Pulse ball', 'Season 1 reward', 9999, 0, '{"reward":true,"bg":"#7c3aed","ink":"#ffffff"}', 91),
  ('t_nightowl', 'title', 'nightowl', 'world', 'Night Owl', 'Season 1 reward', 9999, 0, '{"reward":true}', 92),
  ('bd_nightcity', 'board', 'nightcity', 'world', 'Night City board', 'Season 1 reward', 9999, 0, '{"reward":true,"card":"#0b1020","cell":"#1b2340","ink":"#a5f3fc"}', 93);
insert into public.seasons (id, name, blurb, starts_at, ends_at, xp_per_tier, pass_price) values
  (1, 'Neon Nights', 'Six weeks of neon. Play to climb the track and unlock exclusive looks.', date_trunc('day', now()), date_trunc('day', now()) + interval '42 days', 200, 600);
insert into public.season_tiers (season_id, tier, free_reward, premium_reward) values
${tiers};

-- ======================= health check (now also checks Phase 7) =======================
${health}
-- ======================= permissions =======================
revoke all on public.liveops, public.crews, public.crew_members, public.crew_claims, public.crew_payouts, public.seasons, public.season_tiers, public.season_pass, public.season_claims from anon, authenticated;
grant select on public.liveops, public.seasons, public.season_tiers, public.season_pass, public.season_claims to authenticated;
revoke all on function ${pub([...player, ...admin, ...internal])} from public, anon, authenticated;
grant execute on function ${pub([...player, ...admin])} to authenticated;
grant all on all tables in schema public to service_role;
`;
writeFileSync(new URL("../migrations/008_phase7.sql", import.meta.url), sql);
console.log("wrote 008_phase7.sql", sql.length, "bytes");
