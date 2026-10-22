import { useCallback, useEffect, useState } from "react";
import { adminRpc, dt } from "../../lib/admin";
import Notice from "../../lib/Notice";
import { OP_LABEL } from "../../lib/time";

type Settings = {
  enabled: boolean; league_on: boolean; league_base: number; league_per_player: number; league_max: number; league_split: number[];
  crews_on: boolean; crews_base: number; crews_per_crew: number; crews_max: number; crews_split: number[];
  events_on: boolean; seasons_on: boolean; season_days: number; liveops_on: boolean; liveop_prizes: number[];
  notify_winners: boolean; notify_overtake: boolean; overtake_cooldown_h: number; last_run: string | null; last_result: unknown;
};
type Tpl = { id: string; name: string; descr: string; level: string; fee: number; attempts: number; schedule: "daily" | "weekly"; weekday: number | null; start_hour: number; duration_hours: number; bonus: number; bonus_per_player: number; bonus_max: number; split: number[]; active: boolean };
type LTpl = { id: string; kind: string; title: string; descr: string; mult: number; pct: number; weekday: number | null; start_hour: number; duration_hours: number; board: boolean; active: boolean };
type Auto = {
  settings: Settings; cron: boolean; templates: Tpl[]; liveop_templates: LTpl[];
  league: { players: number; prizes: number[] }; crews: { prizes: number[] };
  season: { name: string; starts_at: string; ends_at: string } | null;
  live_events: { name: string; ends_at: string; auto: boolean }[];
  next_liveops: { title: string; starts_at: string; ends_at: string; board: boolean }[];
  log: { action: string; detail: Record<string, unknown>; at: string }[];
};

const DAYS = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const list = (a: number[]) => a.join(", ");
const nums = (s: string) => s.split(/[,\s]+/).filter(Boolean).map((x) => Math.floor(Number(x)) || 0);
const localHour = (h: number) => { const d = new Date(); d.setUTCHours(h, 0, 0, 0); return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); };
const when = (t: { schedule?: string; weekday: number | null; start_hour: number; duration_hours: number }) =>
  `${t.weekday ? `Every ${DAYS[t.weekday]}` : "Every day"} at ${String(t.start_hour).padStart(2, "0")}:00 UTC (${localHour(t.start_hour)} your time) for ${t.duration_hours} h`;
const LOG: Record<string, string> = { error: "Problem", event_opened: "Event opened", event_paid: "Event finished and paid", league_paid: "League paid", crews_paid: "Crews paid", seasons: "Seasons", liveop_planned: "Boost planned", race_paid: "XP race paid", overtake_error: "Message problem" };
const logText = (l: Auto["log"][number]) => {
  const d = l.detail ?? {};
  if (l.action === "event_opened") return String(d.name ?? "");
  if (l.action === "event_paid") return `${d.event} · pool ${d.pool} · ${(d.winners as unknown[] | undefined)?.length ?? 0} winners`;
  if (l.action === "league_paid" || l.action === "crews_paid") return `week of ${d.week} · ${(d.winners as unknown[] | undefined)?.length ?? 0} winners`;
  if (l.action === "race_paid") return `${d.liveop} · ${(d.winners as unknown[] | undefined)?.length ?? 0} winners`;
  if (l.action === "liveop_planned") return `${d.title} · ${dt(String(d.starts_at))}`;
  return JSON.stringify(d).slice(0, 120);
};
const blankT = (): Tpl => ({ id: "", name: "", descr: "", level: "medium", fee: 20, attempts: 3, schedule: "daily", weekday: null, start_hour: 0, duration_hours: 24, bonus: 200, bonus_per_player: 10, bonus_max: 2000, split: [50, 30, 20], active: true });
const blankL = (): LTpl => ({ id: "", kind: "xp_boost", title: "", descr: "", mult: 2, pct: 25, weekday: null, start_hour: 18, duration_hours: 2, board: true, active: true });

function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return <label className="au-sw"><input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} /><span>{label}</span></label>;
}

