export const Ic = ({ n, c = "" }: { n: string; c?: string }) => (
  <svg className={`ic ${c}`} aria-hidden="true"><use href={`#i-${n}`} /></svg>
);
export const Coins = ({ n }: { n: number }) => (
  <span className="cn"><Ic n="coin" c="coin" />{n}</span>
);
export const L = "BINGO";
export const label = (n: number) => L[Math.floor((n - 1) / 15)] + n;
