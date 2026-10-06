import { authed, handler, json } from "../_shared/http.ts";
import { ensureDaily } from "../_shared/daily.ts";

// Today's Daily Challenge for the lobby: rules, goals and whether you already played it.
Deno.serve(handler(async (req) => {
  const { user, db } = await authed(req);
  const { data: cfgRow } = await db.from("game_config").select("data").eq("id", 1).single();
  const b = await ensureDaily(db, cfgRow!.data);
  const { data: mine } = await db.from("rounds").select("status,score").eq("user_id", user.id).eq("daily_day", b.day).maybeSingle();
  const { data: prof } = await db.from("profiles").select("daily_done,shields").eq("id", user.id).single();
  let rank: number | null = null;
  if (mine?.status === "scored") {
    const { count } = await db.from("rounds").select("id", { count: "exact", head: true }).eq("mode", "daily").eq("daily_day", b.day).eq("status", "scored").gt("score", mine.score);
    rank = (count ?? 0) + 1;
  }
  return json({
    day: b.day, level: b.level, label: b.mods?.label ?? "", goals: [b.g1, b.g2, b.g3],
    played: mine ? { status: mine.status, score: mine.score } : null, rank,
    done: prof?.daily_done ?? 0, shields: prof?.shields ?? 0,
  });
}));
