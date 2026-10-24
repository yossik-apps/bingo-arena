import { useEffect } from "react";
import Auth from "./Auth";

/** The pop-up that asks a visitor to register or log in, with a reason that matches what they tried to do. */
export default function AuthGate({ reason, mode, welcome, guest, onSaved, onClose }: { reason: string; mode: "reg" | "log"; welcome?: number; guest?: boolean; onSaved?: () => void; onClose: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="auth-title" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="tour-card authmodal">
        <div className="tour-top">
          <span className="dim">{guest ? "Free · keeps everything you earned" : "Free · takes 20 seconds"}</span>
          <button className="btn alt" style={{ minHeight: 40, padding: "6px 14px" }} onClick={onClose}>Not now</button>
        </div>
        <Auth reason={reason} startMode={mode} welcome={welcome} guest={guest} onSaved={onSaved} />
      </div>
    </div>
  );
}
