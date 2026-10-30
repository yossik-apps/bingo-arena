import { useEffect, useState, type CSSProperties } from "react";
import { Icon } from "./Icon";
import { fx, sampleVoice, sfx, speak, voiceList } from "./sound";

/** Redraws whenever the sound settings change (here or on another screen). */
const useFx = () => {
  const [, redraw] = useState(0);
  useEffect(() => fx.subscribe(() => redraw((n) => n + 1)), []);
};

const iconFor = () => (fx.muted ? "speakerOff" : fx.volume < 0.45 ? "speakerLow" : "speaker") as "speaker" | "speakerLow" | "speakerOff";

/** The volume slider with a mute button on its left. Used in the round and in Profile. */
export function VolumeRow({ light }: { light?: boolean }) {
  useFx();
  const ink = light ? "#14254F" : "#fff";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <button aria-label={fx.muted ? "Turn sound on" : "Mute"} aria-pressed={fx.muted} onClick={() => fx.set({ sound: !fx.sound, volume: fx.volume <= 0.01 ? 0.7 : fx.volume })}
        style={{ width: 44, height: 44, border: 0, borderRadius: 14, background: fx.muted ? "#FFC531" : light ? "#E9EEFA" : "#123E91", color: fx.muted ? "#3A2300" : ink, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon name={iconFor()} size={22} sw={2.6} />
      </button>
      <input type="range" min={0} max={100} step={5} value={fx.sound ? Math.round(fx.volume * 100) : 0} aria-label="Volume"
        onChange={(e: { target: { value: string } }) => fx.set({ sound: true, volume: Number(e.target.value) / 100 })}
        onPointerUp={() => sfx("good")}
        style={{ flex: 1, minWidth: 0, accentColor: "#FFC531", height: 44, margin: 0 } as CSSProperties} />
      <span aria-hidden="true" style={{ width: 34, textAlign: "right", fontSize: 14, fontWeight: 900, color: ink }}>{fx.sound ? Math.round(fx.volume * 100) : 0}</span>
    </div>
  );
}

/** A switch row: "Voice calls the numbers". */
export function VoiceSwitch({ light }: { light?: boolean }) {
  useFx();
  const on = fx.voice;
  return (
    <button role="switch" aria-checked={on} onClick={() => { fx.set({ voice: !on }); if (!on) speak("B", 12); }}
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, minHeight: 44, border: 0, background: "transparent", padding: 0, font: "inherit", color: light ? "#14254F" : "#fff", width: "100%", textAlign: "left" }}>
      <span style={{ fontSize: 15, fontWeight: 900 }}>Voice calls the numbers</span>
      <span aria-hidden="true" style={{ width: 52, height: 30, borderRadius: 99, background: on ? "#2EB872" : "#B9C4DD", position: "relative", flexShrink: 0 }}>
        <span style={{ position: "absolute", top: 3, left: on ? 25 : 3, width: 24, height: 24, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
      </span>
    </button>
  );
}

/** Choose which voice reads the numbers. "Best on this device" picks the most natural one. */
export function VoicePick({ light }: { light?: boolean }) {
  useFx();
  const list = voiceList();
  if (!fx.voice || list.length < 2) return null;
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 40, fontSize: 13, fontWeight: 800, color: light ? "#4A5A85" : "#DCE7FF" }}>
      <span style={{ flexShrink: 0 }}>Voice</span>
      <select value={fx.voiceName} aria-label="Voice"
        onChange={(e: { target: { value: string } }) => { fx.set({ voiceName: e.target.value }); setTimeout(sampleVoice, 50); }}
        style={{ flex: 1, minWidth: 0, height: 36, borderRadius: 10, border: "2px solid #DCE4F5", background: "#fff", color: "#14254F", fontSize: 13, fontWeight: 800, fontFamily: "inherit", padding: "0 6px" } as CSSProperties}>
        <option value="">Best on this device</option>
        {list.map((v) => <option key={v.name} value={v.name}>{v.name.replace(/^(Microsoft|Google)\s+/i, "").replace(/\s*\(.*?\)/g, "")}</option>)}
      </select>
    </label>
  );
}

/** The speaker icon in the round. Tap it for the volume slider, mute and the voice switch. The round keeps running. */
export function SoundButton() {
  useFx();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const k = (e: { key: string }) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);
  return (
    <>
      <button aria-label={fx.muted ? "Sound is off. Open sound settings" : "Sound settings"} aria-expanded={open} onClick={() => setOpen(!open)}
        style={{ width: 52, height: 52, flexShrink: 0, border: 0, borderRadius: 16, background: fx.muted ? "#FFC531" : "#fff", boxShadow: fx.muted ? "0 4px 0 #D98E00" : "0 4px 0 #0E3E9C", display: "flex", alignItems: "center", justifyContent: "center", color: fx.muted ? "#3A2300" : "#14254F" }}>
        <Icon name={iconFor()} size={24} sw={2.6} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "absolute", inset: 0, zIndex: 30 }} />
          <div role="dialog" aria-label="Sound" className="e-white e-rise" style={{ position: "absolute", zIndex: 31, top: 76, right: 16, width: 290, padding: "10px 14px 8px", display: "flex", flexDirection: "column", gap: 2, boxShadow: "0 8px 0 rgba(11,44,110,.55)" }}>
            <VolumeRow light />
            <VoiceSwitch light />
            <VoicePick light />
          </div>
        </>
      )}
    </>
  );
}
