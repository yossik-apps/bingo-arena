export type Settings = { pulse: number; limit: number }; // minutes between break reminders (0 = off), daily play limit in minutes (0 = off)
const KEY = "ba_settings";
export const loadSettings = (): Settings => {
  try { return { pulse: 45, limit: 0, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { return { pulse: 45, limit: 0 }; }
};
export const saveSettings = (s: Settings) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } };
const dayKey = () => "ba_time_" + new Date().toISOString().slice(0, 10);
export const minutesToday = () => { try { return Number(localStorage.getItem(dayKey()) ?? 0); } catch { return 0; } };
export const addMinute = () => { try { const v = minutesToday() + 1; localStorage.setItem(dayKey(), String(v)); return v; } catch { return 0; } };
