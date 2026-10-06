/** Draws a square result card and shares it (phone share sheet) or saves it as a picture. */
export async function shareCard(o: { title: string; line: string; stars?: number; name: string }): Promise<"shared" | "downloaded" | "cancelled"> {
  const c = document.createElement("canvas");
  c.width = c.height = 1080;
  const x = c.getContext("2d")!;
  const g = x.createLinearGradient(0, 0, 1080, 1080);
  g.addColorStop(0, "#4c1d95"); g.addColorStop(1, "#be185d");
  x.fillStyle = g; x.fillRect(0, 0, 1080, 1080);
  x.fillStyle = "rgba(255,255,255,.08)";
  for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(160 + i * 170, 920 - (i % 2) * 60, 90, 0, 7); x.fill(); }
  x.fillStyle = "#fff"; x.textAlign = "center";
  x.font = "700 44px Quicksand, system-ui, sans-serif"; x.fillText("BINGO ARENA", 540, 150);
  x.font = "700 78px Quicksand, system-ui, sans-serif"; x.fillText(o.title, 540, 400, 960);
  x.font = "700 170px Quicksand, system-ui, sans-serif"; x.fillStyle = "#fbbf24"; x.fillText(o.line, 540, 620, 960);
  if (o.stars !== undefined) {
    for (let i = 0; i < 3; i++) {
      const cx = 400 + i * 140, cy = 740;
      x.beginPath();
      for (let k = 0; k < 10; k++) { const r = k % 2 ? 26 : 62, a = (Math.PI / 5) * k - Math.PI / 2; x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
      x.closePath(); x.fillStyle = i < o.stars ? "#fbbf24" : "rgba(255,255,255,.25)"; x.fill();
    }
  }
  x.fillStyle = "#fff"; x.font = "600 46px Quicksand, system-ui, sans-serif"; x.fillText(o.name, 540, 900);
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
  if (!blob) return "cancelled";
  const file = new File([blob], "bingo-arena.png", { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "Bingo Arena", text: `${o.title}: ${o.line}` }); return "shared"; } catch { return "cancelled"; }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "bingo-arena-result.png"; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return "downloaded";
}

export async function shareLink(url: string, text: string): Promise<"shared" | "copied" | "failed" | "cancelled"> {
  if (navigator.share) { try { await navigator.share({ title: "Bingo Arena", text, url }); return "shared"; } catch { return "cancelled"; } }
  try { await navigator.clipboard.writeText(url); return "copied"; } catch { return "failed"; }
}
