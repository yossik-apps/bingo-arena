// Builds supabase/migrations/009_inbox.sql from the template, an extended health check and the permissions.
// Run: npx tsx supabase/tools/gen_phase8.ts
import { readFileSync, writeFileSync } from "node:fs";

const health = readFileSync(new URL("../migrations/008_phase7.sql", import.meta.url), "utf8").match(/create or replace function public\.admin_health\(\).*?\n\$\$;\n/s)![0]
  .replace("'valid_reward'];", "'valid_reward','contact_support','reply_support','admin_reply','admin_send_message','wave_hello','inbox_summary','new_players'];")
  .replace("'season_tiers'];", "'season_tiers','support_threads','support_messages','notifications'];");
if (!health.includes("contact_support") || !health.includes("support_threads")) throw new Error("health patch failed");

const player = ["contact_support(text, text)", "reply_support(uuid, text)", "my_threads()", "thread_messages(uuid)", "my_notifications()", "mark_notifications_read()",
  "inbox_summary()", "new_players(int)", "wave_hello(uuid)"];
const admin = ["admin_threads(text)", "admin_thread_messages(uuid)", "admin_reply(uuid, text)", "admin_set_thread_status(uuid, text)", "admin_send_message(uuid, text, text)"];
const pub = (l: string[]) => l.map((f) => "public." + f).join(", ");
const sql = readFileSync(new URL("./phase8.template.sql", import.meta.url), "utf8") + `
-- ======================= health check (now also checks the inbox) =======================
${health}
-- ======================= permissions =======================
revoke all on public.support_threads, public.support_messages, public.notifications from anon, authenticated;
revoke all on function ${pub([...player, ...admin])} from public, anon, authenticated;
grant execute on function ${pub([...player, ...admin])} to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
`;
writeFileSync(new URL("../migrations/009_inbox.sql", import.meta.url), sql);
console.log("wrote 009_inbox.sql", sql.length, "bytes");
