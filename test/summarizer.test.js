import test from "node:test";
import assert from "node:assert/strict";
import { summarizeArticle } from "../src/summarizer.js";

test("normal haberi kısa ve tek cümle biçiminde hazırlar", () => {
  const text = summarizeArticle({
    title: "Cumhurbaşkanı Erdoğan gençlerle buluştu",
    description: "Cumhurbaşkanı Erdoğan, gençlerle bir araya gelerek yürütülen projeler ve gelecek hedefleri hakkında konuştu.",
    link: "https://example.com/haber"
  });

  assert.equal(text, "Cumhurbaşkanı Erdoğan, gençlerle bir araya gelerek yürütülen projeler ve gelecek hedefleri hakkında konuştu.");
});

test("son dakika başlığına etiket ekler", () => {
  const text = summarizeArticle({
    title: "Son dakika: İstanbul'da bazı yollar trafiğe kapatıldı",
    description: "İstanbul'da etkili olan sağanak nedeniyle bazı yollar geçici olarak trafiğe kapatıldı.",
    link: "https://example.com/son-dakika"
  });

  assert.equal(text, "#SONDAKİKA | İstanbul'da etkili olan sağanak nedeniyle bazı yollar geçici olarak trafiğe kapatıldı.");
});
