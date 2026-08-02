import fs from "node:fs/promises";
import path from "node:path";

const statePath = path.resolve("data/seen.json");

export async function loadState() {
  try {
    const parsed = JSON.parse(await fs.readFile(statePath, "utf8"));
    return {
      initialized: Boolean(parsed.initialized),
      seenUrls: Array.isArray(parsed.seenUrls) ? parsed.seenUrls : [],
      seenTexts: Array.isArray(parsed.seenTexts) ? parsed.seenTexts : []
    };
  } catch {
    return { initialized: false, seenUrls: [], seenTexts: [] };
  }
}

export async function saveState(state) {
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  const compact = {
    initialized: Boolean(state.initialized),
    seenUrls: [...new Set(state.seenUrls)].slice(-5000),
    seenTexts: [...new Set(state.seenTexts)].slice(-5000)
  };
  await fs.writeFile(statePath, `${JSON.stringify(compact, null, 2)}\n`, "utf8");
}
