import { useEffect, useRef } from "react";

/** A message that scrolls into view, so a result is never missed when the button is far from the top. */
export default function Notice({ text, error }: { text: string; error?: boolean }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (text) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [text]);
  if (!text) return null;
  return <p ref={ref} className="toast" role={error ? "alert" : "status"}>{text}</p>;
}
