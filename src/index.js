import { sources } from "./sources.js";
import { discoverSource, fetchArticle } from "./news.js";
import {
  articleDuplicateKey,
  isSimilarNewsKey,
  normalizedTextKey,
  summarizeArticle
} from "./summarizer.js";
import { loadState, saveState } from "./state.js";
import { publishPost } from "./x-client.js";

const requestedMaxPosts = Number(
  process.env.MAX_POSTS_PER_RUN || 1
);

const maxPosts = Number.isFinite(requestedMaxPosts)
  ? Math.min(Math.max(1, Math.floor(requestedMaxPosts)), 3)
  : 1;

const includeLink =
  String(process.env.INCLUDE_SOURCE_LINK || "false")
    .toLowerCase() === "true";

const selectedNames = new Set(
  String(process.env.SOURCE_NAMES || "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean)
);

const activeSources = selectedNames.size
  ? sources.filter(source => selectedNames.has(source.name))
  : sources;

const sleep = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

function sortNewestFirst(a, b) {
  const aTime = Date.parse(a.publishedAt || "") || 0;
  const bTime = Date.parse(b.publishedAt || "") || 0;

  return bTime - aTime;
}

function getStoredNewsKeys(seenTexts) {
  return [...seenTexts]
    .filter(value => value.startsWith("news:"))
    .map(value => value.slice(5))
    .filter(Boolean);
}

function hasSimilarNews(newsKey, knownNewsKeys) {
  if (!newsKey) return true;

  return knownNewsKeys.some(existingKey =>
    isSimilarNewsKey(newsKey, existingKey)
  );
}

async function discoverAll() {
  const results = await Promise.allSettled(
    activeSources.map(discoverSource)
  );

  const candidates = [];

  results.forEach((result, index) => {
    const source = activeSources[index];

    if (result.status === "fulfilled") {
      console.log(
        `${source.name}: ${result.value.length} aday bağlantı bulundu.`
      );

      candidates.push(...result.value);
    } else {
      console.error(
        `${source.name}: ${result.reason?.message || result.reason}`
      );
    }
  });

  return [
    ...new Map(
      candidates.map(item => [item.link, item])
    ).values()
  ];
}

async function main() {
  if (!activeSources.length) {
    throw new Error("Taranacak haber kaynağı bulunamadı.");
  }

  const state = await loadState();
  const seenUrls = new Set(state.seenUrls);
  const seenTexts = new Set(state.seenTexts);
  const knownNewsKeys = getStoredNewsKeys(seenTexts);

  const candidates = await discoverAll();

  if (!state.initialized) {
    candidates.forEach(item => seenUrls.add(item.link));

    await saveState({
      initialized: true,
      seenUrls: [...seenUrls],
      seenTexts: [...seenTexts]
    });

    console.log(
      `İlk tarama tamamlandı. ${candidates.length} mevcut bağlantı kaydedildi; eski haberler paylaşılmadı.`
    );

    return;
  }

  const freshCandidates = candidates.filter(
    item => !seenUrls.has(item.link)
  );

  const articles = [];

  for (const candidate of freshCandidates.slice(0, 20)) {
    try {
      const article = await fetchArticle(candidate);

      if (article) {
        articles.push(article);
      }
    } catch (error) {
      console.error(
        `${candidate.source} makale okunamadı: ${error.message}`
      );
    }

    await sleep(500);
  }

  let published = 0;

  for (const article of articles.sort(sortNewestFirst)) {
    if (published >= maxPosts) break;

    const newsKey = articleDuplicateKey(article);

    if (!newsKey) {
      console.log(
        `Geçersiz haber başlığı atlandı: ${article.title}`
      );

      seenUrls.add(article.link);
      continue;
    }

    if (hasSimilarNews(newsKey, knownNewsKeys)) {
      console.log(
        `Benzer haber atlandı: ${article.title}`
      );

      seenUrls.add(article.link);
      continue;
    }

    const text = summarizeArticle(article, {
      includeLink
    });

    if (!text) {
      console.log(
        `Bozuk veya eksik haber metni atlandı: ${article.title}`
      );

      seenUrls.add(article.link);
      continue;
    }

    const textKey = normalizedTextKey(text);

    if (!textKey) {
      seenUrls.add(article.link);
      continue;
    }

    if (seenTexts.has(textKey)) {
      console.log(
        `Daha önce paylaşılmış metin atlandı: ${article.title}`
      );

      seenUrls.add(article.link);
      seenTexts.add(`news:${newsKey}`);
      knownNewsKeys.push(newsKey);
      continue;
    }

    try {
      const result = await publishPost(text);

      console.log(`Paylaşım hazırlandı: ${result.id}`);

      seenUrls.add(article.link);
      seenTexts.add(textKey);
      seenTexts.add(`news:${newsKey}`);
      knownNewsKeys.push(newsKey);

      published += 1;

      await saveState({
        initialized: true,
        seenUrls: [...seenUrls],
        seenTexts: [...seenTexts]
      });

      await sleep(1500);
    } catch (error) {
      console.error(
        `X paylaşım hatası: ${error.message}`
      );
    }
  }

  for (const candidate of freshCandidates) {
    seenUrls.add(candidate.link);
  }

  await saveState({
    initialized: true,
    seenUrls: [...seenUrls],
    seenTexts: [...seenTexts]
  });

  console.log(
    `${new Date().toISOString()} — ${published} yeni haber işlendi.`
  );
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
