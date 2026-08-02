const CLICKBAIT_PATTERNS = [
  /\bişte\s+(?:o\s+)?(?:anlar|detaylar|ayrıntılar)\b[.!…]*/gi,
  /\bherkes\s+bunu\s+konuşuyor\b[.!…]*/gi,
  /\bgörenler\s+şaşkına\s+döndü\b[.!…]*/gi,
  /\bşoke\s+eden\b/gi,
  /\bson\s+dakika(?:\s+haberi)?\s*[:|\-–—]?\s*/gi
];

const HTML_ENTITIES = {
  amp: "&",
  apos: "'",
  quot: '"',
  lt: "<",
  gt: ">",
  nbsp: " "
};

const STOP_WORDS = new Set([
  "bir", "bu", "şu", "ve", "ile", "için", "olan",
  "olarak", "sonra", "önce", "daha", "çok",
  "son", "gelen", "geldi", "etti", "oldu",
  "yapıldı", "açıkladı", "haberi"
]);

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&#(\d+);/g, (_, code) =>
      String.fromCodePoint(Number(code))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(parseInt(code, 16))
    )
    .replace(/&([a-z]+);/gi, (match, name) =>
      HTML_ENTITIES[name.toLowerCase()] ?? match
    );
}

function normalize(value) {
  let text = decodeHtmlEntities(value)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  for (const pattern of CLICKBAIT_PATTERNS) {
    text = text.replace(pattern, " ");
  }

  return text
    .replace(/^\s*[,;:|\-–—]+\s*/, "")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function removeSiteSuffix(text) {
  return text
    .replace(
      /\s+[|–—-]\s+(?:AA|TRT Haber|İHA|DHA|NTV|CNN TÜRK|CNN Türk|Haberler?)\s*$/i,
      ""
    )
    .trim();
}

function splitSentences(text) {
  const protectedText = String(text || "")
    .replace(/(\d)\.(\d)/g, "$1§DECIMAL§$2")
    .replace(/\b([A-ZÇĞİÖŞÜ])\./g, "$1§ABBR§");

  const sentences =
    protectedText.match(/[^.!?…]+(?:[.!?…]+|$)/g) || [];

  return sentences.map(sentence =>
    sentence
      .replace(/§DECIMAL§/g, ".")
      .replace(/§ABBR§/g, ".")
      .trim()
  );
}

function isUsefulSentence(sentence) {
  const text = normalize(sentence);

  if (text.length < 55) return false;
  if (/^[,.;:!?\-–—]/.test(text)) return false;
  if (/^[a-zçğıöşü]/.test(text)) return false;

  if (
    /\b(?:ve|ile|ancak|fakat|çünkü|ise|olan|olarak|için)\s*[.!?…]*$/i.test(
      text
    )
  ) {
    return false;
  }

  if (/\b\d+[.,]?\s*$/.test(text)) return false;

  return true;
}

function firstUsefulSentence(text) {
  return (
    splitSentences(text)
      .map(normalize)
      .find(isUsefulSentence) || ""
  );
}

function truncateAtWord(text, maxLength) {
  if (text.length <= maxLength) return text;

  const shortened = text.slice(0, maxLength - 1);
  const lastSpace = shortened.lastIndexOf(" ");

  return `${shortened
    .slice(0, Math.max(lastSpace, 40))
    .replace(/[,:;\-–—\s]+$/, "")}…`;
}

function finishSentence(text) {
  if (!text) return "";
  if (/[.!?…]$/.test(text)) return text;

  return `${text}.`;
}

export function isBreakingNews(title) {
  return /^\s*(?:son\s+dakika|flaş|acil\s+gelişme)\b/i.test(
    String(title || "")
  );
}

export function summarizeArticle(article, options = {}) {
  const includeLink = options.includeLink === true;
  const breaking = isBreakingNews(article.title);
  const prefix = breaking ? "#SONDAKİKA | " : "";
  const linkPart = includeLink ? `\n\n${article.link}` : "";
  const maxBodyLength = 280 - prefix.length - linkPart.length;

  let description = removeSiteSuffix(
    normalize(article.description)
  );

  const normalizedTitle = removeSiteSuffix(
    normalize(article.title)
  );

  if (
    description
      .toLocaleLowerCase("tr-TR")
      .startsWith(normalizedTitle.toLocaleLowerCase("tr-TR"))
  ) {
    description = description
      .slice(normalizedTitle.length)
      .replace(/^\s*[:|\-–—]\s*/, "");
  }

  let body =
    firstUsefulSentence(description) || normalizedTitle;

  body = normalize(body);

  if (
    !body ||
    body.length < 25 ||
    /^[a-zçğıöşü,.;:!?\-–—]/.test(body)
  ) {
    return "";
  }

  if (/\b\d+[.,]?\s*$/.test(body)) {
    body = normalizedTitle;
  }

  if (!body || body.length < 25) return "";

  body = finishSentence(
    truncateAtWord(body, Math.min(maxBodyLength, 245))
  );

  return `${prefix}${body}${linkPart}`.trim();
}

export function normalizedTextKey(text) {
  return normalize(text)
    .toLocaleLowerCase("tr-TR")
    .replace(/#sondakika\s*\|?/gi, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^a-zçğıöşü0-9]+/gi, " ")
    .trim();
}

export function articleDuplicateKey(article) {
  return normalizedTextKey(article?.title || "")
    .split(" ")
    .filter(word => word.length >= 3 && !STOP_WORDS.has(word))
    .slice(0, 18)
    .join(" ");
}

export function isSimilarNewsKey(left, right) {
  if (!left || !right) return false;
  if (left === right) return true;

  const firstWords = new Set(left.split(" ").filter(Boolean));
  const secondWords = new Set(right.split(" ").filter(Boolean));

  if (firstWords.size < 4 || secondWords.size < 4) {
    return false;
  }

  let commonWords = 0;

  for (const word of firstWords) {
    if (secondWords.has(word)) commonWords += 1;
  }

  return (
    commonWords >= 3 &&
    commonWords / Math.min(firstWords.size, secondWords.size) >= 0.65
  );
}
