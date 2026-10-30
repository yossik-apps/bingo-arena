import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { fx, sampleVoice, sfx, speak, voiceList } from "./sound";

/** Redraws whenever the sound settings change (here or on another screen). */
const useFx = () => {
  const [, redraw] = useState(0);
  useEffect(() => fx.subscribe(() => redraw((n) => n + 1)), []);
};

const iconFor = () => (fx.muted ? "speakerOff" : fx.volume < 0.45 ? "speakerLow" : "speaker") as "speaker" | "speakerLow" | "speakerOff";

/** The speaker button in the shell: volume, mute, and the voice that reads the numbers. */
export default function SoundControl() {
  useFx();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);
  const level = fx.sound ? Math.round(fx.volume * 100) : 0;
  const voices = voiceList();
  return (
    <div className="nu-popwrap">
      <button className="nu-icon" aria-label={fx.muted ? "Sound is off. Open sound settings" : "Sound settings"} aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name={iconFor()} size={22} />
      </button>
      {open && (
        <>
          <button className="nu-popback" aria-label="Close sound settings" onClick={() => setOpen(false)} />
          <div className="nu-pop" role="dialog" aria-label="Sound">
            <div className="nu-slider">
              <button className="nu-mute" aria-label={fx.muted ? "Turn sound on" : "Mute"} aria-pressed={fx.muted} onClick={() => fx.set({ sound: !fx.sound, volume: fx.volume <= 0.01 ? 0.7 : fx.volume })}>
                <Icon name={iconFor()} size={22} />
              </button>
              <input type="range" min={0} max={100} step={5} value={level} aria-label="Volume"
                onChange={(e) => fx.set({ sound: true, volume: Number(e.target.value) / 100 })} onPointerUp={() => sfx("good")} />
              <output aria-hidden="true">{level}</output>
            </div>
            <button className="nu-switch" role="switch" aria-checked={fx.voice} onClick={() => { const on = !fx.voice; fx.set({ voice: on }); if (on) speak("B", 12); }}>
              <span>Voice calls the numbers</span><i aria-hidden="true" />
            </button>
            {fx.voice && voices.length > 1 && (
              <label className="nu-voice">
                <span>Voice</span>
                <select value={fx.voiceName} onChange={(e) => { fx.set({ voiceName: e.target.value }); setTimeout(sampleVoice, 50); }}>
                  <option value="">Best on this device</option>
                  {voices.map((v) => <option key={v.name} value={v.name}>{v.name.replace(/^(Microsoft|Google)\s+/i, "").replace(/\s*\(.*?\)/g, "")}</option>)}
                </select>
              </label>
            )}
          </div>
        </>
      )}
    </div>
  );
}
