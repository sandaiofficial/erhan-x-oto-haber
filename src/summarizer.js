const CLICKBAIT_PATTERNS = [
  /\bişte\s+(?:o\s+)?(?:anlar|detaylar|ayrıntılar)\b[.!…]*/gi,
  /\bherkes\s+bunu\s+konuşuyor\b[.!…]*/gi,
  /\bgörenler\s+şaşkına\s+döndü\b[.!…]*/gi,
  /\bşoke\s+eden\b/gi,
  /\bson\s+dakika(?:\s+haberi)?\s*[:|\-–—]?\s*/gi
];

function normalize(value) {
  let text = String(value || "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  for (const pattern of CLICKBAIT_PATTERNS) text = text.replace(pattern, " ");

  return text
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function removeSiteSuffix(text) {
  return text
    .replace(/\s+[|–—-]\s+(?:AA|TRT Haber|İHA|DHA|NTV|CNN TÜRK|CNN Türk|Haberler?)\s*$/i, "")
    .trim();
}

function firstUsefulSentence(text) {
  const sentences = text.match(/[^.!?…]+[.!?…]?/g) || [];
  return sentences
    .map(sentence => sentence.trim())
    .find(sentence => sentence.length >= 55) || text;
}

function truncateAtWord(text, maxLength) {
  if (text.length <= maxLength) return text;
  const shortened = text.slice(0, maxLength - 1);
  const lastSpace = shortened.lastIndexOf(" ");
  return `${shortened.slice(0, Math.max(lastSpace, 40)).replace(/[,:;\-–—\s]+$/, "")}…`;
}

function finishSentence(text) {
  if (!text) return "";
  if (/[.!?…]$/.test(text)) return text;
  return `${text}.`;
}

export function isBreakingNews(title) {
  return /\bson\s+dakika\b|\bflaş\b|\bacil\s+gelişme\b/i.test(String(title || ""));
}

export function summarizeArticle(article, options = {}) {
  const includeLink = options.includeLink === true;
  const breaking = isBreakingNews(article.title);
  const prefix = breaking ? "#SONDAKİKA | " : "";
  const linkPart = includeLink ? `\n\n${article.link}` : "";
  const maxBodyLength = 280 - prefix.length - linkPart.length;

  let description = removeSiteSuffix(normalize(article.description));
  const normalizedTitle = removeSiteSuffix(normalize(article.title));

  if (description.toLocaleLowerCase("tr-TR").startsWith(normalizedTitle.toLocaleLowerCase("tr-TR"))) {
    description = description.slice(normalizedTitle.length).replace(/^\s*[:|\-–—]\s*/, "");
  }

  let body = firstUsefulSentence(description);
  if (body.length < 55) body = normalizedTitle;

  body = finishSentence(truncateAtWord(body, Math.min(maxBodyLength, 245)));
  return `${prefix}${body}${linkPart}`.trim();
}

export function normalizedTextKey(text) {
  return String(text || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/#sondakika\s*\|?/gi, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^a-zçğıöşü0-9]+/gi, " ")
    .trim();
}
