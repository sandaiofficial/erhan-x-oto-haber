import * as cheerio from "cheerio";

const EXCLUDED_PATH = /\/(arama|search|etiket|tag|kategori|category|yazar|author|foto-galeri|galeri|video|canli|live|programlar|hava-durumu|namaz-vakitleri)(\/|$)/i;
const TRACKING_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid"];

export function cleanText(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalUrl(value) {
  try {
    const url = new URL(value);
    TRACKING_PARAMS.forEach(param => url.searchParams.delete(param));
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

async function requestHtml(url) {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; ErhanNewsBot/1.0; +https://github.com/sandaiofficial/erhan-x-oto-haber)",
      accept: "text/html,application/xhtml+xml"
    }
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.text();
}

function isCandidateUrl(url, source) {
  if (!source.hosts.includes(url.hostname)) return false;
  if (EXCLUDED_PATH.test(url.pathname)) return false;
  if (/\.(jpg|jpeg|png|gif|webp|svg|pdf|mp4|mp3)$/i.test(url.pathname)) return false;

  const meaningfulParts = url.pathname.split("/").filter(Boolean);
  return meaningfulParts.length >= 2 && url.pathname.length >= 12;
}

export async function discoverSource(source) {
  const html = await requestHtml(source.home);
  const $ = cheerio.load(html);
  const found = new Map();

  $("a[href]").each((_, element) => {
    const rawHref = $(element).attr("href");
    const anchorText = cleanText(
      $(element).attr("title") ||
      $(element).attr("aria-label") ||
      $(element).find("h1,h2,h3,h4").first().text() ||
      $(element).text()
    );

    if (anchorText.length < 25 || anchorText.length > 240) return;

    try {
      const url = new URL(rawHref, source.home);
      if (!isCandidateUrl(url, source)) return;
      const link = canonicalUrl(url.href);
      if (!link || found.has(link)) return;
      found.set(link, { source: source.name, link, anchorTitle: anchorText });
    } catch {
      // Geçersiz bağlantılar atlanır.
    }
  });

  return [...found.values()].slice(0, 40);
}

function parseJsonLd($) {
  const values = [];

  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const parsed = JSON.parse($(element).text());
      const entries = Array.isArray(parsed) ? parsed : [parsed];

      for (const entry of entries) {
        if (Array.isArray(entry?.["@graph"])) values.push(...entry["@graph"]);
        else values.push(entry);
      }
    } catch {
      // Hatalı JSON-LD blokları atlanır.
    }
  });

  return values;
}

function findNewsJsonLd(entries) {
  return entries.find(entry => {
    const types = Array.isArray(entry?.["@type"]) ? entry["@type"] : [entry?.["@type"]];
    return types.some(type => /NewsArticle|Article|Reportage/i.test(String(type || "")));
  });
}

export async function fetchArticle(candidate) {
  const html = await requestHtml(candidate.link);
  const $ = cheerio.load(html);
  const newsJson = findNewsJsonLd(parseJsonLd($));

  const title = cleanText(
    newsJson?.headline ||
    $('meta[property="og:title"]').attr("content") ||
    $('meta[name="twitter:title"]').attr("content") ||
    $("h1").first().text() ||
    candidate.anchorTitle
  );

  const description = cleanText(
    newsJson?.description ||
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="twitter:description"]').attr("content") ||
    $('meta[name="description"]').attr("content") ||
    $("article p").filter((_, p) => cleanText($(p).text()).length >= 60).first().text()
  );

  const publishedAt = cleanText(
    newsJson?.datePublished ||
    $('meta[property="article:published_time"]').attr("content") ||
    $("time").first().attr("datetime") ||
    ""
  );

  const hasArticleSignal = Boolean(newsJson || $("article").length || $('meta[property="article:published_time"]').length);
  if (!hasArticleSignal || title.length < 20 || description.length < 40) return null;

  return {
    ...candidate,
    title,
    description,
    publishedAt
  };
}
