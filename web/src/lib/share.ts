/** Sharing goes to exactly three places: WhatsApp, Telegram and Facebook. */
export type Target = "whatsapp" | "telegram" | "facebook";
export const TARGETS: { id: Target; name: string }[] = [
  { id: "whatsapp", name: "WhatsApp" },
  { id: "telegram", name: "Telegram" },
  { id: "facebook", name: "Facebook" },
];

export function shareUrl(t: Target, text: string, link: string): string {
  const u = encodeURIComponent(link);
  const tx = encodeURIComponent(text);
  if (t === "whatsapp") return `https://wa.me/?text=${encodeURIComponent(`${text} ${link}`)}`;
  if (t === "telegram") return `https://t.me/share/url?url=${u}&text=${tx}`;
  return `https://www.facebook.com/sharer/sharer.php?u=${u}&quote=${tx}`;
}

export const openShare = (t: Target, text: string, link: string) => { window.open(shareUrl(t, text, link), "_blank", "noopener,noreferrer"); };
