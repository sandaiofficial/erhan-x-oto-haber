import { sources } from "./sources.js";
import { discoverSource, fetchArticle } from "./news.js";
import { normalizedTextKey, summarizeArticle } from "./summarizer.js";
import { loadState, saveState } from "./state.js";
import { publishPost } from "./x-client.js";

const maxPosts = Math.max(1, Number(process.env.MAX_POSTS_PER_RUN || 2));
const includeLink = String(process.env.INCLUDE_SOURCE_LINK || "false").toLowerCase() === "true";
const selectedNames = new Set(
  String(process.env.SOURCE_NAMES || "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean)
);
const activeSources = selectedNames.size
  ? sources.filter(source => selectedNames.has(source.name))
  : sources;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function sortNewestFirst(a, b) {
  const aTime = Date.parse(a.publishedAt || "") || 0;
  const bTime = Date.parse(b.publishedAt || "") || 0;
  return bTime - aTime;
}

async function discoverAll() {
  const results = await Promise.allSettled(activeSources.map(discoverSource));
  const candidates = [];

  results.forEach((result, index) => {
    const source = activeSources[index];
    if (result.status === "fulfilled") {
      console.log(`${source.name}: ${result.value.length} aday bağlantı bulundu.`);
      candidates.push(...result.value);
    } else {
      console.error(`${source.name}: ${result.reason?.message || result.reason}`);
    }
  });

  return [...new Map(candidates.map(item => [item.link, item])).values()];
}

async function main() {
  if (!activeSources.length) throw new Error("Taranacak haber kaynağı bulunamadı.");

  const state = await loadState();
  const seenUrls = new Set(state.seenUrls);
  const seenTexts = new Set(state.seenTexts);
  const candidates = await discoverAll();

  if (!state.initialized) {
    candidates.forEach(item => seenUrls.add(item.link));
    await saveState({ initialized: true, seenUrls: [...seenUrls], seenTexts: [...seenTexts] });
    console.log(`İlk tarama tamamlandı. ${candidates.length} mevcut bağlantı kaydedildi; eski haberler paylaşılmadı.`);
    return;
  }

  const freshCandidates = candidates.filter(item => !seenUrls.has(item.link));
  const articles = [];

  for (const candidate of freshCandidates.slice(0, 20)) {
    try {
      const article = await fetchArticle(candidate);
      if (article) articles.push(article);
    } catch (error) {
      console.error(`${candidate.source} makale okunamadı: ${error.message}`);
    }
    await sleep(500);
  }

  let published = 0;
  for (const article of articles.sort(sortNewestFirst)) {
    if (published >= maxPosts) break;

    const text = summarizeArticle(article, { includeLink });
    const textKey = normalizedTextKey(text);

    if (!textKey || seenTexts.has(textKey)) {
      seenUrls.add(article.link);
      continue;
    }

    try {
      const result = await publishPost(text);
      console.log(`Paylaşım hazırlandı: ${result.id}`);
      seenUrls.add(article.link);
      seenTexts.add(textKey);
      published += 1;
      await saveState({ initialized: true, seenUrls: [...seenUrls], seenTexts: [...seenTexts] });
      await sleep(1500);
    } catch (error) {
      console.error(`X paylaşım hatası: ${error.message}`);
    }
  }

  for (const candidate of freshCandidates) seenUrls.add(candidate.link);
  await saveState({ initialized: true, seenUrls: [...seenUrls], seenTexts: [...seenTexts] });
  console.log(`${new Date().toISOString()} — ${published} yeni haber işlendi.`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
