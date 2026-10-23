import { useCallback, useEffect, useState } from "react";
import { loadAuthSettings, supabase, type AuthSettings } from "../../lib/supabase";
import { APP_VERSION, COMMIT, fullBuildDate } from "../../lib/version";

type Check = { kind: "function" | "table" | "data"; name: string; ok: boolean };
const MIGRATION: Record<string, string> = {
  admin_overview: "003", admin_players: "003", admin_player_detail: "003", admin_adjust_coins: "003", admin_set_banned: "003", admin_save_config: "003",
  admin_save_item: "003", admin_save_mission: "003", admin_events: "003", admin_save_event: "003", admin_set_event_status: "003", admin_delete_event: "003",
  admin_finalize_event: "003", event_leaderboard: "003", events: "003",
  admin_pay_league: "004", league_board: "004", matchmake_tx: "004", matches: "004", match_queue: "004", league_payouts: "004",
  admin_save_stage: "005", admin_journey_stats: "005", settle_stage_tx: "005", claim_album: "005", worlds: "005", stages: "005", stamps: "005", user_stages: "005",
  admin_audit: "006", admin_health: "006", settle_daily_tx: "006", create_challenge_tx: "006", mastery: "006", export_my_data: "006", accept_terms: "006",
  daily_boards: "006", challenges: "006", mastery_tiers: "006", set_guide_seen: "007",
  create_crew: "008", crew_info: "008", claim_crew_chest: "008", admin_pay_crews: "008", season_info: "008", claim_season_tier: "008", admin_save_liveop: "008", admin_save_season: "008", valid_reward: "008", liveops: "008", crews: "008", seasons: "008", season_tiers: "008",
  contact_support: "009", reply_support: "009", admin_reply: "009", admin_send_message: "009", wave_hello: "009", inbox_summary: "009", new_players: "009", settle_drill_tx: "011", grant_purchase: "012", buy_test: "012", my_economy: "012", club_claim: "012", gem_spend: "012", admin_store: "012", claim_ad_reward: "013", my_ad_status: "013", admin_ads: "013", track_visit: "014", track_step: "014", admin_analytics: "014", visits: "014", admin_geo: "015", auto_run: "016", auto_tick: "016", admin_auto: "016", admin_online: "016", presence_ping: "016", league_info: "016", live_races: "016", finalize_event_tx: "016", auto_settings: "016", event_templates: "016", liveop_templates: "016", relay_put: "017", relay_take: "017", admin_joined_on: "017", auth_relay: "017", arena_status: "018", send_invite: "018", answer_invite: "018", online_players: "018", admin_save_links: "018", match_invites: "018", app_links: "018", support_threads: "009", support_messages: "009", notifications: "009",
};
const FUNCTIONS = ["start-round", "submit-round", "find-match", "daily-info", "create-challenge", "delete-account", "admin-set-password"];

async function probe(name: string): Promise<"ok" | "missing" | "unreachable"> {
  const { error } = await supabase.functions.invoke(name, { body: {} });
  if (!error) return "ok";
  const status = (error as { context?: Response }).context?.status;
  if (status === 404) return "missing";
  return status ? "ok" : "unreachable"; // a 400 for an empty request means the function is deployed
}