export default function AutoAdmin() {
  const [a, setA] = useState<Auto | null>(null);
  const [s, setS] = useState<Settings | null>(null);
  const [splits, setSplits] = useState({ league: "", crews: "", race: "" });
  const [t, setT] = useState<Tpl | null>(null);
  const [lt, setLt] = useState<LTpl | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    adminRpc<Auto>("admin_auto").then((x) => {
      setA(x); setS(x.settings);
      setSplits({ league: list(x.settings.league_split), crews: list(x.settings.crews_split), race: list(x.settings.liveop_prizes) });
    }).catch((e: Error) => setMsg(e.message));
  }, []);
  useEffect(load, [load]);
  if (!a || !s) return msg ? <Notice text={msg} /> : <div className="skel" />;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v });
  const n = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => set(k, Math.max(0, Math.floor(Number(e.target.value) || 0)) as never);

  const save = async () => {
    setMsg(""); setBusy(true);
    try {
      await adminRpc("admin_save_auto", { p: { ...s, league_split: nums(splits.league), crews_split: nums(splits.crews), liveop_prizes: nums(splits.race) } });
      setMsg("Saved. The new rules apply from the next run (within 5 minutes)."); load();
    } catch (e) { setMsg((e as Error).message); }
    setBusy(false);
  };
  const run = async () => {
    setMsg(""); setBusy(true);
    try { const r = await adminRpc<unknown[]>("admin_run_auto"); setMsg(Array.isArray(r) && r.length ? `Done: ${r.length} thing${r.length > 1 ? "s" : ""} happened. See the activity list.` : "Done. Nothing was due right now."); load(); }
    catch (e) { setMsg((e as Error).message); }
    setBusy(false);
  };
  const saveT = async () => {
    if (!t) return; setMsg("");
    try { await adminRpc("admin_save_event_template", { p_id: t.id || null, p: { ...t } }); setMsg("Event schedule saved."); setT(null); load(); } catch (e) { setMsg((e as Error).message); }
  };
  const delT = async (id: string) => { try { await adminRpc("admin_delete_event_template", { p_id: id }); setT(null); load(); } catch (e) { setMsg((e as Error).message); } };
  const saveL = async () => {
    if (!lt) return; setMsg("");
    try { await adminRpc("admin_save_liveop_template", { p_id: lt.id || null, p: { ...lt, weekday: lt.weekday ?? "" } }); setMsg("Boost schedule saved. The next week is planned again on the next run."); setLt(null); load(); } catch (e) { setMsg((e as Error).message); }
  };
  const delL = async (id: string) => { try { await adminRpc("admin_delete_liveop_template", { p_id: id }); setLt(null); load(); } catch (e) { setMsg((e as Error).message); } };
  const last = s.last_run ? new Date(s.last_run) : null;
  const stale = !last || Date.now() - last.getTime() > 20 * 60e3;

  return (
    <div className="au">
      <Notice text={msg} />
      <section className={`au-status ${s.enabled ? (stale ? "warn" : "ok") : "off"}`}>
        <div>
          <b>{s.enabled ? "Automation is on" : "Automation is off"}</b>
          <span>{last ? `Last run ${dt(s.last_run)}` : "Has not run yet"} · {a.cron ? "runs every 5 minutes on the database" : "runs when players open the game (switch on pg_cron for exact timing)"}</span>
        </div>
        <div className="row2">
          <Switch on={s.enabled} label="On" onChange={(v) => set("enabled", v)} />
          <button className="btn alt sm" disabled={busy} onClick={() => void run()}>Run now</button>
        </div>
      </section>

      <div className="au-grid">
        <section className="box au-card">
          <div className="au-h"><h2>Weekly league</h2><Switch on={s.league_on} label="Pay automatically" onChange={(v) => set("league_on", v)} /></div>
          <p className="dim">Paid every Monday 00:05 UTC for the week before. Prize pool = base + coins per player, up to the maximum, shared by the split.</p>
          <div className="fgrid">
            <label>Base pool<input type="number" min={0} value={s.league_base} onChange={n("league_base")} /></label>
            <label>Coins per player<input type="number" min={0} value={s.league_per_player} onChange={n("league_per_player")} /></label>
            <label>Maximum pool<input type="number" min={0} value={s.league_max} onChange={n("league_max")} /></label>
            <label>Split in % (1st, 2nd…)<input value={splits.league} onChange={(e) => setSplits({ ...splits, league: e.target.value })} /></label>
          </div>
          <p className="au-now">This week so far: <b>{a.league.players}</b> players → prizes <b>{list(a.league.prizes)}</b> coins</p>
        </section>

        <section className="box au-card">
          <div className="au-h"><h2>Crews</h2><Switch on={s.crews_on} label="Pay automatically" onChange={(v) => set("crews_on", v)} /></div>
          <p className="dim">Paid every Monday for the week before, to every member of the top crews who earned 20+ XP. Prize per member = pool × split.</p>
          <div className="fgrid">
            <label>Base pool<input type="number" min={0} value={s.crews_base} onChange={n("crews_base")} /></label>
            <label>Coins per crew<input type="number" min={0} value={s.crews_per_crew} onChange={n("crews_per_crew")} /></label>
            <label>Maximum pool<input type="number" min={0} value={s.crews_max} onChange={n("crews_max")} /></label>
            <label>Split in %<input value={splits.crews} onChange={(e) => setSplits({ ...splits, crews: e.target.value })} /></label>
          </div>
          <p className="au-now">This week so far: prizes per member <b>{list(a.crews.prizes)}</b> coins</p>
        </section>

        <section className="box au-card">
          <div className="au-h"><h2>Seasons</h2><Switch on={s.seasons_on} label="Start automatically" onChange={(v) => set("seasons_on", v)} /></div>
          <p className="dim">When a season ends, the next one starts with the same rewards. Players with unclaimed tiers get a reminder.</p>
          <div className="fgrid"><label>Season length (days)<input type="number" min={7} max={90} value={s.season_days} onChange={n("season_days")} /></label></div>
          <p className="au-now">{a.season ? <>Now: <b>{a.season.name}</b> until {dt(a.season.ends_at)}</> : "No season running: the next run starts one."}</p>
        </section>

        <section className="box au-card">
          <div className="au-h"><h2>Messages</h2></div>
          <Switch on={s.notify_winners} label="Tell winners how much they won (inbox)" onChange={(v) => set("notify_winners", v)} />
          <Switch on={s.notify_overtake} label="Tell players when someone passes them (events, league, XP races)" onChange={(v) => set("notify_overtake", v)} />
          <div className="fgrid"><label>Hours between “passed you” messages per board<input type="number" min={0} max={72} value={s.overtake_cooldown_h} onChange={n("overtake_cooldown_h")} /></label></div>
          <p className="dim">Only players in the top 20 are told, at most 5 per round, so nobody gets flooded.</p>
        </section>
      </div>
      <button className="btn" disabled={busy} onClick={() => void save()}>Save automation settings</button>

      <div className="au-h" style={{ marginTop: 18 }}><h2 className="sec" style={{ margin: 0 }}>Events on a schedule</h2><Switch on={s.events_on} label="Open events automatically" onChange={(v) => set("events_on", v)} /></div>
      <p className="dim" style={{ margin: "4px 0 8px" }}>Each schedule opens an event by itself and finishes it on time. Prize pool = base + coins per player (up to the maximum) + entry fees after the house share. Events you create by hand in the Events tab are also finished and paid automatically.</p>
      <div className="au-list">
        {a.templates.map((x) => (
          <div className={`qcard au-item ${x.active ? "" : "off"}`} key={x.id}>
            <div className="qtop"><b>{x.name}</b><span className={`tag ${x.active ? "ok" : ""}`}>{x.active ? "On" : "Off"}</span></div>
            <p className="dim">{when(x)}<br />{x.level} · entry {x.fee} · {x.attempts} tries · pool {x.bonus} + {x.bonus_per_player}/player (max {x.bonus_max}) · split {list(x.split)}</p>
            <button className="btn alt sm" onClick={() => setT({ ...x })}>Edit</button>
          </div>
        ))}
        <button className="btn alt au-add" onClick={() => setT(blankT())}>+ Add an event schedule</button>
      </div>
      {t && (
        <div className="box au-form">
          <h2>{t.id ? `Edit “${t.name}”` : "New event schedule"}</h2>
          <div className="fgrid">
            <label>Name<input maxLength={60} value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} /></label>
            <label>Level<select value={t.level} onChange={(e) => setT({ ...t, level: e.target.value })}><option value="beginner">Beginner</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
            <label>Repeats<select value={t.schedule} onChange={(e) => setT({ ...t, schedule: e.target.value as Tpl["schedule"], weekday: e.target.value === "weekly" ? (t.weekday ?? 5) : null })}><option value="daily">Every day</option><option value="weekly">Every week</option></select></label>
            {t.schedule === "weekly" && <label>Day<select value={t.weekday ?? 5} onChange={(e) => setT({ ...t, weekday: Number(e.target.value) })}>{DAYS.slice(1).map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select></label>}
            <label>Starts at (UTC hour){" "}<input type="number" min={0} max={23} value={t.start_hour} onChange={(e) => setT({ ...t, start_hour: Number(e.target.value) })} /></label>
            <label>Lasts (hours)<input type="number" min={1} max={168} value={t.duration_hours} onChange={(e) => setT({ ...t, duration_hours: Number(e.target.value) })} /></label>
            <label>Entry fee<input type="number" min={0} max={1000} value={t.fee} onChange={(e) => setT({ ...t, fee: Number(e.target.value) })} /></label>
            <label>Tries per player<input type="number" min={1} max={20} value={t.attempts} onChange={(e) => setT({ ...t, attempts: Number(e.target.value) })} /></label>
            <label>Base pool<input type="number" min={0} value={t.bonus} onChange={(e) => setT({ ...t, bonus: Number(e.target.value) })} /></label>
            <label>Coins per player<input type="number" min={0} value={t.bonus_per_player} onChange={(e) => setT({ ...t, bonus_per_player: Number(e.target.value) })} /></label>
            <label>Maximum bonus<input type="number" min={0} value={t.bonus_max} onChange={(e) => setT({ ...t, bonus_max: Number(e.target.value) })} /></label>
            <label>Split in %<input value={list(t.split)} onChange={(e) => setT({ ...t, split: nums(e.target.value) })} /></label>
          </div>
          <label>Message for players<input maxLength={160} value={t.descr} onChange={(e) => setT({ ...t, descr: e.target.value })} /></label>
          <p className="dim">{when(t)}</p>
          <Switch on={t.active} label="On" onChange={(v) => setT({ ...t, active: v })} />
          <div className="row2"><button className="btn" onClick={() => void saveT()}>Save</button><button className="btn alt" onClick={() => setT(null)}>Cancel</button>{t.id && <button className="btn alt" onClick={() => void delT(t.id)}>Delete schedule</button>}</div>
        </div>
      )}

      <div className="au-h" style={{ marginTop: 18 }}><h2 className="sec" style={{ margin: 0 }}>Boosts on a schedule (live ops)</h2><Switch on={s.liveops_on} label="Plan boosts automatically" onChange={(v) => set("liveops_on", v)} /></div>
      <p className="dim" style={{ margin: "4px 0 8px" }}>The next 7 days are always planned from these. Boosts marked “XP race” also have a leaderboard; the top players win <b>{splits.race}</b> coins when it ends.</p>
      <div className="fgrid" style={{ maxWidth: 420 }}><label>XP race prizes (1st, 2nd, 3rd…)<input value={splits.race} onChange={(e) => setSplits({ ...splits, race: e.target.value })} /></label></div>
      <div className="au-list">
        {a.liveop_templates.map((x) => (
          <div className={`qcard au-item ${x.active ? "" : "off"}`} key={x.id}>
            <div className="qtop"><b>{x.title}</b><span className={`tag ${x.active ? "ok" : ""}`}>{x.active ? (x.board ? "On · XP race" : "On") : "Off"}</span></div>
            <p className="dim">{when(x)}<br />{OP_LABEL[x.kind] ?? x.kind}{x.kind === "fee_discount" ? ` · ${x.pct}% off` : x.kind !== "banner" ? ` · x${x.mult}` : ""}</p>
            <button className="btn alt sm" onClick={() => setLt({ ...x })}>Edit</button>
          </div>
        ))}
        <button className="btn alt au-add" onClick={() => setLt(blankL())}>+ Add a boost schedule</button>
      </div>
      {lt && (
        <div className="box au-form">
          <h2>{lt.id ? `Edit “${lt.title}”` : "New boost schedule"}</h2>
          <div className="fgrid">
            <label>Type<select value={lt.kind} onChange={(e) => setLt({ ...lt, kind: e.target.value })}>{Object.entries(OP_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label>Title<input maxLength={60} value={lt.title} onChange={(e) => setLt({ ...lt, title: e.target.value })} /></label>
            <label>Day<select value={lt.weekday ?? 0} onChange={(e) => setLt({ ...lt, weekday: Number(e.target.value) || null })}><option value={0}>Every day</option>{DAYS.slice(1).map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select></label>
            <label>Starts at (UTC hour)<input type="number" min={0} max={23} value={lt.start_hour} onChange={(e) => setLt({ ...lt, start_hour: Number(e.target.value) })} /></label>
            <label>Lasts (hours)<input type="number" min={1} max={168} value={lt.duration_hours} onChange={(e) => setLt({ ...lt, duration_hours: Number(e.target.value) })} /></label>
            {(lt.kind === "xp_boost" || lt.kind === "coin_boost") && <label>Multiplier (1.1 to 5)<input type="number" step="0.1" min={1.1} max={5} value={lt.mult} onChange={(e) => setLt({ ...lt, mult: Number(e.target.value) })} /></label>}
            {lt.kind === "fee_discount" && <label>Discount % (5 to 90)<input type="number" min={5} max={90} value={lt.pct} onChange={(e) => setLt({ ...lt, pct: Number(e.target.value) })} /></label>}
          </div>
          <label>Message for players<input maxLength={160} value={lt.descr} onChange={(e) => setLt({ ...lt, descr: e.target.value })} /></label>
          <p className="dim">{when(lt)}</p>
          {(lt.kind === "xp_boost" || lt.kind === "coin_boost") && <Switch on={lt.board} label="XP race with a leaderboard and prizes" onChange={(v) => setLt({ ...lt, board: v })} />}
          <Switch on={lt.active} label="On" onChange={(v) => setLt({ ...lt, active: v })} />
          <div className="row2"><button className="btn" onClick={() => void saveL()}>Save</button><button className="btn alt" onClick={() => setLt(null)}>Cancel</button>{lt.id && <button className="btn alt" onClick={() => void delL(lt.id)}>Delete schedule</button>}</div>
        </div>
      )}
      <button className="btn" disabled={busy} onClick={() => void save()} style={{ marginTop: 10 }}>Save automation settings</button>

      <div className="au-grid" style={{ marginTop: 18 }}>
        <section className="box au-card">
          <h2>Coming up</h2>
          <h3 className="au-sub">Live events</h3>
          {a.live_events.length === 0 ? <p className="dim">None right now.</p> : a.live_events.map((e) => <p className="au-row" key={e.name + e.ends_at}><span>{e.name}{e.auto ? <em className="tag">auto</em> : null}</span><span className="dim">ends {dt(e.ends_at)}</span></p>)}
          <h3 className="au-sub">Boosts</h3>
          {a.next_liveops.length === 0 ? <p className="dim">None planned.</p> : a.next_liveops.map((o) => <p className="au-row" key={o.title + o.starts_at}><span>{o.title}{o.board ? <em className="tag">race</em> : null}</span><span className="dim">{dt(o.starts_at)}</span></p>)}
        </section>
        <section className="box au-card">
          <h2>Activity</h2>
          {a.log.length === 0 ? <p className="dim">Nothing yet. Press “Run now” to start.</p> : (
            <div className="au-log">{a.log.map((l, i) => <p className="au-row" key={i}><span><b>{LOG[l.action] ?? l.action}</b> {logText(l)}</span><span className="dim">{dt(l.at)}</span></p>)}</div>
          )}
        </section>
      </div>
    </div>
  );
}
