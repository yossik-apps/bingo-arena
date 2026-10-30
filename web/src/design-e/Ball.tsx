import type { CSSProperties, ReactNode } from "react";

export type Tone = "B" | "I" | "N" | "G" | "O" | "P" | "X";

/** The ball color for a called number: 1-15 B, 16-30 I, 31-45 N, 46-60 G, 61-75 O. */
export const toneOf = (n: number): Tone => "BINGO"[Math.floor((n - 1) / 15)] as Tone;
export const letterOf = (n: number) => "BINGO"[Math.floor((n - 1) / 15)];

type BallProps = {
  tone: Tone;
  size?: number;
  /** "ln" letter and number, "n" number only, "l" letter only (card header), or pass children for a custom label */
  mode?: "ln" | "n" | "l";
  num?: number | string;
  letter?: string;
  rot?: number;
  style?: CSSProperties;
  className?: string;
  /** spoken label; leave out for decorative balls */
  label?: string;
  children?: ReactNode;
};

const sizeVar = (size: number, style?: CSSProperties) => ({ ["--s" as string]: `${size}px`, ...style }) as CSSProperties;

/** A glossy bingo ball. The recipe is plain CSS layers (see e.css), so it can be rebuilt natively. */
export function Ball({ tone, size = 52, mode = "ln", num, letter, rot = 0, style, className = "", label, children }: BallProps) {
  const l = letter ?? (typeof num === "number" ? letterOf(num) : "");
  const inner = children ?? (mode === "ln" ? (<><i>{l}</i><b>{num}</b></>) : mode === "n" ? <b>{num}</b> : <b>{l}</b>);
  return (
    <span className={`e-ball e-b${tone}${mode === "l" ? " e-hd" : ""} ${className}`} style={sizeVar(size, style)}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}>
      <span className="e-lb" style={rot ? { transform: `rotate(${rot}deg)` } : undefined}>{inner}</span>
    </span>
  );
}

/** A called number as a ball. */
export const NumberBall = ({ n, size, style, className }: { n: number; size?: number; style?: CSSProperties; className?: string }) => (
  <Ball tone={toneOf(n)} num={n} size={size} style={style} className={className} label={`${letterOf(n)}${n}`} />
);

export const Bulbs = ({ n }: { n: number }) => (
  <span className="e-bulbs" aria-hidden="true">{Array.from({ length: n }, (_, i) => <i key={i} style={{ ["--i" as string]: i }} />)}</span>
);