export default function HealthTab() {
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [old, setOld] = useState(false);
  const [fns, setFns] = useState<Record<string, string>>({});
  const [auth, setAuth] = useState<AuthSettings | null | "x">(null);
  useEffect(() => { void loadAuthSettings().then((a) => setAuth(a ?? "x")); }, []);
  const run = useCallback(async () => {
    setOld(false); setChecks(null);
    const { data, error } = await supabase.rpc("admin_health");
    if (error) { setOld(true); return; }
    setChecks(data as Check[]);
  }, []);
  useEffect(() => { void run(); }, [run]);
  const probeAll = async () => {
    setFns({});
    for (const f of FUNCTIONS) { const r = await probe(f); setFns((x) => ({ ...x, [f]: r })); }
  };

  const missing = (checks ?? []).filter((c) => !c.ok);
  const need = [...new Set(missing.map((c) => MIGRATION[c.name]).filter(Boolean))].sort();
  return (
    <div className="cols2">
      <div>
        <h2 className="sec" style={{ marginTop: 8 }}>Website</h2>
        <div className="box"><p style={{ margin: 0 }}>Version <b>{APP_VERSION}</b><br /><span className="dim">Built {fullBuildDate()}{COMMIT ? ` · commit ${COMMIT}` : ""}</span></p></div>
        <h2 className="sec">Database</h2>
        {old && <p className="toast" role="alert">The health check itself is not installed yet. Run <b>supabase/migrations/006_phase6.sql</b> in the Supabase SQL Editor (see docs/UPDATE_GUIDE.md), then press Check again.</p>}
        {!old && !checks && <div className="skel" />}
        {checks && (
          <>
            <p className="toast" role="status">{missing.length === 0 ? "Everything is installed." : `${missing.length} thing${missing.length > 1 ? "s are" : " is"} missing.${need.length ? ` Run migration${need.length > 1 ? "s" : ""} ${need.map((n) => n + "_*.sql").join(", ")} in order.` : ""}`}</p>
            <div className="tw"><table className="t"><tbody>
              {checks.map((c) => <tr key={c.kind + c.name}><td style={{ color: c.ok ? "var(--ok)" : "var(--warn)", fontWeight: 700 }}>{c.ok ? "OK" : "MISSING"}</td><td>{c.kind}</td><td>{c.name}</td><td className="dim">{c.ok ? "" : MIGRATION[c.name] ? `needs migration ${MIGRATION[c.name]}` : "check your data"}</td></tr>)}
            </tbody></table></div>
          </>
        )}
        <button className="btn alt" style={{ marginTop: 10 }} onClick={() => void run()}>Check again</button>
      </div>
      <div>
        <h2 className="sec" style={{ marginTop: 8 }}>Sign-up</h2>
        {auth === null && <div className="skel" style={{ height: 60 }} />}
        {auth === "x" && <p className="dim">Could not read the sign-in settings from Supabase.</p>}
        {auth && auth !== "x" && (
          <div className="box hl-auth">
            <p className={auth.mailer_autoconfirm ? "ok" : "warn"}><b>{auth.mailer_autoconfirm ? "OK" : "ACTION NEEDED"}</b> Email sign-up {auth.mailer_autoconfirm ? "gives instant access (no confirmation email)." : "needs a confirmation email."}</p>
            {!auth.mailer_autoconfirm && <p className="dim">New players who sign up with email must click a link in an email before they can play. Supabase's built-in email sender only delivers to your own team's addresses (and only a few an hour), so most visitors never get the link. This is the main reason visitors don't finish signing up. Fix it in one of two ways (docs/UPDATE_GUIDE.md): <b>Supabase → Authentication → Sign In / Providers → Email → turn off “Confirm email”</b>, or set up your own email sender (Authentication → Emails → SMTP, for example with Resend).</p>}
            <p className={auth.external?.google ? "ok" : "warn"}><b>{auth.external?.google ? "OK" : "OFF"}</b> Google sign-in {auth.external?.google ? "is switched on." : "is off. Google is the fastest way to sign up; see docs/SOCIAL_LOGIN_GUIDE.md."}</p>
            <p className={auth.disable_signup ? "warn" : "ok"}><b>{auth.disable_signup ? "OFF" : "OK"}</b> New sign-ups are {auth.disable_signup ? "switched off in Supabase." : "allowed."}</p>
          </div>
        )}
        <h2 className="sec">Server functions</h2>
        <p className="dim" style={{ marginTop: 0 }}>Checks that each function is deployed. The checks are harmless, nothing is created or changed.</p>
        <button className="btn" onClick={() => void probeAll()}>Check server functions</button>
        <div className="tw" style={{ marginTop: 10 }}><table className="t"><tbody>
          {FUNCTIONS.map((f) => <tr key={f}><td>{f}</td><td style={{ fontWeight: 700, color: fns[f] === "ok" ? "var(--ok)" : fns[f] ? "var(--warn)" : "var(--mut)" }}>{fns[f] === "ok" ? "Deployed" : fns[f] === "missing" ? "NOT DEPLOYED: run npx supabase@latest functions deploy " + f + " --use-api" : fns[f] === "unreachable" ? "Could not reach it" : "–"}</td></tr>)}
        </tbody></table></div>
      </div>
    </div>
  );
}
