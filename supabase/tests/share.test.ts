import test from "node:test";
import assert from "node:assert/strict";
import { TARGETS, shareUrl } from "../../web/src/lib/share.ts";

test("sharing offers exactly WhatsApp, Telegram and Facebook", () => {
  assert.deepEqual(TARGETS.map((t) => t.id), ["whatsapp", "telegram", "facebook"]);
});
test("share links are correctly encoded", () => {
  const link = "https://game.example/?c=abc12345", text = "I scored 340 & won!";
  const wa = shareUrl("whatsapp", text, link), tg = shareUrl("telegram", text, link), fb = shareUrl("facebook", text, link);
  assert.ok(wa.startsWith("https://wa.me/?text=")); assert.ok(decodeURIComponent(wa).includes(text) && decodeURIComponent(wa).includes(link));
  assert.ok(tg.startsWith("https://t.me/share/url?")); assert.ok(tg.includes(encodeURIComponent(link)) && tg.includes(encodeURIComponent(text)));
  assert.ok(fb.startsWith("https://www.facebook.com/sharer/sharer.php?u=")); assert.ok(fb.includes(encodeURIComponent(link)));
  for (const u of [wa, tg, fb]) assert.ok(!u.includes(" ") && !u.includes("&won"), "no raw spaces or unescaped ampersands from the text");
});
