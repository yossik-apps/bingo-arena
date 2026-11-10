// How a score is written for players. Balance v2 rounds can end below zero (wrong taps are no longer stopped at 0),
// so a negative score gets a true minus sign. Display only: the server decides every score.
export const scoreText = (n: number) => (n < 0 ? `−${Math.abs(n)}` : String(n));
