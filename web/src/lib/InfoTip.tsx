import { useState } from "react";

/** A small "?" that explains a term in plain words, right where the player sees it. */
export default function InfoTip({ text, label }: { text: string; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="tip">
      <button className="tipbtn" type="button" aria-label={`What is ${label}?`} aria-expanded={open} onClick={() => setOpen(!open)}>?</button>
      {open && <span className="tipbox" role="note">{text}</span>}
    </span>
  );
}
