import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
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
  contact_support: "009", reply_support: "009", admin_reply: "009", admin_send_message: "009", wave_hello: "009", inbox_summary: "009", new_players: "009", settle_drill_tx: "011", grant_purchase: "012", buy_test: "012", my_economy: "012", club_claim: "012", gem_spend: "012", admin_store: "012", support_threads: "009", support_messages: "009", notifications: "009",
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
        <h2 className="sec" style={{ marginTop: 8 }}>Server functions</h2>
        <p className="dim" style={{ marginTop: 0 }}>Checks that each function is deployed. The checks are harmless, nothing is created or changed.</p>
        <button className="btn" onClick={() => void probeAll()}>Check server functions</button>
        <div className="tw" style={{ marginTop: 10 }}><table className="t"><tbody>
          {FUNCTIONS.map((f) => <tr key={f}><td>{f}</td><td style={{ fontWeight: 700, color: fns[f] === "ok" ? "var(--ok)" : fns[f] ? "var(--warn)" : "var(--mut)" }}>{fns[f] === "ok" ? "Deployed" : fns[f] === "missing" ? "NOT DEPLOYED: run npx supabase@latest functions deploy " + f + " --use-api" : fns[f] === "unreachable" ? "Could not reach it" : "–"}</td></tr>)}
        </tbody></table></div>
      </div>
    </div>
  );
}
